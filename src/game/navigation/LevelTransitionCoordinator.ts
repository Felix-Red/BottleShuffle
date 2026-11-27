import { MONETIZATION_COPY, PRODUCTION_MONETIZATION_CONFIG } from '../../config/MonetizationConfig';
import type { AdRequestOutcome } from '../../core';
import type { GamePlatform, Unsubscribe } from '../../platform/contracts/GamePlatform';
import type { AdService } from '../../services/advertising/AdService';
import type { SaveService } from '../../services/persistence/SaveService';
import type { ProgressionController } from '../progression/ProgressionController';

export interface CampaignLevelTransitionRequest {
  readonly sourceLevelId: string | null;
  readonly destinationLevelId: string | null;
  readonly puzzleCompleted: boolean;
  readonly completionCommitted: boolean;
  readonly victoryPresented: boolean;
  readonly isChapterBoundary?: boolean;
}

export type LevelTransitionStatus =
  | 'launched'
  | 'deferred_until_resume'
  | 'invalid_destination'
  | 'duplicate_blocked'
  | 'cancelled_disposed';

export interface LevelTransitionResult {
  readonly transitionId: number | null;
  readonly destinationLevelId: string | null;
  readonly status: LevelTransitionStatus;
  readonly launched: boolean;
  readonly adOutcome: AdRequestOutcome | null;
}

export interface ActiveTransitionSnapshot {
  readonly transitionId: number;
  readonly sourceLevelId: string | null;
  readonly destinationLevelId: string;
  readonly awaitingResume: boolean;
  readonly adAttempted: boolean;
}

export interface LevelTransitionCoordinatorOptions {
  readonly platform: GamePlatform;
  readonly adService?: AdService;
  readonly progressionController?: ProgressionController;
  readonly saveService?: SaveService;
  readonly isDestinationAccessible?: (levelId: string) => boolean;
  readonly onTransitionPendingChange?: (pending: boolean, statusLabel?: string) => void;
  readonly onLaunchCampaignLevel: (levelId: string, transitionId: number) => void;
  readonly preTransitionSaveFlushTimeoutMs?: number;
}

interface InternalTransaction {
  readonly transitionId: number;
  readonly sourceLevelId: string | null;
  readonly destinationLevelId: string;
  adAttempted: boolean;
  readyToLaunch: boolean;
  launched: boolean;
  adOutcome: AdRequestOutcome | null;
  readonly resolveResumeWaiter?: (result: LevelTransitionResult) => void;
}

/**
 * Coordinates campaign Next Level transitions from the Victory screen.
 *
 * Guarantees:
 * - Validates destination level existence, accessibility, and progression commitment first.
 * - Reserves a single unique transition identity to block duplicate taps/requests.
 * - Performs a bounded, non-blocking save flush before requesting an eligible interstitial.
 * - Delegates interstitial evaluation/request to `AdService` without ever retrying failures.
 * - Respects authoritative host suspension regardless of whether `onResume` arrives
 *   before or after the ad promise settles.
 * - Launches the destination level **exactly once**, even when ads are unavailable or fail.
 * - Discards obsolete callbacks cleanly upon scene shutdown or coordinator disposal.
 */
export class LevelTransitionCoordinator {
  private readonly platform: GamePlatform;
  private readonly adService?: AdService;
  private readonly progressionController?: ProgressionController;
  private readonly saveService?: SaveService;
  private readonly isDestinationAccessible?: (levelId: string) => boolean;
  private readonly onTransitionPendingChange?: (pending: boolean, statusLabel?: string) => void;
  private readonly onLaunchCampaignLevel: (levelId: string, transitionId: number) => void;
  private readonly preTransitionSaveFlushTimeoutMs: number;

  private unsubscribePause?: Unsubscribe;
  private unsubscribeResume?: Unsubscribe;
  private hostSuspended: boolean;
  private disposed = false;
  private nextTransitionId = 1;
  private activeTransaction: InternalTransaction | null = null;
  private resumeWaiterResolve: ((result: LevelTransitionResult) => void) | null = null;

