import { describe, expect, it } from 'vitest';
import {
  comparePersonalBest,
  createAttemptResult,
  getDefaultLevelCatalog,
  type CampaignAchievementSummary,
  type ProgressionEvent,
} from '../../../src/core';
import { formatScoreNumber, VICTORY_CONFIG } from '../../../src/config/VictoryConfig';
import { mapHomeViewState } from '../../../src/game/home/HomeViewStateMapper';
import { computeVictoryLayout } from '../../../src/game/layout/VictoryLayout';
import { mapLevelSelectionViewState } from '../../../src/game/levels/LevelSelectionViewStateMapper';
import { ProgressionController } from '../../../src/game/progression/ProgressionController';
import { mapVictoryViewState } from '../../../src/game/victory/VictoryViewStateMapper';

describe('VictoryViewStateMapper & VictoryConfig', () => {
  const catalog = getDefaultLevelCatalog();

  it('maps performance titles, optimal badge, and score formatting accurately', () => {
    expect(formatScoreNumber(1000)).toBe('1,000');
    expect(formatScoreNumber(98750)).toBe('98,750');

    const threeStarOptimal = createAttemptResult({
      attemptId: 'a1',
      puzzleId: 'p1',
      mode: 'campaign',
      levelId: 'level-006',
      difficulty: 'easy',
      bottleCount: 5,
      actualMoves: 4,
      minimumRequiredSwaps: 4,
      elapsedMs: 14000,
    });
    const view3Opt = mapVictoryViewState({
      attemptResult: threeStarOptimal,
      headerTitle: 'Level 6',
      levelNumber: 6,
      chapterId: 'easy',
      nextLevelId: 'level-007',
      nextLevelNumber: 7,
      progressionEvents: [
        {
          type: 'LEVEL_UNLOCKED',
          levelId: 'level-007',
          levelNumber: 7,
          unlockedByLevelId: 'level-006',
        },
      ],
      personalBest: comparePersonalBest(null, {
        score: threeStarOptimal.totalScore,
        starRating: threeStarOptimal.starRating,
        moveCount: threeStarOptimal.actualMoves,
        elapsedMs: threeStarOptimal.elapsedMs,
      }),
      campaignSummary: null,
      chapterStarSummary: null,
      catalog,
    });

    expect(view3Opt.title).toBe(VICTORY_CONFIG.titlesByRating[3]);
    expect(view3Opt.isOptimalSolution).toBe(true);
    expect(view3Opt.formattedScore).toBe('1,250');
    expect(view3Opt.formattedEfficiency).toBe('100%');
    expect(view3Opt.personalBestBadge?.headline).toBe('First Completion');
    expect(view3Opt.unlockedLevel?.levelNumber).toBe(7);
    expect(view3Opt.primaryActionKind).toBe('next_level');
    expect(view3Opt.showLevelsAction).toBe(true);

    // Ensure no hidden puzzle target sequence or seed leaks into VictoryViewState
    const serialized = JSON.stringify(view3Opt);
    expect(serialized).not.toContain('targetSequence');
    expect(serialized).not.toContain('startingSequence');
    expect(serialized).not.toContain('seed');

    // 3 stars with +1 move does NOT get Optimal Solution badge
    const threeStarPlusOne = createAttemptResult({
      attemptId: 'a2',
      puzzleId: 'p1',
      mode: 'campaign',
      levelId: 'level-006',
      difficulty: 'easy',
      bottleCount: 5,
      actualMoves: 5,
      minimumRequiredSwaps: 4,
      elapsedMs: 16000,
    });
    const view3NonOpt = mapVictoryViewState({
      attemptResult: threeStarPlusOne,
      headerTitle: 'Level 6',
      levelNumber: 6,
      chapterId: 'easy',
      nextLevelId: 'level-007',
      nextLevelNumber: 7,
      progressionEvents: [],
      personalBest: null,
      campaignSummary: null,
      chapterStarSummary: null,
      catalog,
    });
    expect(view3NonOpt.earnedStars).toBe(3);
    expect(view3NonOpt.title).toBe('Perfect Shuffle!');
    expect(view3NonOpt.isOptimalSolution).toBe(false);

    // 2 stars and 1 star titles
    const twoStar = createAttemptResult({
      attemptId: 'a3',
      puzzleId: 'p2',
      mode: 'practice',
      levelId: null,
      difficulty: 'normal',
      bottleCount: 6,
      actualMoves: 6,
      minimumRequiredSwaps: 4,
      elapsedMs: 25000,
    });
    const view2 = mapVictoryViewState({
      attemptResult: twoStar,
      headerTitle: 'Normal Practice',
      levelNumber: null,
      chapterId: null,
      nextLevelId: null,
      nextLevelNumber: null,
      progressionEvents: [],
      personalBest: null,
      campaignSummary: null,
      chapterStarSummary: null,
      catalog,
    });
    expect(view2.title).toBe('Great Shuffle!');
    expect(view2.primaryActionKind).toBe('new_puzzle');
    expect(view2.showLevelsAction).toBe(false);
    expect(view2.personalBestBadge).toBeNull();

    const oneStar = createAttemptResult({
      attemptId: 'a4',
      puzzleId: 'p3',
      mode: 'practice',
      levelId: null,
      difficulty: 'hard',
      bottleCount: 8,
      actualMoves: 12,
      minimumRequiredSwaps: 5,
      elapsedMs: 40000,
    });
    const view1 = mapVictoryViewState({
      attemptResult: oneStar,
      headerTitle: 'Hard Practice',
      levelNumber: null,
      chapterId: null,
      nextLevelId: null,
      nextLevelNumber: null,
      progressionEvents: [],
      personalBest: null,
      campaignSummary: null,
      chapterStarSummary: null,
      catalog,
    });
    expect(view1.title).toBe('Puzzle Solved!');
  });

  it('maps campaign completion with Shuffle Master! title and Perfect Campaign flag', () => {
    const attemptResult = createAttemptResult({
      attemptId: 'final',
      puzzleId: 'p50',
      mode: 'campaign',
      levelId: 'level-050',
      difficulty: 'expert',
      bottleCount: 10,
      actualMoves: 7,
      minimumRequiredSwaps: 7,
      elapsedMs: 45000,
    });
    const summary: CampaignAchievementSummary = {
      completedLevels: 50,
      totalLevels: 50,
      totalEarnedStars: 150,
      maxAvailableStars: 150,
      totalBestScore: 105000,
      threeStarCount: 50,
      twoStarCount: 0,
      oneStarCount: 0,
      isCampaignComplete: true,
      isPerfectCampaign: true,
    };
    const events: ProgressionEvent[] = [{ type: 'CAMPAIGN_COMPLETED', totalLevels: 50 }];

    const view = mapVictoryViewState({
      attemptResult,
      headerTitle: 'Level 50',
      levelNumber: 50,
      chapterId: 'expert',
      nextLevelId: null,
      nextLevelNumber: null,
      progressionEvents: events,
      personalBest: null,
      campaignSummary: summary,
      chapterStarSummary: null,
      catalog,
    });

    expect(view.title).toBe('Shuffle Master!');
    expect(view.primaryActionKind).toBe('view_levels');
    expect(view.showLevelsAction).toBe(false);
    expect(view.campaignCompletion?.isPerfectCampaign).toBe(true);
    expect(view.campaignCompletion?.formattedTotalBestScore).toBe('105,000');
  });
});

