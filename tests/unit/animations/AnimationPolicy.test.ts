import { describe, expect, it, vi } from 'vitest';
import { MotionDurations } from '../../../src/design-system/tokens/Motion';
import { resolveAnimationPolicy } from '../../../src/game/animations/core/AnimationPolicy';
import {
  MotionPreferenceService,
  type MediaQueryLike,
} from '../../../src/services/MotionPreferenceService';

describe('AnimationPolicy & MotionPreferenceService', () => {
  it('resolves normal-motion durations and flags accurately', () => {
    const policy = resolveAnimationPolicy(false);

    expect(policy.reducedMotion).toBe(false);
    expect(policy.allowLift).toBe(true);
    expect(policy.allowTilt).toBe(true);
    expect(policy.allowCurvedSwap).toBe(true);
    expect(policy.allowSquashStretch).toBe(true);
    expect(policy.allowMotionTrails).toBe(true);
    expect(policy.allowSelectionPulse).toBe(true);
    expect(policy.allowParticles).toBe(true);
    expect(policy.allowCounterPop).toBe(true);

    expect(policy.swapAnticipationMs).toBe(MotionDurations.SwapAnticipation);
    expect(policy.swapMovementMs).toBe(MotionDurations.SwapMovement);
    expect(policy.bottleLandingMs).toBe(MotionDurations.BottleLanding);
    expect(policy.swapAnticipationMs + policy.swapMovementMs + policy.bottleLandingMs).toBe(470);
    expect(policy.floatingFeedbackDurationMs).toBe(650);
    expect(policy.victoryCelebrationMs).toBe(800);
  });

  it('suppresses decorative motion while preserving essential short transitions in reduced-motion mode', () => {
    const reduced = resolveAnimationPolicy(true);

    expect(reduced.reducedMotion).toBe(true);
    expect(reduced.allowLift).toBe(false);
    expect(reduced.allowTilt).toBe(false);
    expect(reduced.allowCurvedSwap).toBe(false);
    expect(reduced.allowSquashStretch).toBe(false);
    expect(reduced.allowMotionTrails).toBe(false);
    expect(reduced.allowSelectionPulse).toBe(false);
    expect(reduced.allowParticles).toBe(false);
    expect(reduced.allowCounterPop).toBe(false);

    expect(reduced.swapAnticipationMs).toBe(0);
    expect(reduced.bottleLandingMs).toBe(0);
    expect(reduced.swapMovementMs).toBe(MotionDurations.ReducedSwapMovement);
    expect(reduced.modalEntranceMs).toBe(0);
    expect(reduced.modalDismissalMs).toBe(0);
    expect(reduced.floatingFeedbackDurationMs).toBeGreaterThan(0);
  });

  it('supports slow-motion timeScale for showcase inspection', () => {
    const slow = resolveAnimationPolicy(false, 0.5);
    expect(slow.swapMovementMs).toBe(MotionDurations.SwapMovement * 2);
    expect(slow.swapAnticipationMs).toBe(MotionDurations.SwapAnticipation * 2);
  });

  it('tracks system prefers-reduced-motion, programmatic overrides, and listener cleanup', () => {
    let mediaListener: ((event: { readonly matches: boolean }) => void) | undefined;
    const removeSpy = vi.fn();
    const fakeQuery: MediaQueryLike = {
      matches: false,
      addEventListener: (_type, listener) => {
        mediaListener = listener;
      },
      removeEventListener: removeSpy,
    };

    const service = new MotionPreferenceService(() => fakeQuery);
    const changes: boolean[] = [];
    const unsubscribe = service.onChange((value) => {
      changes.push(value);
    });

    expect(service.isReducedMotion()).toBe(false);

    // Media query flips to reduce
    mediaListener?.({ matches: true });
    expect(service.isReducedMotion()).toBe(true);
    expect(changes).toEqual([true]);

    // Programmatic override forces normal motion
    service.setOverride(false);
    expect(service.isReducedMotion()).toBe(false);
    expect(changes).toEqual([true, false]);

    // Clearing override returns to system preference (true)
    service.setOverride(null);
    expect(service.isReducedMotion()).toBe(true);
    expect(changes).toEqual([true, false, true]);

    unsubscribe();
    service.dispose();
    expect(removeSpy).toHaveBeenCalledTimes(1);
  });
});
