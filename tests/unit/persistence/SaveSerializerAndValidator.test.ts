import { describe, expect, it } from 'vitest';
import { PERSISTENCE_CONFIG } from '../../../src/config/PersistenceConfig';
import {
  CURRENT_SAVE_SCHEMA_VERSION,
  getDefaultLevelCatalog,
  isValidSaveData,
  SAVE_GAME_ID,
  validateSaveData,
} from '../../../src/core';
import {
  computeSaveContentSignature,
  measureUtf8ByteSize,
  parseRawSaveJson,
  serializeSaveData,
} from '../../../src/services/persistence/SaveSerializer';
import {
  createEmptySaveFixture,
  createFull50LevelCampaignSaveFixture,
  createPartialCampaignSaveFixture,
} from '../../fixtures/saves/saveFixtures';

describe('SaveSerializer', () => {
  it('round-trips valid save data compactly without transient fields and within size budget', () => {
    const emptySave = createEmptySaveFixture();
    const emptyJson = serializeSaveData(emptySave);
    const emptyBytes = measureUtf8ByteSize(emptyJson);
    expect(emptyBytes).toBeGreaterThan(0);
    expect(emptyBytes).toBeLessThan(512);

    const parsedEmpty = parseRawSaveJson(emptyJson);
    expect(parsedEmpty.ok).toBe(true);
    if (parsedEmpty.ok) {
      const validated = validateSaveData(parsedEmpty.value);
      expect(validated.disposition).toBe('valid');
      expect(validated.data).toEqual(emptySave);
    }

    const fullSave = createFull50LevelCampaignSaveFixture();
    const fullJson = serializeSaveData(fullSave);
    const fullBytes = measureUtf8ByteSize(fullJson);
    expect(fullBytes).toBeLessThan(PERSISTENCE_CONFIG.sizeTargetBytes);
    expect(fullJson.includes('targetSequence')).toBe(false);
    expect(fullJson.includes('recentProcessedAttemptIds')).toBe(false);

    const parsedFull = parseRawSaveJson(fullJson);
    expect(parsedFull.ok).toBe(true);
    if (parsedFull.ok) {
      expect(isValidSaveData(parsedFull.value)).toBe(true);
    }
  });

  it('rejects malformed JSON, non-object roots, and unsafe prototype-polluting keys', () => {
    expect(parseRawSaveJson('').ok).toBe(false);
    expect(parseRawSaveJson('{invalid').ok).toBe(false);
    expect(parseRawSaveJson('[1, 2, 3]').ok).toBe(false);
    expect(parseRawSaveJson('"plain-string"').ok).toBe(false);
    expect(parseRawSaveJson('42').ok).toBe(false);
    expect(parseRawSaveJson('null').ok).toBe(false);

    const polluted = '{"__proto__":{"admin":true},"schemaVersion":1}';
    const res = parseRawSaveJson(polluted);
    expect(res.ok).toBe(false);
  });

  it('computes identical content signatures regardless of revision or timestamp', () => {
    const base = createPartialCampaignSaveFixture();
    const later = {
      ...base,
      revision: base.revision + 5,
      updatedAt: '2026-12-01T00:00:00.000Z',
    };
    expect(computeSaveContentSignature(base)).toBe(computeSaveContentSignature(later));
  });
});