describe('VictoryLayout responsive geometry', () => {
  const viewports: readonly [number, number, 'landscape' | 'compact-landscape' | 'portrait'][] = [
    [1920, 1080, 'landscape'],
    [1280, 720, 'landscape'],
    [844, 390, 'compact-landscape'],
    [540, 960, 'portrait'],
    [390, 844, 'portrait'],
    [360, 640, 'portrait'],
  ];

  for (const [w, h, expectedMode] of viewports) {
    it(`keeps all victory elements inside bounds with >= 44px touch targets at ${String(w)}x${String(h)}`, () => {
      const layout = computeVictoryLayout(w, h, {
        hasOptimalBadge: true,
        hasPersonalBest: true,
        hasMilestoneBanner: true,
        isCampaignComplete: true,
        secondaryActionCount: 3,
      });

      expect(layout.mode).toBe(expectedMode);
      expect(layout.panelRect.width).toBeLessThanOrEqual(w - 16);
      expect(layout.panelRect.height).toBeLessThanOrEqual(h - 16);
      expect(layout.primaryButtonRect.height).toBeGreaterThanOrEqual(44);
      expect(layout.secondaryButtonRects).toHaveLength(3);
      for (const btn of layout.secondaryButtonRects) {
        expect(btn.height).toBeGreaterThanOrEqual(44);
        expect(btn.width).toBeGreaterThan(40);
      }
      expect(layout.milestoneRect).not.toBeNull();
    });
  }
});

