import { describe, expect, it, vi } from 'vitest';
import type { Puzzle } from '../../src/core';
import {
  AnimationCoordinator,
  type SwapTransitionToken,
} from '../../src/game/animations/core/AnimationCoordinator';
import { resolveAnimationPolicy } from '../../src/game/animations/core/AnimationPolicy';
import { computeSwapTrajectories } from '../../src/game/animations/utils/AnimationCurves';
import { GameplayController } from '../../src/game/gameplay/GameplayController';
import { calculateGameplayLayout } from '../../src/game/layout/GameplayLayout';
import type { MonotonicClock } from '../../src/services/GameplayClock';

class FakeClock implements MonotonicClock {
  private ms = 0;
  public now(): number {
    return this.ms;
  }
  public advance(deltaMs: number): void {
    this.ms += deltaMs;
  }
}

const TEST_PUZZLE: Puzzle = Object.freeze({
  id: 'pzl-anim-int',
  seed: 'anim-int-seed',
  generatorVersion: '1.0.0',
  difficulty: 'easy',
  bottleCount: 4,
  // 0 matches initially: red@1, blue@0, yellow@3, green@2 -> 2 swaps to solve (0<->1, 2<->3)
  startingSequence: Object.freeze(['blue', 'red', 'yellow', 'green'] as const),
  targetSequence: Object.freeze(['red', 'blue', 'green', 'yellow'] as const),
});

