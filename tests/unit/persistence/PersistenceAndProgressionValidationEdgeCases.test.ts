import { describe, expect, it } from 'vitest';
import {
  createDefaultSaveData,
  getDefaultLevelCatalog,
  PROGRESSION_SCHEMA_VERSION,
  validateCompletionInput,
  validateProgressionState,
} from '../../../src/core';
import { BrowserSaveStorage } from '../../../src/platform/browser/BrowserSaveStorage';
import { YouTubeSaveStorage } from '../../../src/platform/youtube/YouTubeSaveStorage';
import { GlobalYouTubeSdkClient } from '../../../src/platform/youtube/YouTubeSdkClient';
import {
  computeSaveContentSignature,
  measureUtf8ByteSize,
  parseRawSaveJson,
  serializeSaveData,
} from '../../../src/services/persistence/SaveSerializer';
import { MockYouTubeSdk } from '../../helpers/MockYouTubeSdk';

describe('Persistence serializer, storage, and progression validator edge cases (Task 19)', () => {
  it('handles SaveSerializer malformed JSON, non-object JSON, prohibited keys, size measurement, and revision-agnostic content signatures', () => {
    expect(parseRawSaveJson('{invalid').ok).toBe(false);
    expect(parseRawSaveJson('').ok).toBe(false);
    expect(parseRawSaveJson('[1,2,3]').ok).toBe(false);
    expect(parseRawSaveJson('{"__proto__":{"polluted":true}}').ok).toBe(false);

    const parsed = parseRawSaveJson('{"ok":true}');
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value).toEqual({ ok: true });
    }

    const d1 = createDefaultSaveData({ updatedAt: '2026-11-27T10:00:00.000Z' });
    const d2 = { ...d1, revision: 99, updatedAt: '2027-01-01T00:00:00.000Z' };

    expect(computeSaveContentSignature(d1)).toBe(computeSaveContentSignature(d2));
    const json = serializeSaveData(d1);
    expect(measureUtf8ByteSize(json)).toBeGreaterThan(200);
  });

  it('rejects invalid progression completion inputs and malformed progression states cleanly', () => {
    const catalog = getDefaultLevelCatalog();
    const alwaysPlayable = (): boolean => true;

    expect(
      validateCompletionInput(
        {
          attemptId: '   ',
          levelId: 'level-001',
          moveCount: 2,
          elapsedMs: 1000,
          score: 1000,
          starRating: 3,
          scoringPolicyVersion: 1,
        },
        catalog,
        alwaysPlayable,
        [],
      ),
    ).toBe('INVALID_ATTEMPT_ID');

    expect(
      validateCompletionInput(
        {
          attemptId: 'att-1',
          levelId: 'level-999',
          moveCount: 2,
          elapsedMs: 1000,
          score: 1000,
          starRating: 3,
          scoringPolicyVersion: 1,
        },
        catalog,
        alwaysPlayable,
        [],
      ),
    ).toBe('UNKNOWN_LEVEL');

    expect(
      validateCompletionInput(
        {
          attemptId: 'att-1',
          levelId: 'level-001',
          moveCount: 2,
          elapsedMs: 1000,
          score: 1000,
          starRating: 3,
          scoringPolicyVersion: 1,
        },
        catalog,
        () => false,
        [],
      ),
    ).toBe('LEVEL_LOCKED');

    expect(
      validateCompletionInput(
        {
          attemptId: 'att-1',
          levelId: 'level-001',
          moveCount: 0,
          elapsedMs: 1000,
          score: 1000,
          starRating: 3,
          scoringPolicyVersion: 1,
        },
        catalog,
        alwaysPlayable,
        [],
      ),
    ).toBe('INVALID_MOVE_COUNT');

    expect(
      validateCompletionInput(
        {
          attemptId: 'att-1',
          levelId: 'level-001',
          moveCount: 2,
          elapsedMs: -5,
          score: 1000,
          starRating: 3,
          scoringPolicyVersion: 1,
        },
        catalog,
        alwaysPlayable,
        [],
      ),
    ).toBe('INVALID_ELAPSED_TIME');

    expect(
      validateCompletionInput(
        {
          attemptId: 'att-1',
          levelId: 'level-001',
          moveCount: 2,
          elapsedMs: 1000,
          score: -10,
          starRating: 3,
          scoringPolicyVersion: 1,
        },
        catalog,
        alwaysPlayable,
        [],
      ),
    ).toBe('INVALID_SCORE');

    expect(
      validateCompletionInput(
        {
          attemptId: 'att-1',
          levelId: 'level-001',
          moveCount: 2,
          elapsedMs: 1000,
          score: 1000,
          starRating: 3,
          scoringPolicyVersion: 1,
        },
        catalog,
        alwaysPlayable,
        ['att-1'],
      ),
    ).toBe('DUPLICATE_ATTEMPT');

    const invalidState = validateProgressionState(
      {
        schemaVersion: PROGRESSION_SCHEMA_VERSION + 99,
        completedLevels: {
          'level-999': {
            levelId: 'level-999',
            completionCount: 0,
            bestMoveCount: 0,
            bestElapsedMs: -1,
            bestScore: -5,
            bestStarRating: 3,
            scoringPolicyVersion: 1,
          },
        },
        lastPlayedLevelId: 'level-999',
        selectedLevelId: 'level-999',
        recentProcessedAttemptIds: [''],
      },
      catalog,
    );
    expect(invalidState.valid).toBe(false);
    expect(invalidState.errors.length).toBeGreaterThanOrEqual(3);
  });

  it('handles BrowserSaveStorage quota failures, unavailability, remove, and disposal safely', async () => {
    const throwingStorage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        const err = new Error('QuotaExceededError');
        err.name = 'QuotaExceededError';
        throw err;
      },
      removeItem: () => {
        throw new Error('SecurityError');
      },
    };

    const unavailable = new BrowserSaveStorage({ storage: throwingStorage, windowRef: null });
    expect(unavailable.isAvailable()).toBe(false);
    await expect(unavailable.load()).rejects.toThrow();
    await expect(unavailable.save('{}')).rejects.toThrow();
    await expect(unavailable.remove()).rejects.toThrow();
    unavailable.dispose();

    const map = new Map<string, string>();
    const working = new BrowserSaveStorage({
      storage: {
        getItem: (k) => map.get(k) ?? null,
        setItem: (k, v) => {
          map.set(k, v);
        },
        removeItem: (k) => {
          map.delete(k);
        },
      },
      windowRef: null,
    });
    expect(working.isAvailable()).toBe(true);
    await working.save('{"v":1}');
    expect(await working.load()).toBe('{"v":1}');
    await working.remove();
    expect(await working.load()).toBeNull();
    working.dispose();
  });

  it('handles YouTubeSaveStorage save, disposal, and post-disposal read/write guards safely', async () => {
    const sdk = new MockYouTubeSdk({ initialCloudData: '{"saved":true}' });
    const storage = new YouTubeSaveStorage(new GlobalYouTubeSdkClient(() => sdk.asSdk()));

    expect(await storage.load()).toBe('{"saved":true}');
    await storage.save('{"updated":true}');
    expect(sdk.cloudData).toBe('{"updated":true}');

    storage.dispose();
    expect(storage.isAvailable()).toBe(false);
    await expect(storage.load()).rejects.toThrow();
    await expect(storage.save('{}')).rejects.toThrow();
  });
});
