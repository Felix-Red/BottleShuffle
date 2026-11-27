import { describe, expect, it, vi } from 'vitest';
import { PRODUCTION_MONETIZATION_CONFIG } from '../../../src/config/MonetizationConfig';
import { BrowserGamePlatform } from '../../../src/platform/browser/BrowserGamePlatform';
import { NoOpAdvertisingProvider } from '../../../src/platform/browser/NoOpAdvertisingProvider';
import { YouTubeAdvertisingProvider } from '../../../src/platform/youtube/YouTubeAdvertisingProvider';
import { YouTubePlatform } from '../../../src/platform/youtube/YouTubePlatform';
import { GlobalYouTubeSdkClient } from '../../../src/platform/youtube/YouTubeSdkClient';
import { mapAdError } from '../../../src/services/advertising/AdErrorMapper';
import { AdService } from '../../../src/services/advertising/AdService';
import { MockAdvertisingProvider } from '../../helpers/MockAdvertisingProvider';
import { createMockSdkError, MockYouTubeSdk } from '../../helpers/MockYouTubeSdk';

const ELIGIBLE_NEXT_LEVEL = {
  mode: 'campaign' as const,
  trigger: 'next_level' as const,
  puzzleCompleted: true,
  completionCommitted: true,
  victoryPresented: true,
  sourceLevelId: 'level-001',
  destinationLevelId: 'level-002',
  destinationAccessible: true,
  isChapterBoundary: false,
};

