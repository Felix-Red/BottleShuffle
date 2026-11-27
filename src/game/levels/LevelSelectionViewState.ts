import type {
  ChallengeMode,
  ChapterId,
  DifficultyId,
  EarnedStarRating,
  LevelId,
  LevelStatus,
} from '../../core';
import type { ChapterViewState } from './ChapterViewState';
import type { LevelCardViewState } from './LevelCardViewState';

export interface LevelPreviewViewState {
  readonly levelId: LevelId;
  readonly levelNumber: number;
  readonly chapterId: ChapterId;
  readonly chapterNumber: number;
  readonly chapterName: string;
  readonly difficulty: DifficultyId;
  readonly difficultyDisplayName: string;
  readonly bottleCount: number;
  readonly challengeMode: ChallengeMode;
  readonly challengeModeLabel: string;
  readonly timeLimitSeconds: number | null;
  readonly formattedTimeLimit: string | null;
  readonly moveLimit: number | null;
  readonly objectiveSummary: string;
  readonly description: string;
  readonly status: Exclude<LevelStatus, 'locked'>;
  readonly isCompleted: boolean;
  readonly completionCount: number;
  readonly bestMoveCount: number | null;
  readonly bestElapsedMs: number | null;
  readonly bestStarRating: EarnedStarRating | null;
  readonly bestScore: number | null;
  readonly formattedBestScore: string | null;
  readonly formattedBestTime: string | null;
  readonly primaryActionLabel: string;
}

/**
 * Immutable top-level presentation model for LevelSelectionScene.
 * Always derived from authoritative ProgressionController + LevelCatalog state.
 */
export interface LevelSelectionViewState {
  readonly totalCampaignLevels: number;
  readonly completedCampaignLevels: number;
  readonly totalEarnedStars: number;
  readonly maxAvailableStars: number;
  readonly totalBestScore: number;
  readonly campaignCompletionPercentage: number;
  readonly isCampaignComplete: boolean;
  readonly chapters: readonly ChapterViewState[];
  readonly selectedChapterId: ChapterId;
  readonly selectedChapterIndex: number;
  readonly totalChapters: number;
  readonly recommendedLevelId: LevelId | null;
  readonly recommendedLevelNumber: number | null;
  readonly recommendedChapterId: ChapterId;
  readonly canGoPreviousChapter: boolean;
  readonly canGoNextChapter: boolean;
  readonly currentChapter: ChapterViewState;
  readonly levelCards: readonly LevelCardViewState[];
  readonly selectedLevelId: LevelId | null;
  readonly focusedLevelIndex: number | null;
  readonly previewLevel: LevelPreviewViewState | null;
  readonly canNavigate: boolean;
  readonly chapterCompletedBanner: string | null;
  readonly lockedFeedbackMessage: string | null;
  readonly errorMessage: string | null;
}
