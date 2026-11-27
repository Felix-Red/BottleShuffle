import {
  BrowserGamePlatform,
  type BrowserGamePlatformOptions,
} from './browser/BrowserGamePlatform';
import type { GamePlatform } from './contracts/GamePlatform';
import { YouTubePlatform } from './youtube/YouTubePlatform';
import { GlobalYouTubeSdkClient, type YouTubeSdkClient } from './youtube/YouTubeSdkClient';

export interface PlatformFactoryOptions {
  /** Explicit platform injection for deterministic unit/integration testing. */
  readonly overridePlatform?: GamePlatform;
  /** Optional injectable YouTube SDK client boundary for deterministic testing. */
  readonly youtubeSdkClient?: YouTubeSdkClient;
  /** Optional browser platform options when running outside YouTube Playables. */
  readonly browserOptions?: BrowserGamePlatformOptions;
}

/**
 * Single authoritative runtime environment selector.
 *
 * Uses strictly the documented `ytgame.IN_PLAYABLES_ENV === true` flag via `YouTubeSdkClient`:
 * - Inside YouTube Playables -> `YouTubePlatform` (never falls back silently to LocalStorage).
 * - Outside YouTube Playables -> `BrowserGamePlatform` for local development & web play.
 */
export function createPlatformForEnvironment(options: PlatformFactoryOptions = {}): GamePlatform {
  if (options.overridePlatform !== undefined) {
    return options.overridePlatform;
  }

  const sdkClient = options.youtubeSdkClient ?? new GlobalYouTubeSdkClient();
  if (sdkClient.isInPlayablesEnv()) {
    return new YouTubePlatform(sdkClient);
  }

  return new BrowserGamePlatform(options.browserOptions);
}
