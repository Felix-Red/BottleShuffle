import type { AdPlacement, AdRequestOutcome, RewardedAdOutcome } from '../../src/core';
import type {
  AdvertisingCapabilities,
  AdvertisingProvider,
} from '../../src/platform/contracts/AdvertisingProvider';

export interface MockAdvertisingProviderOptions {
  readonly interstitialSupported?: boolean;
  readonly rewardedSupported?: boolean;
  readonly requestsEnabled?: boolean;
  readonly onHostPause?: () => void;
  readonly onHostResume?: () => void;
}

export interface DeferredInterstitialHandle {
  readonly resolveCompleted: () => void;
  readonly resolveUnavailable: (reason?: string) => void;
  readonly resolveFailed: (message?: string) => void;
}

export interface DeferredRewardedHandle {
  readonly resolveEarned: () => void;
  readonly resolveNotEarned: () => void;
  readonly resolveFailed: (message?: string) => void;
}

/**
 * Deterministic mock AdvertisingProvider strictly confined to `tests/helpers/`
 * and excluded from production bundles.
 *
 * Supports immediate, unavailable, rejected, delayed/deferred, and host-lifecycle
 * interleaved outcomes while tracking request & synthetic reward counters.
 */
export class MockAdvertisingProvider implements AdvertisingProvider {
  public readonly name = 'mock-advertising-provider';

  public interstitialSupported: boolean;
  public rewardedSupported: boolean;
  public requestsEnabled: boolean;

  public interstitialRequestCount = 0;
  public rewardedRequestCount = 0;
  public lastPlacement: AdPlacement | null = null;
  public lastRewardId: string | null = null;
  public activeRequestCount = 0;
  public syntheticRewardGrantCount = 0;

  private readonly onHostPause?: () => void;
  private readonly onHostResume?: () => void;

  private nextInterstitialHandler: ((placement: AdPlacement) => Promise<AdRequestOutcome>) | null =
    null;
  private nextRewardedHandler:
    ((rewardId: string, placement: AdPlacement) => Promise<RewardedAdOutcome>) | null = null;
  private defaultInterstitialStatus: 'request_completed' | 'unavailable' | 'failed' =
    'request_completed';
  private defaultRewardedStatus: 'reward_earned' | 'reward_not_earned' | 'failed' = 'reward_earned';
  private pauseHostOnNextRequest = false;
  private resumeHostBeforeSettle = false;
  private resumeHostAfterSettle = false;
  private disposed = false;

  public constructor(options: MockAdvertisingProviderOptions = {}) {
    this.interstitialSupported = options.interstitialSupported ?? true;
    this.rewardedSupported = options.rewardedSupported ?? true;
    this.requestsEnabled = options.requestsEnabled ?? true;
    this.onHostPause = options.onHostPause;
    this.onHostResume = options.onHostResume;
  }

  public getCapabilities(): AdvertisingCapabilities {
    if (this.disposed) {
      return Object.freeze({
        interstitialSupported: false,
        rewardedSupported: false,
        requestsEnabled: false,
      });
    }
    return Object.freeze({
      interstitialSupported: this.interstitialSupported,
      rewardedSupported: this.rewardedSupported,
      requestsEnabled: this.requestsEnabled,
    });
  }

  public setDefaultInterstitialStatus(
    status: 'request_completed' | 'unavailable' | 'failed',
  ): void {
    this.defaultInterstitialStatus = status;
  }

  public setDefaultRewardedStatus(status: 'reward_earned' | 'reward_not_earned' | 'failed'): void {
    this.defaultRewardedStatus = status;
  }

  public configureHostLifecycleForNextRequest(options: {
    readonly pauseDuringRequest: boolean;
    readonly resumeBeforeSettle?: boolean;
    readonly resumeAfterSettle?: boolean;
  }): void {
    this.pauseHostOnNextRequest = options.pauseDuringRequest;
    this.resumeHostBeforeSettle = options.resumeBeforeSettle ?? false;
    this.resumeHostAfterSettle = options.resumeAfterSettle ?? false;
  }

  public setNextInterstitialDeferred(): DeferredInterstitialHandle {
    let resolveFn: (outcome: AdRequestOutcome) => void = () => undefined;
    let capturedPlacement: AdPlacement = 'campaign_level_transition';
    const promise = new Promise<AdRequestOutcome>((resolve) => {
      resolveFn = resolve;
    });
    this.nextInterstitialHandler = (placement) => {
      capturedPlacement = placement;
      return promise;
    };
    return {
      resolveCompleted: () => {
        resolveFn({
          adType: 'interstitial',
          placement: capturedPlacement,
          status: 'request_completed',
          reason: 'mock_deferred_completed',
        });
      },
      resolveUnavailable: (reason = 'mock_deferred_unavailable') => {
        resolveFn({
          adType: 'interstitial',
          placement: capturedPlacement,
          status: 'unavailable',
          reason,
        });
      },
      resolveFailed: (message = 'Simulated deferred interstitial rejection.') => {
        resolveFn({
          adType: 'interstitial',
          placement: capturedPlacement,
          status: 'failed',
          reason: 'mock_deferred_failed',
          error: {
            category: 'request_rejected',
            sdkErrorType: 'UNKNOWN',
            message,
          },
        });
      },
    };
  }

