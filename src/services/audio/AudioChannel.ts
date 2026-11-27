export type AudioChannel = 'music' | 'ui' | 'gameplay' | 'feedback' | 'celebration';

export type AudioLoadTier = 'essential' | 'deferred';

export type AudioSuspensionReason =
  'manual_pause' | 'browser_hidden' | 'platform_suspended' | 'scene_transition';

export type MusicContext = 'none' | 'menu' | 'gameplay';
