/**
 * Centralised application-level monetisation and advertising configuration.
 *
 * These flags are application policy controls, NOT player preferences.
 * Inside YouTube Playables, Developer Portal monetisation toggles and YouTube's
 * own delivery/eligibility systems remain authoritative alongside these settings.
 */
export interface MonetizationPolicyConfig {
  /** Master application toggle for platform advertising integration. */
  readonly advertisingEnabled: boolean;
  /** Enables eligible interstitial ad requests on completed campaign transitions. */
  readonly interstitialEnabled: boolean;
  /** Enables the reusable rewarded-ad infrastructure layer for testing/future features. */
  readonly rewardedInfrastructureEnabled: boolean;
  /**
   * Controls whether rewarded-ad buttons are exposed in production gameplay UI.
   * Explicitly false in Task 18 until an optional reward mechanic is designed and approved.
   */
  readonly rewardedUiExposedInProduction: boolean;
  /** Tutorial gameplay is always ad-free. */
  readonly tutorialAdsDisabled: boolean;
  /** Practice mode is ad-free in the initial release. */
  readonly practiceAdsDisabled: boolean;
  /** Active puzzle solving is always ad-free. */
  readonly activeGameplayAdsDisabled: boolean;
  /** Manual pause and resume flows are always ad-free. */
  readonly pauseAdsDisabled: boolean;
  /** Restarting or replaying the same level is ad-free in the initial release. */
  readonly restartAndReplayAdsDisabled: boolean;
  /** Bounded save-flush timeout before an eligible level transition ad request. */
  readonly preTransitionSaveFlushTimeoutMs: number;
  /**
   * Diagnostic watchdog threshold (ms) for logging delayed host ad responses.
   * Never cancels a host ad or launches gameplay behind an unresolved request.
   */
  readonly delayedResponseWatchdogMs: number;
}

export const PRODUCTION_MONETIZATION_CONFIG: MonetizationPolicyConfig = Object.freeze({
  advertisingEnabled: true,
  interstitialEnabled: true,
  rewardedInfrastructureEnabled: true,
  rewardedUiExposedInProduction: false,
  tutorialAdsDisabled: true,
  practiceAdsDisabled: true,
  activeGameplayAdsDisabled: true,
  pauseAdsDisabled: true,
  restartAndReplayAdsDisabled: true,
  preTransitionSaveFlushTimeoutMs: 300,
  delayedResponseWatchdogMs: 12_000,
});

export const DEVELOPMENT_MONETIZATION_CONFIG: MonetizationPolicyConfig = Object.freeze({
  ...PRODUCTION_MONETIZATION_CONFIG,
  delayedResponseWatchdogMs: 6_000,
});

export const MONETIZATION_COPY = Object.freeze({
  preparingNextLevel: 'Preparing next level...',
  /**
   * Reserved non-PII illustrative identifiers for future explicitly approved reward features.
   * Not wired to any production gameplay mechanic in Task 18.
   */
  reservedRewardIds: Object.freeze({
    optionalHint: 'bottle-shuffle.optional-hint.v1',
    optionalAssistance: 'bottle-shuffle.optional-assistance.v1',
    devSyntheticReward: 'bottle-shuffle.dev-synthetic-reward.v1',
  }),
});

export function resolveMonetizationConfig(isDev: boolean): MonetizationPolicyConfig {
  return isDev ? DEVELOPMENT_MONETIZATION_CONFIG : PRODUCTION_MONETIZATION_CONFIG;
}
