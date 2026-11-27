import type { LevelId } from '../levels/LevelId';
import type { ChallengeIntroMode } from '../models/ChallengeMode';
import type { EarnedStarRating } from '../models/StarRating';
import type { MotionPreference } from '../settings/MotionPreference';
import type { SaveMetadata } from './SaveMetadata';
import type { CURRENT_SAVE_SCHEMA_VERSION, SAVE_GAME_ID } from './SaveSchemaVersion';

export type PersistedTutorialStatus = 'not_seen' | 'completed' | 'skipped';

/**
 * Compact persisted completion record for a single campaign level.
 * Omits redundant `levelId` (stored as map key) and all derived unlock/percentage fields.
 */
export interface PersistedLevelRecord {
  readonly completionCount: number;
  readonly bestMoveCount: number;
  readonly bestElapsedMs: number;
  readonly bestScore?: number;
  readonly bestStarRating?: EarnedStarRating;
  readonly scoringPolicyVersion?: number;
}

export interface PersistedProgressionData {
  readonly completedLevels: Readonly<Record<LevelId, PersistedLevelRecord>>;
  readonly lastPlayedLevelId: LevelId | null;
}

export interface PersistedSettingsData {
  readonly musicEnabled: boolean;
  readonly soundEffectsEnabled: boolean;
  readonly vibrationEnabled: boolean;
  readonly motionPreference: MotionPreference;
}

export interface PersistedTutorialData {
  readonly status: PersistedTutorialStatus;
  readonly completed: boolean;
}

/**
 * Authoritative versioned JSON-serialisable save snapshot for Bottle Shuffle (Schema v2).
 * Records `campaignCatalogVersion` so completion records are never silently mapped onto
 * materially different campaign levels, and tracks dismissed contextual challenge intros.
 */
export interface SaveData extends SaveMetadata {
  readonly schemaVersion: typeof CURRENT_SAVE_SCHEMA_VERSION;
  readonly gameId: typeof SAVE_GAME_ID;
  readonly campaignCatalogVersion: string;
  readonly revision: number;
  readonly updatedAt: string;
  readonly progression: PersistedProgressionData;
  readonly settings: PersistedSettingsData;
  readonly tutorial: PersistedTutorialData;
  readonly seenChallengeIntros: readonly ChallengeIntroMode[];
}
