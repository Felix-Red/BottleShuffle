import { describe, expect, it, vi } from 'vitest';
import { computePauseLayout } from '../../../src/game/layout/PauseLayout';
import { computeSettingsLayout } from '../../../src/game/layout/SettingsLayout';
import { ProgressionController } from '../../../src/game/progression/ProgressionController';
import { SettingsController } from '../../../src/game/settings/SettingsController';
import { MotionPreferenceService } from '../../../src/services/MotionPreferenceService';
import { SettingsService } from '../../../src/services/SettingsService';

describe('SettingsController navigation, capabilities, and reset isolation', () => {
  it('blocks unsupported vibration updates and explains system reduced motion clearly', () => {
    const settingsService = new SettingsService();
    const motionPreference = new MotionPreferenceService(
      () => ({ matches: true }),
      settingsService,
    );
    const onClose = vi.fn();
    const onHowToPlay = vi.fn();

    const controller = new SettingsController({
      settingsService,
      motionPreference,
      origin: 'home',
      vibrationSupported: false,
      callbacks: {
        onCloseRequested: onClose,
        onHowToPlayRequested: onHowToPlay,
      },
    });

    const initial = controller.getViewState();
    expect(initial.vibration.enabled).toBe(false);
    expect(initial.vibration.value).toBe(false);
    expect(initial.vibration.description).toContain('Not supported');
    expect(initial.reducedMotion.value).toBe(true);
    expect(initial.reducedMotion.enabled).toBe(false);
    expect(initial.reducedMotion.description).toContain('system');

    // Attempting to enable unsupported vibration is ignored
    controller.setVibrationEnabled(true);
    expect(settingsService.getSettings().vibrationEnabled).toBe(false);

    // About sub-overlay Escape closes sub-overlay first, then Escape closes Settings
    controller.openAbout();
    expect(controller.getViewState().subOverlay).toBe('about');
    controller.handleEscapeKey();
    expect(controller.getViewState().subOverlay).toBe('none');
    expect(onClose).not.toHaveBeenCalled();

    controller.handleEscapeKey();
    expect(onClose).toHaveBeenCalledTimes(1);

    controller.requestHowToPlay();
    expect(onHowToPlay).toHaveBeenCalledTimes(1);

    controller.dispose();
    motionPreference.dispose();
    settingsService.dispose();
  });

  it('resets ONLY settings preferences and never erases campaign progression or stars', () => {
    const progression = new ProgressionController();
    const attempt = progression.beginCampaignAttempt('level-001');
    if (attempt.accepted) {
      progression.completeActiveAttempt({
        attemptId: attempt.attempt.attemptId,
        levelId: 'level-001',
        moveCount: 2,
        elapsedMs: 10000,
        score: 1000,
        starRating: 3,
        scoringPolicyVersion: 1,
      });
    }

    const settingsService = new SettingsService();
    const motionPreference = new MotionPreferenceService(null, settingsService);
    const controller = new SettingsController({
      settingsService,
      motionPreference,
      origin: 'pause',
      vibrationSupported: true,
    });

    controller.setMusicEnabled(false);
    controller.setSoundEffectsEnabled(false);
    controller.setVibrationEnabled(true);
    controller.setReducedMotionEnabled(true);
    expect(controller.getViewState().canResetSettings).toBe(true);

    controller.requestResetConfirmation();
    expect(controller.getViewState().subOverlay).toBe('reset_confirm');
    controller.confirmResetSettings();

    expect(controller.getViewState().subOverlay).toBe('none');
    expect(settingsService.getSettings().musicEnabled).toBe(true);
    expect(settingsService.getSettings().soundEffectsEnabled).toBe(true);
    expect(settingsService.getSettings().vibrationEnabled).toBe(false);
    expect(settingsService.getSettings().motionPreference).toBe('system');

    // Campaign progression and stars are 100% preserved
    expect(progression.getCampaignProgress().completedLevels).toBe(1);
    expect(progression.getCampaignAchievementSummary().totalEarnedStars).toBe(3);

    controller.dispose();
    motionPreference.dispose();
    settingsService.dispose();
  });
});

describe('PauseLayout and SettingsLayout responsive viewports', () => {
  const viewports: readonly [number, number, 'landscape' | 'compact-landscape' | 'portrait'][] = [
    [1920, 1080, 'landscape'],
    [1280, 720, 'landscape'],
    [844, 390, 'compact-landscape'],
    [540, 960, 'portrait'],
    [390, 844, 'portrait'],
    [360, 640, 'portrait'],
  ];

  for (const [w, h, expectedMode] of viewports) {
    it(`fits PauseLayout cleanly inside ${String(w)}x${String(h)} with >= 44px controls`, () => {
      const layout = computePauseLayout(w, h);
      expect(layout.mode).toBe(expectedMode);
      expect(layout.panelRect.width).toBeLessThanOrEqual(w - 16);
      expect(layout.panelRect.height).toBeLessThanOrEqual(h - 16);
      expect(layout.resumeButtonRect.height).toBeGreaterThanOrEqual(44);
      expect(layout.restartButtonRect.height).toBeGreaterThanOrEqual(44);
      expect(layout.settingsButtonRect.height).toBeGreaterThanOrEqual(44);
      expect(layout.exitButtonRect.height).toBeGreaterThanOrEqual(44);
    });

    it(`fits SettingsLayout cleanly inside ${String(w)}x${String(h)} with >= 44px rows and Done CTA`, () => {
      const layout = computeSettingsLayout(w, h, { showHowToPlay: true });
      expect(layout.mode).toBe(expectedMode);
      expect(layout.panelRect.width).toBeLessThanOrEqual(w - 16);
      expect(layout.panelRect.height).toBeLessThanOrEqual(h - 16);
      expect(layout.musicRowRect.height).toBeGreaterThanOrEqual(44);
      expect(layout.sfxRowRect.height).toBeGreaterThanOrEqual(44);
      expect(layout.vibrationRowRect.height).toBeGreaterThanOrEqual(44);
      expect(layout.reducedMotionRowRect.height).toBeGreaterThanOrEqual(44);
      expect(layout.doneButtonRect.height).toBeGreaterThanOrEqual(44);
    });
  }
});
