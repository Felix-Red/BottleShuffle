import { describe, expect, it, vi } from 'vitest';
import { generateLevelPuzzle, getDefaultLevelCatalog } from '../../src/core';
import { GameplayController } from '../../src/game/gameplay/GameplayController';
import { ProgressionController } from '../../src/game/progression/ProgressionController';
import { SettingsController } from '../../src/game/settings/SettingsController';
import { TutorialController } from '../../src/game/tutorial/TutorialController';
import { MotionPreferenceService } from '../../src/services/MotionPreferenceService';
import { SettingsService } from '../../src/services/SettingsService';

describe('PauseSettingsFlow end-to-end player journeys', () => {
  const catalog = getDefaultLevelCatalog();

  it('Journey 1 & 2: Pause/Resume preserves attempt and Settings from Pause never auto-resumes', () => {
    let nowMs = 0;
    const progression = new ProgressionController(catalog);
    const settingsService = new SettingsService();
    const motionService = new MotionPreferenceService(null, settingsService);

    const gc = new GameplayController({
      sceneData: { mode: 'campaign', levelId: 'level-001' },
      progressionController: progression,
      clock: { now: () => nowMs },
    });
    gc.start();

    // Perform a valid swap after 12s
    nowMs += 12_000;
    gc.handleBottleTap(0);
    gc.handleBottleTap(1);
    gc.completeSwapTransition();

    const beforePause = gc.getViewState();
    expect(beforePause.moveCount).toBe(1);
    expect(gc.getElapsedMs()).toBe(12_000);

    // Pause gameplay
    gc.requestPause();
    expect(gc.getViewState().overlayMode).toBe('pause');
    expect(gc.getViewState().status).toBe('paused');
    expect(gc.getViewState().inputEnabled).toBe(false);

    // Open Settings from Pause and change preferences
    nowMs += 8_000;
    gc.openSettingsFromPause();
    expect(gc.getViewState().overlayMode).toBe('settings');

    const settingsCtrl = new SettingsController({
      settingsService,
      motionPreference: motionService,
      origin: 'pause',
      vibrationSupported: true,
    });
    settingsCtrl.setMusicEnabled(false);
    settingsCtrl.setReducedMotionEnabled(true);

    // Close Settings -> returns to Pause, NEVER auto-resumes!
    nowMs += 7_000;
    gc.closeSettings();
    expect(gc.getViewState().overlayMode).toBe('pause');
    expect(gc.getViewState().status).toBe('paused');
    expect(gc.getElapsedMs()).toBe(12_000);

    // Resume gameplay -> preserves sequence, moves, attemptId, time, and new settings
    gc.resumeFromPause();
    const afterResume = gc.getViewState();
    expect(afterResume.overlayMode).toBe('none');
    expect(afterResume.status).toBe('playing');
    expect(afterResume.inputEnabled).toBe(true);
    expect(afterResume.moveCount).toBe(beforePause.moveCount);
    expect(afterResume.currentSequence).toEqual(beforePause.currentSequence);
    expect(afterResume.attemptId).toBe(beforePause.attemptId);
    expect(gc.getElapsedMs()).toBe(12_000);
    expect(settingsService.getSettings().musicEnabled).toBe(false);
    expect(motionService.isReducedMotion()).toBe(true);

    settingsCtrl.dispose();
    gc.dispose();
    motionService.dispose();
    settingsService.dispose();
  });

  it('Journey 3: Restart confirmation cancel preserves attempt and confirm resets cleanly while preserving campaign records', () => {
    let nowMs = 0;
    const progression = new ProgressionController(catalog);
    const prevAttempt = progression.beginCampaignAttempt('level-001');
    if (prevAttempt.accepted) {
      progression.completeActiveAttempt({
        attemptId: prevAttempt.attempt.attemptId,
        levelId: 'level-001',
        moveCount: 2,
        elapsedMs: 11_000,
        score: 1000,
        starRating: 3,
        scoringPolicyVersion: 1,
      });
    }

    const gc = new GameplayController({
      sceneData: { mode: 'campaign', levelId: 'level-001' },
      progressionController: progression,
      clock: { now: () => nowMs },
    });
    gc.start();
    const initialSeq = [...gc.getViewState().currentSequence];
    const initialAttemptId = gc.getViewState().attemptId;

    nowMs += 9_000;
    gc.handleBottleTap(0);
    gc.handleBottleTap(1);
    gc.completeSwapTransition();
    const movedSeq = [...gc.getViewState().currentSequence];

    // Pause -> Request Restart -> Cancel -> returns to Pause with attempt intact
    gc.requestPause();
    gc.requestRestartConfirmation();
    expect(gc.getViewState().overlayMode).toBe('restart_confirm');
    nowMs += 5_000;

    gc.cancelRestartConfirmation();
    expect(gc.getViewState().overlayMode).toBe('pause');
    expect(gc.getViewState().moveCount).toBe(1);
    expect(gc.getViewState().currentSequence).toEqual(movedSeq);
    expect(gc.getElapsedMs()).toBe(9_000);

    // Request Restart again -> Confirm -> restores original sequence, resets moves/time, new attemptId
    gc.requestRestartConfirmation();
    gc.confirmRestart();
    const afterRestart = gc.getViewState();
    expect(afterRestart.overlayMode).toBe('none');
    expect(afterRestart.status).toBe('playing');
    expect(afterRestart.currentSequence).toEqual(initialSeq);
    expect(afterRestart.moveCount).toBe(0);
    expect(afterRestart.attemptId).toBe(initialAttemptId + 1);
    expect(gc.getElapsedMs()).toBe(0);

    // Historical 3-star record is 100% preserved
    expect(progression.getCompletionRecord('level-001')?.bestStarRating).toBe(3);
    expect(progression.getCompletionRecord('level-001')?.bestScore).toBe(1000);

    gc.dispose();
  });

  it('Journey 4: Exit confirmation cancel preserves attempt and confirm abandons cleanly without awarding completion', () => {
    const progression = new ProgressionController(catalog);
    const onExitConfirmed = vi.fn();

    const gc = new GameplayController({
      sceneData: { mode: 'campaign', levelId: 'level-001' },
      progressionController: progression,
      callbacks: { onExitConfirmed },
    });
    gc.start();

    gc.requestPause();
    gc.requestExitConfirmation();
    expect(gc.getViewState().overlayMode).toBe('exit_confirm');

    gc.cancelExitConfirmation();
    expect(gc.getViewState().overlayMode).toBe('pause');
    expect(onExitConfirmed).not.toHaveBeenCalled();

    gc.requestExitConfirmation();
    expect(gc.confirmExit()).toBe(true);
    // Duplicate confirm is ignored
    expect(gc.confirmExit()).toBe(false);
    expect(onExitConfirmed).toHaveBeenCalledTimes(1);

    // Incomplete abandoned attempt awards zero completions/stars
    expect(progression.getCampaignProgress().completedLevels).toBe(0);
    expect(progression.getCampaignAchievementSummary().totalEarnedStars).toBe(0);

    gc.dispose();
  });

  it('Journey 5: Overlapping manual pause + browser hidden keeps pause menu open after browser returns', () => {
    let nowMs = 0;
    const gc = new GameplayController({
      sceneData: { mode: 'practice', difficulty: 'beginner', seed: 'overlap-1' },
      clock: { now: () => nowMs },
    });
    gc.start();

    nowMs += 10_000;
    gc.requestPause();
    nowMs += 4_000;
    gc.handleBrowserHidden();
    nowMs += 6_000;
    gc.handleBrowserVisible();

    // Still manually paused!
    expect(gc.getViewState().overlayMode).toBe('pause');
    expect(gc.getViewState().status).toBe('paused');
    expect(gc.getViewState().inputEnabled).toBe(false);
    expect(gc.getElapsedMs()).toBe(10_000);

    // Now manual Resume succeeds and clock resumes
    gc.resumeFromPause();
    expect(gc.getViewState().overlayMode).toBe('none');
    expect(gc.getViewState().status).toBe('playing');
    expect(gc.getViewState().inputEnabled).toBe(true);
    nowMs += 5_000;
    expect(gc.getElapsedMs()).toBe(15_000);

    gc.dispose();
  });

  it('Journey 6 & 7: Shared settings survive across scenes, Tutorial pause preserves stage, and Victory stays committed', () => {
    const settingsService = new SettingsService();
    const motionService = new MotionPreferenceService(null, settingsService);
    const progression = new ProgressionController(catalog);

    // Home Settings changes preferences
    const homeSettings = new SettingsController({
      settingsService,
      motionPreference: motionService,
      origin: 'home',
      vibrationSupported: false,
    });
    homeSettings.setMusicEnabled(false);
    homeSettings.setReducedMotionEnabled(true);
    homeSettings.dispose();

    // Tutorial pause/settings/browser suspend preserves tutorial stage
    const tutorial = new TutorialController({ origin: 'replay', returnTo: 'home' });
    tutorial.start();
    tutorial.handlePrimaryAction(); // -> guided_selection
    expect(tutorial.getViewState().stage).toBe('guided_selection');

    tutorial.requestPause();
    tutorial.openSettingsFromPause();
    tutorial.handleBrowserHidden();
    tutorial.handleBrowserVisible();
    tutorial.closeSettings();
    expect(tutorial.getViewState().overlayMode).toBe('pause');
    tutorial.resumeFromPause();
    expect(tutorial.getViewState().stage).toBe('guided_selection');
    tutorial.dispose();

    // Campaign Victory remains committed even when platform suspends/resumes
    const level1 = catalog.getLevelById('level-001');
    expect(level1).toBeDefined();
    if (level1 !== undefined) {
      const puzzle = generateLevelPuzzle(level1);
      const gc = new GameplayController({
        sceneData: { mode: 'campaign', levelId: level1.id },
        progressionController: progression,
      });
      gc.start();

      // Solve level-001
      while (gc.getViewState().status !== 'completed') {
        const seq = gc.getViewState().currentSequence;
        let idx = -1;
        for (let i = 0; i < seq.length; i += 1) {
          if (seq[i] !== puzzle.targetSequence[i]) {
            idx = i;
            break;
          }
        }
        const desired = puzzle.targetSequence[idx];
        if (desired === undefined) {
          break;
        }
        gc.handleBottleTap(idx);
        gc.handleBottleTap(seq.indexOf(desired));
        gc.completeSwapTransition();
      }

      const committedScore = gc.getViewState().victory?.totalScore;
      gc.handlePlatformSuspend();
      gc.handlePlatformResume();
      gc.requestPause(); // Cannot open pause over completed puzzle
      gc.resumeFromPause(); // Cannot resume completed puzzle

      expect(gc.getViewState().overlayMode).toBe('completed');
      expect(gc.getViewState().status).toBe('completed');
      expect(gc.getViewState().victory?.totalScore).toBe(committedScore);
      expect(progression.getCompletionRecord('level-001')?.bestScore).toBe(committedScore);
      expect(settingsService.getSettings().musicEnabled).toBe(false);
      expect(motionService.isReducedMotion()).toBe(true);
      gc.dispose();
    }

    motionService.dispose();
    settingsService.dispose();
  });
});
