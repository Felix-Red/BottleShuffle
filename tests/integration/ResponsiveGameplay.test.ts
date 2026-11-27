import { describe, expect, it, vi } from 'vitest';
import { generateLevelPuzzle, getDefaultLevelCatalog } from '../../src/core';
import { AnimationCoordinator } from '../../src/game/animations/core/AnimationCoordinator';
import { GameplayController } from '../../src/game/gameplay/GameplayController';
import { calculateGameplayLayout } from '../../src/game/layout/GameplayLayout';
import { calculateTutorialLayout } from '../../src/game/layout/TutorialLayout';
import { ProgressionController } from '../../src/game/progression/ProgressionController';
import { TutorialController } from '../../src/game/tutorial/TutorialController';
import { InMemorySaveStorage } from '../../src/platform/memory/InMemorySaveStorage';
import { ResponsiveLayoutService } from '../../src/services/ResponsiveLayoutService';
import { SettingsService } from '../../src/services/SettingsService';
import { TutorialPreferenceService } from '../../src/services/TutorialPreferenceService';
import { SaveCoordinator } from '../../src/services/persistence/SaveCoordinator';
import { SaveService } from '../../src/services/persistence/SaveService';

describe('ResponsiveGameplay integration journeys', () => {
  it('Journey 1: preserves bottle selection, sequence, and move count across landscape <-> portrait orientation change', () => {
    const responsive = new ResponsiveLayoutService(undefined, { width: 844, height: 390 });
    const controller = new GameplayController({
      sceneData: { mode: 'practice', bottleCount: 6, seed: 'resp-j1' },
    });
    controller.start();

    controller.handleBottleTap(2);
    const before = controller.getViewState();
    expect(before.selectedSlotIndex).toBe(2);
    expect(responsive.getLayoutProfile()).toBe('compact-landscape');

    // Rotate device to portrait
    responsive.updateViewport({ width: 390, height: 844, safeArea: { top: 44, bottom: 34 } });
    expect(responsive.getLayoutProfile()).toBe('compact-portrait');

    const portraitLayout = calculateGameplayLayout({
      width: responsive.getViewport().width,
      height: responsive.getViewport().height,
      bottleCount: before.totalBottleCount,
      safeArea: responsive.getViewport().safeArea,
    });
    expect(portraitLayout.board.rackLayout.rows).toBe(2);

    // Gameplay state remains completely intact after orientation change
    const after = controller.getViewState();
    expect(after.selectedSlotIndex).toBe(2);
    expect(after.currentSequence).toEqual(before.currentSequence);
    expect(after.moveCount).toBe(before.moveCount);

    controller.dispose();
    responsive.dispose();
  });

  it('Journey 2: interrupts active swap on resize and reconciles state exactly once', () => {
    const responsive = new ResponsiveLayoutService(undefined, { width: 1280, height: 720 });
    const coordinator = new AnimationCoordinator();
    const cancelSpy = vi.fn();
    let completeCount = 0;

    const controller = new GameplayController({
      sceneData: { mode: 'practice', bottleCount: 4, seed: 'resp-j2' },
      callbacks: {
        onSwapStarted: (transition) => {
          coordinator.beginSwap(
            () => cancelSpy,
            () => {
              controller.completeSwapTransition(transition.transitionId);
            },
          );
        },
        onSwapCompleted: () => {
          completeCount += 1;
        },
      },
    });
    controller.start();

    controller.handleBottleTap(0);
    controller.handleBottleTap(1);
    expect(controller.getViewState().isSwapping).toBe(true);

    // Trigger resize mid-swap -> mirrors GameScene.handleResize -> interruptActiveSwapAndReconcile
    responsive.subscribe(() => {
      const cancelled = coordinator.cancelActiveSwap();
      if (cancelled || controller.getViewState().isSwapping) {
        controller.completeSwapTransition();
      }
    });

    responsive.updateViewport({ width: 640, height: 360 });
    expect(cancelSpy).toHaveBeenCalledTimes(1);
    expect(completeCount).toBe(1);
    expect(controller.getViewState().isSwapping).toBe(false);
    expect(controller.getViewState().moveCount).toBe(1);

    coordinator.dispose();
    controller.dispose();
    responsive.dispose();
  });

  it('Journey 3: keeps pause state and frozen timer intact across resize', () => {
    let now = 1000;
    const responsive = new ResponsiveLayoutService(undefined, { width: 1280, height: 720 });
    const controller = new GameplayController({
      sceneData: { mode: 'practice', bottleCount: 4, seed: 'resp-j3' },
      clock: { now: () => now },
    });
    controller.start();

    now += 4000;
    expect(controller.pollFormattedTime()).toBe('00:04');

    controller.requestPause();
    expect(controller.getViewState().overlayMode).toBe('pause');

    // Time advances while paused + viewport resizes twice
    now += 10000;
    responsive.updateViewport({ width: 390, height: 844 });
    responsive.updateViewport({ width: 844, height: 390 });

    expect(controller.getViewState().overlayMode).toBe('pause');
    expect(controller.getViewState().formattedTime).toBe('00:04');

    controller.dispose();
    responsive.dispose();
  });

  it('Journey 4: preserves tutorial stage and recalculates spotlight/panel cleanly on resize', () => {
    const responsive = new ResponsiveLayoutService(undefined, { width: 1280, height: 720 });
    const tutorialPref = new TutorialPreferenceService();
    const controller = new TutorialController({
      origin: 'first_time',
      tutorialPreference: tutorialPref,
      initialStage: 'guided_selection',
    });
    controller.start();
    expect(controller.getViewState().stage).toBe('guided_selection');

    responsive.updateViewport({ width: 320, height: 480 });
    const view = controller.getViewState();
    const tutLayout = calculateTutorialLayout({
      width: responsive.getViewport().width,
      height: responsive.getViewport().height,
      bottleCount: view.totalBottleCount,
      hasActions: view.primaryActionLabel !== null,
      showCounterExamples: view.showCounterExamples,
    });

    expect(view.stage).toBe('guided_selection');
    expect(tutLayout.profile).toBe('compact-portrait');
    expect(tutLayout.instructionPanel.y + tutLayout.instructionPanel.height).toBeLessThanOrEqual(
      480,
    );

    controller.dispose();
    tutorialPref.dispose();
    responsive.dispose();
  });

  it('Journey 5: resizing during victory screen never double-commits progression or triggers victory twice', () => {
    const catalog = getDefaultLevelCatalog();
    const progression = new ProgressionController(catalog);
    const levelDef = catalog.getLevelById('level-001');
    if (levelDef === undefined) {
      throw new Error('level-001 must exist in default catalog');
    }
    const puzzle = generateLevelPuzzle(levelDef);
    const responsive = new ResponsiveLayoutService(undefined, { width: 1280, height: 720 });
    const progressionEventsSpy = vi.fn();

    const controller = new GameplayController({
      puzzle,
      sceneData: { mode: 'campaign', levelId: 'level-001' },
      progressionController: progression,
      callbacks: {
        onProgressionEvents: progressionEventsSpy,
      },
    });
    controller.start();

    // Solve level-001 deterministically using test puzzle target
    let safety = 0;
    while (controller.getViewState().overlayMode !== 'completed' && safety < 20) {
      const state = controller.getViewState();
      const firstWrong = state.currentSequence.findIndex(
        (id, idx) => id !== puzzle.targetSequence[idx],
      );
      if (firstWrong === -1) {
        break;
      }
      const desiredBottle = puzzle.targetSequence[firstWrong];
      const swapWith = state.currentSequence.findIndex((id) => id === desiredBottle);
      controller.handleBottleTap(firstWrong);
      controller.handleBottleTap(swapWith);
      controller.completeSwapTransition();
      safety += 1;
    }

    expect(controller.getViewState().overlayMode).toBe('completed');
    const callsAfterWin = progressionEventsSpy.mock.calls.length;
    const statusBeforeResize = progression.getLevelStatus('level-001');
    expect(statusBeforeResize).toBe('completed');

    // Multiple viewport resizes while victory overlay is open
    responsive.updateViewport({ width: 390, height: 844 });
    responsive.updateViewport({ width: 568, height: 320 });
    responsive.updateViewport({ width: 1920, height: 1080 });

    expect(controller.getViewState().overlayMode).toBe('completed');
    expect(progressionEventsSpy.mock.calls.length).toBe(callsAfterWin);
    expect(progression.getLevelStatus('level-001')).toBe('completed');

    controller.dispose();
    responsive.dispose();
  });

  it('Journey 6: persists settings and progression cleanly across resizes and simulated reload', async () => {
    const storage = new InMemorySaveStorage();
    const progressionA = new ProgressionController();
    const settingsA = new SettingsService();
    const tutorialA = new TutorialPreferenceService();
    const saveServiceA = new SaveService({
      storage,
      targets: {
        progressionController: progressionA,
        settingsService: settingsA,
        tutorialPreference: tutorialA,
      },
      normalDebounceMs: 0,
      maxAutomaticRetries: 0,
    });
    await saveServiceA.initialise();

    const coordinatorA = new SaveCoordinator({
      saveService: saveServiceA,
      progressionController: progressionA,
      settingsService: settingsA,
      tutorialPreference: tutorialA,
    });
    const responsive = new ResponsiveLayoutService(undefined, { width: 1280, height: 720 });

    // Resize, mutate settings & tutorial, resize again, flush save
    responsive.updateViewport({ width: 360, height: 640 });
    settingsA.setMotionPreference('reduced');
    settingsA.setMusicEnabled(false);
    tutorialA.markCompleted();
    responsive.updateViewport({ width: 844, height: 390 });
    await saveServiceA.flush(1000);

    coordinatorA.dispose();
    saveServiceA.dispose();
    responsive.dispose();

    // Reload into fresh service instances from the same storage
    const progressionB = new ProgressionController();
    const settingsB = new SettingsService();
    const tutorialB = new TutorialPreferenceService();
    const saveServiceB = new SaveService({
      storage,
      targets: {
        progressionController: progressionB,
        settingsService: settingsB,
        tutorialPreference: tutorialB,
      },
      normalDebounceMs: 0,
      maxAutomaticRetries: 0,
    });
    await saveServiceB.initialise();

    expect(settingsB.getSettings().motionPreference).toBe('reduced');
    expect(settingsB.getSettings().musicEnabled).toBe(false);
    expect(tutorialB.shouldOfferFirstTimeTutorial()).toBe(false);

    saveServiceB.dispose();
    settingsA.dispose();
    settingsB.dispose();
    tutorialA.dispose();
    tutorialB.dispose();
  });
});
