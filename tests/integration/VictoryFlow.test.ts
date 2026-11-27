import { describe, expect, it } from 'vitest';
import {
  generateLevelPuzzle,
  generatePuzzle,
  getDefaultLevelCatalog,
  type BottleId,
} from '../../src/core';
import { GameplayController } from '../../src/game/gameplay/GameplayController';
import { ProgressionController } from '../../src/game/progression/ProgressionController';
import { TutorialController } from '../../src/game/tutorial/TutorialController';

/**
 * Helper solving a GameplayController's current puzzle via legitimate user taps,
 * optionally adding extra redundant swaps beforehand to hit specific star ratings.
 */
function solveGameplayController(
  controller: GameplayController,
  targetSequence: readonly BottleId[],
  extraSwaps = 0,
): void {
  const performSwap = (a: number, b: number): void => {
    controller.handleBottleTap(a);
    controller.handleBottleTap(b);
    controller.completeSwapTransition();
  };

  // Optional redundant back-and-forth swaps to test 2-star / 1-star outcomes
  for (let e = 0; e < extraSwaps; e += 1) {
    if (controller.getViewState().status === 'completed') {
      break;
    }
    performSwap(0, 1);
    if (controller.getViewState().status === 'completed') {
      break;
    }
    performSwap(0, 1);
  }

  while (controller.getViewState().status !== 'completed') {
    const seq = controller.getViewState().currentSequence;
    let mismatchIdx = -1;
    for (let i = 0; i < seq.length; i += 1) {
      if (seq[i] !== targetSequence[i]) {
        mismatchIdx = i;
        break;
      }
    }
    if (mismatchIdx === -1) {
      break;
    }
    const desiredColor = targetSequence[mismatchIdx];
    if (desiredColor === undefined) {
      break;
    }
    const swapIdx = seq.indexOf(desiredColor);
    performSwap(mismatchIdx, swapIdx);
  }
}

