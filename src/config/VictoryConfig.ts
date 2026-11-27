import type { EarnedStarRating } from '../core';

export const VICTORY_CONFIG = {
  titlesByRating: Object.freeze<Record<EarnedStarRating, string>>({
    3: 'Perfect Shuffle!',
    2: 'Great Shuffle!',
    1: 'Puzzle Solved!',
  }),
  copy: {
    optimalBadge: 'Optimal Solution',
    campaignMasterTitle: 'Shuffle Master!',
    perfectCampaignBadge: 'Perfect Campaign',
    campaignCompleteMessage: 'You solved every campaign puzzle in Bottle Shuffle!',
    firstCompletionBadge: 'First Completion',
    newBestScoreBadge: 'New Best Score',
    newBestStarsBadge: 'New Best Rating',
    newBestMovesBadge: 'New Best Moves',
    newBestTimeBadge: 'New Best Time',
    newPersonalBestBadge: 'New Personal Best!',
    chapterCompleteHeading: 'CHAPTER COMPLETE',
    nextLevelAction: 'Next Level',
    newPuzzleAction: 'New Puzzle',
    viewLevelsAction: 'View Levels',
    replayAction: 'Replay',
    levelsAction: 'Levels',
    homeAction: 'Home',
  },
  motion: {
    starStaggerMs: 170,
    starRevealDurationMs: 260,
    scoreCountDurationMs: 520,
    overlayEntranceMs: 240,
  },
} as const;

export function formatScoreNumber(score: number): string {
  const safe = Number.isFinite(score) ? Math.max(0, Math.round(score)) : 0;
  return safe.toLocaleString('en-US');
}