describe('Advertising capabilities, providers, and AdService', () => {
  it('detects technical YouTube SDK advertising capabilities accurately and handles missing methods safely', async () => {
    const fullSdk = new MockYouTubeSdk();
    const fullClient = new GlobalYouTubeSdkClient(() => fullSdk.asSdk());
    const fullPlatform = new YouTubePlatform(fullClient);
    await fullPlatform.initialize();

    const fullCaps = fullPlatform.getCapabilities();
    expect(fullCaps.advertising).toBe(true);
    expect(fullCaps.advertisingEnabled).toBe(true);
    expect(fullCaps.interstitialAds).toBe(true);
    expect(fullCaps.rewardedAds).toBe(true);

    const noAdsSdk = new MockYouTubeSdk({ includeAdsNamespace: false });
    const noAdsClient = new GlobalYouTubeSdkClient(() => noAdsSdk.asSdk());
    const noAdsProvider = new YouTubeAdvertisingProvider(noAdsClient);
    expect(noAdsProvider.getCapabilities()).toEqual({
      interstitialSupported: false,
      rewardedSupported: false,
      requestsEnabled: false,
    });

    const unavailableInt = await noAdsProvider.requestInterstitial('campaign_level_transition');
    expect(unavailableInt.status).toBe('unavailable');
    expect(unavailableInt.error?.category).toBe('api_unavailable');

    const unavailableRew = await noAdsProvider.requestRewarded(
      'bottle-shuffle.dev-synthetic-reward.v1',
      'optional_reward',
    );
    expect(unavailableRew.status).toBe('unavailable');
    expect(unavailableRew.rewardEarned).toBe(false);

    fullPlatform.dispose();
    noAdsProvider.dispose();
  });

  it('exposes standalone browser NoOpAdvertisingProvider with zero ads and zero reward grants', async () => {
    const browserPlatform = new BrowserGamePlatform({ storage: null, documentRef: null });
    await browserPlatform.initialize();

    const caps = browserPlatform.getCapabilities();
    expect(caps.advertising).toBe(false);
    expect(caps.interstitialAds).toBe(false);
    expect(caps.rewardedAds).toBe(false);

    const provider = browserPlatform.getAdvertisingProvider();
    expect(provider).toBeInstanceOf(NoOpAdvertisingProvider);

    const intRes = await provider.requestInterstitial('campaign_level_transition');
    expect(intRes.status).toBe('unavailable');

    const rewRes = await provider.requestRewarded(
      'bottle-shuffle.dev-synthetic-reward.v1',
      'optional_reward',
    );
    expect(rewRes.status).toBe('unavailable');
    expect(rewRes.rewardEarned).toBe(false);

    browserPlatform.dispose();
  });

  it('delegates YouTube interstitial and rewarded requests cleanly and maps SDK errors (including undefined)', async () => {
    const sdk = new MockYouTubeSdk();
    const client = new GlobalYouTubeSdkClient(() => sdk.asSdk());
    const provider = new YouTubeAdvertisingProvider(client);

    const okInt = await provider.requestInterstitial('campaign_level_transition');
    expect(okInt.status).toBe('request_completed');
    expect(sdk.interstitialAdCalls).toBe(1);

    sdk.setNextInterstitialError(createMockSdkError('API_UNAVAILABLE', 'No ad fill'));
    const unavailInt = await provider.requestInterstitial('campaign_level_transition');
    expect(unavailInt.status).toBe('unavailable');
    expect(unavailInt.error?.sdkErrorType).toBe('API_UNAVAILABLE');

    sdk.setNextInterstitialError(undefined);
    const undefErrInt = await provider.requestInterstitial('campaign_level_transition');
    expect(undefErrInt.status).toBe('failed');
    expect(undefErrInt.error?.category).toBe('request_rejected');

    sdk.setNextRewardedResult(true);
    const earned = await provider.requestRewarded('reward-001', 'optional_reward');
    expect(earned.status).toBe('reward_earned');
    expect(earned.rewardEarned).toBe(true);

    sdk.setNextRewardedResult(false);
    const notEarned = await provider.requestRewarded('reward-001', 'optional_reward');
    expect(notEarned.status).toBe('reward_not_earned');
    expect(notEarned.rewardEarned).toBe(false);

    sdk.setNextRewardedError(createMockSdkError('INVALID_PARAMS', 'Bad reward ID'));
    const badParams = await provider.requestRewarded('reward-001', 'optional_reward');
    expect(badParams.status).toBe('failed');
    expect(badParams.rewardEarned).toBe(false);
    expect(badParams.error?.category).toBe('invalid_params');

    expect(mapAdError(createMockSdkError('SIZE_LIMIT_EXCEEDED', 'Too large')).category).toBe(
      'size_limit_exceeded',
    );

    provider.dispose();
  });

  it('enforces single active request lock across interstitial and rewarded calls and suppresses disabled config', async () => {
    const mockProvider = new MockAdvertisingProvider();
    const adService = new AdService({ provider: mockProvider });

    const deferred = mockProvider.setNextInterstitialDeferred();
    const firstPromise = adService.requestInterstitial(ELIGIBLE_NEXT_LEVEL);
    expect(adService.getRequestState()).toBe('requesting');
    expect(adService.isRequestActive()).toBe(true);

    // Concurrent interstitial blocked
    const dupInt = await adService.requestInterstitial(ELIGIBLE_NEXT_LEVEL);
    expect(dupInt.status).toBe('busy');

    // Concurrent rewarded blocked while interstitial is active
    const dupRew = await adService.requestRewarded({
      rewardId: 'bottle-shuffle.dev-synthetic-reward.v1',
      explicitUserOptIn: true,
      isDevelopmentSimulation: true,
    });
    expect(dupRew.status).toBe('busy');
    expect(mockProvider.interstitialRequestCount).toBe(1);
    expect(mockProvider.rewardedRequestCount).toBe(0);

    deferred.resolveCompleted();
    const firstResult = await firstPromise;
    expect(firstResult.status).toBe('request_completed');
    expect(adService.getRequestState()).toBe('settled');

    // Disabled config suppresses requests before invoking provider
    const disabledService = new AdService({
      provider: mockProvider,
      config: { ...PRODUCTION_MONETIZATION_CONFIG, advertisingEnabled: false },
    });
    const suppressed = await disabledService.requestInterstitial(ELIGIBLE_NEXT_LEVEL);
    expect(suppressed.status).toBe('suppressed_by_policy');
    expect(mockProvider.interstitialRequestCount).toBe(1);

    adService.dispose();
    disabledService.dispose();
  });

  it('triggers diagnostic delayed-response watchdog without cancelling host request and discards stale/disposed callbacks', async () => {
    vi.useFakeTimers();
    try {
      const mockProvider = new MockAdvertisingProvider();
      const adService = new AdService({
        provider: mockProvider,
        config: {
          ...PRODUCTION_MONETIZATION_CONFIG,
          delayedResponseWatchdogMs: 1000,
        },
      });

      const deferred = mockProvider.setNextInterstitialDeferred();
      const pending = adService.requestInterstitial(ELIGIBLE_NEXT_LEVEL);

      vi.advanceTimersByTime(1100);
      expect(adService.getRequestState()).toBe('requesting');
      expect(adService.getDiagnosticSnapshot().delayedWarningCount).toBe(1);

      // Disposing mid-flight discards the late callback cleanly
      adService.dispose();
      expect(adService.getRequestState()).toBe('disposed');

      deferred.resolveCompleted();
      const staleResult = await pending;
      expect(staleResult.status).toBe('unavailable');
      expect(staleResult.reason).toBe('stale_or_disposed_callback');
      expect(adService.getRequestState()).toBe('disposed');
    } finally {
      vi.useRealTimers();
    }
  });
});