  public constructor(options: LevelTransitionCoordinatorOptions) {
    this.platform = options.platform;
    this.adService = options.adService;
    this.progressionController = options.progressionController;
    this.saveService = options.saveService;
    this.isDestinationAccessible = options.isDestinationAccessible;
    this.onTransitionPendingChange = options.onTransitionPendingChange;
    this.onLaunchCampaignLevel = options.onLaunchCampaignLevel;
    this.preTransitionSaveFlushTimeoutMs =
      options.preTransitionSaveFlushTimeoutMs ??
      PRODUCTION_MONETIZATION_CONFIG.preTransitionSaveFlushTimeoutMs;

    this.hostSuspended = options.platform.isHostPaused?.() ?? false;

    this.unsubscribePause = options.platform.onPause(() => {
      if (this.disposed) {
        return;
      }
      this.hostSuspended = true;
    });

    this.unsubscribeResume = options.platform.onResume(() => {
      if (this.disposed) {
        return;
      }
      this.hostSuspended = false;
      this.tryLaunchPendingAfterResume();
    });
  }

  public isTransitionPending(): boolean {
    return this.activeTransaction !== null && !this.disposed;
  }

  public getActiveTransition(): ActiveTransitionSnapshot | null {
    if (this.activeTransaction === null || this.disposed) {
      return null;
    }
    return Object.freeze({
      transitionId: this.activeTransaction.transitionId,
      sourceLevelId: this.activeTransaction.sourceLevelId,
      destinationLevelId: this.activeTransaction.destinationLevelId,
      awaitingResume: this.activeTransaction.readyToLaunch && !this.activeTransaction.launched,
      adAttempted: this.activeTransaction.adAttempted,
    });
  }

  public async requestCampaignNextLevel(
    request: CampaignLevelTransitionRequest,
  ): Promise<LevelTransitionResult> {
    if (this.disposed) {
      return {
        transitionId: null,
        destinationLevelId: request.destinationLevelId,
        status: 'cancelled_disposed',
        launched: false,
        adOutcome: null,
      };
    }

    if (this.activeTransaction !== null) {
      return {
        transitionId: this.activeTransaction.transitionId,
        destinationLevelId: this.activeTransaction.destinationLevelId,
        status: 'duplicate_blocked',
        launched: false,
        adOutcome: null,
      };
    }

    const destinationLevelId = request.destinationLevelId?.trim() ?? '';
    if (
      destinationLevelId.length === 0 ||
      destinationLevelId === request.sourceLevelId ||
      !this.checkDestinationAccessible(destinationLevelId)
    ) {
      return {
        transitionId: null,
        destinationLevelId: destinationLevelId.length > 0 ? destinationLevelId : null,
        status: 'invalid_destination',
        launched: false,
        adOutcome: null,
      };
    }

    const transitionId = this.nextTransitionId;
    this.nextTransitionId += 1;

    const tx: InternalTransaction = {
      transitionId,
      sourceLevelId: request.sourceLevelId,
      destinationLevelId,
      adAttempted: false,
      readyToLaunch: false,
      launched: false,
      adOutcome: null,
    };
    this.activeTransaction = tx;

    const isChapterBoundary =
      request.isChapterBoundary ??
      this.detectChapterBoundary(request.sourceLevelId, destinationLevelId);

    const adContext = {
      mode: 'campaign' as const,
      trigger: 'next_level' as const,
      puzzleCompleted: request.puzzleCompleted,
      completionCommitted: request.completionCommitted,
      victoryPresented: request.victoryPresented,
      sourceLevelId: request.sourceLevelId,
      destinationLevelId,
      destinationAccessible: true,
      isChapterBoundary,
    };

    const adEvaluation = this.adService?.canRequestInterstitial(adContext);
    const willAttemptAd = adEvaluation?.canProceed === true;

    this.onTransitionPendingChange?.(
      true,
      willAttemptAd ? MONETIZATION_COPY.preparingNextLevel : undefined,
    );

    // Protect committed progress with a bounded, non-blocking save flush before ad/transition.
    if (this.saveService !== undefined) {
      try {
        await this.saveService.flush(this.preTransitionSaveFlushTimeoutMs);
      } catch {
        // Save failures must never block ordinary campaign progression.
      }
    }

    if (this.isStale(transitionId)) {
      return this.buildCancelledResult(transitionId, destinationLevelId, null);
    }

    if (this.adService !== undefined && willAttemptAd) {
      tx.adAttempted = true;
      tx.adOutcome = await this.adService.requestInterstitial(adContext);
    }

    if (this.isStale(transitionId)) {
      return this.buildCancelledResult(transitionId, destinationLevelId, tx.adOutcome);
    }

    tx.readyToLaunch = true;

    // Re-evaluate authoritative host suspension before launching gameplay.
    if (this.isHostCurrentlySuspended()) {
      return new Promise<LevelTransitionResult>((resolve) => {
        this.resumeWaiterResolve = resolve;
      });
    }

    return this.completeLaunch(tx);
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    const cancelledTx = this.activeTransaction;
    this.activeTransaction = null;

    const waiter = this.resumeWaiterResolve;
    this.resumeWaiterResolve = null;

    this.unsubscribePause?.();
    this.unsubscribePause = undefined;
    this.unsubscribeResume?.();
    this.unsubscribeResume = undefined;

    if (waiter !== null && cancelledTx !== null) {
      waiter(
        this.buildCancelledResult(
          cancelledTx.transitionId,
          cancelledTx.destinationLevelId,
          cancelledTx.adOutcome,
        ),
      );
    }
  }

