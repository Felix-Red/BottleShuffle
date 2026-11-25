import { describe, expect, it, vi } from 'vitest';
import {
  BrowserGamePlatform,
  type StorageLike,
  type VisibilityDocumentLike,
} from '../../src/platform/browser/BrowserGamePlatform';

function createMemoryStorage(): StorageLike {
  const store = new Map<string, string>();
  return {
    getItem(key: string): string | null {
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string): void {
      store.set(key, value);
    },
  };
}

function createFakeVisibilityDocument(initialHidden = false): {
  documentRef: VisibilityDocumentLike;
  setHidden: (hidden: boolean) => void;
  listenerCount: () => number;
} {
  let hidden = initialHidden;
  const listeners = new Set<() => void>();

  const documentRef: VisibilityDocumentLike = {
    get hidden(): boolean {
      return hidden;
    },
    addEventListener(_type: 'visibilitychange', listener: () => void): void {
      listeners.add(listener);
    },
    removeEventListener(_type: 'visibilitychange', listener: () => void): void {
      listeners.delete(listener);
    },
  };

  return {
    documentRef,
    setHidden(nextHidden: boolean): void {
      hidden = nextHidden;
      for (const listener of listeners) {
        listener();
      }
    },
    listenerCount(): number {
      return listeners.size;
    },
  };
}

describe('BrowserGamePlatform', () => {
  it('initializes idempotently and exposes browser metadata', async () => {
    const fakeDoc = createFakeVisibilityDocument();
    const platform = new BrowserGamePlatform({
      storage: createMemoryStorage(),
      documentRef: fakeDoc.documentRef,
    });

    expect(platform.name).toBe('browser');

    await platform.initialize();
    await platform.initialize();

    expect(fakeDoc.listenerCount()).toBe(1);
    platform.notifyFirstFrameReady();
    platform.notifyGameReady();

    platform.dispose();
    expect(fakeDoc.listenerCount()).toBe(0);
  });

  it('persists and retrieves serialized save data via storage', async () => {
    const storage = createMemoryStorage();
    const platform = new BrowserGamePlatform({
      storage,
      storageKey: 'test:bottle-shuffle',
      documentRef: null,
    });

    await platform.initialize();

    expect(await platform.loadData()).toBeNull();

    const payload = JSON.stringify({ level: 3, bestMoves: 7 });
    await platform.saveData(payload);

    expect(await platform.loadData()).toBe(payload);
  });

  it('falls back to in-memory storage when browser storage throws', async () => {
    const failingStorage: StorageLike = {
      getItem(): string | null {
        throw new Error('Storage access denied');
      },
      setItem(): void {
        throw new Error('Quota exceeded');
      },
    };

    const platform = new BrowserGamePlatform({
      storage: failingStorage,
      documentRef: null,
    });

    await platform.initialize();
    await platform.saveData('{"level":1}');

    expect(await platform.loadData()).toBe('{"level":1}');
  });

  it('notifies pause and resume listeners on visibility changes and supports unsubscribe', async () => {
    const fakeDoc = createFakeVisibilityDocument(false);
    const platform = new BrowserGamePlatform({
      storage: null,
      documentRef: fakeDoc.documentRef,
    });

    const onPause = vi.fn();
    const onResume = vi.fn();

    const unsubscribePause = platform.onPause(onPause);
    const unsubscribeResume = platform.onResume(onResume);

    await platform.initialize();

    fakeDoc.setHidden(true);
    expect(onPause).toHaveBeenCalledTimes(1);
    expect(onResume).not.toHaveBeenCalled();

    fakeDoc.setHidden(false);
    expect(onResume).toHaveBeenCalledTimes(1);

    unsubscribePause();
    unsubscribeResume();

    fakeDoc.setHidden(true);
    fakeDoc.setHidden(false);
    expect(onPause).toHaveBeenCalledTimes(1);
    expect(onResume).toHaveBeenCalledTimes(1);

    platform.dispose();
  });

  it('tracks audio preference changes and notifies subscribers only on transitions', () => {
    const platform = new BrowserGamePlatform({
      storage: null,
      documentRef: null,
      initialAudioEnabled: true,
    });

    const onAudioChange = vi.fn();
    const unsubscribe = platform.onAudioEnabledChange(onAudioChange);

    expect(platform.isAudioEnabled()).toBe(true);

    platform.setAudioEnabled(true);
    expect(onAudioChange).not.toHaveBeenCalled();

    platform.setAudioEnabled(false);
    expect(platform.isAudioEnabled()).toBe(false);
    expect(onAudioChange).toHaveBeenCalledWith(false);
    expect(onAudioChange).toHaveBeenCalledTimes(1);

    unsubscribe();
    platform.setAudioEnabled(true);
    expect(onAudioChange).toHaveBeenCalledTimes(1);
  });
});