describe('SaveDataValidator', () => {
  const catalog = getDefaultLevelCatalog();

  it('accepts valid default and fully completed 50-level campaign saves', () => {
    expect(validateSaveData(createEmptySaveFixture(), catalog).disposition).toBe('valid');
    expect(validateSaveData(createFull50LevelCampaignSaveFixture(), catalog).disposition).toBe(
      'valid',
    );
  });

  it('detects unsupported future schemas without marking them corrupted', () => {
    const future = {
      ...createEmptySaveFixture(),
      schemaVersion: CURRENT_SAVE_SCHEMA_VERSION + 2,
    };
    const res = validateSaveData(future, catalog);
    expect(res.valid).toBe(false);
    expect(res.disposition).toBe('unsupported_future_version');
    expect(res.detectedSchemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION + 2);
    expect(res.data).toBeNull();
  });

  it('rejects wrong gameId, invalid schemaVersion, and unsafe nested keys as corrupted', () => {
    expect(
      validateSaveData({ ...createEmptySaveFixture(), gameId: 'other-game' }, catalog).disposition,
    ).toBe('corrupted');
    expect(
      validateSaveData({ ...createEmptySaveFixture(), schemaVersion: 0 }, catalog).disposition,
    ).toBe('corrupted');
    expect(
      validateSaveData(
        {
          schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
          gameId: SAVE_GAME_ID,
          progression: { completedLevels: { constructor: {} } },
        },
        catalog,
      ).disposition,
    ).toBe('corrupted');
  });

  it('recovers independently valid sections while dropping invalid level records and repairing bad settings', () => {
    const partial = {
      schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
      gameId: SAVE_GAME_ID,
      revision: 3,
      updatedAt: '2026-11-27T10:00:00.000Z',
      progression: {
        completedLevels: {
          'level-001': {
            completionCount: 1,
            bestMoveCount: 2,
            bestElapsedMs: 12000,
            bestScore: 1000,
            bestStarRating: 3,
          },
          'level-999': {
            completionCount: 1,
            bestMoveCount: 2,
            bestElapsedMs: 5000,
          },
          // Orphan record missing level-002 prerequisite
          'level-003': {
            completionCount: 1,
            bestMoveCount: 3,
            bestElapsedMs: 9000,
            bestStarRating: 2,
          },
        },
        lastPlayedLevelId: 'level-999',
      },
      settings: {
        musicEnabled: 'not-a-bool',
        soundEffectsEnabled: false,
        vibrationEnabled: false,
        motionPreference: 'invalid',
      },
      tutorial: {
        status: 'completed',
        completed: false, // inconsistent flag -> aligned with status
      },
    };

    const res = validateSaveData(partial, catalog);
    expect(res.disposition).toBe('repaired');
    expect(res.data).not.toBeNull();
    expect(Object.keys(res.data?.progression.completedLevels ?? {})).toEqual(['level-001']);
    expect(res.data?.progression.lastPlayedLevelId).toBeNull();
    expect(res.data?.settings.musicEnabled).toBe(true); // defaulted
    expect(res.data?.settings.soundEffectsEnabled).toBe(false); // preserved!
    expect(res.data?.settings.motionPreference).toBe('system'); // defaulted
    expect(res.data?.tutorial).toEqual({ status: 'completed', completed: true });
    expect(res.repairs.length).toBeGreaterThanOrEqual(4);
  });

  it('drops individual completion records with invalid counts, stars, scores, moves, or times', () => {
    const candidate = {
      ...createEmptySaveFixture(),
      progression: {
        completedLevels: {
          'level-001': {
            completionCount: 0, // invalid
            bestMoveCount: 2,
            bestElapsedMs: 1000,
          },
          'level-002': {
            completionCount: 1,
            bestMoveCount: 0, // invalid
            bestElapsedMs: 1000,
          },
          'level-003': {
            completionCount: 1,
            bestMoveCount: 2,
            bestElapsedMs: -50, // invalid
          },
          'level-004': {
            completionCount: 1,
            bestMoveCount: 2,
            bestElapsedMs: 1000,
            bestStarRating: 5, // invalid
          },
          'level-005': {
            completionCount: 1,
            bestMoveCount: 2,
            bestElapsedMs: 1000,
            bestScore: 0, // invalid
          },
        },
        lastPlayedLevelId: null,
      },
    };

    const res = validateSaveData(candidate, catalog);
    expect(res.disposition).toBe('repaired');
    expect(Object.keys(res.data?.progression.completedLevels ?? {})).toHaveLength(0);
  });
});