  private tryLaunchPendingAfterResume(): void {
    const tx = this.activeTransaction;
    if (
      this.disposed ||
      tx === null ||
      !tx.readyToLaunch ||
      tx.launched ||
      this.isHostCurrentlySuspended()
    ) {
      return;
    }

    const result = this.completeLaunch(tx);
    const waiter = this.resumeWaiterResolve;
    this.resumeWaiterResolve = null;
    waiter?.(result);
  }

  private completeLaunch(tx: InternalTransaction): LevelTransitionResult {
    if (this.disposed || tx.launched || this.activeTransaction?.transitionId !== tx.transitionId) {
      return this.buildCancelledResult(tx.transitionId, tx.destinationLevelId, tx.adOutcome);
    }

    tx.launched = true;
    this.activeTransaction = null;
    this.onTransitionPendingChange?.(false);
    this.onLaunchCampaignLevel(tx.destinationLevelId, tx.transitionId);

    return {
      transitionId: tx.transitionId,
      destinationLevelId: tx.destinationLevelId,
      status: 'launched',
      launched: true,
      adOutcome: tx.adOutcome,
    };
  }

  private isHostCurrentlySuspended(): boolean {
    return this.hostSuspended || (this.platform.isHostPaused?.() ?? false);
  }

  private isStale(transitionId: number): boolean {
    return this.disposed || this.activeTransaction?.transitionId !== transitionId;
  }

  private checkDestinationAccessible(levelId: string): boolean {
    if (this.isDestinationAccessible !== undefined) {
      return this.isDestinationAccessible(levelId);
    }
    if (this.progressionController === undefined) {
      return true;
    }
    const levelDef = this.progressionController.getCatalog().getLevelById(levelId);
    if (levelDef === undefined) {
      return false;
    }
    const progress = this.progressionController.getLevelProgressView(levelId);
    return progress !== undefined && progress.status !== 'locked';
  }

  private detectChapterBoundary(sourceLevelId: string | null, destinationLevelId: string): boolean {
    if (sourceLevelId === null || this.progressionController === undefined) {
      return false;
    }
    const catalog = this.progressionController.getCatalog();
    const sourceDef = catalog.getLevelById(sourceLevelId);
    const destDef = catalog.getLevelById(destinationLevelId);
    if (sourceDef === undefined || destDef === undefined) {
      return false;
    }
    return sourceDef.chapterId !== destDef.chapterId;
  }

  private buildCancelledResult(
    transitionId: number,
    destinationLevelId: string,
    adOutcome: AdRequestOutcome | null,
  ): LevelTransitionResult {
    return {
      transitionId,
      destinationLevelId,
      status: 'cancelled_disposed',
      launched: false,
      adOutcome,
    };
  }
}
