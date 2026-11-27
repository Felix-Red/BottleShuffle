import type { AdPlacement } from './AdPlacement';
import type { AdType } from './AdType';

/**
 * Application-level advertising request outcomes.
 *
 * Strictly distinguishes what the SDK actually communicates:
 * - `request_completed`: the interstitial SDK promise resolved (does NOT guarantee an
 *   ad impression was rendered or revenue was generated).
 * - `reward_earned`: `requestRewardedAd` resolved to `true`.
 * - `reward_not_earned`: `requestRewardedAd` resolved to `false`.
 * - `unavailable`: advertising is unsupported, disabled, or the SDK API is unavailable.
 * - `failed`: the SDK request rejected with an error or unexpected value.
 * - `busy`: another advertising request is already in flight.
 * - `suppressed_by_policy`: placement or lifecycle policy disallowed the request.
 */
export const AD_RESULT_STATUSES = [
  'request_completed',
  'reward_earned',
  'reward_not_earned',
  'unavailable',
  'failed',
  'busy',
  'suppressed_by_policy',
] as const;

export type AdResultStatus = (typeof AD_RESULT_STATUSES)[number];

export type AdErrorCategory =
  | 'api_unavailable'
  | 'invalid_params'
  | 'size_limit_exceeded'
  | 'capability_disabled'
  | 'request_rejected'
  | 'unknown';

export interface AdErrorDetails {
  readonly category: AdErrorCategory;
  readonly sdkErrorType: string | null;
  readonly message: string;
}

export interface AdRequestOutcome {
  readonly adType: AdType;
  readonly placement: AdPlacement;
  readonly status: AdResultStatus;
  readonly reason: string;
  readonly error?: AdErrorDetails;
}

export interface RewardedAdOutcome extends AdRequestOutcome {
  readonly adType: 'rewarded';
  readonly rewardId: string;
  readonly rewardEarned: boolean;
}
