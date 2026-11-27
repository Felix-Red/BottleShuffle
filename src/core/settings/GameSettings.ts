import type { MotionPreference } from './MotionPreference';

export const SETTINGS_SCHEMA_VERSION = 1 as const;

/**
 * Immutable, serialisable, versioned player preference snapshot.
 * Deliberately excludes tutorial onboarding state (owned by TutorialPreferenceService)
 * and campaign progression (owned by ProgressionController).
 */
export interface GameSettings {
  readonly musicEnabled: boolean;
  readonly soundEffectsEnabled: boolean;
  readonly vibrationEnabled: boolean;
  readonly motionPreference: MotionPreference;
  readonly schemaVersion: typeof SETTINGS_SCHEMA_VERSION;
}
