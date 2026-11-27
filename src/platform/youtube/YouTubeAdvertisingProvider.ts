import type { AdPlacement, AdRequestOutcome, RewardedAdOutcome } from '../../core';
import { isUnavailableAdError, mapAdError } from '../../services/advertising/AdErrorMapper';
import type {
  AdvertisingCapabilities,
  AdvertisingProvider,
} from '../contracts/AdvertisingProvider';
import type { YouTubeSdkClient } from './YouTubeSdkClient';

/**
 * Production advertising adapter for YouTube Playables.
 *
 * Exclusively delegates to the verified `ytgame.ads` namespace via `YouTubeSdkClient`:
 * - `ytgame.ads.requestInterstitialAd(): Promise<void>`
 * - `ytgame.ads.requestRewardedAd(rewardId: string): Promise<boolean>`
 *
 * Technical capability flags reflect ONLY presence of the verified SDK functions in
 * the active Playables runtime and never assume fill rate, user eligibility, or
 * Developer Portal monetisation approval.
 */
export class YouTubeAdvertisingProvider implements AdvertisingProvider {
  public readonly name = 'youtube-playables';

  private readonly sdkClient: YouTubeSdkClient;
  private disposed = false;

  public constructor(sdkClient: YouTubeSdkClient) {
    this.sdkClient = sdkClient;
  }

  public getCapabilities(): AdvertisingCapabilities {
    if (this.disposed || !this.sdkClient.isInPlayablesEnv()) {
      return Object.freeze({
        interstitialSupported: false,
        rewardedSupported: false,
        requestsEnabled: false,
      });
    }

    const interstitialSupported = this.sdkClient.hasInterstitialAdApi();
    const rewardedSupported = this.sdkClient.hasRewardedAdApi();

    return Object.freeze({
      interstitialSupported,
      rewardedSupported,
      requestsEnabled: interstitialSupported || rewardedSupported,
    });
  }

  public async requestInterstitial(placement: AdPlacement): Promise<AdRequestOutcome> {
    if (this.disposed) {
      return {
        adType: 'interstitial',
        placement,
        status: 'unavailable',
        reason: 'provider_disposed',
      };
    }

    if (!this.sdkClient.isInPlayablesEnv() || !this.sdkClient.hasInterstitialAdApi()) {
      return {
        adType: 'interstitial',
        placement,
        status: 'unavailable',
        reason: 'sdk_interstitial_api_unavailable',
        error: {
          category: 'api_unavailable',
          sdkErrorType: 'API_UNAVAILABLE',
          message: 'YouTube Playables interstitial ad API is unavailable.',
        },
      };
    }

    try {
      await this.sdkClient.requestInterstitialAd();
      return {
        adType: 'interstitial',
        placement,
        status: 'request_completed',
        reason: 'sdk_interstitial_request_settled',
      };
    } catch (error: unknown) {
      const mapped = mapAdError(error);
      return {
        adType: 'interstitial',
        placement,
        status: isUnavailableAdError(mapped) ? 'unavailable' : 'failed',
        reason: isUnavailableAdError(mapped)
          ? 'sdk_interstitial_unavailable'
          : 'sdk_interstitial_failed',
        error: mapped,
      };
    }
  }

  public async requestRewarded(
    rewardId: string,
    placement: AdPlacement,
  ): Promise<RewardedAdOutcome> {
    if (this.disposed) {
      return {
        adType: 'rewarded',
        placement,
        rewardId,
        status: 'unavailable',
        rewardEarned: false,
        reason: 'provider_disposed',
      };
    }

    if (!this.sdkClient.isInPlayablesEnv() || !this.sdkClient.hasRewardedAdApi()) {
      return {
        adType: 'rewarded',
        placement,
        rewardId,
        status: 'unavailable',
        rewardEarned: false,
        reason: 'sdk_rewarded_api_unavailable',
        error: {
          category: 'api_unavailable',
          sdkErrorType: 'API_UNAVAILABLE',
          message: 'YouTube Playables rewarded ad API is unavailable.',
        },
      };
    }

    try {
      const earned: unknown = await this.sdkClient.requestRewardedAd(rewardId);
      const rewardEarned = earned === true;
      return {
        adType: 'rewarded',
        placement,
        rewardId,
        status: rewardEarned ? 'reward_earned' : 'reward_not_earned',
        rewardEarned,
        reason: rewardEarned ? 'sdk_reward_earned' : 'sdk_reward_not_earned',
      };
    } catch (error: unknown) {
      const mapped = mapAdError(error);
      return {
        adType: 'rewarded',
        placement,
        rewardId,
        status: isUnavailableAdError(mapped) ? 'unavailable' : 'failed',
        rewardEarned: false,
        reason: isUnavailableAdError(mapped) ? 'sdk_rewarded_unavailable' : 'sdk_rewarded_failed',
        error: mapped,
      };
    }
  }

  public dispose(): void {
    this.disposed = true;
  }
}
