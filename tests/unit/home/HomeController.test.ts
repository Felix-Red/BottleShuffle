import { describe, expect, it, vi } from 'vitest';
import { formatLevelId, type DifficultyId, type LevelId } from '../../../src/core';
import { HomeController } from '../../../src/game/home/HomeController';
import type { LevelSelectionSceneData } from '../../../src/game/levels/LevelSelectionSceneData';
import type { SceneNavigator } from '../../../src/game/navigation/SceneNavigator';
import { ProgressionController } from '../../../src/game/progression/ProgressionController';

function createFakeNavigator(shouldSucceed = true): {
  readonly navigator: SceneNavigator;
  readonly launchedLevels: LevelId[];
  readonly launchedPractice: DifficultyId[];
  readonly openedLevelSelections: (LevelSelectionSceneData | undefined)[];
  setTransitioning: (value: boolean) => void;
  setShouldSucceed: (value: boolean) => void;
} {
  let transitioning = false;
  let succeed = shouldSucceed;
  const launchedLevels: LevelId[] = [];
  const launchedPractice: DifficultyId[] = [];
  const openedLevelSelections: (LevelSelectionSceneData | undefined)[] = [];

  const navigator: SceneNavigator = {
    isTransitioning: () => transitioning,
    launchCampaignLevel: (levelId) => {
      if (!succeed || transitioning) {
        return false;
      }
      transitioning = true;
      launchedLevels.push(levelId);
      return true;
    },
    launchPracticePuzzle: (difficulty) => {
      if (!succeed || transitioning) {
        return false;
      }
      transitioning = true;
      launchedPractice.push(difficulty);
      return true;
    },
    launchTutorialReplay: () => {
      if (!succeed || transitioning) {
        return false;
      }
      transitioning = true;
      return true;
    },
    openLevelSelection: (data) => {
      if (!succeed || transitioning) {
        return false;
      }
      transitioning = true;
      openedLevelSelections.push(data);
      return true;
    },
    returnToHome: () => true,
    cancelPendingTransition: () => {
      transitioning = false;
    },
  };

  return {
    navigator,
    launchedLevels,
    launchedPractice,
    openedLevelSelections,
    setTransitioning: (v) => {
      transitioning = v;
    },
    setShouldSucceed: (v) => {
      succeed = v;
    },
  };
}

describe('HomeController', () => {
  it('launches recommended level on Play/Continue, prevents duplicate launches, and recovers from failed launches', () => {
    const progression = new ProgressionController();
    const nav = createFakeNavigator(true);
    const controller = new HomeController({
      progressionController: progression,
      navigator: nav.navigator,
    });

    // Primary action for new player launches Level 1
    expect(controller.handlePrimaryAction()).toBe(true);
    expect(nav.launchedLevels).toEqual(['level-001']);
    expect(controller.getViewState().canNavigate).toBe(false);

    // Rapid duplicate tap is rejected
    expect(controller.handlePrimaryAction()).toBe(false);
    expect(nav.launchedLevels).toHaveLength(1);

    controller.dispose();

    // Failed navigation restores interaction and shows friendly error modal
    const failingNav = createFakeNavigator(false);
    const recoveryController = new HomeController({
      progressionController: progression,
      navigator: failingNav.navigator,
    });

    expect(recoveryController.handlePrimaryAction()).toBe(false);
    expect(recoveryController.getViewState().overlayMode).toBe('error');
    recoveryController.closeOverlay();
    expect(recoveryController.getViewState().canNavigate).toBe(true);

    // Failed Levels navigation also restores interaction cleanly
    expect(recoveryController.openLevels()).toBe(false);
    expect(recoveryController.getViewState().overlayMode).toBe('error');
    recoveryController.closeOverlay();
    expect(recoveryController.getViewState().canNavigate).toBe(true);

    // Locked level cannot be launched
    expect(recoveryController.launchCampaignLevel('level-002')).toBe(false);
    expect(recoveryController.getViewState().overlayMode).toBe('error');
    recoveryController.closeOverlay();

    // Practice launches without mutating progression
    expect(recoveryController.launchPracticePuzzle('expert')).toBe(false);
    failingNav.setShouldSucceed(true);
    recoveryController.closeOverlay();
    expect(recoveryController.launchPracticePuzzle('expert')).toBe(true);
    expect(failingNav.launchedPractice).toEqual(['expert']);
    expect(progression.getCampaignProgress().completedLevels).toBe(0);

    recoveryController.dispose();
  });

  it('opens LevelSelectionScene on Levels & Play Again, supports keyboard navigation, suspension, and tutorial hook', () => {
    const progression = new ProgressionController();
    const tutorialHook = vi.fn(() => true);
    const nav = createFakeNavigator(true);

    const hookController = new HomeController({
      progressionController: progression,
      navigator: nav.navigator,
      callbacks: { onBeforeFirstTimePlay: tutorialHook },
    });

    expect(hookController.handlePrimaryAction()).toBe(true);
    expect(tutorialHook).toHaveBeenCalledWith('level-001');
    expect(nav.launchedLevels).toHaveLength(0);

    // Keyboard navigation cycles cleanly and Escape closes overlays
    expect(hookController.moveFocus(1).focusedControl).toBe('primary');
    expect(hookController.moveFocus(1).focusedControl).toBe('levels');
    expect(hookController.moveFocus(1).focusedControl).toBe('practice');
    expect(hookController.activateFocusedControl()).toBe(true);
    expect(hookController.getViewState().overlayMode).toBe('practice');
    expect(hookController.handleEscapeKey().overlayMode).toBe('none');

    // Suspension blocks actions cleanly
    hookController.setSuspended(true);
    expect(hookController.getViewState().canNavigate).toBe(false);
    expect(hookController.handlePrimaryAction()).toBe(false);
    hookController.setSuspended(false);
    expect(hookController.getViewState().canNavigate).toBe(true);

    // Activating Levels navigates to LevelSelectionScene
    expect(hookController.openLevels()).toBe(true);
    expect(nav.openedLevelSelections).toHaveLength(1);
    hookController.dispose();

    // Complete all 50 levels -> Play Again opens LevelSelectionScene instead of launching nonexistent level
    for (let n = 1; n <= 50; n += 1) {
      const id = formatLevelId(n);
      const started = progression.beginCampaignAttempt(id);
      if (started.accepted) {
        progression.completeActiveAttempt({
          attemptId: started.attempt.attemptId,
          levelId: id,
          moveCount: 3,
          elapsedMs: 5000,
        });
      }
    }

    const completedNav = createFakeNavigator(true);
    const completedController = new HomeController({
      progressionController: progression,
      navigator: completedNav.navigator,
    });
    expect(completedController.handlePrimaryAction()).toBe(true);
    expect(completedNav.openedLevelSelections).toHaveLength(1);
    expect(completedNav.launchedLevels).toHaveLength(0);
    completedController.dispose();
  });
});
