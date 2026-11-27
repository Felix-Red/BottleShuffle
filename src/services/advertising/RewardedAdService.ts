import { validateRewardIdentifier, type RewardedAdOutcome } from '../../core';
import type { GamePlatform, Unsubscribe } from '../../platform/contracts/GamePlatform';
import type { AdService } from './AdService';

export interface RewardedAdServiceOptions {
  readonly adService: AdService;
  readonly platform?: GamePlatform;
}

export interface RewardedAdTransactionRequest {
  /** Stable, non-PII reward identifier conforming to YouTube Playables SDK guidelines. */
  readonly rewardId: string;
  /** Must be true — rewarded ads are strictly opt-in via explicit player action. */
  readonly explicitUserOptIn: boolean;
  /** Optional internal transaction identifier used for duplicate-grant deduplication. */
  readonly transactionId?: string;
  /**
   * Set true strictly by isolated development diagnostics or unit tests.
   * Production UI does not expose rewarded advertising in Task 18.
   */
  readonly isDevelopmentSimulation?: boolean;
  /** Invoked at most once when the SDK explicitly confirms `rewardEarned === true`. */
  readonly onGrantReward: (grant: RewardedGrantEvent) => void;
  /**
   * Optional validity check evaluated when delivering a grant (e.g. after host resume).
   * If false, `onPreserveEarnedReward` is invoked instead of silently dropping the reward.
   */
  readonly isContextStillValid?: () => boolean;
  /** Optional fallback called if an earned reward settles after its original UI context closed. */
  readonly onPreserveEarnedReward?: (grant: RewardedGrantEvent) => void;
}

export interface RewardedGrantEvent {
  readonly transactionId: string;
  readonly rewardId: string;
  readonly deferredUntilResume: boolean;
  readonly preservedOutOfContext: boolean;
}

export interface RewardedTransactionResult {
  readonly transactionId: string;
  readonly rewardId: string;
  readonly outcome: RewardedAdOutcome;
  readonly rewardGranted: boolean;
  readonly deferredUntilResume: boolean;
  readonly preservedOutOfContext: boolean;
}

interface PendingDeferredGrant {
  readonly transactionId: string;
  readonly rewardId: string;
  readonly onGrantReward: (grant: RewardedGrantEvent) => void;
  readonly isContextStillValid?: () => boolean;
  readonly onPreserveEarnedReward?: (grant: RewardedGrantEvent) => void;
}

/**
 * Reusable rewarded advertising transaction service.
 *
 * Prepared for future explicitly approved optional reward features while keeping
 * production gameplay completely free of unfinished reward buttons in Task 18.
 *
 * Guarantees:
 * - Strictly requires `explicitUserOptIn === true` and a validated non-PII `rewardId`.
 * - Prevents concurrent rewarded transactions and duplicate reward grants per transaction ID.
 * - Grants a reward ONLY when the verified SDK resolves `rewardEarned === true`.
 * - Defers grant presentation safely if the host is suspended when the request settles.
 * - Never silently discards an earned reward if the originating UI context became obsolete.
 */
export class RewardedAdService {
  private readonly adService: AdService;
  private readonly platform?: GamePlatform;

  private readonly grantedTransactionIds = new Set<string>();
  private readonly pendingDeferredGrants: PendingDeferredGrant[] = [];

  private unsubscribeResume?: Unsubscribe;
  private nextTransactionCounter = 1;
  private activeTransactionId: string | null = null;
  private totalRewardsGranted = 0;
  private disposed = false;

  public constructor(options: RewardedAdServiceOptions) {
    this.adService = options.adService;
    this.platform = options.platform;

    if (options.platform !== undefined) {
      this.unsubscribeResume = options.platform.onResume(() => {
        if (!this.disposed) {
          this.flushDeferredGrants();
        }
      });
    }
  }

  public getTotalRewardsGranted(): number {
    return this.totalRewardsGranted;
  }

  public getPendingDeferredGrantCount(): number {
    return this.pendingDeferredGrants.length;
  }

  public hasGrantedTransaction(transactionId: string): boolean {
    return this.grantedTransactionIds.has(transactionId);
  }

  public isTransactionActive(): boolean {
    return this.activeTransactionId !== null && !this.disposed;
  }

