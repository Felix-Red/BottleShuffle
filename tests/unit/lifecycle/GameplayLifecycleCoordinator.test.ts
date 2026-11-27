import { describe, expect, it, vi } from 'vitest';
import { GameplayClock } from '../../../src/services/GameplayClock';
import { GameplayLifecycleCoordinator } from '../../../src/services/GameplayLifecycleCoordinator';

describe('GameplayLifecycleCoordinator overlapping suspension reasons', () => {
  it('handles manual pause + browser hidden overlap idempotently without accidental resume', () => {
    const lifecycle = new GameplayLifecycleCoordinator();
    const listener = vi.fn();
    const unsubscribe = lifecycle.subscribe(listener);

    expect(lifecycle.canResumeGameplay()).toBe(true);
    expect(lifecycle.isSuspended()).toBe(false);

    // Player manually pauses
    expect(lifecycle.addReason('manual_pause')).toBe(true);
    // Duplicate add is idempotent
    expect(lifecycle.addReason('manual_pause')).toBe(false);
    expect(lifecycle.isSuspended()).toBe(true);
    expect(lifecycle.canResumeGameplay()).toBe(false);

    // Browser tab hides while manually paused
    expect(lifecycle.addReason('browser_hidden')).toBe(true);
    expect(lifecycle.getSnapshot().activeReasons).toEqual(['manual_pause', 'browser_hidden']);

    // Browser tab returns: manual_pause MUST remain active!
    expect(lifecycle.removeReason('browser_hidden')).toBe(true);
    expect(lifecycle.hasReason('manual_pause')).toBe(true);
    expect(lifecycle.isSuspended()).toBe(true);
    expect(lifecycle.canResumeGameplay()).toBe(false);

    // Removing non-present reason is a no-op
    expect(lifecycle.removeReason('platform_suspended')).toBe(false);

    // Player selects Resume -> clears manual_pause -> eligible to resume!
    expect(lifecycle.removeReason('manual_pause')).toBe(true);
    expect(lifecycle.isSuspended()).toBe(false);
    expect(lifecycle.canResumeGameplay()).toBe(true);

    unsubscribe();
    lifecycle.dispose();
  });

  it('prevents completed gameplay from ever resuming and preserves external suspension on restart', () => {
    const lifecycle = new GameplayLifecycleCoordinator();

    lifecycle.markCompleted();
    expect(lifecycle.canResumeGameplay()).toBe(false);

    lifecycle.addReason('manual_pause');
    lifecycle.addReason('platform_suspended');
    lifecycle.resetForNewAttempt();

    // Attempt-local overlay reasons cleared, external platform_suspended preserved
    expect(lifecycle.isCompleted()).toBe(false);
    expect(lifecycle.hasReason('manual_pause')).toBe(false);
    expect(lifecycle.hasReason('platform_suspended')).toBe(true);
    expect(lifecycle.canResumeGameplay()).toBe(false);

    lifecycle.removeReason('platform_suspended');
    expect(lifecycle.canResumeGameplay()).toBe(true);
    lifecycle.dispose();
  });
});

describe('GameplayClock exclusion of suspended durations', () => {
  it('excludes paused, settings, confirmation, and browser suspension durations accurately', () => {
    let nowMs = 1000;
    const clock = new GameplayClock({ now: () => nowMs });
    const lifecycle = new GameplayLifecycleCoordinator();

    const sync = (): void => {
      clock.setLifecycleSuspended(lifecycle.isSuspended());
    };

    clock.start();

    // Active gameplay: 30 seconds
    nowMs += 30_000;
    expect(clock.getElapsedMs()).toBe(30_000);

    // Manual pause: 10 seconds -> Settings overlay: 5 seconds -> Browser hidden: 5 seconds (total 20s suspended)
    lifecycle.addReason('manual_pause');
    sync();
    nowMs += 10_000;

    lifecycle.addReason('settings_overlay');
    sync();
    nowMs += 5_000;

    lifecycle.addReason('browser_hidden');
    sync();
    nowMs += 5_000;

    // Clear browser hidden + settings overlay (still manually paused -> still frozen)
    lifecycle.removeReason('browser_hidden');
    lifecycle.removeReason('settings_overlay');
    sync();
    nowMs += 5_000;
    expect(clock.getElapsedMs()).toBe(30_000);

    // Resume -> Active gameplay: 15 seconds
    lifecycle.removeReason('manual_pause');
    sync();
    nowMs += 15_000;
    expect(clock.getElapsedMs()).toBe(45_000);
    expect(clock.getFormattedTime()).toBe('00:45');

    // Completion freezes time permanently
    clock.complete();
    nowMs += 60_000;
    expect(clock.getElapsedMs()).toBe(45_000);

    // Restart resets elapsed time
    clock.reset(true);
    expect(clock.getElapsedMs()).toBe(0);
    lifecycle.dispose();
  });
});
