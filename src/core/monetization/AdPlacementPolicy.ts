import type { AdGameplayMode, AdPlacement, AdTransitionTrigger } from './AdPlacement';

/**
 * Policy configuration subset evaluated by the pure domain placement rules.
 */
export interface AdPlacementPolicyRules {
  readonly advertisingEnabled: boolean;
  readonly interstitialEnabled: boolean;
  readonly rewardedInfrastructureEnabled: boolean;
  readonly rewardedUiExposedInProduction: boolean;
  readonly tutorialAdsDisabled: boolean;
  readonly practiceAdsDisabled: boolean;
  readonly activeGameplayAdsDisabled: boolean;
  readonly pauseAdsDisabled: boolean;
  readonly restartAndReplayAdsDisabled: boolean;
}

export interface InterstitialPlacementContext {
  readonly mode: AdGameplayMode;
  readonly trigger: AdTransitionTrigger;
  readonly puzzleCompleted: boolean;
  readonly completionCommitted: boolean;
  readonly victoryPresented: boolean;
  readonly sourceLevelId: string | null;
  readonly destinationLevelId: string | null;
  readonly destinationAccessible: boolean;
  readonly isChapterBoundary: boolean;
  readonly hostSuspended: boolean;
}

export type InterstitialPolicyReason =
  | 'eligible_campaign_level_transition'
  | 'eligible_chapter_transition'
  | 'advertising_disabled'
  | 'interstitial_disabled'
  | 'host_suspended'
  | 'tutorial_mode_ineligible'
  | 'practice_mode_ineligible'
  | 'trigger_ineligible'
  | 'puzzle_not_completed'
  | 'completion_not_committed'
  | 'victory_not_presented'
  | 'destination_invalid_or_inaccessible'
  | 'destination_same_as_source';

export interface InterstitialPolicyDecision {
  readonly eligible: boolean;
  readonly placement: AdPlacement | null;
  readonly reason: InterstitialPolicyReason;
  /** True when a chapter transition and level transition were coalesced into one request. */
  readonly coalescedChapterTransition: boolean;
}

export interface RewardedPlacementContext {
  readonly rewardId: string;
  readonly explicitUserOptIn: boolean;
  readonly hostSuspended: boolean;
  readonly isDevelopmentSimulation?: boolean;
}

export type RewardedPolicyReason =
  | 'eligible_optional_reward'
  | 'advertising_disabled'
  | 'rewarded_infrastructure_disabled'
  | 'rewarded_ui_not_exposed_in_production'
  | 'missing_explicit_user_opt_in'
  | 'host_suspended'
  | 'invalid_reward_identifier';

export interface RewardedPolicyDecision {
  readonly eligible: boolean;
  readonly placement: AdPlacement | null;
  readonly reason: RewardedPolicyReason;
}

const VALID_REWARD_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{2,63}$/;

/**
 * Validates that a reward identifier is a clean, bounded, non-PII token or UUID
 * matching official YouTube Playables SDK guidelines (no emails, JSON payloads, or spaces).
 */
export function validateRewardIdentifier(rewardId: string): boolean {
  if (typeof rewardId !== 'string') {
    return false;
  }
  const trimmed = rewardId.trim();
  if (trimmed !== rewardId || trimmed.length < 3 || trimmed.length > 64) {
    return false;
  }
  return VALID_REWARD_ID_PATTERN.test(trimmed);
}

/**
 * Pure deterministic policy evaluator for interstitial advertising opportunities.
 *
 * Initial release policy permits at most one interstitial request ONLY when:
 * 1. Advertising & interstitial integration are enabled.
 * 2. Application is not host-suspended.
 * 3. Active mode is `campaign` (never tutorial or practice).
 * 4. Trigger is `next_level` from a presented victory screen after committed completion.
 * 5. Destination is a valid, accessible campaign level distinct from the completed level.
 * 6. Chapter boundaries coalesce chapter + level transitions into ONE `chapter_transition`.
 */
