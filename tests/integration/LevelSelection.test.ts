import { describe, expect, it } from 'vitest';
import { formatLevelId, generateLevelPuzzle, type LevelId } from '../../src/core';
import { GameplayController } from '../../src/game/gameplay/GameplayController';
import { HomeController } from '../../src/game/home/HomeController';
import { LevelSelectionController } from '../../src/game/levels/LevelSelectionController';
import { LevelUnlockTracker } from '../../src/game/levels/LevelUnlockTracker';
import type { SceneNavigator } from '../../src/game/navigation/SceneNavigator';
import { ProgressionController } from '../../src/game/progression/ProgressionController';
import type { MonotonicClock } from '../../src/services/GameplayClock';

class FakeClock implements MonotonicClock {
  private ms = 0;
  public now(): number {
    return this.ms;
  }
  public advance(deltaMs: number): void {
    this.ms += deltaMs;
  }
}

function solveLevelThroughGameplay(
  progression: ProgressionController,
  levelId: LevelId,
  clock: FakeClock,
  stepMs = 1500,
): void {
  const levelDef = progression.getCatalog().getLevelById(levelId);
  if (levelDef === undefined) {
    throw new Error(`Missing level ${levelId}`);
  }
  const puzzle = generateLevelPuzzle(levelDef);
  const game = new GameplayController({
    sceneData: { mode: 'campaign', levelId, returnTo: 'level_selection' },
    progressionController: progression,
    clock,
  });
  game.start();
  while (game.getViewState().status !== 'completed') {
    clock.advance(stepMs);
    const current = game.getViewState().currentSequence;
    const mismatch = current.findIndex((id, idx) => id !== puzzle.targetSequence[idx]);
    if (mismatch < 0) {
      break;
    }
    const needed = puzzle.targetSequence[mismatch];
    if (needed === undefined) {
      break;
    }
    const source = current.indexOf(needed);
    game.handleBottleTap(mismatch);
    game.handleBottleTap(source);
    game.completeSwapTransition();
  }
  game.dispose();
}

function makeNav(): {
  readonly navigator: SceneNavigator;
  openedLevelsCount: number;
  lastLaunchedLevelId: LevelId | null;
} {
  const tracker = {
    openedLevelsCount: 0,
    lastLaunchedLevelId: null as LevelId | null,
    navigator: {
      isTransitioning: () => false,
      launchCampaignLevel: (levelId: LevelId) => {
        tracker.lastLaunchedLevelId = levelId;
        return true;
      },
      launchPracticePuzzle: () => true,
      launchTutorialReplay: () => true,
      openLevelSelection: () => {
        tracker.openedLevelsCount += 1;
        return true;
      },
      returnToHome: () => true,
      cancelPendingTransition: () => undefined,
    } satisfies SceneNavigator,
  };
  return tracker;
}

