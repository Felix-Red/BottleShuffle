import { describe, expect, it, vi } from 'vitest';
import {
  AnimationCoordinator,
  type SwapTransitionToken,
} from '../../../src/game/animations/core/AnimationCoordinator';

describe('AnimationCoordinator', () => {
  it('runs a single swap transition at a time and guarantees completion executes at most once', () => {
    const coordinator = new AnimationCoordinator();
    const onComplete = vi.fn();
    let capturedToken: SwapTransitionToken | undefined;

    const handle = coordinator.beginSwap((token) => {
      capturedToken = token;
      return undefined;
    }, onComplete);

    expect(handle).not.toBeNull();
    expect(coordinator.isSwapActive()).toBe(true);

    // Duplicate swap request while active is rejected safely
    const duplicate = coordinator.beginSwap(() => undefined, vi.fn());
    expect(duplicate).toBeNull();

    // Completing twice still calls onComplete only once
    capturedToken?.complete();
    capturedToken?.complete();

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(coordinator.isSwapActive()).toBe(false);
  });

  it('cancels active swaps cleanly and prevents stale callbacks from firing', () => {
    const coordinator = new AnimationCoordinator();
    const onComplete = vi.fn();
    const onRunnerCancel = vi.fn();
    const onReconcile = vi.fn();
    let capturedToken: SwapTransitionToken | undefined;

    coordinator.beginSwap((token) => {
      capturedToken = token;
      return onRunnerCancel;
    }, onComplete);

    expect(coordinator.cancelActiveSwap(onReconcile)).toBe(true);
    expect(onRunnerCancel).toHaveBeenCalledTimes(1);
    expect(onReconcile).toHaveBeenCalledTimes(1);
    expect(coordinator.isSwapActive()).toBe(false);

    // Stale completion callback is ignored
    expect(capturedToken?.isValid()).toBe(false);
    capturedToken?.complete();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('invalidates previous-attempt callbacks and cleans up decorative handles on resetAttempt and dispose', () => {
    const coordinator = new AnimationCoordinator();
    const prevComplete = vi.fn();
    const decCancelA = vi.fn();
    const decCancelB = vi.fn();
    let prevToken: SwapTransitionToken | undefined;

    coordinator.beginSwap((token) => {
      prevToken = token;
      return undefined;
    }, prevComplete);

    const decA = coordinator.registerDecorative(decCancelA);
    coordinator.registerDecorative(decCancelB);
    expect(coordinator.getActiveDecorativeCount()).toBe(2);

    // Finish decorative A normally before reset
    decA.finish();
    expect(coordinator.getActiveDecorativeCount()).toBe(1);

    // Restart attempt advances epoch and cancels outstanding swap + decorative B
    const initialEpoch = coordinator.getAttemptEpoch();
    coordinator.resetAttempt();
    expect(coordinator.getAttemptEpoch()).toBe(initialEpoch + 1);
    expect(decCancelA).not.toHaveBeenCalled();
    expect(decCancelB).toHaveBeenCalledTimes(1);
    expect(coordinator.getActiveDecorativeCount()).toBe(0);

    // Stale callback from attempt 1 cannot fire
    prevToken?.complete();
    expect(prevComplete).not.toHaveBeenCalled();

    // Dispose cleans up and rejects future swaps
    const decCancelC = vi.fn();
    coordinator.registerDecorative(decCancelC);
    coordinator.dispose();
    expect(decCancelC).toHaveBeenCalledTimes(1);
    expect(coordinator.isDisposed()).toBe(true);
    expect(coordinator.beginSwap(() => undefined, vi.fn())).toBeNull();
  });
});
