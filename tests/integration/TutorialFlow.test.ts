import { describe, expect, it } from 'vitest';
import { getTutorialPuzzle } from '../../src/core';
import { HomeController } from '../../src/game/home/HomeController';
import {
  resolveCampaignLaunchSceneData,
  type SceneNavigator,
} from '../../src/game/navigation/SceneNavigator';
import { ProgressionController } from '../../src/game/progression/ProgressionController';
import { TutorialController } from '../../src/game/tutorial/TutorialController';
import { TutorialPreferenceService } from '../../src/services/TutorialPreferenceService';

describe('Interactive Tutorial End-to-End Journeys', () => {
  it('covers first-time onboarding, skipping, returning player bypass, manual replay, and independent solving', () => {
    const progression = new ProgressionController();
    const tutorialPref = new TutorialPreferenceService();
    const launchedRoutes: ReturnType<typeof resolveCampaignLaunchSceneData>[] = [];

    const createNav = (): SceneNavigator => ({
      isTransitioning: () => false,
      launchCampaignLevel: (levelId, returnTo = 'home') => {
        launchedRoutes.push(resolveCampaignLaunchSceneData(levelId, returnTo, tutorialPref));
        return true;
      },
      launchPracticePuzzle: () => true,
      launchTutorialReplay: (returnTo = 'home') => {
        launchedRoutes.push({
          mode: 'tutorial',
          tutorialOrigin: 'replay',
          returnTo,
        });
        return true;
      },
      openLevelSelection: () => true,
      returnToHome: () => true,
      cancelPendingTransition: () => undefined,
    });

    // 1. FIRST-TIME PLAYER: Home -> Play -> routed to Tutorial with Level 1 preserved
    const home1 = new HomeController({
      progressionController: progression,
      navigator: createNav(),
    });
    expect(home1.handlePrimaryAction()).toBe(true);
    home1.dispose();

    const route1 = launchedRoutes.at(-1);
    expect(route1).toEqual({
      mode: 'tutorial',
      tutorialOrigin: 'first_time',
      returnTo: 'home',
      nextCampaignLevelId: 'level-001',
    });

    // Complete all stages of the tutorial including independent puzzle
    let completedExitCount = 0;
    const tut1 = new TutorialController({
      origin: 'first_time',
      returnTo: 'home',
      nextCampaignLevelId: 'level-001',
      nextCampaignLevelNumber: 1,
      tutorialPreference: tutorialPref,
      callbacks: {
        onExitRequested: (reason) => {
          if (reason === 'completed') {
            completedExitCount += 1;
          }
        },
      },
    });
    tut1.start();
    tut1.handlePrimaryAction(); // intro -> select
    tut1.handleBottleTap(0); // select -> swap
    tut1.handleBottleTap(1); // swap -> animating
    tut1.completeSwapTransition(); // -> counter explanation
    tut1.handlePrimaryAction(); // -> independent puzzle

    // Independent puzzle: starting [green, red, blue], target [red, blue, green] (0/3)
    const independentTarget = getTutorialPuzzle('tutorial-independent-01').targetSequence;
    // Make an exploratory swap that increases matches (0 -> 1), then swap back (1 -> 0) to observe both directions
    tut1.handleBottleTap(0);
    tut1.handleBottleTap(1);
    tut1.completeSwapTransition();
    expect(tut1.getViewState().displayedMatchCount).toBe(1);
    expect(tut1.getViewState().matchFeedback?.tone).toBe('positive');

    tut1.handleBottleTap(0);
    tut1.handleBottleTap(1);
    tut1.completeSwapTransition();
    expect(tut1.getViewState().displayedMatchCount).toBe(0);
    expect(tut1.getViewState().matchFeedback?.tone).toBe('negative');

    // Now solve the independent puzzle cleanly
    while (tut1.getViewState().stage !== 'completed') {
      const seq = tut1.getViewState().currentSequence;
      const mismatch = seq.findIndex((id, i) => id !== independentTarget[i]);
      if (mismatch < 0) {
        break;
      }
      const needed = independentTarget[mismatch];
      if (needed === undefined) {
        break;
      }
      const src = seq.indexOf(needed);
      tut1.handleBottleTap(mismatch);
      tut1.handleBottleTap(src);
      tut1.completeSwapTransition();
    }

    expect(tut1.getViewState().stage).toBe('completed');
    expect(tut1.getViewState().overlayMode).toBe('completed');
    expect(tut1.getViewState().completionActionLabel).toBe('PLAY LEVEL 1');
    expect(tutorialPref.getStatus()).toBe('completed');

    // Campaign progression remains untouched by tutorial completion!
    expect(progression.getCampaignProgress().completedLevels).toBe(0);
    expect(progression.getLevelStatus('level-001')).toBe('unlocked');
    expect(progression.getLevelStatus('level-002')).toBe('locked');

    expect(tut1.continueAfterCompletion()).toBe(true);
    expect(tut1.continueAfterCompletion()).toBe(false); // duplicate blocked
    expect(completedExitCount).toBe(1);
    tut1.dispose();

    // 2. RETURNING PLAYER: Home -> Play/Continue now bypasses tutorial directly to campaign Level 1
    const home2 = new HomeController({
      progressionController: progression,
      navigator: createNav(),
    });
    expect(home2.handlePrimaryAction()).toBe(true);
    expect(launchedRoutes.at(-1)).toEqual({
      mode: 'campaign',
      levelId: 'level-001',
      returnTo: 'home',
    });
    home2.dispose();

    // 3. MANUAL REPLAY: How to Play launches replay tutorial; skipping/exiting never erases completed status
    const home3 = new HomeController({
      progressionController: progression,
      navigator: createNav(),
    });
    expect(home3.launchTutorialReplay()).toBe(true);
    expect(launchedRoutes.at(-1)).toEqual({
      mode: 'tutorial',
      tutorialOrigin: 'replay',
      returnTo: 'home',
    });
    home3.dispose();

    const replayTut = new TutorialController({
      origin: 'replay',
      returnTo: 'home',
      tutorialPreference: tutorialPref,
    });
    replayTut.start();
    expect(replayTut.skipTutorial()).toBe(true);
    expect(tutorialPref.getStatus()).toBe('completed');
    expect(progression.getCampaignProgress().completedLevels).toBe(0);
    replayTut.dispose();

    // 4. PLAYER SKIPS FIRST-TIME TUTORIAL: marks skipped and prevents auto-repeat in session
    const freshPref = new TutorialPreferenceService();
    let skipReason: string | null = null;
    const skipTut = new TutorialController({
      origin: 'first_time',
      returnTo: 'level_selection',
      nextCampaignLevelId: 'level-001',
      nextCampaignLevelNumber: 1,
      tutorialPreference: freshPref,
      callbacks: {
        onExitRequested: (r) => {
          skipReason = r;
        },
      },
    });
    skipTut.start();
    expect(skipTut.skipTutorial()).toBe(true);
    expect(skipReason).toBe('skipped');
    expect(freshPref.getStatus()).toBe('skipped');
    expect(resolveCampaignLaunchSceneData('level-001', 'home', freshPref)).toEqual({
      mode: 'campaign',
      levelId: 'level-001',
      returnTo: 'home',
    });
    skipTut.dispose();
    freshPref.dispose();
    tutorialPref.dispose();
  });
});
