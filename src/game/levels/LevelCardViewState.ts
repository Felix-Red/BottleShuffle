import type { EarnedStarRating, LevelId, LevelStatus } from '../../core';

/**
 * Public presentation model for a single campaign level card.
 * Intentionally excludes hidden target sequences, seeds, swap distances, and debug data.
 */
export interface LevelCardViewState {
  readonly levelId: LevelId;
  readonly levelNumber: number;
  readonly status: LevelStatus;
  readonly isPlayable: boolean;
  readonly isRecommended: boolean;
  readonly isSelected: boolean;
  readonly isFocused: boolean;
  readonly completionCount: number;
  readonly bestMoveCount: number | null;
  readonly bestElapsedMs: number | null;
  readonly bestStarRating: EarnedStarRating | null;
  readonly bestScore: number | null;
  readonly prerequisiteLevelNumber: number | null;
  readonly shouldAnimateUnlock: boolean;
}