  public async requestOptionalReward(
    request: RewardedAdTransactionRequest,
  ): Promise<RewardedTransactionResult> {
    const transactionId =
      request.transactionId ?? `reward-tx-${String(this.nextTransactionCounter++)}`;

    if (this.disposed) {
      return {
        transactionId,
        rewardId: request.rewardId,
        outcome: {
          adType: 'rewarded',
          placement: 'optional_reward',
          rewardId: request.rewardId,
          status: 'unavailable',
          rewardEarned: false,
          reason: 'rewarded_service_disposed',
        },
        rewardGranted: false,
        deferredUntilResume: false,
        preservedOutOfContext: false,
      };
    }

    if (this.grantedTransactionIds.has(transactionId)) {
      return {
        transactionId,
        rewardId: request.rewardId,
        outcome: {
          adType: 'rewarded',
          placement: 'optional_reward',
          rewardId: request.rewardId,
          status: 'suppressed_by_policy',
          rewardEarned: false,
          reason: 'duplicate_transaction_blocked',
        },
        rewardGranted: false,
        deferredUntilResume: false,
        preservedOutOfContext: false,
      };
    }

    if (this.activeTransactionId !== null) {
      return {
        transactionId,
        rewardId: request.rewardId,
        outcome: {
          adType: 'rewarded',
          placement: 'optional_reward',
          rewardId: request.rewardId,
          status: 'busy',
          rewardEarned: false,
          reason: 'concurrent_rewarded_transaction_active',
        },
        rewardGranted: false,
        deferredUntilResume: false,
        preservedOutOfContext: false,
      };
    }

    if (!request.explicitUserOptIn) {
      return {
        transactionId,
        rewardId: request.rewardId,
        outcome: {
          adType: 'rewarded',
          placement: 'optional_reward',
          rewardId: request.rewardId,
          status: 'suppressed_by_policy',
          rewardEarned: false,
          reason: 'missing_explicit_user_opt_in',
        },
        rewardGranted: false,
        deferredUntilResume: false,
        preservedOutOfContext: false,
      };
    }

    if (!validateRewardIdentifier(request.rewardId)) {
      return {
        transactionId,
        rewardId: request.rewardId,
        outcome: {
          adType: 'rewarded',
          placement: 'optional_reward',
          rewardId: request.rewardId,
          status: 'suppressed_by_policy',
          rewardEarned: false,
          reason: 'invalid_reward_identifier',
        },
        rewardGranted: false,
        deferredUntilResume: false,
        preservedOutOfContext: false,
      };
    }

    this.activeTransactionId = transactionId;

    let outcome: RewardedAdOutcome;
    try {
      outcome = await this.adService.requestRewarded({
        rewardId: request.rewardId,
        explicitUserOptIn: request.explicitUserOptIn,
        ...(request.isDevelopmentSimulation !== undefined
          ? { isDevelopmentSimulation: request.isDevelopmentSimulation }
          : {}),
      });
    } finally {
      if (this.activeTransactionId === transactionId) {
        this.activeTransactionId = null;
      }
    }

    if (
      this.isDisposed() ||
      outcome.status !== 'reward_earned' ||
      !outcome.rewardEarned ||
      this.grantedTransactionIds.has(transactionId)
    ) {
      return {
        transactionId,
        rewardId: request.rewardId,
        outcome,
        rewardGranted: false,
        deferredUntilResume: false,
        preservedOutOfContext: false,
      };
    }

    // Reserve transaction ID immediately so duplicate callbacks can never double-grant.
    this.grantedTransactionIds.add(transactionId);

    const suspendedNow =
      this.adService.isHostSuspended() || (this.platform?.isHostPaused?.() ?? false);

    if (suspendedNow) {
      this.pendingDeferredGrants.push({
        transactionId,
        rewardId: request.rewardId,
        onGrantReward: request.onGrantReward,
        ...(request.isContextStillValid !== undefined
          ? { isContextStillValid: request.isContextStillValid }
          : {}),
        ...(request.onPreserveEarnedReward !== undefined
          ? { onPreserveEarnedReward: request.onPreserveEarnedReward }
          : {}),
      });

      return {
        transactionId,
        rewardId: request.rewardId,
        outcome,
        rewardGranted: false,
        deferredUntilResume: true,
        preservedOutOfContext: false,
      };
    }

    const preservedOutOfContext = this.deliverGrant({
      transactionId,
      rewardId: request.rewardId,
      deferredUntilResume: false,
      onGrantReward: request.onGrantReward,
      ...(request.isContextStillValid !== undefined
        ? { isContextStillValid: request.isContextStillValid }
        : {}),
      ...(request.onPreserveEarnedReward !== undefined
        ? { onPreserveEarnedReward: request.onPreserveEarnedReward }
        : {}),
    });

    return {
      transactionId,
      rewardId: request.rewardId,
      outcome,
      rewardGranted: true,
      deferredUntilResume: false,
      preservedOutOfContext,
    };
  }

  public flushDeferredGrants(): number {
    if (this.disposed) {
      return 0;
    }
    const suspendedNow =
      this.adService.isHostSuspended() || (this.platform?.isHostPaused?.() ?? false);
    if (suspendedNow || this.pendingDeferredGrants.length === 0) {
      return 0;
    }

    const toDeliver = this.pendingDeferredGrants.splice(0, this.pendingDeferredGrants.length);
    for (const pending of toDeliver) {
      this.deliverGrant({
        transactionId: pending.transactionId,
        rewardId: pending.rewardId,
        deferredUntilResume: true,
        onGrantReward: pending.onGrantReward,
        ...(pending.isContextStillValid !== undefined
          ? { isContextStillValid: pending.isContextStillValid }
          : {}),
        ...(pending.onPreserveEarnedReward !== undefined
          ? { onPreserveEarnedReward: pending.onPreserveEarnedReward }
          : {}),
      });
    }
    return toDeliver.length;
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.activeTransactionId = null;
    this.pendingDeferredGrants.length = 0;
    this.unsubscribeResume?.();
    this.unsubscribeResume = undefined;
  }

  private isDisposed(): boolean {
    return this.disposed;
  }

  private deliverGrant(entry: {
    readonly transactionId: string;
    readonly rewardId: string;
    readonly deferredUntilResume: boolean;
    readonly onGrantReward: (grant: RewardedGrantEvent) => void;
    readonly isContextStillValid?: () => boolean;
    readonly onPreserveEarnedReward?: (grant: RewardedGrantEvent) => void;
  }): boolean {
    const contextValid = entry.isContextStillValid?.() ?? true;
    this.totalRewardsGranted += 1;

    if (!contextValid) {
      const preservedEvent: RewardedGrantEvent = {
        transactionId: entry.transactionId,
        rewardId: entry.rewardId,
        deferredUntilResume: entry.deferredUntilResume,
        preservedOutOfContext: true,
      };
      entry.onPreserveEarnedReward?.(preservedEvent);
      return true;
    }

    entry.onGrantReward({
      transactionId: entry.transactionId,
      rewardId: entry.rewardId,
      deferredUntilResume: entry.deferredUntilResume,
      preservedOutOfContext: false,
    });
    return false;
  }
}
