import { SETTINGS_SCHEMA_VERSION, type GameSettings } from './GameSettings';

/**
 * Authoritative default player preferences.
 * Vibration defaults to false because device and host platform support vary.
 */
export const DEFAULT_GAME_SETTINGS: GameSettings = Object.freeze({
  musicEnabled: true,
  soundEffectsEnabled: true,
  vibrationEnabled: false,
  motionPreference: 'system',
  schemaVersion: SETTINGS_SCHEMA_VERSION,
});

export function createDefaultGameSettings(): GameSettings {
  return Object.freeze({ ...DEFAULT_GAME_SETTINGS });
}
