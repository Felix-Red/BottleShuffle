import type {
  AttemptResult,
  CampaignAchievementSummary,
  ChapterId,
  EarnedStarRating,
  LevelId,
  PersonalBestComparison,
  ScoredGameplayMode,
} from '../../core';

export type VictoryPrimaryActionKind = 'next_level' | 'new_puzzle' | 'view_levels' | 'replay';

export interface VictoryLevelUnlockInfo {
  readonly levelId: LevelId;
  readonly levelNumber: number;
  readonly label: string;
}

export interface VictoryChapterCompletionInfo {
  readonly chapterId: ChapterId;
  readonly chapterName: string;
  readonly earnedStars: number;
  readonly maxStars: number;
  readonly nextChapterName: string | null;
  readonly nextChapterDifficulty: string | null;
  readonly nextChapterBottleCount: number | null;
}

export interface VictoryCampaignCompletionInfo {
  readonly completedLevels: number;
  readonly totalLevels: number;
  readonly totalEarnedStars: number;
  readonly maxAvailableStars: number;
  readonly totalBestScore: number;
  readonly formattedTotalBestScore: string;
  readonly threeStarCount: number;
  readonly isPerfectCampaign: boolean;
}

export interface VictoryPersonalBestBadge {
  readonly headline: string;
  readonly details: string | null;
}

/**
 * Immutable presentation model for VictoryOverlay.
 * Derived strictly from AttemptResult, PersonalBestComparison, and ProgressionTransitionResult.
 * Contains zero hidden target sequence or debug information.
 */
export interface VictoryViewState {
  readonly mode: ScoredGameplayMode;
  readonly attemptResult: AttemptResult;
  readonly completionLabel: string;
  readonly title: string;
  readonly earnedStars: EarnedStarRating;
  readonly isOptimalSolution: boolean;
  readonly totalScore: number;
  readonly formattedScore: string;
  readonly formattedTime: string;
  readonly formattedEfficiency: string;
  readonly matchedCount: number;
  readonly totalBottles: number;
  readonly actualMoves: number;
  readonly minimumRequiredSwaps: number;
  readonly extraMoves: number;
  readonly personalBestBadge: VictoryPersonalBestBadge | null;
  readonly personalBestComparison: PersonalBestComparison | null;
  readonly unlockedLevel: VictoryLevelUnlockInfo | null;
  readonly chapterCompletion: VictoryChapterCompletionInfo | null;
  readonly campaignCompletion: VictoryCampaignCompletionInfo | null;
  readonly campaignSummary: CampaignAchievementSummary | null;
  readonly primaryActionKind: VictoryPrimaryActionKind;
  readonly primaryActionLabel: string;
  readonly nextLevelId: LevelId | null;
  readonly nextLevelNumber: number | null;
  readonly showLevelsAction: boolean;
  readonly chapterIdForLevels: ChapterId | null;
}
