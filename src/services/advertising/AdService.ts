import {
  PRODUCTION_MONETIZATION_CONFIG,
  type MonetizationPolicyConfig,
} from '../../config/MonetizationConfig';
import {
  evaluateInterstitialEligibility,
  evaluateRewardedEligibility,
  type AdPlacement,
  type AdRequestOutcome,
  type AdType,
  type InterstitialPlacementContext,
  type InterstitialPolicyDecision,
  type RewardedAdOutcome,
  type RewardedPlacementContext,
  type RewardedPolicyDecision,
} from '../../core';
import type {
  AdvertisingCapabilities,
  AdvertisingProvider,
} from '../../platform/contracts/AdvertisingProvider';
import type { GamePlatform, Unsubscribe } from '../../platform/contracts/GamePlatform';
import type { AdRequestState, AdServiceDiagnosticSnapshot } from './AdRequestState';

export interface AdServiceOptions {
  readonly provider: AdvertisingProvider;
  readonly platform?: GamePlatform;
  readonly config?: MonetizationPolicyConfig;
  readonly scheduleTimeout?: (callback: () => void, ms: number) => ReturnType<typeof setTimeout>;
  readonly clearScheduledTimeout?: (handle: ReturnType<typeof setTimeout>) => void;
}

export type InterstitialRequestInput = Omit<InterstitialPlacementContext, 'hostSuspended'> & {
  readonly hostSuspended?: boolean;
};

export type RewardedRequestInput = Omit<RewardedPlacementContext, 'hostSuspended'> & {
  readonly hostSuspended?: boolean;
};

export interface InterstitialEligibilityEvaluation extends InterstitialPolicyDecision {
  readonly providerSupported: boolean;
  readonly requestBusy: boolean;
  readonly canProceed: boolean;
}

export interface RewardedEligibilityEvaluation extends RewardedPolicyDecision {
  readonly providerSupported: boolean;
  readonly requestBusy: boolean;
  readonly canProceed: boolean;
}

export type AdServiceListener = (snapshot: AdServiceDiagnosticSnapshot) => void;

/**
 * Single application-owned advertising service shared across the entire app lifecycle.
 *
 * Responsibilities:
 * - Evaluates pure domain placement eligibility (`AdPlacementPolicy`).
 * - Verifies technical provider capability without assuming fill or approval.
 * - Enforces a strict single-active-request lock across interstitial and rewarded requests.
 * - Tracks authoritative host suspension (`platform.onPause` / `onResume`).
 * - Guards against stale callbacks and post-disposal mutations.
 * - Never retries failed SDK requests automatically.
 */
export class AdService {
  private readonly provider: AdvertisingProvider;
  private readonly platform?: GamePlatform;
  private readonly config: MonetizationPolicyConfig;
  private readonly scheduleTimeout: (
    callback: () => void,
    ms: number,
  ) => ReturnType<typeof setTimeout>;
  private readonly clearScheduledTimeout: (handle: ReturnType<typeof setTimeout>) => void;

  private readonly listeners = new Set<AdServiceListener>();
  private unsubscribePause?: Unsubscribe;
  private unsubscribeResume?: Unsubscribe;

  private state: AdRequestState = 'idle';
  private disposed = false;
  private hostSuspended: boolean;
  private nextRequestId = 1;
  private activeRequestId: number | null = null;
  private activeAdType: AdType | null = null;
  private activePlacement: AdPlacement | null = null;
  private watchdogTimer?: ReturnType<typeof setTimeout>;

  private totalInterstitialRequests = 0;
  private totalRewardedRequests = 0;
  private delayedWarningCount = 0;
  private lastOutcome: AdRequestOutcome | null = null;

  public constructor(options: AdServiceOptions) {
    this.provider = options.provider;
    this.platform = options.platform;
    this.config = options.config ?? PRODUCTION_MONETIZATION_CONFIG;
    this.scheduleTimeout = options.scheduleTimeout ?? ((cb, ms) => globalThis.setTimeout(cb, ms));
    this.clearScheduledTimeout =
      options.clearScheduledTimeout ??
      ((handle) => {
        globalThis.clearTimeout(handle);
      });
    this.hostSuspended = options.platform?.isHostPaused?.() ?? false;

    if (options.platform !== undefined) {
      this.unsubscribePause = options.platform.onPause(() => {
        if (this.disposed || this.hostSuspended) {
          return;
        }
        this.hostSuspended = true;
        this.emitSnapshot();
      });
      this.unsubscribeResume = options.platform.onResume(() => {
        if (this.disposed || !this.hostSuspended) {
          return;
        }
        this.hostSuspended = false;
        this.emitSnapshot();
      });
    }
  }

