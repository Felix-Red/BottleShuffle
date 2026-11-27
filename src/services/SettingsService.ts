import {
  createDefaultGameSettings,
  isValidGameSettings,
  reduceGameSettings,
  type GameSettings,
  type MotionPreference,
  type SettingsAction,
  type SettingsTransitionResult,
} from '../core';
import type { Unsubscribe } from '../platform/contracts/GamePlatform';

export type SettingsListener = (settings: GameSettings) => void;

/**
 * Shared application-level settings owner.
 * Maintains a single immutable GameSettings snapshot across scenes, validates
 * all transitions through the pure SettingsReducer, avoids duplicate subscriber
 * notifications for unchanged values, and remains strictly in memory until Task 15.
 */
export class SettingsService {
  private state: GameSettings;
  private readonly listeners = new Set<SettingsListener>();
  private disposed = false;

  public constructor(initialSettings?: GameSettings) {
    this.state =
      initialSettings !== undefined && isValidGameSettings(initialSettings)
        ? Object.freeze({ ...initialSettings })
        : createDefaultGameSettings();
  }

  public getSettings(): GameSettings {
    return this.state;
  }

  public applyAction(action: SettingsAction): SettingsTransitionResult {
    if (this.disposed) {
      return Object.freeze({
        accepted: false,
        changed: false,
        state: this.state,
      });
    }

    const result = reduceGameSettings(this.state, action);
    if (!result.accepted || !result.changed) {
      return result;
    }

    this.state = result.state;
    this.notify(this.state);
    return result;
  }

  public setMusicEnabled(enabled: boolean): SettingsTransitionResult {
    return this.applyAction({ type: 'SET_MUSIC_ENABLED', enabled });
  }

  public setSoundEffectsEnabled(enabled: boolean): SettingsTransitionResult {
    return this.applyAction({ type: 'SET_SOUND_EFFECTS_ENABLED', enabled });
  }

  public setVibrationEnabled(enabled: boolean): SettingsTransitionResult {
    return this.applyAction({ type: 'SET_VIBRATION_ENABLED', enabled });
  }

  public setMotionPreference(preference: MotionPreference): SettingsTransitionResult {
    return this.applyAction({ type: 'SET_MOTION_PREFERENCE', preference });
  }

  public resetToDefaults(): SettingsTransitionResult {
    return this.applyAction({ type: 'RESET_SETTINGS' });
  }

  /**
   * Atomically restores validated persisted settings during startup hydration.
   * Notifies subscribers only if any setting value actually changed.
   */
  public restoreSettings(settings: GameSettings): boolean {
    if (this.disposed || !isValidGameSettings(settings)) {
      return false;
    }

    const unchanged =
      this.state.musicEnabled === settings.musicEnabled &&
      this.state.soundEffectsEnabled === settings.soundEffectsEnabled &&
      this.state.vibrationEnabled === settings.vibrationEnabled &&
      this.state.motionPreference === settings.motionPreference;

    if (unchanged) {
      return false;
    }

    this.state = Object.freeze({ ...settings });
    this.notify(this.state);
    return true;
  }

  public subscribe(listener: SettingsListener): Unsubscribe {
    if (this.disposed) {
      return () => undefined;
    }
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.listeners.clear();
  }

  private notify(settings: GameSettings): void {
    for (const listener of [...this.listeners]) {
      listener(settings);
    }
  }
}
