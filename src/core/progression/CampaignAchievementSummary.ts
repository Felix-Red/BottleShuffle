import type { ChapterId } from '../levels/LevelId';

/**
 * Aggregate campaign star and score summary derived dynamically from LevelCatalog
 * and ProgressionState. Never hardcodes level or star limits.
 */
export interface CampaignAchievementSummary {
  readonly completedLevels: number;
  readonly totalLevels: number;
  readonly totalEarnedStars: number;
  readonly maxAvailableStars: number;
  readonly totalBestScore: number;
  readonly threeStarCount: number;
  readonly twoStarCount: number;
  readonly oneStarCount: number;
  readonly isCampaignComplete: boolean;
  readonly isPerfectCampaign: boolean;
}

export interface ChapterStarSummary {
  readonly chapterId: ChapterId;
  readonly earnedStars: number;
  readonly maxStars: number;
  readonly totalBestScore: number;
}