  public setNextRewardedDeferred(): DeferredRewardedHandle {
    let resolveFn: (outcome: RewardedAdOutcome) => void = () => undefined;
    let capturedRewardId = '';
    let capturedPlacement: AdPlacement = 'optional_reward';
    const promise = new Promise<RewardedAdOutcome>((resolve) => {
      resolveFn = resolve;
    });
    this.nextRewardedHandler = (rewardId, placement) => {
      capturedRewardId = rewardId;
      capturedPlacement = placement;
      return promise;
    };
    return {
      resolveEarned: () => {
        resolveFn({
          adType: 'rewarded',
          placement: capturedPlacement,
          rewardId: capturedRewardId,
          status: 'reward_earned',
          rewardEarned: true,
          reason: 'mock_deferred_reward_earned',
        });
      },
      resolveNotEarned: () => {
        resolveFn({
          adType: 'rewarded',
          placement: capturedPlacement,
          rewardId: capturedRewardId,
          status: 'reward_not_earned',
          rewardEarned: false,
          reason: 'mock_deferred_reward_not_earned',
        });
      },
      resolveFailed: (message = 'Simulated deferred rewarded rejection.') => {
        resolveFn({
          adType: 'rewarded',
          placement: capturedPlacement,
          rewardId: capturedRewardId,
          status: 'failed',
          rewardEarned: false,
          reason: 'mock_deferred_reward_failed',
          error: {
            category: 'request_rejected',
            sdkErrorType: 'UNKNOWN',
            message,
          },
        });
      },
    };
  }

  public recordSyntheticRewardGrant(): void {
    this.syntheticRewardGrantCount += 1;
  }

  public async requestInterstitial(placement: AdPlacement): Promise<AdRequestOutcome> {
    this.interstitialRequestCount += 1;
    this.activeRequestCount += 1;
    this.lastPlacement = placement;

    const shouldPause = this.pauseHostOnNextRequest;
    const resumeBefore = this.resumeHostBeforeSettle;
    const resumeAfter = this.resumeHostAfterSettle;
    this.pauseHostOnNextRequest = false;
    this.resumeHostBeforeSettle = false;
    this.resumeHostAfterSettle = false;

    if (shouldPause) {
      this.onHostPause?.();
    }

    try {
      let outcome: AdRequestOutcome;
      if (this.nextInterstitialHandler !== null) {
        const handler = this.nextInterstitialHandler;
        this.nextInterstitialHandler = null;
        outcome = await handler(placement);
      } else if (this.defaultInterstitialStatus === 'unavailable') {
        outcome = {
          adType: 'interstitial',
          placement,
          status: 'unavailable',
          reason: 'mock_interstitial_unavailable',
        };
      } else if (this.defaultInterstitialStatus === 'failed') {
        outcome = {
          adType: 'interstitial',
          placement,
          status: 'failed',
          reason: 'mock_interstitial_failed',
          error: {
            category: 'request_rejected',
            sdkErrorType: 'UNKNOWN',
            message: 'Simulated interstitial rejection.',
          },
        };
      } else {
        outcome = {
          adType: 'interstitial',
          placement,
          status: 'request_completed',
          reason: 'mock_interstitial_completed',
        };
      }

      if (shouldPause && resumeBefore) {
        this.onHostResume?.();
      }
      return outcome;
    } finally {
      this.activeRequestCount = Math.max(0, this.activeRequestCount - 1);
      if (shouldPause && resumeAfter) {
        queueMicrotask(() => {
          this.onHostResume?.();
        });
      }
    }
  }

  public async requestRewarded(
    rewardId: string,
    placement: AdPlacement,
  ): Promise<RewardedAdOutcome> {
    this.rewardedRequestCount += 1;
    this.activeRequestCount += 1;
    this.lastPlacement = placement;
    this.lastRewardId = rewardId;

    try {
      if (this.nextRewardedHandler !== null) {
        const handler = this.nextRewardedHandler;
        this.nextRewardedHandler = null;
        return await handler(rewardId, placement);
      }

      if (this.defaultRewardedStatus === 'reward_not_earned') {
        return {
          adType: 'rewarded',
          placement,
          rewardId,
          status: 'reward_not_earned',
          rewardEarned: false,
          reason: 'mock_reward_not_earned',
        };
      }

      if (this.defaultRewardedStatus === 'failed') {
        return {
          adType: 'rewarded',
          placement,
          rewardId,
          status: 'failed',
          rewardEarned: false,
          reason: 'mock_reward_failed',
          error: {
            category: 'request_rejected',
            sdkErrorType: 'UNKNOWN',
            message: 'Simulated rewarded rejection.',
          },
        };
      }

      return {
        adType: 'rewarded',
        placement,
        rewardId,
        status: 'reward_earned',
        rewardEarned: true,
        reason: 'mock_reward_earned',
      };
    } finally {
      this.activeRequestCount = Math.max(0, this.activeRequestCount - 1);
    }
  }

  public dispose(): void {
    this.disposed = true;
  }
}
