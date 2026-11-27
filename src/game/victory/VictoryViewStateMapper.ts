import {
  formatEfficiencyPercentage,
  getDifficultyDefinition,
  type AttemptResult,
  type CampaignAchievementSummary,
  type ChapterId,
  type ChapterStarSummary,
  type LevelCatalog,
  type LevelId,
  type PersonalBestComparison,
  type ProgressionEvent,
} from '../../core';
import { formatScoreNumber, VICTORY_CONFIG } from '../../config/VictoryConfig';
import { formatElapsedTime } from '../../services/GameplayClock';
import type {
  VictoryCampaignCompletionInfo,
  VictoryChapterCompletionInfo,
  VictoryLevelUnlockInfo,
  VictoryPersonalBestBadge,
  VictoryPrimaryActionKind,
  VictoryViewState,
} from './VictoryViewState';

export interface MapVictoryViewStateInput {
  readonly attemptResult: AttemptResult;
  readonly headerTitle: string;
  readonly levelNumber: number | null;
  readonly chapterId: ChapterId | null;
  readonly nextLevelId: LevelId | null;
  readonly nextLevelNumber: number | null;
  readonly progressionEvents: readonly ProgressionEvent[];
  readonly personalBest: PersonalBestComparison | null;
  readonly campaignSummary: CampaignAchievementSummary | null;
  readonly chapterStarSummary: ChapterStarSummary | null;
  readonly catalog: LevelCatalog | null;
}

function buildPersonalBestBadge(
  comparison: PersonalBestComparison | null,
): VictoryPersonalBestBadge | null {
  if (comparison === null) {
    return null;
  }

  if (comparison.isFirstCompletion) {
    return Object.freeze({
      headline: VICTORY_CONFIG.copy.firstCompletionBadge,
      details: null,
    });
  }

  if (!comparison.hasAnyImprovement) {
    return null;
  }

  const improvements: string[] = [];
  if (comparison.improvedStars) {
    improvements.push('Rating');
  }
  if (comparison.improvedScore) {
    improvements.push('Score');
  }
  if (comparison.improvedMoves) {
    improvements.push('Moves');
  }
  if (comparison.improvedTime) {
    improvements.push('Time');
  }

  if (improvements.length === 1) {
    const single = comparison.improvedStars
      ? VICTORY_CONFIG.copy.newBestStarsBadge
      : comparison.improvedScore
        ? VICTORY_CONFIG.copy.newBestScoreBadge
        : comparison.improvedMoves
          ? VICTORY_CONFIG.copy.newBestMovesBadge
          : VICTORY_CONFIG.copy.newBestTimeBadge;
    return Object.freeze({
      headline: single,
      details: null,
    });
  }

  return Object.freeze({
    headline: VICTORY_CONFIG.copy.newPersonalBestBadge,
    details: improvements.join(' · '),
  });
}

/**
 * Pure mapper assembling immutable VictoryViewState from authoritative domain models.
 * Never calculates scores, stars, or unlock eligibility independently.
 */
