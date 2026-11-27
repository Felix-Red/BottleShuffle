import {
  calculateScoreBreakdown,
  calculateStarRating,
  createDefaultSaveData,
  CURRENT_SAVE_SCHEMA_VERSION,
  freezeSaveData,
  getDefaultLevelCatalog,
  SAVE_GAME_ID,
  type PersistedLevelRecord,
  type SaveData,
} from '../../../src/core';

export function createEmptySaveFixture(): SaveData {
  return createDefaultSaveData({ updatedAt: '2026-11-27T10:00:00.000Z' });
}

export function createPartialCampaignSaveFixture(): SaveData {
  return freezeSaveData({
    schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
    gameId: SAVE_GAME_ID,
    revision: 5,
    updatedAt: '2026-11-27T10:00:00.000Z',
    progression: {
      completedLevels: {
        'level-001': {
          completionCount: 2,
          bestMoveCount: 2,
          bestElapsedMs: 14200,
          bestScore: 1000,
          bestStarRating: 3,
          scoringPolicyVersion: 1,
        },
        'level-002': {
          completionCount: 1,
          bestMoveCount: 4,
          bestElapsedMs: 24800,
          bestScore: 860,
          bestStarRating: 2,
          scoringPolicyVersion: 1,
        },
      },
      lastPlayedLevelId: 'level-002',
    },
    settings: {
      musicEnabled: false,
      soundEffectsEnabled: true,
      vibrationEnabled: false,
      motionPreference: 'reduced',
    },
    tutorial: {
      status: 'completed',
      completed: true,
    },
  });
}

export function createFull50LevelCampaignSaveFixture(): SaveData {
  const catalog = getDefaultLevelCatalog();
  const completedLevels: Record<string, PersistedLevelRecord> = {};

  for (const level of catalog.getAllLevels()) {
    const minSwaps = Math.max(2, level.bottleCount - 2);
    const extraMoves = level.levelNumber % 3 === 0 ? 1 : 0;
    const moves = minSwaps + extraMoves;
    const breakdown = calculateScoreBreakdown({
      difficulty: level.difficulty,
      actualMoves: moves,
      minimumRequiredSwaps: minSwaps,
    });
    const stars = calculateStarRating(minSwaps, moves);

    completedLevels[level.id] = {
      completionCount: 1 + (level.levelNumber % 4),
      bestMoveCount: moves,
      bestElapsedMs: 12000 + level.levelNumber * 1250,
      bestScore: breakdown.totalScore,
      bestStarRating: stars,
      scoringPolicyVersion: breakdown.scoringPolicyVersion,
    };
  }

  return freezeSaveData({
    schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
    gameId: SAVE_GAME_ID,
    revision: 75,
    updatedAt: '2026-11-27T12:00:00.000Z',
    progression: {
      completedLevels,
      lastPlayedLevelId: catalog.getFinalLevel().id,
    },
    settings: {
      musicEnabled: true,
      soundEffectsEnabled: true,
      vibrationEnabled: false,
      motionPreference: 'system',
    },
    tutorial: {
      status: 'completed',
      completed: true,
    },
  });
}