describe('Animation & Gameplay Integration', () => {
  it('sequences swap movement, blocks rapid input, updates counters after landing, and completes once per attempt', () => {
    const clock = new FakeClock();
    const coordinator = new AnimationCoordinator();
    const activeTokens: SwapTransitionToken[] = [];
    let cancelCount = 0;

    const controller = new GameplayController({
      puzzle: TEST_PUZZLE,
      clock,
      callbacks: {
        onSwapStarted: (transition) => {
          coordinator.beginSwap(
            (token) => {
              activeTokens.push(token);
              return () => {
                cancelCount += 1;
              };
            },
            () => {
              controller.completeSwapTransition(transition.transitionId);
            },
          );
        },
      },
    });

    controller.start();
    expect(controller.getViewState().displayedMatchCount).toBe(0);
    expect(controller.getViewState().displayedMoveCount).toBe(0);

    // Swap 1: slots 0 <-> 1 (+2 matches, still incomplete)
    controller.handleBottleTap(0);
    const midSwap = controller.handleBottleTap(1);
    expect(midSwap.isSwapping).toBe(true);
    expect(midSwap.inputEnabled).toBe(false);
    // Displayed HUD counters hold pre-swap values until landing completes
    expect(midSwap.displayedMatchCount).toBe(0);
    expect(midSwap.displayedMoveCount).toBe(0);
    expect(coordinator.isSwapActive()).toBe(true);

    // Rapid tap during active swap must NOT trigger another swap
    controller.handleBottleTap(2);
    controller.handleBottleTap(3);
    expect(activeTokens).toHaveLength(1);
    expect(controller.getViewState().moveCount).toBe(1);

    // Finish swap animation -> counters update & input restores
    clock.advance(470);
    activeTokens[0]?.complete();
    const afterSwap1 = controller.getViewState();
    expect(afterSwap1.isSwapping).toBe(false);
    expect(afterSwap1.inputEnabled).toBe(true);
    expect(afterSwap1.displayedMatchCount).toBe(2);
    expect(afterSwap1.displayedMoveCount).toBe(1);
    expect(afterSwap1.matchFeedback?.text).toBe('+2 matches');
    expect(afterSwap1.matchFeedback?.tone).toBe('positive');

    // Swap 2: slots 2 <-> 3 solves the puzzle!
    controller.handleBottleTap(2);
    controller.handleBottleTap(3);
    expect(activeTokens).toHaveLength(2);
    activeTokens[1]?.complete();
    // Duplicate completion trigger is a no-op
    activeTokens[1]?.complete();

    const completed = controller.getViewState();
    expect(completed.status).toBe('completed');
    expect(completed.overlayMode).toBe('completed');
    expect(completed.inputEnabled).toBe(false);
    expect(completed.displayedMatchCount).toBe(4);
    expect(completed.displayedMoveCount).toBe(2);
    expect(cancelCount).toBe(0);

    coordinator.dispose();
    controller.dispose();
  });

  it('reconciles cleanly when interrupted by pause, resize, platform suspend, restart, or shutdown', () => {
    const clock = new FakeClock();
    const coordinator = new AnimationCoordinator();
    const cancelledSwaps = vi.fn();
    let latestToken: SwapTransitionToken | undefined;

    const controller = new GameplayController({
      puzzle: TEST_PUZZLE,
      clock,
      callbacks: {
        onSwapStarted: (transition) => {
          coordinator.beginSwap(
            (token) => {
              latestToken = token;
              return cancelledSwaps;
            },
            () => {
              controller.completeSwapTransition(transition.transitionId);
            },
          );
        },
      },
    });

    controller.start();

    // 1. Pause mid-swap: reconciles accepted swap, keeps input blocked while paused
    controller.handleBottleTap(0);
    controller.handleBottleTap(1);
    expect(coordinator.isSwapActive()).toBe(true);

    coordinator.cancelActiveSwap();
    const paused = controller.requestPause();
    expect(cancelledSwaps).toHaveBeenCalledTimes(1);
    expect(paused.status).toBe('paused');
    expect(paused.inputEnabled).toBe(false);
    expect(paused.displayedMatchCount).toBe(2);
    expect(paused.displayedMoveCount).toBe(1);
    expect(paused.currentSequence).toEqual(['red', 'blue', 'yellow', 'green']);

    // Stale token completion while paused must not restore input
    latestToken?.complete();
    expect(controller.getViewState().inputEnabled).toBe(false);

    controller.resumeFromPause();
    expect(controller.getViewState().inputEnabled).toBe(true);

    // 2. Viewport resize mid-swap (landscape -> portrait) preserves state & computes valid cross-row curves
    controller.handleBottleTap(0);
    controller.handleBottleTap(2);
    coordinator.cancelActiveSwap();
    controller.completeSwapTransition();
    const portraitLayout = calculateGameplayLayout({ width: 390, height: 844, bottleCount: 4 });
    const slot0 = portraitLayout.board.rackLayout.slots[0];
    const slot2 = portraitLayout.board.rackLayout.slots[2];
    expect(slot0).toBeDefined();
    expect(slot2).toBeDefined();
    if (slot0 !== undefined && slot2 !== undefined) {
      const pair = computeSwapTrajectories({
        fromA: { x: slot0.x, y: slot0.y },
        fromB: { x: slot2.x, y: slot2.y },
        bottleWidth: slot0.width,
        bottleHeight: slot0.height,
      });
      expect(pair.curveA.p0).toEqual({ x: slot0.x, y: slot0.y });
      expect(pair.curveA.p2).toEqual({ x: slot2.x, y: slot2.y });
    }
    expect(controller.getViewState().moveCount).toBe(2);

    // 3. Restart mid-swap invalidates previous attempt callback and restores starting puzzle
    controller.handleBottleTap(0);
    controller.handleBottleTap(1);
    const staleSwapToken = latestToken;
    coordinator.resetAttempt();
    const restarted = controller.confirmRestart();
    expect(restarted.currentSequence).toEqual(TEST_PUZZLE.startingSequence);
    expect(restarted.moveCount).toBe(0);
    expect(restarted.displayedMoveCount).toBe(0);
    expect(restarted.displayedMatchCount).toBe(0);
    staleSwapToken?.complete();
    expect(controller.getViewState().moveCount).toBe(0);

    // 4. Platform suspend mid-swap reconciles cleanly
    controller.handleBottleTap(0);
    controller.handleBottleTap(1);
    coordinator.cancelActiveSwap();
    controller.handlePlatformSuspend();
    expect(controller.getViewState().displayedMatchCount).toBe(2);
    controller.handlePlatformResume();

    // 5. Reduced-motion policy preserves all gameplay rules
    const reducedPolicy = resolveAnimationPolicy(true);
    expect(reducedPolicy.allowParticles).toBe(false);
    expect(reducedPolicy.allowCurvedSwap).toBe(false);
    expect(reducedPolicy.swapMovementMs).toBeGreaterThan(0);

    // 6. Scene shutdown cancels all outstanding animations
    const decCancel = vi.fn();
    coordinator.registerDecorative(decCancel);
    coordinator.dispose();
    controller.dispose();
    expect(decCancel).toHaveBeenCalledTimes(1);
    expect(coordinator.isDisposed()).toBe(true);
  });
});
