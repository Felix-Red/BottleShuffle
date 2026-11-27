import type { Unsubscribe } from '../../platform/contracts/GamePlatform';
import type { MotionPreferenceService } from '../../services/MotionPreferenceService';
import type { SettingsService } from '../../services/SettingsService';
import type { SettingsOrigin, SettingsSubOverlay, SettingsViewState } from './SettingsViewState';
import { mapSettingsViewState } from './SettingsViewStateMapper';

export interface SettingsControllerCallbacks {
  readonly onViewStateChange?: (state: SettingsViewState) => void;
  readonly onCloseRequested?: () => void;
  readonly onHowToPlayRequested?: () => void;
}

export interface SettingsControllerOptions {
  readonly settingsService: SettingsService;
  readonly motionPreference: MotionPreferenceService;
  readonly origin: SettingsOrigin;
  readonly vibrationSupported: boolean;
  readonly showHowToPlay?: boolean;
  readonly callbacks?: SettingsControllerCallbacks;
}

/**
 * Pure, Phaser-free presentation controller for the shared SettingsOverlay.
 * Delegates all mutations to the single shared SettingsService and coordinates
 * About and Reset Settings confirmation sub-overlays cleanly.
 */
export class SettingsController {
  private readonly settingsService: SettingsService;
  private readonly motionPreference: MotionPreferenceService;
  private readonly origin: SettingsOrigin;
  private readonly vibrationSupported: boolean;
  private readonly showHowToPlay: boolean;
  private readonly callbacks: SettingsControllerCallbacks;

  private readonly unsubscribeSettings: Unsubscribe;
  private readonly unsubscribeMotion: Unsubscribe;

  private subOverlay: SettingsSubOverlay = 'none';
  private disposed = false;

  public constructor(options: SettingsControllerOptions) {
    this.settingsService = options.settingsService;
    this.motionPreference = options.motionPreference;
    this.origin = options.origin;
    this.vibrationSupported = options.vibrationSupported;
    this.showHowToPlay = options.showHowToPlay ?? options.origin !== 'tutorial';
    this.callbacks = options.callbacks ?? {};

    this.unsubscribeSettings = this.settingsService.subscribe(() => {
      if (!this.disposed) {
        this.emitState();
      }
    });

    this.unsubscribeMotion = this.motionPreference.onChange(() => {
      if (!this.disposed) {
        this.emitState();
      }
    });
  }

  public getViewState(): SettingsViewState {
    return mapSettingsViewState({
      settings: this.settingsService.getSettings(),
      origin: this.origin,
      systemReducedMotion: this.motionPreference.getSystemReducedMotion(),
      effectiveReducedMotion: this.motionPreference.isReducedMotion(),
      vibrationSupported: this.vibrationSupported,
      subOverlay: this.subOverlay,
      showHowToPlay: this.showHowToPlay,
    });
  }

  public setMusicEnabled(enabled: boolean): SettingsViewState {
    if (this.disposed || this.subOverlay !== 'none') {
      return this.getViewState();
    }
    this.settingsService.setMusicEnabled(enabled);
    return this.getViewState();
  }

  public setSoundEffectsEnabled(enabled: boolean): SettingsViewState {
    if (this.disposed || this.subOverlay !== 'none') {
      return this.getViewState();
    }
    this.settingsService.setSoundEffectsEnabled(enabled);
    return this.getViewState();
  }

  public setVibrationEnabled(enabled: boolean): SettingsViewState {
    if (this.disposed || this.subOverlay !== 'none' || !this.vibrationSupported) {
      return this.getViewState();
    }
    this.settingsService.setVibrationEnabled(enabled);
    return this.getViewState();
  }

  public setReducedMotionEnabled(enabled: boolean): SettingsViewState {
    if (this.disposed || this.subOverlay !== 'none') {
      return this.getViewState();
    }
    // System reduced motion is never overridden with increased motion
    if (this.motionPreference.getSystemReducedMotion() && !enabled) {
      this.settingsService.setMotionPreference('system');
      return this.getViewState();
    }
    this.settingsService.setMotionPreference(enabled ? 'reduced' : 'system');
    return this.getViewState();
  }

  public openAbout(): SettingsViewState {
    if (this.disposed || this.subOverlay !== 'none') {
      return this.getViewState();
    }
    this.subOverlay = 'about';
    return this.emitState();
  }

  public requestResetConfirmation(): SettingsViewState {
    if (this.disposed || this.subOverlay !== 'none') {
      return this.getViewState();
    }
    this.subOverlay = 'reset_confirm';
    return this.emitState();
  }

  public confirmResetSettings(): SettingsViewState {
    if (this.disposed || this.subOverlay !== 'reset_confirm') {
      return this.getViewState();
    }
    this.subOverlay = 'none';
    this.settingsService.resetToDefaults();
    return this.emitState();
  }

  public closeSubOverlay(): SettingsViewState {
    if (this.disposed || this.subOverlay === 'none') {
      return this.getViewState();
    }
    this.subOverlay = 'none';
    return this.emitState();
  }

  public requestHowToPlay(): boolean {
    if (this.disposed || this.subOverlay !== 'none' || !this.showHowToPlay) {
      return false;
    }
    this.callbacks.onHowToPlayRequested?.();
    return true;
  }

  public requestClose(): void {
    if (this.disposed) {
      return;
    }
    this.subOverlay = 'none';
    this.callbacks.onCloseRequested?.();
  }

  public handleEscapeKey(): boolean {
    if (this.disposed) {
      return false;
    }
    if (this.subOverlay !== 'none') {
      this.closeSubOverlay();
      return true;
    }
    this.requestClose();
    return true;
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.unsubscribeSettings();
    this.unsubscribeMotion();
  }

  private emitState(): SettingsViewState {
    const next = this.getViewState();
    this.callbacks.onViewStateChange?.(next);
    return next;
  }
}
