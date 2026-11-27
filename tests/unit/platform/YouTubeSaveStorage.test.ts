import { describe, expect, it } from 'vitest';
import { SaveError } from '../../../src/core';
import { GlobalYouTubeSdkClient } from '../../../src/platform/youtube/YouTubeSdkClient';
import {
  isWellFormedUtf16,
  YouTubeSaveStorage,
} from '../../../src/platform/youtube/YouTubeSaveStorage';
import { createMockSdkError, MockYouTubeSdk } from '../../helpers/MockYouTubeSdk';

describe('YouTubeSaveStorage cloud persistence & load-before-save protection', () => {
  it('blocks saveData completely until loadData succeeds', async () => {
    const mock = new MockYouTubeSdk({ initialCloudData: '{"existing":true}' });
    const storage = new YouTubeSaveStorage(new GlobalYouTubeSdkClient(() => mock.asSdk()));

    expect(storage.getLoadState()).toBe('not_initialised');
    await expect(storage.save('{"new":true}')).rejects.toThrow(SaveError);
    expect(mock.saveDataCalls).toBe(0);
    expect(mock.cloudData).toBe('{"existing":true}');

    // Failed load keeps saveData blocked
    mock.setNextLoadError(createMockSdkError('API_UNAVAILABLE', 'Offline'));
    await expect(storage.load()).rejects.toMatchObject({ code: 'STORAGE_UNAVAILABLE' });
    expect(storage.getLoadState()).toBe('load_failed');

    await expect(storage.save('{"overwrite":true}')).rejects.toThrow(SaveError);
    expect(mock.saveDataCalls).toBe(0);
    expect(mock.cloudData).toBe('{"existing":true}');

    // Subsequent successful load unlocks saving
    const loaded = await storage.load();
    expect(loaded).toBe('{"existing":true}');
    expect(storage.getLoadState()).toBe('loaded');

    await storage.save('{"updated":true}');
    expect(mock.saveDataCalls).toBe(1);
    expect(mock.cloudData).toBe('{"updated":true}');
  });

  it('treats official empty-string cloud response as missing save (null) while allowing future saves', async () => {
    const mock = new MockYouTubeSdk({ initialCloudData: '' });
    const storage = new YouTubeSaveStorage(new GlobalYouTubeSdkClient(() => mock.asSdk()));

    const loaded = await storage.load();
    expect(loaded).toBeNull();
    expect(storage.getLoadState()).toBe('loaded');

    await storage.save('{"schemaVersion":1}');
    expect(mock.saveDataCalls).toBe(1);
  });

  it('rejects malformed UTF-16 strings and >3 MiB payloads before calling the SDK', async () => {
    const mock = new MockYouTubeSdk({ initialCloudData: '' });
    const storage = new YouTubeSaveStorage(new GlobalYouTubeSdkClient(() => mock.asSdk()), {
      maxPayloadBytes: 1024,
    });
    await storage.load();

    // Lone high surrogate (ill-formed UTF-16)
    const loneSurrogate = `{"bad":"${String.fromCharCode(0xd800)}"}`;
    expect(isWellFormedUtf16(loneSurrogate)).toBe(false);
    await expect(storage.save(loneSurrogate)).rejects.toMatchObject({
      code: 'SERIALIZATION_FAILED',
    });
    expect(mock.saveDataCalls).toBe(0);

    // Oversized UTF-16 string (600 chars = 1200 UTF-16 bytes > 1024 limit)
    const oversized = 'a'.repeat(600);
    await expect(storage.save(oversized)).rejects.toMatchObject({
      code: 'STORAGE_QUOTA_EXCEEDED',
    });
    expect(mock.saveDataCalls).toBe(0);
  });

  it('maps SDK save errors (SIZE_LIMIT_EXCEEDED, INVALID_PARAMS, API_UNAVAILABLE, unpopulated rejection) cleanly', async () => {
    const mock = new MockYouTubeSdk({ initialCloudData: '' });
    const storage = new YouTubeSaveStorage(new GlobalYouTubeSdkClient(() => mock.asSdk()));
    await storage.load();

    mock.setNextSaveError(createMockSdkError('SIZE_LIMIT_EXCEEDED', 'Too large'));
    await expect(storage.save('{"a":1}')).rejects.toMatchObject({
      code: 'STORAGE_QUOTA_EXCEEDED',
    });

    mock.setNextSaveError(createMockSdkError('INVALID_PARAMS', 'Invalid'));
    await expect(storage.save('{"a":1}')).rejects.toMatchObject({
      code: 'SERIALIZATION_FAILED',
    });

    mock.setNextSaveError(createMockSdkError('API_UNAVAILABLE', 'Down'));
    await expect(storage.save('{"a":1}')).rejects.toMatchObject({
      code: 'STORAGE_UNAVAILABLE',
    });

    mock.setNextLoadRawError(null);
    await expect(storage.load()).rejects.toMatchObject({
      code: 'STORAGE_READ_FAILED',
    });
  });

  it('never touches browser localStorage in YouTube mode', async () => {
    const mock = new MockYouTubeSdk({ initialCloudData: '' });
    const storage = new YouTubeSaveStorage(new GlobalYouTubeSdkClient(() => mock.asSdk()));

    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('localStorage MUST NOT be accessed in YouTube mode');
      },
    });

    try {
      expect(await storage.load()).toBeNull();
      await storage.save('{"cloudOnly":true}');
      expect(mock.cloudData).toBe('{"cloudOnly":true}');
    } finally {
      if (original !== undefined) {
        Object.defineProperty(globalThis, 'localStorage', original);
      } else {
        delete (globalThis as { localStorage?: unknown }).localStorage;
      }
    }
  });
});
