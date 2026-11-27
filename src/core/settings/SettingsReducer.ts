import type { GameSettings } from './GameSettings';
import { isMotionPreference } from './MotionPreference';
import type { SettingsAction, SettingsRejectionReason } from './SettingsAction';
import { createDefaultGameSettings } from './SettingsDefaults';
import { isValidGameSettings } from './SettingsValidator';

export interface SettingsTransitionResult {
  readonly accepted: boolean;
  readonly changed: boolean;
  readonly state: GameSettings;
  readonly rejectionReason?: SettingsRejectionReason;
}

function freezeSettings(settings: GameSettings): GameSettings {
  return Object.freeze({
    musicEnabled: settings.musicEnabled,
    soundEffectsEnabled: settings.soundEffectsEnabled,
    vibrationEnabled: settings.vibrationEnabled,
    motionPreference: settings.motionPreference,
    schemaVersion: settings.schemaVersion,
  });
}

function areSettingsEqual(a: GameSettings, b: GameSettings): boolean {
  return (
    a.musicEnabled === b.musicEnabled &&
    a.soundEffectsEnabled === b.soundEffectsEnabled &&
    a.vibrationEnabled === b.vibrationEnabled &&
    a.motionPreference === b.motionPreference
  );
}

/**
 * Pure, deterministic reducer for GameSettings transitions.
 * Rejects malformed values without mutating state and reports `changed: false`
 * when an update produces an identical snapshot.
 */
export function reduceGameSettings(
  currentState: GameSettings,
  action: SettingsAction,
): SettingsTransitionResult {
  if (!isValidGameSettings(currentState)) {
    return Object.freeze({
      accepted: false,
      changed: false,
      state: createDefaultGameSettings(),
      rejectionReason: 'INVALID_SETTINGS_SNAPSHOT',
    });
  }

  switch (action.type) {
    case 'SET_MUSIC_ENABLED': {
      if (typeof action.enabled !== 'boolean') {
        return Object.freeze({
          accepted: false,
          changed: false,
          state: currentState,
          rejectionReason: 'INVALID_BOOLEAN_VALUE',
        });
      }
      if (currentState.musicEnabled === action.enabled) {
        return Object.freeze({ accepted: true, changed: false, state: currentState });
      }
      return Object.freeze({
        accepted: true,
        changed: true,
        state: freezeSettings({ ...currentState, musicEnabled: action.enabled }),
      });
    }

    case 'SET_SOUND_EFFECTS_ENABLED': {
      if (typeof action.enabled !== 'boolean') {
        return Object.freeze({
          accepted: false,
          changed: false,
          state: currentState,
          rejectionReason: 'INVALID_BOOLEAN_VALUE',
        });
      }
      if (currentState.soundEffectsEnabled === action.enabled) {
        return Object.freeze({ accepted: true, changed: false, state: currentState });
      }
      return Object.freeze({
        accepted: true,
        changed: true,
        state: freezeSettings({ ...currentState, soundEffectsEnabled: action.enabled }),
      });
    }

    case 'SET_VIBRATION_ENABLED': {
      if (typeof action.enabled !== 'boolean') {
        return Object.freeze({
          accepted: false,
          changed: false,
          state: currentState,
          rejectionReason: 'INVALID_BOOLEAN_VALUE',
        });
      }
      if (currentState.vibrationEnabled === action.enabled) {
        return Object.freeze({ accepted: true, changed: false, state: currentState });
      }
      return Object.freeze({
        accepted: true,
        changed: true,
        state: freezeSettings({ ...currentState, vibrationEnabled: action.enabled }),
      });
    }

    case 'SET_MOTION_PREFERENCE': {
      if (!isMotionPreference(action.preference)) {
        return Object.freeze({
          accepted: false,
          changed: false,
          state: currentState,
          rejectionReason: 'INVALID_MOTION_PREFERENCE',
        });
      }
      if (currentState.motionPreference === action.preference) {
        return Object.freeze({ accepted: true, changed: false, state: currentState });
      }
      return Object.freeze({
        accepted: true,
        changed: true,
        state: freezeSettings({ ...currentState, motionPreference: action.preference }),
      });
    }

    case 'RESET_SETTINGS': {
      const defaults = createDefaultGameSettings();
      const changed = !areSettingsEqual(currentState, defaults);
      return Object.freeze({
        accepted: true,
        changed,
        state: changed ? defaults : currentState,
      });
    }

    default: {
      return Object.freeze({
        accepted: false,
        changed: false,
        state: currentState,
        rejectionReason: 'UNKNOWN_ACTION',
      });
    }
  }
}
