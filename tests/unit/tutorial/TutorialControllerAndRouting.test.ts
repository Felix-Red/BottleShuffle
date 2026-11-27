import { describe, expect, it, vi } from 'vitest';
import { calculateTutorialLayout } from '../../../src/game/layout/TutorialLayout';
import { resolveCampaignLaunchSceneData } from '../../../src/game/navigation/SceneNavigator';
import { TutorialController } from '../../../src/game/tutorial/TutorialController';
import type { MonotonicClock } from '../../../src/services/GameplayClock';
import { TutorialPreferenceService } from '../../../src/services/TutorialPreferenceService';

class FakeClock implements MonotonicClock {
  private ms = 0;
  public now(): number {
    return this.ms;
  }
  public advance(deltaMs: number): void {
    this.ms += deltaMs;
  }
}

describe('TutorialPreferenceService, TutorialController & TutorialLayout', () => {
  it('routes first-time campaign launches to tutorial while preserving destination and protecting completed status', () => {
    const pref = new TutorialPreferenceService();
    expect(pref.getStatus()).toBe('not_seen');
    expect(pref.shouldOfferFirstTimeTutorial()).toBe(true);

    // NotSeen routes to tutorial while preserving exact requested campaign level & returnTo
    const firstLaunch = resolveCampaignLaunchSceneData('level-001', 'level_selection', pref);
    expect(firstLaunch).toEqual({
      mode: 'tutorial',
      tutorialOrigin: 'first_time',
      returnTo: 'level_selection',
      nextCampaignLevelId: 'level-001',
    });

    // Skipped bypasses tutorial during session
    pref.markSkipped();
    expect(pref.getStatus()).toBe('skipped');
    expect(pref.shouldOfferFirstTimeTutorial()).toBe(false);
    expect(resolveCampaignLaunchSceneData('level-002', 'home', pref)).toEqual({
      mode: 'campaign',
      levelId: 'level-002',
      returnTo: 'home',
    });

    // Completed status is never downgraded by subsequent skip during manual replay
    pref.markCompleted();
    expect(pref.getStatus()).toBe('completed');
    pref.markSkipped();
    expect(pref.getStatus()).toBe('completed');
    pref.dispose();
  });

  it('enforces guided input restrictions without counting rejected taps as moves and guards animation transitions', () => {
    const pref = new TutorialPreferenceService();
    const clock = new FakeClock();
    const exitSpy = vi.fn();

    const controller = new TutorialController({
      origin: 'first_time',
      returnTo: 'home',
      nextCampaignLevelId: 'level-001',
      nextCampaignLevelNumber: 1,
      tutorialPreference: pref,
      clock,
      callbacks: { onExitRequested: exitSpy },
    });

    controller.start();
    expect(controller.getViewState().stage).toBe('introduction');
    expect(controller.getViewState().displayedMatchCount).toBe(1);

    // Acknowledge intro -> Stage 2
    controller.handlePrimaryAction();
    expect(controller.getViewState().stage).toBe('guided_selection');

    // Wrong bottle tap is gently rejected and never increments move count
    controller.handleBottleTap(2);
    expect(controller.getViewState().stage).toBe('guided_selection');
    expect(controller.getViewState().displayedMoveCount).toBe(0);
    expect(controller.getViewState().guidanceHint).not.toBeNull();

    // Tap slot 0 -> Stage 3
    controller.handleBottleTap(0);
    expect(controller.getViewState().stage).toBe('guided_swap');
    expect(controller.getViewState().selectedSlotIndex).toBe(0);

    // Tap slot 1 -> swap starts; stage does NOT advance until animation completes
    controller.handleBottleTap(1);
    expect(controller.getViewState().isSwapping).toBe(true);
    expect(controller.getViewState().stage).toBe('guided_swap');

    // Animation finishes -> moves to Stage 4 with 4-bottle demo puzzle
    controller.completeSwapTransition();
    expect(controller.getViewState().stage).toBe('counter_explanation');
    expect(controller.getViewState().totalBottleCount).toBe(4);
    expect(controller.getViewState().displayedMatchCount).toBe(2);

    // Demo swap runs on real GameEngine: 2/4 -> 1/4 (-1)
    controller.handleSecondaryAction();
    expect(controller.getViewState().isSwapping).toBe(true);
    controller.completeSwapTransition();
    expect(controller.getViewState().displayedMatchCount).toBe(1);
    expect(controller.getViewState().matchFeedback?.tone).toBe('negative');

    // Advance to Stage 5: Independent puzzle -> trigger inactivity reminder without spoiling solution
    controller.handlePrimaryAction();
    expect(controller.getViewState().stage).toBe('independent_puzzle');
    expect(controller.getViewState().totalBottleCount).toBe(3);
    controller.triggerInactivityReminder();
    expect(controller.getViewState().guidanceHint).toContain('Try swapping two bottles');

    // Abandoning does not mark completed or skipped
    controller.abandonTutorial();
    expect(exitSpy).toHaveBeenCalledWith('abandoned');
    expect(pref.getStatus()).toBe('not_seen');

    // Disposing prevents stale transition callbacks
    controller.dispose();
    controller.completeSwapTransition();
    expect(controller.getViewState().stage).toBe('independent_puzzle');
  });

  it('computes non-overlapping TutorialLayout across landscape, compact, and portrait viewports', () => {
    const viewports = [
      { w: 1920, h: 1080 },
      { w: 1280, h: 720 },
      { w: 844, h: 390 },
      { w: 540, h: 960 },
      { w: 390, h: 844 },
      { w: 360, h: 640 },
    ];

    for (const vp of viewports) {
      for (const showCounterExamples of [false, true]) {
        const layout = calculateTutorialLayout({
          width: vp.w,
          height: vp.h,
          bottleCount: showCounterExamples ? 4 : 3,
          hasActions: true,
          showCounterExamples,
        });

        expect(Number.isFinite(layout.instructionPanel.x)).toBe(true);
        expect(Number.isFinite(layout.instructionPanel.y)).toBe(true);
        expect(layout.instructionPanel.x).toBeGreaterThanOrEqual(0);
        expect(layout.instructionPanel.x + layout.instructionPanel.width).toBeLessThanOrEqual(vp.w);
        expect(layout.instructionPanel.y + layout.instructionPanel.height).toBeLessThanOrEqual(
          vp.h,
        );

        // Instruction panel sits strictly below the gameplay HUD & rack
        const hudBottom = layout.gameplay.hud.topY + layout.gameplay.hud.height;
        expect(layout.instructionPanel.y).toBeGreaterThan(hudBottom);
      }
    }
  });
});
