import type { AdPlacement, AdRequestOutcome, RewardedAdOutcome } from '../../core';

/**
 * Technical capability snapshot for an advertising provider.
 *
 * IMPORTANT: Technical SDK capability (`interstitialSupported`, `rewardedSupported`)
 * never guarantees that an ad will fill, that the release has monetisation approved,
 * or that the current user is eligible to view ads.
 */
export interface AdvertisingCapabilities {
  readonly interstitialSupported: boolean;
  readonly rewardedSupported: boolean;
  readonly requestsEnabled: boolean;
}

/**
 * Platform-independent advertising adapter contract.
 * Implemented by `YouTubeAdvertisingProvider` inside YouTube Playables and
 * `NoOpAdvertisingProvider` in standalone browsers.
 */
export interface AdvertisingProvider {
  readonly name: string;

  /** Returns technical advertising capability flags for the active runtime. */
  getCapabilities(): AdvertisingCapabilities;

  /** Requests a platform interstitial advertisement for an eligible placement. */
  requestInterstitial(placement: AdPlacement): Promise<AdRequestOutcome>;

  /** Requests a platform opt-in rewarded advertisement for a validated reward ID. */
  requestRewarded(rewardId: string, placement: AdPlacement): Promise<RewardedAdOutcome>;

  /** Releases any provider-owned state or references. */
  dispose(): void;
}
