/**
 * TypeScript declarations for the official YouTube Playables SDK v1 (`window.ytgame`).
 *
 * Authoritative source:
 *   https://developers.google.com/youtube/gaming/playables/reference/sdk
 *   Script URL: https://www.youtube.com/game_api/v1
 *   Verified: 2026-11-27
 *
 * Scoped strictly to verified SDK v1 symbols relevant to Bottle Shuffle.
 * Does not include speculative or unverified properties.
 */

export type YouTubeSdkErrorType =
  'UNKNOWN' | 'API_UNAVAILABLE' | 'INVALID_PARAMS' | 'SIZE_LIMIT_EXCEEDED';

export type YouTubeUnsetCallback = () => void;

export interface YouTubeSdkErrorLike extends Error {
  readonly errorType?: string;
  readonly description?: string;
}

export interface YouTubeSdkGameNamespace {
  /** Signals to YouTube that the initial loading or game frame has rendered. */
  firstFrameReady(): void;
  /** Signals to YouTube that the game is fully loaded and interactive. */
  gameReady(): void;
  /** Loads serialized player progress from YouTube cloud storage ("" when empty). */
  loadData(): Promise<string>;
  /** Saves a well-formed UTF-16 serialized string (<= 3 MiB) to YouTube cloud storage. */
  saveData(data: string): Promise<void>;
}

export interface YouTubeSdkSystemNamespace {
  /** Synchronously returns whether YouTube host audio is currently enabled. */
  isAudioEnabled(): boolean;
  /** Registers a host audio permission listener and returns an unsubscribe callback. */
  onAudioEnabledChange(callback: (isAudioEnabled: boolean) => void): YouTubeUnsetCallback;
  /** Registers a host pause listener and returns an unsubscribe callback. */
  onPause(callback: () => void): YouTubeUnsetCallback;
  /** Registers a host resume listener and returns an unsubscribe callback. */
  onResume(callback: () => void): YouTubeUnsetCallback;
  /** Asynchronously returns the user's BCP-47 language tag (e.g. "en-US"). */
  getLanguage?(): Promise<string>;
}

export interface YouTubeSdkHealthNamespace {
  /** Best-effort, rate-limited reporting of critical game errors to YouTube. */
  logError?(): void;
  /** Best-effort, rate-limited reporting of non-critical game warnings to YouTube. */
  logWarning?(): void;
}

export interface YouTubeSdkEngagementNamespace {
  /** Submits an integer score to YouTube (explicitly unused/disabled). */
  sendScore?(score: { readonly value: number }): Promise<void>;
}

export interface YouTubeSdkAdsNamespace {
  /**
   * Requests an interstitial ad at a natural gameplay break.
   * Resolves when the request settles; rejects when unavailable or failed.
   * Verified against https://developers.google.com/youtube/gaming/playables/reference/monetization
   */
  requestInterstitialAd?(): Promise<void>;
  /**
   * Requests an opt-in rewarded ad tied to a non-PII reward identifier.
   * Resolves to `true` only when the player earned the reward, `false` otherwise.
   * Verified against https://developers.google.com/youtube/gaming/playables/reference/monetization
   */
  requestRewardedAd?(rewardId: string): Promise<boolean>;
}

export interface YouTubePlayablesSdk {
  readonly SDK_VERSION?: string;
  readonly IN_PLAYABLES_ENV: boolean;
  readonly game: YouTubeSdkGameNamespace;
  readonly system: YouTubeSdkSystemNamespace;
  readonly health?: YouTubeSdkHealthNamespace;
  readonly engagement?: YouTubeSdkEngagementNamespace;
  readonly ads?: YouTubeSdkAdsNamespace;
  readonly SdkErrorType?: Readonly<Record<YouTubeSdkErrorType, YouTubeSdkErrorType>>;
}

declare global {
  var ytgame: YouTubePlayablesSdk | undefined;
}

export {};
