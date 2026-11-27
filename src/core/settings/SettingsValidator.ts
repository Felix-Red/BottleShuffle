import { GameError } from '../errors/GameError';
import { SETTINGS_SCHEMA_VERSION, type GameSettings } from './GameSettings';
import { isMotionPreference } from './MotionPreference';

interface RawSettingsCandidate {
  readonly musicEnabled?: unknown;
  readonly soundEffectsEnabled?: unknown;
  readonly vibrationEnabled?: unknown;
  readonly motionPreference?: unknown;
  readonly schemaVersion?: unknown;
}

export function isValidGameSettings(value: unknown): value is GameSettings {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as RawSettingsCandidate;
  return (
    typeof candidate.musicEnabled === 'boolean' &&
    typeof candidate.soundEffectsEnabled === 'boolean' &&
    typeof candidate.vibrationEnabled === 'boolean' &&
    isMotionPreference(candidate.motionPreference) &&
    candidate.schemaVersion === SETTINGS_SCHEMA_VERSION
  );
}

export function assertValidGameSettings(value: unknown): asserts value is GameSettings {
  if (!isValidGameSettings(value)) {
    throw new GameError(
      'INVALID_SETTINGS_INPUT',
      'Invalid GameSettings snapshot: expected boolean flags, valid motionPreference, and schemaVersion 1.',
    );
  }
}

export function serializeGameSettings(settings: GameSettings): string {
  assertValidGameSettings(settings);
  return JSON.stringify({
    musicEnabled: settings.musicEnabled,
    soundEffectsEnabled: settings.soundEffectsEnabled,
    vibrationEnabled: settings.vibrationEnabled,
    motionPreference: settings.motionPreference,
    schemaVersion: settings.schemaVersion,
  });
}

export function deserializeGameSettings(serialized: string): GameSettings | null {
  try {
    const parsed: unknown = JSON.parse(serialized);
    if (!isValidGameSettings(parsed)) {
      return null;
    }
    return Object.freeze({
      musicEnabled: parsed.musicEnabled,
      soundEffectsEnabled: parsed.soundEffectsEnabled,
      vibrationEnabled: parsed.vibrationEnabled,
      motionPreference: parsed.motionPreference,
      schemaVersion: SETTINGS_SCHEMA_VERSION,
    });
  } catch {
    return null;
  }
}
