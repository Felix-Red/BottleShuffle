import type { AdPlacement, AdRequestOutcome, RewardedAdOutcome } from '../../core';
import type {
  AdvertisingCapabilities,
  AdvertisingProvider,
} from '../contracts/AdvertisingProvider';

/**
 * Advertisement-free provider used in standalone browser environments.
 *
 * Guarantees:
 * - Immediate `unavailable` response with zero navigation delay.
 * - Zero external network requests and zero third-party SDK dependencies.
 * - Never claims an ad was shown and never grants a reward.
 */
export class NoOpAdvertisingProvider implements AdvertisingProvider {
  public readonly name = 'noop-browser';

  private disposed = false;

  public getCapabilities(): AdvertisingCapabilities {
    return Object.freeze({
      interstitialSupported: false,
      rewardedSupported: false,
      requestsEnabled: false,
    });
  }

  public requestInterstitial(placement: AdPlacement): Promise<AdRequestOutcome> {
    return Promise.resolve({
      adType: 'interstitial',
      placement,
      status: 'unavailable',
      reason: this.disposed ? 'provider_disposed' : 'standalone_browser_ad_free',
    });
  }

  public requestRewarded(rewardId: string, placement: AdPlacement): Promise<RewardedAdOutcome> {
    return Promise.resolve({
      adType: 'rewarded',
      placement,
      rewardId,
      status: 'unavailable',
      rewardEarned: false,
      reason: this.disposed ? 'provider_disposed' : 'standalone_browser_ad_free',
    });
  }

  public dispose(): void {
    this.disposed = true;
  }
}
