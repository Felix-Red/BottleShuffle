import type { ChapterId, DifficultyId } from '../../core';
import type { LevelCardViewState } from './LevelCardViewState';

/**
 * Public presentation model for a campaign chapter derived from LevelCatalog and ProgressionEngine.
 */
export interface ChapterViewState {
  readonly chapterId: ChapterId;
  readonly chapterNumber: number;
  readonly displayName: string;
  readonly description: string;
  readonly difficulty: DifficultyId;
  readonly difficultyDisplayName: string;
  readonly bottleCount: number;
  readonly totalLevels: number;
  readonly completedLevels: number;
  readonly earnedStars: number;
  readonly maxStars: number;
  readonly completionPercentage: number;
  readonly hasPlayableLevels: boolean;
  readonly isLocked: boolean;
  readonly isCompleted: boolean;
  readonly isRecommendedChapter: boolean;
  readonly levelCards: readonly LevelCardViewState[];
}
