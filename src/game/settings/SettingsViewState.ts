import type { GameSettings } from '../../core';

export type SettingsOrigin = 'home' | 'pause' | 'tutorial';
export type SettingsSubOverlay = 'none' | 'about' | 'reset_confirm';

export interface SettingsToggleItemState {
  readonly id: 'music' | 'soundEffects' | 'vibration' | 'reducedMotion';
  readonly title: string;
  readonly description: string;
  readonly value: boolean;
  readonly enabled: boolean;
  readonly stateLabel: 'ON' | 'OFF';
}

/**
 * Immutable presentation snapshot for the shared SettingsOverlay.
 * Derived strictly from GameSettings, MotionPreferenceService, and platform capabilities.
 */
export interface SettingsViewState {
  readonly origin: SettingsOrigin;
  readonly settings: GameSettings;
  readonly music: SettingsToggleItemState;
  readonly soundEffects: SettingsToggleItemState;
  readonly vibration: SettingsToggleItemState;
  readonly reducedMotion: SettingsToggleItemState;
  readonly effectiveReducedMotion: boolean;
  readonly systemReducedMotion: boolean;
  readonly vibrationSupported: boolean;
  readonly showHowToPlay: boolean;
  readonly showAbout: boolean;
  readonly showResetSettings: boolean;
  readonly canResetSettings: boolean;
  readonly subOverlay: SettingsSubOverlay;
  readonly appVersion: string;
}