  public getCapabilities(): AdvertisingCapabilities {
    if (this.disposed) {
      return Object.freeze({
        interstitialSupported: false,
        rewardedSupported: false,
        requestsEnabled: false,
      });
    }
    return this.provider.getCapabilities();
  }

  public getPolicyConfig(): MonetizationPolicyConfig {
    return this.config;
  }

  public getRequestState(): AdRequestState {
    return this.state;
  }

  public isRequestActive(): boolean {
    return this.activeRequestId !== null && !this.disposed;
  }

  public isHostSuspended(): boolean {
    return this.hostSuspended || (this.platform?.isHostPaused?.() ?? false);
  }

  public getDiagnosticSnapshot(): AdServiceDiagnosticSnapshot {
    return Object.freeze({
      state: this.state,
      providerName: this.provider.name,
      capabilities: this.getCapabilities(),
      activeRequestId: this.activeRequestId,
      activeAdType: this.activeAdType,
      activePlacement: this.activePlacement,
      hostSuspended: this.isHostSuspended(),
      totalInterstitialRequests: this.totalInterstitialRequests,
      totalRewardedRequests: this.totalRewardedRequests,
      delayedWarningCount: this.delayedWarningCount,
      lastOutcome: this.lastOutcome,
    });
  }

  public subscribe(listener: AdServiceListener): Unsubscribe {
    if (this.disposed) {
      return () => undefined;
    }
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public canRequestInterstitial(
    input: InterstitialRequestInput,
  ): InterstitialEligibilityEvaluation {
    const effectiveSuspended = input.hostSuspended ?? this.isHostSuspended();
    const decision = evaluateInterstitialEligibility(
      {
        ...input,
        hostSuspended: effectiveSuspended,
      },
      this.config,
    );
    const caps = this.getCapabilities();
    const providerSupported = caps.requestsEnabled && caps.interstitialSupported;
    const requestBusy = this.isRequestActive();

    return {
      ...decision,
      providerSupported,
      requestBusy,
      canProceed: !this.disposed && decision.eligible && providerSupported && !requestBusy,
    };
  }

  public async requestInterstitial(input: InterstitialRequestInput): Promise<AdRequestOutcome> {
    if (this.disposed) {
      return {
        adType: 'interstitial',
        placement: 'campaign_level_transition',
        status: 'unavailable',
        reason: 'service_disposed',
      };
    }

    if (this.activeRequestId !== null) {
      const busyOutcome: AdRequestOutcome = {
        adType: 'interstitial',
        placement: this.activePlacement ?? 'campaign_level_transition',
        status: 'busy',
        reason: 'concurrent_ad_request_active',
      };
      return busyOutcome;
    }

    const evaluation = this.canRequestInterstitial(input);
    if (!evaluation.eligible || evaluation.placement === null) {
      const suppressed: AdRequestOutcome = {
        adType: 'interstitial',
        placement: input.isChapterBoundary ? 'chapter_transition' : 'campaign_level_transition',
        status: 'suppressed_by_policy',
        reason: evaluation.reason,
      };
      this.lastOutcome = suppressed;
      this.emitSnapshot();
      return suppressed;
    }

    if (!evaluation.providerSupported) {
      const unavailable: AdRequestOutcome = {
        adType: 'interstitial',
        placement: evaluation.placement,
        status: 'unavailable',
        reason: 'provider_interstitial_unsupported',
      };
      this.lastOutcome = unavailable;
      this.emitSnapshot();
      return unavailable;
    }

    const requestId = this.beginRequest('interstitial', evaluation.placement);
    this.totalInterstitialRequests += 1;
    this.emitSnapshot();

    let rawOutcome: AdRequestOutcome;
    try {
      rawOutcome = await this.provider.requestInterstitial(evaluation.placement);
    } catch {
      rawOutcome = {
        adType: 'interstitial',
        placement: evaluation.placement,
        status: 'failed',
        reason: 'unexpected_provider_throw',
      };
    }

    if (this.isStaleOrDisposed(requestId)) {
      return {
        adType: 'interstitial',
        placement: evaluation.placement,
        status: 'unavailable',
        reason: 'stale_or_disposed_callback',
      };
    }

    this.finishRequest(rawOutcome);
    return rawOutcome;
  }

  public canRequestRewarded(input: RewardedRequestInput): RewardedEligibilityEvaluation {
    const effectiveSuspended = input.hostSuspended ?? this.isHostSuspended();
    const decision = evaluateRewardedEligibility(
      {
        ...input,
        hostSuspended: effectiveSuspended,
      },
      this.config,
    );
    const caps = this.getCapabilities();
    const providerSupported = caps.requestsEnabled && caps.rewardedSupported;
    const requestBusy = this.isRequestActive();

    return {
      ...decision,
      providerSupported,
      requestBusy,
      canProceed: !this.disposed && decision.eligible && providerSupported && !requestBusy,
    };
  }

  public async requestRewarded(input: RewardedRequestInput): Promise<RewardedAdOutcome> {
    if (this.disposed) {
      return {
        adType: 'rewarded',
        placement: 'optional_reward',
        rewardId: input.rewardId,
        status: 'unavailable',
        rewardEarned: false,
        reason: 'service_disposed',
      };
    }

    if (this.activeRequestId !== null) {
      return {
        adType: 'rewarded',
        placement: 'optional_reward',
        rewardId: input.rewardId,
        status: 'busy',
        rewardEarned: false,
        reason: 'concurrent_ad_request_active',
      };
    }

    const evaluation = this.canRequestRewarded(input);
    if (!evaluation.eligible || evaluation.placement === null) {
      const suppressed: RewardedAdOutcome = {
        adType: 'rewarded',
        placement: 'optional_reward',
        rewardId: input.rewardId,
        status: 'suppressed_by_policy',
        rewardEarned: false,
        reason: evaluation.reason,
      };
      this.lastOutcome = suppressed;
      this.emitSnapshot();
      return suppressed;
    }

    if (!evaluation.providerSupported) {
      const unavailable: RewardedAdOutcome = {
        adType: 'rewarded',
        placement: evaluation.placement,
        rewardId: input.rewardId,
        status: 'unavailable',
        rewardEarned: false,
        reason: 'provider_rewarded_unsupported',
      };
      this.lastOutcome = unavailable;
      this.emitSnapshot();
      return unavailable;
    }

    const requestId = this.beginRequest('rewarded', evaluation.placement);
    this.totalRewardedRequests += 1;
    this.emitSnapshot();

    let rawOutcome: RewardedAdOutcome;
    try {
      rawOutcome = await this.provider.requestRewarded(input.rewardId, evaluation.placement);
    } catch {
      rawOutcome = {
        adType: 'rewarded',
        placement: evaluation.placement,
        rewardId: input.rewardId,
        status: 'failed',
        rewardEarned: false,
        reason: 'unexpected_provider_throw',
      };
    }

    if (this.isStaleOrDisposed(requestId)) {
      return {
        adType: 'rewarded',
        placement: evaluation.placement,
        rewardId: input.rewardId,
        status: 'unavailable',
        rewardEarned: false,
        reason: 'stale_or_disposed_callback',
      };
    }

    this.finishRequest(rawOutcome);
    return rawOutcome;
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.state = 'disposed';
    this.clearWatchdog();
    this.activeRequestId = null;
    this.activeAdType = null;
    this.activePlacement = null;
    this.unsubscribePause?.();
    this.unsubscribePause = undefined;
    this.unsubscribeResume?.();
    this.unsubscribeResume = undefined;
    this.listeners.clear();
  }

  private isStaleOrDisposed(requestId: number): boolean {
    return this.disposed || this.activeRequestId !== requestId;
  }

  private beginRequest(adType: AdType, placement: AdPlacement): number {
    const requestId = this.nextRequestId;
    this.nextRequestId += 1;
    this.activeRequestId = requestId;
    this.activeAdType = adType;
    this.activePlacement = placement;
    this.state = 'requesting';
    this.startWatchdog(requestId);
    return requestId;
  }

  private finishRequest(outcome: AdRequestOutcome): void {
    this.clearWatchdog();
    this.activeRequestId = null;
    this.activeAdType = null;
    this.activePlacement = null;
    this.state = outcome.status === 'failed' ? 'failed' : 'settled';
    this.lastOutcome = outcome;
    this.emitSnapshot();
  }

  private startWatchdog(requestId: number): void {
    this.clearWatchdog();
    if (this.config.delayedResponseWatchdogMs <= 0) {
      return;
    }
    this.watchdogTimer = this.scheduleTimeout(() => {
      if (this.disposed || this.activeRequestId !== requestId) {
        return;
      }
      // Diagnostic-only watchdog: never cancels host ads or launches gameplay early.
      this.delayedWarningCount += 1;
      this.emitSnapshot();
    }, this.config.delayedResponseWatchdogMs);
  }

  private clearWatchdog(): void {
    if (this.watchdogTimer !== undefined) {
      this.clearScheduledTimeout(this.watchdogTimer);
      this.watchdogTimer = undefined;
    }
  }

  private emitSnapshot(): void {
    if (this.listeners.size === 0) {
      return;
    }
    const snapshot = this.getDiagnosticSnapshot();
    for (const listener of [...this.listeners]) {
      listener(snapshot);
    }
  }
}
