import { describe, expect, it, vi } from 'vitest';
import type { GameplayReturnDestination } from '../../../src/game/gameplay/GameplaySceneData';
import { LevelSelectionController } from '../../../src/game/levels/LevelSelectionController';
import { LevelUnlockTracker } from '../../../src/game/levels/LevelUnlockTracker';
import type { SceneNavigator } from '../../../src/game/navigation/SceneNavigator';
import { ProgressionController } from '../../../src/game/progression/ProgressionController';

function createFakeNavigator(succeed = true): {
  readonly navigator: SceneNavigator;
  readonly launched: { levelId: string; returnTo?: GameplayReturnDestination }[];
  returnedHome: number;
  setSucceed: (v: boolean) => void;
  setTransitioning: (v: boolean) => void;
} {
  let transitioning = false;
  let shouldSucceed = succeed;
  const launched: { levelId: string; returnTo?: GameplayReturnDestination }[] = [];
  const state = {
    returnedHome: 0,
    launched,
    setSucceed: (v: boolean) => {
      shouldSucceed = v;
    },
    setTransitioning: (v: boolean) => {
      transitioning = v;
    },
    navigator: {
      isTransitioning: () => transitioning,
      launchCampaignLevel: (levelId: string, returnTo?: GameplayReturnDestination) => {
        if (!shouldSucceed || transitioning) {
          return false;
        }
        transitioning = true;
        launched.push({ levelId, returnTo });
        return true;
      },
      launchPracticePuzzle: () => false,
      launchTutorialReplay: () => false,
      openLevelSelection: () => false,
      returnToHome: () => {
        if (!shouldSucceed || transitioning) {
          return false;
        }
        transitioning = true;
        state.returnedHome += 1;
        return true;
      },
      cancelPendingTransition: () => {
        transitioning = false;
      },
    } satisfies SceneNavigator,
  };
  return state;
}

describe('LevelSelectionController', () => {
  it('navigates chapters within bounds, inspects future locked chapters, and invalidates stale transition tokens', () => {
    const progression = new ProgressionController();
    const nav = createFakeNavigator(true);
    const transitions: { chapterId: string; dir: number; token: number }[] = [];

    const controller = new LevelSelectionController({
      progressionController: progression,
      navigator: nav.navigator,
      initialData: { chapterId: 'unknown-chapter' }, // invalid ID safely falls back to recommended
      callbacks: {
        onChapterChange: (state, dir, token) => {
          transitions.push({ chapterId: state.selectedChapterId, dir, token });
        },
      },
    });

    expect(controller.getViewState().selectedChapterId).toBe('chapter-01');
    // Cannot move before Chapter 1
    expect(controller.previousChapter()).toBe(false);

    // Move forward to Chapter 2 (locked future chapter is inspectable)
    expect(controller.nextChapter()).toBe(true);
    expect(controller.getViewState().selectedChapterId).toBe('chapter-02');
    expect(controller.getViewState().currentChapter.isLocked).toBe(true);
    const token1 = controller.getTransitionToken();

    // Rapid jump directly to Chapter 6 invalidates previous token
    expect(controller.selectChapter('chapter-06')).toBe(true);
    const token2 = controller.getTransitionToken();
    expect(token2).toBeGreaterThan(token1);
    expect(controller.isCurrentTransitionToken(token1)).toBe(false);
    expect(controller.isCurrentTransitionToken(token2)).toBe(true);
    expect(controller.getViewState().selectedChapterId).toBe('chapter-06');

    // Cannot move past final chapter or select invalid/same chapter
    expect(controller.nextChapter()).toBe(false);
    expect(controller.selectChapter('chapter-06')).toBe(false);
    expect(controller.selectChapter('chapter-999')).toBe(false);
    expect(transitions).toHaveLength(2);

    // Inspecting locked chapters never unlocks anything or generates puzzles
    expect(progression.getLevelStatus('level-041')).toBe('locked');

    // Shutdown invalidates current token
    controller.dispose();
    expect(controller.isCurrentTransitionToken(token2)).toBe(false);
  });

  it('handles playable previews, locked prerequisites, duplicate launch prevention, error recovery, and unlock tracking', () => {
    const progression = new ProgressionController();
    const tracker = new LevelUnlockTracker(progression);
    const nav = createFakeNavigator(false);
    const lockedSpy = vi.fn();

    // Solve Level 1 so Level 2 becomes newly unlocked
    const started = progression.beginCampaignAttempt('level-001');
    if (started.accepted) {
      progression.completeActiveAttempt({
        attemptId: started.attempt.attemptId,
        levelId: 'level-001',
        moveCount: 5,
        elapsedMs: 14000,
      });
    }
    expect(tracker.hasPendingUnlock('level-002')).toBe(true);

    const controller = new LevelSelectionController({
      progressionController: progression,
      navigator: nav.navigator,
      unlockTracker: tracker,
      callbacks: { onLockedLevelAttempt: lockedSpy },
    });

    // Level 2 flagged for unlock animation once, then consumed cleanly without mutating progression
    expect(controller.getViewState().levelCards[1]?.shouldAnimateUnlock).toBe(true);
    expect(controller.acknowledgeVisibleUnlocks()).toEqual(['level-002']);
    expect(controller.getViewState().levelCards[1]?.shouldAnimateUnlock).toBe(false);
    expect(progression.getLevelStatus('level-002')).toBe('unlocked');

    // Locked Level 3 cannot open preview or launch gameplay
    expect(controller.selectLevel('level-003')).toBe(false);
    expect(controller.getViewState().previewLevel).toBeNull();
    expect(lockedSpy).toHaveBeenCalledWith('Complete Level 2 to unlock Level 3.', 'level-003');

    // Completed Level 1 opens preview with actual completion record
    expect(controller.selectLevel('level-001')).toBe(true);
    const preview = controller.getViewState().previewLevel;
    expect(preview?.levelId).toBe('level-001');
    expect(preview?.isCompleted).toBe(true);
    expect(preview?.bestMoveCount).toBe(5);
    expect(preview?.formattedBestTime).toBe('00:14');

    // Failed launch restores interaction and shows error
    expect(controller.launchSelectedLevel()).toBe(false);
    expect(controller.getViewState().errorMessage).not.toBeNull();
    controller.dismissError();
    expect(controller.getViewState().canNavigate).toBe(true);

    // Succeeding launch navigates with returnTo = 'level_selection' and prevents duplicate launches
    nav.setSucceed(true);
    expect(controller.selectLevel('level-001')).toBe(true);
    expect(controller.launchSelectedLevel()).toBe(true);
    expect(nav.launched).toEqual([{ levelId: 'level-001', returnTo: 'level_selection' }]);
    expect(controller.launchLevel('level-002')).toBe(false);

    controller.dispose();
    tracker.dispose();
  });

  it('supports keyboard grid navigation and Escape back-to-home flow', () => {
    const progression = new ProgressionController();
    const nav = createFakeNavigator(true);
    const controller = new LevelSelectionController({
      progressionController: progression,
      navigator: nav.navigator,
    });

    expect(controller.moveGridFocus(1, 0, 5).focusedLevelIndex).toBe(0);
    expect(controller.activateFocusedLevel()).toBe(true);
    expect(controller.getViewState().previewLevel?.levelId).toBe('level-001');

    // First Escape closes preview dialog
    expect(controller.handleEscapeKey()).toBe(true);
    expect(controller.getViewState().previewLevel).toBeNull();
    expect(nav.returnedHome).toBe(0);

    // Second Escape returns home
    expect(controller.handleEscapeKey()).toBe(true);
    expect(nav.returnedHome).toBe(1);

    controller.dispose();
  });
});
