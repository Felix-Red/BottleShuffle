import { DEFAULT_GAME_SETTINGS, type GameSettings } from '../../core';
import { SETTINGS_CONFIG } from '../../config/SettingsConfig';
import type { SettingsOrigin, SettingsSubOverlay, SettingsViewState } from './SettingsViewState';

export interface MapSettingsViewStateInput {
  readonly settings: GameSettings;
  readonly origin: SettingsOrigin;
  readonly systemReducedMotion: boolean;
  readonly effectiveReducedMotion: boolean;
  readonly vibrationSupported: boolean;
  readonly subOverlay: SettingsSubOverlay;
  readonly showHowToPlay: boolean;
}

/**
 * Pure mapper converting authoritative GameSettings + runtime capabilities
 * into immutable SettingsViewState.
 */
export function mapSettingsViewState(input: MapSettingsViewStateInput): SettingsViewState {
  const {
    settings,
    origin,
    systemReducedMotion,
    effectiveReducedMotion,
    vibrationSupported,
    subOverlay,
    showHowToPlay,
  } = input;

  const isDefault =
    settings.musicEnabled === DEFAULT_GAME_SETTINGS.musicEnabled &&
    settings.soundEffectsEnabled === DEFAULT_GAME_SETTINGS.soundEffectsEnabled &&
    settings.vibrationEnabled === DEFAULT_GAME_SETTINGS.vibrationEnabled &&
    settings.motionPreference === DEFAULT_GAME_SETTINGS.motionPreference;

  const vibrationValue = vibrationSupported ? settings.vibrationEnabled : false;
  const reducedMotionEnabledBySystemOnly =
    systemReducedMotion && settings.motionPreference === 'system';

  return Object.freeze({
    origin,
    settings,
    music: Object.freeze({
      id: 'music' as const,
      title: SETTINGS_CONFIG.settings.music.title,
      description: SETTINGS_CONFIG.settings.music.description,
      value: settings.musicEnabled,
      enabled: true,
      stateLabel: settings.musicEnabled ? ('ON' as const) : ('OFF' as const),
    }),
    soundEffects: Object.freeze({
      id: 'soundEffects' as const,
      title: SETTINGS_CONFIG.settings.soundEffects.title,
      description: SETTINGS_CONFIG.settings.soundEffects.description,
      value: settings.soundEffectsEnabled,
      enabled: true,
      stateLabel: settings.soundEffectsEnabled ? ('ON' as const) : ('OFF' as const),
    }),
    vibration: Object.freeze({
      id: 'vibration' as const,
      title: SETTINGS_CONFIG.settings.vibration.title,
      description: vibrationSupported
        ? SETTINGS_CONFIG.settings.vibration.description
        : SETTINGS_CONFIG.settings.vibration.unsupportedDescription,
      value: vibrationValue,
      enabled: vibrationSupported,
      stateLabel: vibrationValue ? ('ON' as const) : ('OFF' as const),
    }),
    reducedMotion: Object.freeze({
      id: 'reducedMotion' as const,
      title: SETTINGS_CONFIG.settings.reducedMotion.title,
      description: systemReducedMotion
        ? SETTINGS_CONFIG.settings.reducedMotion.systemActiveDescription
        : SETTINGS_CONFIG.settings.reducedMotion.description,
      value: effectiveReducedMotion,
      enabled: !reducedMotionEnabledBySystemOnly,
      stateLabel: effectiveReducedMotion ? ('ON' as const) : ('OFF' as const),
    }),
    effectiveReducedMotion,
    systemReducedMotion,
    vibrationSupported,
    showHowToPlay,
    showAbout: true,
    showResetSettings: true,
    canResetSettings: !isDefault,
    subOverlay,
    appVersion: SETTINGS_CONFIG.appVersion,
  });
}