describe('VictoryFlow end-to-end integration journeys', () => {
  const catalog = getDefaultLevelCatalog();

  it('Journey 1-3: First campaign completion, improved replay, and weaker replay preserve stronger personal bests', () => {
    const progression = new ProgressionController(catalog);
    const levelDef = catalog.getLevelById('level-004');
    expect(levelDef).toBeDefined();
    if (levelDef === undefined) {
      return;
    }

    // Unlock level-004 by completing 1..3 first
    for (let n = 1; n <= 3; n += 1) {
      const id = `level-00${String(n)}`;
      const a = progression.beginCampaignAttempt(id);
      if (a.accepted) {
        progression.completeActiveAttempt({
          attemptId: a.attempt.attemptId,
          levelId: id,
          moveCount: 2,
          elapsedMs: 9000,
          score: 1000,
          starRating: 3,
          scoringPolicyVersion: 1,
        });
      }
    }

    const levelPuzzle = generateLevelPuzzle(levelDef);

    // Journey 1: First completion with many extra moves -> 1 star
    const gc1 = new GameplayController({
      sceneData: { mode: 'campaign', levelId: levelDef.id },
      progressionController: progression,
    });
    gc1.start();
    solveGameplayController(gc1, levelPuzzle.targetSequence, 4);

    const view1 = gc1.getViewState();
    expect(view1.status).toBe('completed');
    expect(view1.victory).not.toBeNull();
    expect(view1.victory?.earnedStars).toBe(1);
    expect(view1.victory?.personalBestBadge?.headline).toBe('First Completion');
    expect(view1.victory?.unlockedLevel?.levelId).toBe('level-005');
    expect(progression.canPlayLevel('level-005')).toBe(true);
    const firstScore = view1.victory?.totalScore ?? 0;
    gc1.dispose();

    // Journey 2: Improved optimal replay -> 3 stars, Optimal Solution, upgrades PB
    const gc2 = new GameplayController({
      sceneData: { mode: 'campaign', levelId: levelDef.id },
      progressionController: progression,
    });
    gc2.start();
    solveGameplayController(gc2, levelPuzzle.targetSequence, 0);

    const view2 = gc2.getViewState();
    expect(view2.victory?.earnedStars).toBe(3);
    expect(view2.victory?.isOptimalSolution).toBe(true);
    expect(view2.victory?.totalScore).toBeGreaterThan(firstScore);
    expect(view2.victory?.personalBestComparison?.improvedStars).toBe(true);
    expect(view2.victory?.personalBestComparison?.improvedScore).toBe(true);
    expect(progression.getCompletionRecord(levelDef.id)?.bestStarRating).toBe(3);
    expect(progression.getCompletionRecord(levelDef.id)?.bestScore).toBe(view2.victory?.totalScore);
    const bestScore = view2.victory?.totalScore ?? 0;
    gc2.dispose();

    // Journey 3: Weaker replay -> 1 star, preserves 3★ best score/rating, increments completionCount
    const gc3 = new GameplayController({
      sceneData: { mode: 'campaign', levelId: levelDef.id },
      progressionController: progression,
    });
    gc3.start();
    solveGameplayController(gc3, levelPuzzle.targetSequence, 5);

    const view3 = gc3.getViewState();
    expect(view3.victory?.earnedStars).toBe(1);
    expect(view3.victory?.personalBestComparison?.improvedScore).toBe(false);
    expect(view3.victory?.personalBestComparison?.improvedStars).toBe(false);
    expect(progression.getCompletionRecord(levelDef.id)?.bestStarRating).toBe(3);
    expect(progression.getCompletionRecord(levelDef.id)?.bestScore).toBe(bestScore);
    expect(progression.getCompletionRecord(levelDef.id)?.completionCount).toBe(3);
    gc3.dispose();
  });

  it('Journey 4: Chapter completion produces chapter star summary and next chapter unlock preview', () => {
    const progression = new ProgressionController(catalog);
    for (let n = 1; n <= 7; n += 1) {
      const id = `level-00${String(n)}`;
      const a = progression.beginCampaignAttempt(id);
      if (a.accepted) {
        progression.completeActiveAttempt({
          attemptId: a.attempt.attemptId,
          levelId: id,
          moveCount: 2,
          elapsedMs: 10000,
          score: 1000,
          starRating: 3,
          scoringPolicyVersion: 1,
        });
      }
    }

    const level8 = catalog.getLevelById('level-008');
    expect(level8).toBeDefined();
    if (level8 === undefined) {
      return;
    }
    const puzzle8 = generateLevelPuzzle(level8);

    const gc = new GameplayController({
      sceneData: { mode: 'campaign', levelId: 'level-008' },
      progressionController: progression,
    });
    gc.start();
    solveGameplayController(gc, puzzle8.targetSequence, 0);

    const victory = gc.getViewState().victory;
    expect(victory?.chapterCompletion).not.toBeNull();
    expect(victory?.chapterCompletion?.chapterId).toBe('chapter-01');
    expect(victory?.chapterCompletion?.earnedStars).toBe(24);
    expect(victory?.chapterCompletion?.maxStars).toBe(24);
    expect(victory?.chapterCompletion?.nextChapterName).toBe(
      catalog.getChapterById('chapter-02')?.displayName,
    );
    expect(victory?.unlockedLevel?.levelId).toBe('level-009');
    gc.dispose();
  });

  it('Journey 5: Campaign completion triggers Shuffle Master!, View Levels CTA, and accurate totals', () => {
    const progression = new ProgressionController(catalog);
    const allLevels = catalog.getAllLevels();

    for (let i = 0; i < allLevels.length - 1; i += 1) {
      const lvl = allLevels[i];
      if (lvl === undefined) {
        continue;
      }
      const a = progression.beginCampaignAttempt(lvl.id);
      if (a.accepted) {
        progression.completeActiveAttempt({
          attemptId: a.attempt.attemptId,
          levelId: lvl.id,
          moveCount: 3,
          elapsedMs: 15000,
          score: 1500,
          starRating: 3,
          scoringPolicyVersion: 1,
        });
      }
    }

    const finalLevel = allLevels[allLevels.length - 1];
    expect(finalLevel).toBeDefined();
    if (finalLevel === undefined) {
      return;
    }
    const finalPuzzle = generateLevelPuzzle(finalLevel);

    const gc = new GameplayController({
      sceneData: { mode: 'campaign', levelId: finalLevel.id },
      progressionController: progression,
    });
    gc.start();
    solveGameplayController(gc, finalPuzzle.targetSequence, 0);

    const victory = gc.getViewState().victory;
    expect(victory?.title).toBe('Shuffle Master!');
    expect(victory?.primaryActionKind).toBe('view_levels');
    expect(victory?.campaignCompletion?.completedLevels).toBe(50);
    expect(victory?.campaignCompletion?.totalLevels).toBe(50);
    expect(victory?.campaignCompletion?.totalEarnedStars).toBe(150);
    expect(victory?.campaignCompletion?.maxAvailableStars).toBe(150);
    expect(victory?.campaignCompletion?.isPerfectCampaign).toBe(true);
    gc.dispose();
  });

  it('Journey 6: Practice mode produces score and stars while keeping campaign progression untouched', () => {
    const progression = new ProgressionController(catalog);
    const seed = 'practice-victory-seed-7';
    const puzzle = generatePuzzle({ difficulty: 'normal', seed });

    const gc = new GameplayController({
      sceneData: { mode: 'practice', difficulty: 'normal', seed },
      progressionController: progression,
    });
    gc.start();
    solveGameplayController(gc, puzzle.targetSequence, 0);

    const victory = gc.getViewState().victory;
    expect(victory).not.toBeNull();
    expect(victory?.mode).toBe('practice');
    expect(victory?.earnedStars).toBe(3);
    expect(victory?.totalScore).toBe(1500);
    expect(victory?.primaryActionKind).toBe('new_puzzle');
    expect(victory?.personalBestBadge).toBeNull();
    expect(victory?.unlockedLevel).toBeNull();

    // Campaign progression remains completely untouched
    expect(progression.getCampaignProgress().completedLevels).toBe(0);
    expect(progression.getCampaignAchievementSummary().totalEarnedStars).toBe(0);
    expect(progression.canPlayLevel('level-002')).toBe(false);
    gc.dispose();
  });

  it('Journey 7: Tutorial completion remains isolated from scoring and campaign progression', () => {
    const progression = new ProgressionController(catalog);
    const tutorial = new TutorialController({
      origin: 'first_time',
      returnTo: 'home',
      nextCampaignLevelId: 'level-001',
      nextCampaignLevelNumber: 1,
    });
    tutorial.start();
    // Advance intro -> guided_selection -> guided_swap -> counter_explanation -> independent_puzzle -> completed
    tutorial.handlePrimaryAction();
    tutorial.handleBottleTap(0);
    tutorial.handleBottleTap(1);
    tutorial.completeSwapTransition();
    tutorial.handlePrimaryAction();
    // Solve independent 3-bottle puzzle (red, blue, green -> blue, green, red or guided target)
    tutorial.handleBottleTap(0);
    tutorial.handleBottleTap(1);
    tutorial.completeSwapTransition();
    if (tutorial.getViewState().stage !== 'completed') {
      tutorial.handleBottleTap(1);
      tutorial.handleBottleTap(2);
      tutorial.completeSwapTransition();
    }
    if (tutorial.getViewState().stage !== 'completed') {
      tutorial.handleBottleTap(0);
      tutorial.handleBottleTap(2);
      tutorial.completeSwapTransition();
    }

    expect(progression.getCampaignProgress().completedLevels).toBe(0);
    expect(progression.getCampaignAchievementSummary().totalEarnedStars).toBe(0);
    expect(progression.getCampaignAchievementSummary().totalBestScore).toBe(0);
    tutorial.dispose();
  });
});
