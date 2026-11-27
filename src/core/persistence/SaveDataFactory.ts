import { isChallengeIntroMode, type ChallengeIntroMode } from '../models/ChallengeMode';
import { createDefaultGameSettings } from '../settings/SettingsDefaults';
import type {
  PersistedLevelRecord,
  PersistedProgressionData,
  PersistedSettingsData,
  PersistedTutorialData,
  SaveData,
} from './SaveData';
import {
  CURRENT_CAMPAIGN_CATALOG_VERSION,
  CURRENT_SAVE_SCHEMA_VERSION,
  SAVE_GAME_ID,
} from './SaveSchemaVersion';

export const DEFAULT_SAVE_TIMESTAMP = '1970-01-01T00:00:00.000Z';

function normalizeSeenChallengeIntros(
  modes: readonly ChallengeIntroMode[] | undefined,
): readonly ChallengeIntroMode[] {
  if (modes === undefined || modes.length === 0) {
    return Object.freeze([]);
  }
  const unique: ChallengeIntroMode[] = [];
  for (const mode of modes) {
    if (isChallengeIntroMode(mode) && !unique.includes(mode)) {
      unique.push(mode);
    }
  }
  return Object.freeze(unique);
}

export function freezeSaveData(
  data: Omit<SaveData, 'campaignCatalogVersion' | 'seenChallengeIntros'> & {
    readonly campaignCatalogVersion?: string;
    readonly seenChallengeIntros?: readonly ChallengeIntroMode[];
  },
): SaveData {
  const completedLevels: Record<string, PersistedLevelRecord> = {};
  for (const [levelId, record] of Object.entries(data.progression.completedLevels)) {
    completedLevels[levelId] = Object.freeze({
      completionCount: record.completionCount,
      bestMoveCount: record.bestMoveCount,
      bestElapsedMs: record.bestElapsedMs,
      ...(record.bestScore !== undefined ? { bestScore: record.bestScore } : {}),
      ...(record.bestStarRating !== undefined ? { bestStarRating: record.bestStarRating } : {}),
      ...(record.scoringPolicyVersion !== undefined
        ? { scoringPolicyVersion: record.scoringPolicyVersion }
        : {}),
    });
  }

  const progression: PersistedProgressionData = Object.freeze({
    completedLevels: Object.freeze(completedLevels),
    lastPlayedLevelId: data.progression.lastPlayedLevelId,
  });

  const settings: PersistedSettingsData = Object.freeze({
    musicEnabled: data.settings.musicEnabled,
    soundEffectsEnabled: data.settings.soundEffectsEnabled,
    vibrationEnabled: data.settings.vibrationEnabled,
    motionPreference: data.settings.motionPreference,
  });

  const tutorial: PersistedTutorialData = Object.freeze({
    status: data.tutorial.status,
    completed: data.tutorial.status === 'completed',
  });

  return Object.freeze({
    schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
    gameId: SAVE_GAME_ID,
    campaignCatalogVersion: data.campaignCatalogVersion ?? CURRENT_CAMPAIGN_CATALOG_VERSION,
    revision: data.revision,
    updatedAt: data.updatedAt,
    progression,
    settings,
    tutorial,
    seenChallengeIntros: normalizeSeenChallengeIntros(data.seenChallengeIntros),
  });
}

/**
 * Generates a fresh, immutable default SaveData snapshot by delegating to the
 * authoritative domain defaults (SettingsDefaults & empty campaign progression).
 */
export function createDefaultSaveData(options: { readonly updatedAt?: string } = {}): SaveData {
  const defaultSettings = createDefaultGameSettings();
  return freezeSaveData({
    schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
    gameId: SAVE_GAME_ID,
    campaignCatalogVersion: CURRENT_CAMPAIGN_CATALOG_VERSION,
    revision: 0,
    updatedAt: options.updatedAt ?? DEFAULT_SAVE_TIMESTAMP,
    progression: {
      completedLevels: {},
      lastPlayedLevelId: null,
    },
    settings: {
      musicEnabled: defaultSettings.musicEnabled,
      soundEffectsEnabled: defaultSettings.soundEffectsEnabled,
      vibrationEnabled: defaultSettings.vibrationEnabled,
      motionPreference: defaultSettings.motionPreference,
    },
    tutorial: {
      status: 'not_seen',
      completed: false,
    },
    seenChallengeIntros: [],
  });
}
