import { PLATFORM_CONFIG } from '../../config/PlatformConfig';
import type { AdvertisingCapabilities } from '../contracts/AdvertisingProvider';
import type { PlatformCapabilities } from '../contracts/PlatformCapabilities';

export interface YouTubeCapabilityOptions {
  readonly cloudSaveAvailable: boolean;
  readonly advertisingCapabilities?: AdvertisingCapabilities;
}

/**
 * Authoritative capability policy for YouTube Playables.
 * - Local browser persistence is strictly disabled (cloud save only).
 * - Host audio and host pause/resume callbacks are authoritative.
 * - Haptics remain disabled until verified on YouTube Playables.
 * - Advertising flags reflect technical SDK presence only (not ad fill or portal approval).
 * - Score reporting and external auth remain disabled.
 */
export function createYouTubeCapabilities(
  input: boolean | YouTubeCapabilityOptions,
): PlatformCapabilities {
  const cloudSaveAvailable = typeof input === 'boolean' ? input : input.cloudSaveAvailable;
  const adCaps = typeof input === 'boolean' ? undefined : input.advertisingCapabilities;
  const interstitialAds = adCaps?.interstitialSupported ?? false;
  const rewardedAds = adCaps?.rewardedSupported ?? false;
  const advertisingEnabled = adCaps?.requestsEnabled ?? false;

  return Object.freeze({
    environment: 'youtube',
    localStoragePersistence: false,
    cloudSave: cloudSaveAvailable,
    hostAudioControl: true,
    hostLifecycleControl: true,
    useBrowserVisibilityLifecycle: false,
    haptics: false,
    scoreReporting: PLATFORM_CONFIG.youtube.scoreReportingEnabled,
    advertising: advertisingEnabled,
    advertisingEnabled,
    interstitialAds,
    rewardedAds,
    externalAuth: false,
  });
}

export function createBrowserCapabilities(options: {
  readonly localStorageAvailable: boolean;
  readonly vibrationSupported: boolean;
}): PlatformCapabilities {
  return Object.freeze({
    environment: 'browser',
    localStoragePersistence: options.localStorageAvailable,
    cloudSave: false,
    hostAudioControl: false,
    hostLifecycleControl: false,
    useBrowserVisibilityLifecycle: true,
    haptics: options.vibrationSupported,
    scoreReporting: false,
    advertising: false,
    advertisingEnabled: false,
    interstitialAds: false,
    rewardedAds: false,
    externalAuth: false,
  });
}
