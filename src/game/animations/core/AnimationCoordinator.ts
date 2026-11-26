import { createAnimationHandle, type AnimationHandle } from './AnimationHandle';

export interface SwapTransitionToken {
  readonly transitionId: number;
  readonly attemptEpoch: number;
  isValid(): boolean;
  complete(): void;
}

export type SwapRunner = (token: SwapTransitionToken) => (() => void) | undefined;

interface ActiveSwapRecord {
  readonly transitionId: number;
  readonly attemptEpoch: number;
  cancelled: boolean;
  completed: boolean;
  cancelRunner?: () => void;
}

/**
 * Pure, Phaser-free coordinator managing essential swap transitions, decorative animation
 * handles, attempt-scoped cancellation tokens, and single-execution completion guarantees.
 */
export class AnimationCoordinator {
  private attemptEpoch = 1;
  private nextId = 1;
  private activeSwap: ActiveSwapRecord | null = null;
  private readonly decorativeHandles = new Map<number, AnimationHandle>();
  private disposed = false;

  public getAttemptEpoch(): number {
    return this.attemptEpoch;
  }

  public isSwapActive(): boolean {
    return this.activeSwap !== null && !this.activeSwap.cancelled && !this.activeSwap.completed;
  }

  public getActiveSwapTransitionId(): number | null {
    return this.isSwapActive() ? (this.activeSwap?.transitionId ?? null) : null;
  }

  public getActiveDecorativeCount(): number {
    return this.decorativeHandles.size;
  }

  public isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * Begins an essential swap animation. Rejects duplicate requests while a swap is already active
   * or after disposal. Guarantees onComplete executes at most once and never if cancelled,
   * superseded by a restart, or disposed.
   */
  public beginSwap(runner: SwapRunner, onComplete: () => void): AnimationHandle | null {
    if (this.disposed || this.isSwapActive()) {
      return null;
    }

    const transitionId = this.nextId;
    this.nextId += 1;
    const epoch = this.attemptEpoch;

    const record: ActiveSwapRecord = {
      transitionId,
      attemptEpoch: epoch,
      cancelled: false,
      completed: false,
    };
    this.activeSwap = record;

    const isValid = (): boolean =>
      !this.disposed &&
      !record.cancelled &&
      !record.completed &&
      this.attemptEpoch === epoch &&
      this.activeSwap === record;

    const { handle, markFinished } = createAnimationHandle(transitionId, () => {
      if (record.cancelled || record.completed) {
        return;
      }
      record.cancelled = true;
      if (this.activeSwap === record) {
        this.activeSwap = null;
      }
      const cancelFn = record.cancelRunner;
      record.cancelRunner = undefined;
      cancelFn?.();
    });

    const token: SwapTransitionToken = {
      transitionId,
      attemptEpoch: epoch,
      isValid,
      complete: () => {
        if (!isValid()) {
          return;
        }
        record.completed = true;
        if (this.activeSwap === record) {
          this.activeSwap = null;
        }
        record.cancelRunner = undefined;
        markFinished();
        onComplete();
      },
    };

    const maybeCancel = runner(token);
    if (typeof maybeCancel === 'function') {
      if (!isValid()) {
        maybeCancel();
      } else {
        record.cancelRunner = maybeCancel;
      }
    }

    return handle;
  }

  /**
   * Cancels the currently active swap transition (if any) without invoking its completion callback,
   * and optionally invokes a synchronous reconciliation hook.
   */
  public cancelActiveSwap(reconcile?: () => void): boolean {
    if (this.activeSwap === null) {
      return false;
    }

    const record = this.activeSwap;
    this.activeSwap = null;

    if (!record.cancelled && !record.completed) {
      record.cancelled = true;
      const cancelFn = record.cancelRunner;
      record.cancelRunner = undefined;
      cancelFn?.();
      reconcile?.();
      return true;
    }

    return false;
  }

  /**
   * Registers a decorative animation (floating feedback, particle burst, celebration)
   * so it can be cancelled deterministically on restart or shutdown without blocking gameplay input.
   */
  public registerDecorative(onCancel: () => void): {
    readonly handle: AnimationHandle;
    readonly finish: () => void;
  } {
    const id = this.nextId;
    this.nextId += 1;

    if (this.disposed) {
      onCancel();
      const noop = createAnimationHandle(id, () => undefined);
      noop.markFinished();
      return { handle: noop.handle, finish: () => undefined };
    }

    const { handle, markFinished } = createAnimationHandle(id, () => {
      this.decorativeHandles.delete(id);
      onCancel();
    });

    this.decorativeHandles.set(id, handle);

    return {
      handle,
      finish: () => {
        markFinished();
        this.decorativeHandles.delete(id);
      },
    };
  }

  public cancelAllDecorative(): void {
    const handles = [...this.decorativeHandles.values()];
    this.decorativeHandles.clear();
    for (const handle of handles) {
      handle.cancel();
    }
  }

  /**
   * Advances the attempt epoch and cancels all active swap & decorative animations.
   * Any stale callback from a previous attempt becomes permanently invalid.
   */
  public resetAttempt(reconcile?: () => void): void {
    this.attemptEpoch += 1;
    this.cancelActiveSwap(reconcile);
    this.cancelAllDecorative();
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.attemptEpoch += 1;
    this.cancelActiveSwap();
    this.cancelAllDecorative();
  }
}