export function evaluateInterstitialEligibility(
  context: InterstitialPlacementContext,
  rules: AdPlacementPolicyRules,
): InterstitialPolicyDecision {
  if (!rules.advertisingEnabled) {
    return {
      eligible: false,
      placement: null,
      reason: 'advertising_disabled',
      coalescedChapterTransition: false,
    };
  }

  if (!rules.interstitialEnabled) {
    return {
      eligible: false,
      placement: null,
      reason: 'interstitial_disabled',
      coalescedChapterTransition: false,
    };
  }

  if (context.hostSuspended) {
    return {
      eligible: false,
      placement: null,
      reason: 'host_suspended',
      coalescedChapterTransition: false,
    };
  }

  if (context.mode === 'tutorial' && rules.tutorialAdsDisabled) {
    return {
      eligible: false,
      placement: null,
      reason: 'tutorial_mode_ineligible',
      coalescedChapterTransition: false,
    };
  }

  if (context.mode === 'practice' && rules.practiceAdsDisabled) {
    return {
      eligible: false,
      placement: null,
      reason: 'practice_mode_ineligible',
      coalescedChapterTransition: false,
    };
  }

  if (context.mode !== 'campaign') {
    return {
      eligible: false,
      placement: null,
      reason: 'trigger_ineligible',
      coalescedChapterTransition: false,
    };
  }

  if (context.trigger !== 'next_level') {
    return {
      eligible: false,
      placement: null,
      reason: 'trigger_ineligible',
      coalescedChapterTransition: false,
    };
  }

  if (!context.puzzleCompleted) {
    return {
      eligible: false,
      placement: null,
      reason: rules.activeGameplayAdsDisabled ? 'puzzle_not_completed' : 'puzzle_not_completed',
      coalescedChapterTransition: false,
    };
  }

  if (!context.completionCommitted) {
    return {
      eligible: false,
      placement: null,
      reason: 'completion_not_committed',
      coalescedChapterTransition: false,
    };
  }

  if (!context.victoryPresented) {
    return {
      eligible: false,
      placement: null,
      reason: 'victory_not_presented',
      coalescedChapterTransition: false,
    };
  }

  if (
    context.destinationLevelId === null ||
    context.destinationLevelId.trim().length === 0 ||
    !context.destinationAccessible
  ) {
    return {
      eligible: false,
      placement: null,
      reason: 'destination_invalid_or_inaccessible',
      coalescedChapterTransition: false,
    };
  }

  if (
    context.sourceLevelId !== null &&
    context.destinationLevelId === context.sourceLevelId &&
    rules.restartAndReplayAdsDisabled
  ) {
    return {
      eligible: false,
      placement: null,
      reason: 'destination_same_as_source',
      coalescedChapterTransition: false,
    };
  }

  if (context.isChapterBoundary) {
    return {
      eligible: true,
      placement: 'chapter_transition',
      reason: 'eligible_chapter_transition',
      coalescedChapterTransition: true,
    };
  }

  return {
    eligible: true,
    placement: 'campaign_level_transition',
    reason: 'eligible_campaign_level_transition',
    coalescedChapterTransition: false,
  };
}

/**
 * Pure deterministic policy evaluator for opt-in rewarded advertising requests.
 * Production rewarded UI remains disabled in Task 18 (`rewardedUiExposedInProduction: false`),
 * while isolated development/unit-test simulations may pass `isDevelopmentSimulation: true`.
 */
export function evaluateRewardedEligibility(
  context: RewardedPlacementContext,
  rules: AdPlacementPolicyRules,
): RewardedPolicyDecision {
  if (!rules.advertisingEnabled) {
    return {
      eligible: false,
      placement: null,
      reason: 'advertising_disabled',
    };
  }

  if (!rules.rewardedInfrastructureEnabled) {
    return {
      eligible: false,
      placement: null,
      reason: 'rewarded_infrastructure_disabled',
    };
  }

  if (!rules.rewardedUiExposedInProduction && context.isDevelopmentSimulation !== true) {
    return {
      eligible: false,
      placement: null,
      reason: 'rewarded_ui_not_exposed_in_production',
    };
  }

  if (!context.explicitUserOptIn) {
    return {
      eligible: false,
      placement: null,
      reason: 'missing_explicit_user_opt_in',
    };
  }

  if (context.hostSuspended) {
    return {
      eligible: false,
      placement: null,
      reason: 'host_suspended',
    };
  }

  if (!validateRewardIdentifier(context.rewardId)) {
    return {
      eligible: false,
      placement: null,
      reason: 'invalid_reward_identifier',
    };
  }

  return {
    eligible: true,
    placement: 'optional_reward',
    reason: 'eligible_optional_reward',
  };
}
