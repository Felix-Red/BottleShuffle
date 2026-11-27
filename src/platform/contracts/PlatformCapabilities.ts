export type PlatformEnvironment = 'browser' | 'youtube';

/**
 * Explicit platform capability policy flags.
 * Prevents scenes and services from guessing host permissions via UA sniffing
 * or calling browser APIs restricted inside embedded environments like YouTube Playables.
 */
export interface PlatformCapabilities {
  readonly environment: PlatformEnvironment;
  /** Whether standalone browser LocalStorage persistence is permitted. */
  readonly localStoragePersistence: boolean;
  /** Whether platform cloud save storage (ytgame.game.loadData/saveData) is active. */
  readonly cloudSave: boolean;
  /** Whether the host platform exposes authoritative audio mute/unmute controls. */
  readonly hostAudioControl: boolean;
  /** Whether host pause/resume callbacks are authoritative over browser visibility events. */
  readonly hostLifecycleControl: boolean;
  /** Whether scenes/services may attach browser visibility/blur/focus pause listeners. */
  readonly useBrowserVisibilityLifecycle: boolean;
  /** Whether tactile vibration is permitted and supported in this environment. */
  readonly haptics: boolean;
  /** Whether external platform score reporting is enabled. */
  readonly scoreReporting: boolean;
  /** Whether platform advertising integration is technically supported in this runtime. */
  readonly advertising: boolean;
  /** Whether advertising requests are enabled by platform capability policy. */
  readonly advertisingEnabled: boolean;
  /** Whether platform interstitial ad SDK capability is present. */
  readonly interstitialAds: boolean;
  /** Whether platform rewarded ad SDK capability is present. */
  readonly rewardedAds: boolean;
  /** Whether external authentication is enabled (explicitly disabled). */
  readonly externalAuth: boolean;
}