describe('LevelSelection & Home mapper star/score integration', () => {
  it('exposes recorded stars and scores cleanly without fabricating missing historical stars', () => {
    const controller = new ProgressionController();

    // Level 1: scored 3-star completion
    const a1 = controller.beginCampaignAttempt('level-001');
    if (a1.accepted) {
      controller.completeActiveAttempt({
        attemptId: a1.attempt.attemptId,
        levelId: 'level-001',
        moveCount: 3,
        elapsedMs: 11000,
        score: 1000,
        starRating: 3,
        scoringPolicyVersion: 1,
      });
    }

    // Level 2: historical completion without score/stars
    const a2 = controller.beginCampaignAttempt('level-002');
    if (a2.accepted) {
      controller.completeActiveAttempt({
        attemptId: a2.attempt.attemptId,
        levelId: 'level-002',
        moveCount: 4,
        elapsedMs: 13000,
      });
    }

    const levelSelectionState = mapLevelSelectionViewState({
      progressionController: controller,
      selectedChapterId: 'beginner',
      selectedLevelId: 'level-001',
      focusedLevelIndex: null,
      previewLevelId: 'level-001',
      pendingUnlockLevelIds: new Set(),
      canNavigate: true,
      chapterCompletedBanner: null,
      lockedFeedbackMessage: null,
      errorMessage: null,
    });

    const card1 = levelSelectionState.levelCards.find((c) => c.levelId === 'level-001');
    const card2 = levelSelectionState.levelCards.find((c) => c.levelId === 'level-002');
    const card3 = levelSelectionState.levelCards.find((c) => c.levelId === 'level-003');

    expect(card1?.bestStarRating).toBe(3);
    expect(card1?.bestScore).toBe(1000);
    expect(card2?.bestStarRating).toBeNull();
    expect(card2?.bestScore).toBeNull();
    expect(card3?.bestStarRating).toBeNull();
    expect(levelSelectionState.currentChapter.earnedStars).toBe(3);
    expect(levelSelectionState.currentChapter.maxStars).toBe(15);
    expect(levelSelectionState.totalEarnedStars).toBe(3);
    expect(levelSelectionState.maxAvailableStars).toBe(150);
    expect(levelSelectionState.previewLevel?.formattedBestScore).toBe('1,000');
    expect(levelSelectionState.previewLevel?.bestStarRating).toBe(3);

    const homeState = mapHomeViewState({
      campaignProgress: controller.getCampaignProgress(),
      campaignAchievementSummary: controller.getCampaignAchievementSummary(),
      catalog: controller.getCatalog(),
      canNavigate: true,
    });
    expect(homeState.totalEarnedStars).toBe(3);
    expect(homeState.maxAvailableStars).toBe(150);
    expect(homeState.totalBestScore).toBe(1000);
  });
});
