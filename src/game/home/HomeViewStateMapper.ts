import {
  MAX_STARS_PER_LEVEL,
  type CampaignAchievementSummary,
  type CampaignProgress,
  type LevelCatalog,
} from '../../core';
import { HOME_CONFIG } from '../../config/HomeConfig';
import type {
  HomeFocusTarget,
  HomeOverlayMode,
  HomePlayerStatus,
  HomePrimaryActionKind,
  HomeViewState,
} from './HomeViewState';

export interface MapHomeViewStateOptions {
  readonly campaignProgress: CampaignProgress;
  readonly campaignAchievementSummary?: CampaignAchievementSummary;
  readonly catalog: LevelCatalog;
  readonly canNavigate: boolean;
  readonly overlayMode?: HomeOverlayMode;
  readonly focusedControl?: HomeFocusTarget | null;
  readonly errorMessage?: string | null;
}

/**
 * Pure mapper converting authoritative CampaignProgress, CampaignAchievementSummary, and LevelCatalog
 * into the presentation-ready HomeViewState without hardcoding level counts or chapter names.
 */
export function mapHomeViewState(options: MapHomeViewStateOptions): HomeViewState {
  const { campaignProgress, campaignAchievementSummary, catalog, canNavigate } = options;
  const overlayMode = options.overlayMode ?? 'none';
  const focusedControl = options.focusedControl ?? null;
  const errorMessage = options.errorMessage ?? null;

  const isCampaignComplete = campaignProgress.isComplete;
  const completedCount = campaignProgress.completedLevels;
  const totalCount = campaignProgress.totalLevels;
  const totalEarnedStars = campaignAchievementSummary?.totalEarnedStars ?? 0;
  const maxAvailableStars =
    campaignAchievementSummary?.maxAvailableStars ?? totalCount * MAX_STARS_PER_LEVEL;
  const totalBestScore = campaignAchievementSummary?.totalBestScore ?? 0;

  let playerStatus: HomePlayerStatus;
  let primaryActionLabel: string;
  let primarySupportingText: string;
  let primaryActionKind: HomePrimaryActionKind;
  let recommendedLevelId: string | null = null;
  let recommendedLevelNumber: number | null = null;
  let recommendedChapterName: string;
  let recommendedChapterOrder: number | null = null;

  if (isCampaignComplete || campaignProgress.recommendedNextLevel.status === 'campaign_completed') {
    playerStatus = 'completed';
    primaryActionLabel = HOME_CONFIG.copy.playAgainLabel;
    primarySupportingText = HOME_CONFIG.copy.chooseLevelSupport;
    primaryActionKind = 'open_levels';
    recommendedChapterName = HOME_CONFIG.copy.campaignCompletedLabel;
  } else {
    const recommendedLevel = campaignProgress.recommendedNextLevel.level;
    const chapter = catalog.getChapterById(recommendedLevel.chapterId);

    recommendedLevelId = recommendedLevel.id;
    recommendedLevelNumber = recommendedLevel.levelNumber;
    recommendedChapterName = chapter?.displayName ?? recommendedLevel.chapterId;
    recommendedChapterOrder = chapter?.order ?? null;
    primaryActionKind = 'launch_level';
    primarySupportingText = `Level ${String(recommendedLevel.levelNumber)}`;

    if (completedCount === 0) {
      playerStatus = 'new';
      primaryActionLabel = HOME_CONFIG.copy.playLabel;
    } else {
      playerStatus = 'returning';
      primaryActionLabel = HOME_CONFIG.copy.continueLabel;
    }
  }

  return Object.freeze({
    playerStatus,
    primaryActionLabel,
    primarySupportingText,
    primaryActionKind,
    recommendedLevelId,
    recommendedLevelNumber,
    recommendedChapterName,
    recommendedChapterOrder,
    completedLevelCount: completedCount,
    totalLevelCount: totalCount,
    totalEarnedStars,
    maxAvailableStars,
    totalBestScore,
    completionPercentage: campaignProgress.completionPercentage,
    isCampaignComplete,
    canNavigate,
    overlayMode,
    focusedControl,
    errorMessage,
  });
}