describe('Level Selection End-to-End Integration Journeys', () => {
  it('covers new player, returning player, replay, chapter boundary, and campaign completion journeys', () => {
    const progression = new ProgressionController();
    const unlockTracker = new LevelUnlockTracker(progression);
    const clock = new FakeClock();

    // 1. NEW PLAYER: Home -> Levels -> Ch 1 -> Level 1 playable, rest locked -> preview -> launch
    const homeNav = makeNav();
    const home = new HomeController({
      progressionController: progression,
      navigator: homeNav.navigator,
    });
    expect(home.openLevels()).toBe(true);
    expect(homeNav.openedLevelsCount).toBe(1);
    home.dispose();

    const lsNav1 = makeNav();
    const ls1 = new LevelSelectionController({
      progressionController: progression,
      navigator: lsNav1.navigator,
      unlockTracker,
    });
    expect(ls1.getViewState().selectedChapterId).toBe('chapter-01');
    expect(ls1.getViewState().levelCards[0]?.isPlayable).toBe(true);
    expect(
      ls1
        .getViewState()
        .levelCards.slice(1)
        .every((c) => !c.isPlayable),
    ).toBe(true);
    expect(ls1.selectLevel('level-001')).toBe(true);
    expect(ls1.getViewState().previewLevel?.levelId).toBe('level-001');
    expect(ls1.launchSelectedLevel()).toBe(true);
    expect(lsNav1.lastLaunchedLevelId).toBe('level-001');
    ls1.dispose();

    // 2. RETURNING PLAYER: Solve Level 1 -> return to Level Selection -> Level 1 completed, Level 2 unlocked & recommended
    solveLevelThroughGameplay(progression, 'level-001', clock, 2000);
    const lsNav2 = makeNav();
    const ls2 = new LevelSelectionController({
      progressionController: progression,
      navigator: lsNav2.navigator,
      unlockTracker,
      initialData: { returnFromLevelId: 'level-001' },
    });
    const view2 = ls2.getViewState();
    expect(view2.levelCards[0]?.status).toBe('completed');
    expect(view2.levelCards[1]?.status).toBe('unlocked');
    expect(view2.levelCards[1]?.isRecommended).toBe(true);
    expect(view2.levelCards[1]?.shouldAnimateUnlock).toBe(true);
    ls2.acknowledgeVisibleUnlocks();
    expect(ls2.getViewState().levelCards[1]?.shouldAnimateUnlock).toBe(false);

    // 3. REPLAY: Select completed Level 1 -> inspect records -> replay faster -> campaign % unchanged, best time improved
    expect(ls2.selectLevel('level-001')).toBe(true);
    const beforeReplayBestMs = ls2.getViewState().previewLevel?.bestElapsedMs ?? 0;
    expect(beforeReplayBestMs).toBeGreaterThan(0);
    expect(ls2.launchSelectedLevel()).toBe(true);
    ls2.dispose();

    solveLevelThroughGameplay(progression, 'level-001', clock, 500);
    expect(progression.getCampaignProgress().completedLevels).toBe(1);
    const afterReplayRecord = progression.getCompletionRecord('level-001');
    expect(afterReplayRecord?.completionCount).toBe(2);
    expect(afterReplayRecord?.bestElapsedMs).toBeLessThan(beforeReplayBestMs);

    // 4. CHAPTER BOUNDARY: Complete Levels 2..5 (finish Chapter 1) -> Chapter 1 complete, Level 6 unlocked, Ch 2 recommended
    for (let n = 2; n <= 5; n += 1) {
      solveLevelThroughGameplay(progression, formatLevelId(n), clock, 1000);
    }
    const lsNav3 = makeNav();
    const ls3 = new LevelSelectionController({
      progressionController: progression,
      navigator: lsNav3.navigator,
      unlockTracker,
    });
    const view3 = ls3.getViewState();
    expect(view3.chapters[0]?.isCompleted).toBe(true);
    expect(view3.selectedChapterId).toBe('chapter-02');
    expect(view3.recommendedChapterId).toBe('chapter-02');
    expect(view3.recommendedLevelId).toBe('level-006');
    expect(view3.levelCards[0]?.isPlayable).toBe(true);
    expect(view3.levelCards[0]?.isRecommended).toBe(true);
    ls3.dispose();

    // 5. CAMPAIGN COMPLETION: Complete Levels 6..50 -> all 50 replayable, 100%, no nonexistent recommended level
    for (let n = 6; n <= 50; n += 1) {
      const id = formatLevelId(n);
      const att = progression.beginCampaignAttempt(id);
      if (att.accepted) {
        progression.completeActiveAttempt({
          attemptId: att.attempt.attemptId,
          levelId: id,
          moveCount: 4,
          elapsedMs: 12000,
        });
      }
    }
    unlockTracker.clearAll();

    const lsNav4 = makeNav();
    const ls4 = new LevelSelectionController({
      progressionController: progression,
      navigator: lsNav4.navigator,
      unlockTracker,
    });
    const finalView = ls4.getViewState();
    expect(finalView.isCampaignComplete).toBe(true);
    expect(finalView.completedCampaignLevels).toBe(50);
    expect(finalView.campaignCompletionPercentage).toBe(100);
    expect(finalView.recommendedLevelId).toBeNull();
    expect(finalView.selectedChapterId).toBe('chapter-06');
    expect(finalView.chapters.every((c) => c.levelCards.every((l) => l.isPlayable))).toBe(true);

    ls4.dispose();
    unlockTracker.dispose();
  });
});
