import {
  CURRENT_CAMPAIGN_CATALOG_VERSION,
  CURRENT_SAVE_SCHEMA_VERSION,
  freezeSaveData,
  PROGRESSION_SCHEMA_VERSION,
  SAVE_GAME_ID,
  SETTINGS_SCHEMA_VERSION,
  type CompletionRecord,
  type GameSettings,
  type LevelId,
  type PersistedLevelRecord,
  type ProgressionState,
  type SaveData,
} from '../../core';
import type { ProgressionController } from '../../game/progression/ProgressionController';
import type { ChallengeIntroService } from '../ChallengeIntroService';
import type { SettingsService } from '../SettingsService';
import type { TutorialPreferenceService } from '../TutorialPreferenceService';

export interface SaveStateTargets {
  readonly progressionController: ProgressionController;
  readonly settingsService: SettingsService;
  readonly tutorialPreference: TutorialPreferenceService;
  readonly challengeIntroService?: ChallengeIntroService;
}

export interface SaveCaptureMetadata {
  readonly revision: number;
  readonly updatedAt: string;
}

/**
 * Pure application-level boundary converting between live authoritative services
 * and the compact, versioned SaveData schema.
 *
 * - Captures ONLY committed authoritative records (never transient attempts or derived views).
 * - Restores validated records directly without re-calculating scores or replaying first-time events.
 */
export function captureSaveData(
  targets: SaveStateTargets,
  metadata: SaveCaptureMetadata,
): SaveData {
  const progState = targets.progressionController.getState();
  const completedLevels: Record<LevelId, PersistedLevelRecord> = {};

  for (const [levelId, record] of Object.entries(progState.completedLevels)) {
    completedLevels[levelId] = {
      completionCount: record.completionCount,
      bestMoveCount: record.bestMoveCount,
      bestElapsedMs: record.bestElapsedMs,
      ...(record.bestScore !== undefined ? { bestScore: record.bestScore } : {}),
      ...(record.bestStarRating !== undefined ? { bestStarRating: record.bestStarRating } : {}),
      ...(record.scoringPolicyVersion !== undefined
        ? { scoringPolicyVersion: record.scoringPolicyVersion }
        : {}),
    };
  }

  const settings = targets.settingsService.getSettings();
  const tutorialStatus = targets.tutorialPreference.getStatus();

  return freezeSaveData({
    schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
    gameId: SAVE_GAME_ID,
    campaignCatalogVersion: CURRENT_CAMPAIGN_CATALOG_VERSION,
    revision: metadata.revision,
    updatedAt: metadata.updatedAt,
    progression: {
      completedLevels,
      lastPlayedLevelId: progState.lastPlayedLevelId,
    },
    settings: {
      musicEnabled: settings.musicEnabled,
      soundEffectsEnabled: settings.soundEffectsEnabled,
      vibrationEnabled: settings.vibrationEnabled,
      motionPreference: settings.motionPreference,
    },
    tutorial: {
      status: tutorialStatus,
      completed: tutorialStatus === 'completed',
    },
    seenChallengeIntros: targets.challengeIntroService?.getSeenModes() ?? [],
  });
}

/**
 * Restores a validated SaveData snapshot into the shared application services.
 * Computes `selectedLevelId` cleanly via the existing ProgressionEngine rules
 * and never dispatches ordinary first-time completion or milestone events.
 */
export function restoreSaveData(data: SaveData, targets: SaveStateTargets): void {
  const engine = targets.progressionController.getEngine();
  const completedLevels: Record<LevelId, CompletionRecord> = {};

  for (const [levelId, persisted] of Object.entries(data.progression.completedLevels)) {
    completedLevels[levelId] = Object.freeze({
      levelId,
      completionCount: persisted.completionCount,
      bestMoveCount: persisted.bestMoveCount,
      bestElapsedMs: persisted.bestElapsedMs,
      ...(persisted.bestScore !== undefined ? { bestScore: persisted.bestScore } : {}),
      ...(persisted.bestStarRating !== undefined
        ? { bestStarRating: persisted.bestStarRating }
        : {}),
      ...(persisted.scoringPolicyVersion !== undefined
        ? { scoringPolicyVersion: persisted.scoringPolicyVersion }
        : {}),
    });
  }

  const provisionalState: ProgressionState = Object.freeze({
    schemaVersion: PROGRESSION_SCHEMA_VERSION,
    completedLevels: Object.freeze(completedLevels),
    lastPlayedLevelId: data.progression.lastPlayedLevelId,
    selectedLevelId: null,
    recentProcessedAttemptIds: Object.freeze([]),
  });

  const recommended = engine.getRecommendedNextLevel(provisionalState);
  const derivedSelectedLevelId =
    recommended.status === 'available' ? recommended.level.id : recommended.finalLevel.id;

  const restoredProgression: ProgressionState = Object.freeze({
    ...provisionalState,
    selectedLevelId: derivedSelectedLevelId,
  });

  const restoredSettings: GameSettings = Object.freeze({
    musicEnabled: data.settings.musicEnabled,
    soundEffectsEnabled: data.settings.soundEffectsEnabled,
    vibrationEnabled: data.settings.vibrationEnabled,
    motionPreference: data.settings.motionPreference,
    schemaVersion: SETTINGS_SCHEMA_VERSION,
  });

  targets.progressionController.restoreState(restoredProgression);
  targets.settingsService.restoreSettings(restoredSettings);
  targets.tutorialPreference.restoreStatus(data.tutorial.status);
  targets.challengeIntroService?.restoreSeenModes(data.seenChallengeIntros);
}