export function mapVictoryViewState(input: MapVictoryViewStateInput): VictoryViewState {
  const { attemptResult, progressionEvents, personalBest, campaignSummary, catalog } = input;

  const unlockedEvent = progressionEvents.find((e) => e.type === 'LEVEL_UNLOCKED');
  const unlockedLevel: VictoryLevelUnlockInfo | null =
    unlockedEvent?.type === 'LEVEL_UNLOCKED'
      ? Object.freeze({
          levelId: unlockedEvent.levelId,
          levelNumber: unlockedEvent.levelNumber,
          label: `Level ${String(unlockedEvent.levelNumber)} unlocked!`,
        })
      : null;

  const chapterCompletedEvent = progressionEvents.find((e) => e.type === 'CHAPTER_COMPLETED');
  let chapterCompletion: VictoryChapterCompletionInfo | null = null;
  if (chapterCompletedEvent?.type === 'CHAPTER_COMPLETED' && catalog !== null) {
    const chapters = catalog.getAllChapters();
    const idx = chapters.findIndex((c) => c.id === chapterCompletedEvent.chapterId);
    const nextChapter = idx >= 0 && idx + 1 < chapters.length ? chapters[idx + 1] : undefined;
    const nextDiffName =
      nextChapter !== undefined
        ? getDifficultyDefinition(nextChapter.difficulty).displayName
        : null;

    chapterCompletion = Object.freeze({
      chapterId: chapterCompletedEvent.chapterId,
      chapterName: chapterCompletedEvent.chapterName,
      earnedStars: input.chapterStarSummary?.earnedStars ?? 0,
      maxStars: input.chapterStarSummary?.maxStars ?? 0,
      nextChapterName: nextChapter?.displayName ?? null,
      nextChapterDifficulty: nextDiffName,
      nextChapterBottleCount: nextChapter?.bottleCount ?? null,
    });
  }

  const campaignCompletedEvent = progressionEvents.find((e) => e.type === 'CAMPAIGN_COMPLETED');
  const campaignCompletion: VictoryCampaignCompletionInfo | null =
    campaignCompletedEvent?.type === 'CAMPAIGN_COMPLETED' && campaignSummary !== null
      ? Object.freeze({
          completedLevels: campaignSummary.completedLevels,
          totalLevels: campaignSummary.totalLevels,
          totalEarnedStars: campaignSummary.totalEarnedStars,
          maxAvailableStars: campaignSummary.maxAvailableStars,
          totalBestScore: campaignSummary.totalBestScore,
          formattedTotalBestScore: formatScoreNumber(campaignSummary.totalBestScore),
          threeStarCount: campaignSummary.threeStarCount,
          isPerfectCampaign: campaignSummary.isPerfectCampaign,
        })
      : null;

  const isCampaign = attemptResult.mode === 'campaign';
  const completionLabel =
    isCampaign && input.levelNumber !== null
      ? `Level ${String(input.levelNumber)} Complete`
      : `${input.headerTitle} Complete`;

  const title =
    campaignCompletion !== null
      ? VICTORY_CONFIG.copy.campaignMasterTitle
      : VICTORY_CONFIG.titlesByRating[attemptResult.starRating];

  let primaryActionKind: VictoryPrimaryActionKind;
  let primaryActionLabel: string;

  if (!isCampaign) {
    primaryActionKind = 'new_puzzle';
    primaryActionLabel = VICTORY_CONFIG.copy.newPuzzleAction;
  } else if (campaignCompletion !== null || input.nextLevelId === null) {
    primaryActionKind = 'view_levels';
    primaryActionLabel = VICTORY_CONFIG.copy.viewLevelsAction;
  } else {
    primaryActionKind = 'next_level';
    primaryActionLabel =
      input.nextLevelNumber !== null
        ? `${VICTORY_CONFIG.copy.nextLevelAction}: ${String(input.nextLevelNumber)}`
        : VICTORY_CONFIG.copy.nextLevelAction;
  }

  return Object.freeze({
    mode: attemptResult.mode,
    attemptResult,
    completionLabel,
    title,
    earnedStars: attemptResult.starRating,
    isOptimalSolution: attemptResult.isOptimalSolution,
    totalScore: attemptResult.totalScore,
    formattedScore: formatScoreNumber(attemptResult.totalScore),
    formattedTime: formatElapsedTime(attemptResult.elapsedMs),
    formattedEfficiency: formatEfficiencyPercentage(attemptResult.moveEfficiency),
    matchedCount: attemptResult.bottleCount,
    totalBottles: attemptResult.bottleCount,
    actualMoves: attemptResult.actualMoves,
    minimumRequiredSwaps: attemptResult.minimumRequiredSwaps,
    extraMoves: attemptResult.extraMoves,
    personalBestBadge: isCampaign ? buildPersonalBestBadge(personalBest) : null,
    personalBestComparison: personalBest,
    unlockedLevel,
    chapterCompletion,
    campaignCompletion,
    campaignSummary,
    primaryActionKind,
    primaryActionLabel,
    nextLevelId: input.nextLevelId,
    nextLevelNumber: input.nextLevelNumber,
    showLevelsAction: isCampaign && primaryActionKind !== 'view_levels',
    chapterIdForLevels: input.chapterId,
  });
}
