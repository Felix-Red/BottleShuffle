import type { ChallengeMode } from '../models/ChallengeMode';
import type { DifficultyId } from '../models/Difficulty';
import type { ChapterId, LevelId } from './LevelId';

/**
 * Immutable static metadata describing a campaign chapter.
 * Never stores mutable player completion state; chapter progress is always derived.
 */
export interface ChapterDefinition {
  readonly id: ChapterId;
  readonly displayName: string;
  readonly order: number;
  readonly difficulty: DifficultyId;
  /** Representative bottle count (e.g. starting/featured count) for backward compatibility. */
  readonly bottleCount: number;
  readonly minBottleCount: number;
  readonly maxBottleCount: number;
  readonly challengeMode: ChallengeMode;
  readonly levelIds: readonly LevelId[];
  readonly description?: string;
}

/**
 * Declarative per-level specification inside a ChapterSpec.
 * Enables distinct bottle counts, time limits, move limits, and constraints per level.
 */
export interface LevelSpec {
  readonly bottleCount: number;
  readonly difficulty?: DifficultyId;
  readonly challengeMode?: ChallengeMode;
  readonly timeLimitSeconds?: number | null;
  readonly moveLimit?: number | null;
  readonly minInitialMatches?: number;
  readonly maxInitialMatches?: number;
  readonly minRequiredSwaps?: number;
  readonly seedSalt?: string;
}

/**
 * Declarative specification used to build a chapter and its constituent levels.
 * Supports either an explicit per-level array (`levels`) or uniform chapter generation
 * (`levelCount` + `bottleCount`) for tests and future campaign expansions.
 */
export interface ChapterSpec {
  readonly id: ChapterId;
  readonly displayName: string;
  readonly order: number;
  readonly difficulty: DifficultyId;
  readonly bottleCount: number;
  readonly startLevelNumber: number;
  readonly levelCount: number;
  readonly challengeMode?: ChallengeMode;
  readonly timeLimitSeconds?: number | null;
  readonly moveLimit?: number | null;
  readonly minInitialMatches: number;
  readonly maxInitialMatches: number;
  readonly minRequiredSwaps: number;
  readonly description?: string;
  /** Optional explicit per-level overrides (length must match `levelCount` when supplied). */
  readonly levels?: readonly LevelSpec[];
  /** Optional per-level seed salt overrides resolved during catalogue authoring for guaranteed variety. */
  readonly seedSalts?: Readonly<Record<number, string>>;
}
