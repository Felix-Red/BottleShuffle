import { describe, expect, it } from 'vitest';
import {
  formatElapsedTime,
  GameplayClock,
  type MonotonicClock,
} from '../../../src/services/GameplayClock';

class FakeClock implements MonotonicClock {
  private currentMs = 0;

  public now(): number {
    return this.currentMs;
  }

  public advance(ms: number): void {
    this.currentMs += ms;
  }
}

describe('GameplayClock', () => {
  it('formats elapsed durations cleanly as MM:SS including long sessions and invalid inputs', () => {
    expect(formatElapsedTime(0)).toBe('00:00');
    expect(formatElapsedTime(9_999)).toBe('00:09');
    expect(formatElapsedTime(65_000)).toBe('01:05');
    expect(formatElapsedTime(6_309_000)).toBe('105:09');
    expect(formatElapsedTime(-500)).toBe('00:00');
    expect(formatElapsedTime(Number.NaN)).toBe('00:00');
  });

  it('tracks active elapsed time while excluding manual pauses and modal suspensions', () => {
    const fake = new FakeClock();
    const timer = new GameplayClock(fake);

    expect(timer.getElapsedMs()).toBe(0);
    expect(timer.isRunning()).toBe(false);

    timer.start();
    expect(timer.isRunning()).toBe(true);
    fake.advance(4_500);
    expect(timer.getElapsedMs()).toBe(4_500);
    expect(timer.getFormattedTime()).toBe('00:04');

    // Manual pause excludes paused duration
    timer.setManualPaused(true);
    expect(timer.isRunning()).toBe(false);
    fake.advance(10_000);
    expect(timer.getElapsedMs()).toBe(4_500);

    // Resume continues from previous total
    timer.setManualPaused(false);
    fake.advance(2_500);
    expect(timer.getElapsedMs()).toBe(7_000);

    // Modal suspension excludes confirmation time
    timer.setModalSuspended(true);
    fake.advance(5_000);
    timer.setModalSuspended(false);
    fake.advance(1_000);
    expect(timer.getElapsedMs()).toBe(8_000);
  });

  it('excludes platform suspension time and never allows platform resume to override manual pause', () => {
    const fake = new FakeClock();
    const timer = new GameplayClock(fake);
    timer.start();
    fake.advance(3_000);

    // Browser tab hidden -> platform suspend
    timer.setPlatformSuspended(true);
    fake.advance(15_000);
    timer.setPlatformSuspended(false);
    fake.advance(2_000);
    expect(timer.getElapsedMs()).toBe(5_000);

    // Player manually pauses, then browser tab hides and returns -> MUST remain paused!
    timer.setManualPaused(true);
    timer.setPlatformSuspended(true);
    fake.advance(20_000);
    timer.setPlatformSuspended(false);
    expect(timer.isRunning()).toBe(false);
    fake.advance(8_000);
    expect(timer.getElapsedMs()).toBe(5_000);

    // Only explicit manual resume restarts timing
    timer.setManualPaused(false);
    expect(timer.isRunning()).toBe(true);
    fake.advance(1_000);
    expect(timer.getElapsedMs()).toBe(6_000);
  });

  it('freezes elapsed time on completion and resets cleanly on restart', () => {
    const fake = new FakeClock();
    const timer = new GameplayClock(fake);
    timer.start();
    fake.advance(12_000);

    timer.complete();
    expect(timer.isRunning()).toBe(false);
    fake.advance(30_000);
    expect(timer.getElapsedMs()).toBe(12_000);
    expect(timer.getFormattedTime()).toBe('00:12');

    timer.reset(true);
    expect(timer.isRunning()).toBe(true);
    expect(timer.getElapsedMs()).toBe(0);
    fake.advance(3_000);
    expect(timer.getElapsedMs()).toBe(3_000);
  });
});
