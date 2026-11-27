import type { MotionPreference } from './MotionPreference';

export type SettingsAction =
  | { readonly type: 'SET_MUSIC_ENABLED'; readonly enabled: boolean }
  | { readonly type: 'SET_SOUND_EFFECTS_ENABLED'; readonly enabled: boolean }
  | { readonly type: 'SET_VIBRATION_ENABLED'; readonly enabled: boolean }
  | { readonly type: 'SET_MOTION_PREFERENCE'; readonly preference: MotionPreference }
  | { readonly type: 'RESET_SETTINGS' };

export type SettingsRejectionReason =
  | 'INVALID_BOOLEAN_VALUE'
  | 'INVALID_MOTION_PREFERENCE'
  | 'UNKNOWN_ACTION'
  | 'INVALID_SETTINGS_SNAPSHOT';
