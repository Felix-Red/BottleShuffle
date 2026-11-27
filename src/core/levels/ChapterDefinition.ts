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
  readonly bottleCount: number;
  readonly levelIds: readonly LevelId[];
  readonly description?: string;
}

/**
 * Declarative specification used to build a chapter and its constituent levels.
 * Supports scalable campaign expansion without changing engine or progression rules.
 */
export interface ChapterSpec {
  readonly id: ChapterId;
  readonly displayName: string;
  readonly order: number;
  readonly difficulty: DifficultyId;
  readonly bottleCount: number;
  readonly startLevelNumber: number;
  readonly levelCount: number;
  readonly minInitialMatches: number;
  readonly maxInitialMatches: number;
  readonly minRequiredSwaps: number;
  readonly description?: string;
  /** Optional per-level seed salt overrides resolved during catalogue authoring for guaranteed variety. */
  readonly seedSalts?: Readonly<Record<number, string>>;
}
