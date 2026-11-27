import type { ChapterDefinition } from '../levels/ChapterDefinition';
import type { LevelDefinition } from '../levels/LevelDefinition';
import type { ChapterId, LevelId } from '../levels/LevelId';
import type { CompletionRecord } from './CompletionRecord';
import type { LevelStatus } from './LevelStatus';

export const PROGRESSION_SCHEMA_VERSION = 1;

/**
 * Bounded deduplication buffer capacity for processed campaign attempt IDs.
 * Prevents duplicate completion processing without unbounded historical growth.
 */
export const MAX_RECENT_ATTEMPT_IDS = 32;

/**
 * Immutable, JSON-serialisable player progression state.
 * Stores only minimal records required to reconstruct all unlocked/chapter/campaign views.
 * Never contains Phaser objects, callbacks, or static LevelCatalog data.
 */
export interface ProgressionState {
  readonly schemaVersion: number;
  readonly completedLevels: Readonly<Record<LevelId, CompletionRecord>>;
  readonly lastPlayedLevelId: LevelId | null;
  readonly selectedLevelId: LevelId | null;
  readonly recentProcessedAttemptIds: readonly string[];
}

export interface LevelProgressView {
  readonly level: LevelDefinition;
  readonly status: LevelStatus;
  readonly record: CompletionRecord | null;
}

export interface ChapterProgress {
  readonly chapter: ChapterDefinition;
  readonly chapterId: ChapterId;
  readonly totalLevels: number;
  readonly completedLevels: number;
  readonly unlockedLevels: number;
  readonly completionPercentage: number;
  readonly isComplete: boolean;
  readonly hasPlayableLevel: boolean;
}

export type RecommendedNextLevel =
  | { readonly status: 'available'; readonly level: LevelDefinition }
  | { readonly status: 'campaign_completed'; readonly finalLevel: LevelDefinition };

export interface CampaignProgress {
  readonly totalLevels: number;
  readonly completedLevels: number;
  readonly remainingLevels: number;
  readonly completionPercentage: number;
  readonly recommendedNextLevel: RecommendedNextLevel;
  readonly isComplete: boolean;
}
