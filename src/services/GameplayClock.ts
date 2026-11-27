import { GAMEPLAY_CONFIG } from '../config/GameplayConfig';

export interface MonotonicClock {
  /** Returns monotonically increasing time in milliseconds. */
  now(): number;
}

export type CountdownUrgency = 'normal' | 'warning' | 'critical';

export function createSystemClock(): MonotonicClock {
  return {
    now(): number {
      if (
        typeof globalThis.performance !== 'undefined' &&
        typeof globalThis.performance.now === 'function'
      ) {
        return globalThis.performance.now();
      }
      return Date.now();
    },
  };
}

/**
 * Formats an elapsed duration in milliseconds as MM:SS without clipping for
 * durations over 60 minutes (e.g. 00:00, 01:42, 105:09).
 */
export function formatElapsedTime(elapsedMs: number): string {
  const safeMs = Number.isFinite(elapsedMs) && elapsedMs > 0 ? elapsedMs : 0;
  const totalSeconds = Math.floor(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Formats a countdown remaining duration in milliseconds as MM:SS using ceiling seconds
 * so positive sub-second remainders still display 00:01 rather than premature 00:00.
 */
export function formatCountdownTime(remainingMs: number): string {
  const safeMs = Number.isFinite(remainingMs) && remainingMs > 0 ? remainingMs : 0;
  const totalSeconds = Math.ceil(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Formats a concise time-limit badge label (e.g. "30s", "1:30", "3:30").
 */
export function formatTimeLimitShort(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  if (safe < 60) {
    return `${String(safe)}s`;
  }
  const mins = Math.floor(safe / 60);
  const rem = safe % 60;
  return `${String(mins)}:${String(rem).padStart(2, '0')}`;
}

/**
 * Evaluates visual countdown urgency ('normal' | 'warning' amber | 'critical' red)
 * from remaining milliseconds and total time limit using configurable thresholds.
 */
export function evaluateCountdownUrgency(
  remainingMs: number,
  timeLimitMs: number,
): CountdownUrgency {
  if (!Number.isFinite(timeLimitMs) || timeLimitMs <= 0) {
    return 'normal';
  }
  const clamped = Math.max(0, Math.min(timeLimitMs, remainingMs));
  const ratio = clamped / timeLimitMs;

  if (
    clamped <= GAMEPLAY_CONFIG.countdownCriticalFloorMs ||
    (ratio <= GAMEPLAY_CONFIG.countdownCriticalRatio &&
      clamped <= GAMEPLAY_CONFIG.countdownCriticalMs)
  ) {
    return 'critical';
  }

  if (
    ratio <= GAMEPLAY_CONFIG.countdownWarningRatio ||
    clamped <= GAMEPLAY_CONFIG.countdownWarningMs
  ) {
    return 'warning';
  }

  return 'normal';
}

/**
 * Tracks active gameplay elapsed time and optional countdown remaining time using an
 * injected monotonic clock. Manual pause, modal suspension, and platform suspension
 * are tracked independently so platform resume never overrides a player-initiated pause.
 */
export class GameplayClock {
  private readonly clock: MonotonicClock;
  private readonly timeLimitMs: number | null;

  private started = false;
  private completed = false;
  private manualPaused = false;
  private modalSuspended = false;
  private platformSuspended = false;
  private lifecycleSuspended = false;

  private accumulatedMs = 0;
  private activeSegmentStartMs: number | null = null;

  public constructor(
    clock: MonotonicClock = createSystemClock(),
    timeLimitMs: number | null = null,
  ) {
    this.clock = clock;
    this.timeLimitMs =
      timeLimitMs !== null && Number.isFinite(timeLimitMs) && timeLimitMs > 0
        ? Math.round(timeLimitMs)
        : null;
  }

  public start(): void {
    if (this.completed) {
      return;
    }
    this.started = true;
    this.syncRunningState();
  }

  public setManualPaused(paused: boolean): void {
    if (this.manualPaused === paused) {
      return;
    }
    this.manualPaused = paused;
    this.syncRunningState();
  }

  public isManualPaused(): boolean {
    return this.manualPaused;
  }

  public setModalSuspended(suspended: boolean): void {
    if (this.modalSuspended === suspended) {
      return;
    }
    this.modalSuspended = suspended;
    this.syncRunningState();
  }

  public setPlatformSuspended(suspended: boolean): void {
    if (this.platformSuspended === suspended) {
      return;
    }
    this.platformSuspended = suspended;
    this.syncRunningState();
  }

  public setLifecycleSuspended(suspended: boolean): void {
    if (this.lifecycleSuspended === suspended) {
      return;
    }
    this.lifecycleSuspended = suspended;
    this.syncRunningState();
  }

  public complete(): void {
    if (this.completed) {
      return;
    }
    this.flushActiveSegment();
    this.completed = true;
  }

  public reset(autoStart = false): void {
    this.accumulatedMs = 0;
    this.activeSegmentStartMs = null;
    this.completed = false;
    this.manualPaused = false;
    this.modalSuspended = false;
    this.started = autoStart;
    this.syncRunningState();
  }

  public isRunning(): boolean {
    return this.activeSegmentStartMs !== null;
  }

  public isTimed(): boolean {
    return this.timeLimitMs !== null;
  }

  public getTimeLimitMs(): number | null {
    return this.timeLimitMs;
  }

  public getElapsedMs(): number {
    if (this.activeSegmentStartMs === null) {
      return this.accumulatedMs;
    }
    const delta = Math.max(0, this.clock.now() - this.activeSegmentStartMs);
    return this.accumulatedMs + delta;
  }

  public getRemainingMs(): number | null {
    if (this.timeLimitMs === null) {
      return null;
    }
    return Math.max(0, this.timeLimitMs - this.getElapsedMs());
  }

  public getRemainingRatio(): number | null {
    if (this.timeLimitMs === null) {
      return null;
    }
    const remaining = this.getRemainingMs() ?? 0;
    return Math.max(0, Math.min(1, remaining / this.timeLimitMs));
  }

  public isExpired(): boolean {
    if (this.timeLimitMs === null) {
      return false;
    }
    return this.getElapsedMs() >= this.timeLimitMs;
  }

  public getCountdownUrgency(): CountdownUrgency {
    if (this.timeLimitMs === null) {
      return 'normal';
    }
    return evaluateCountdownUrgency(this.getRemainingMs() ?? 0, this.timeLimitMs);
  }

  public getFormattedTime(): string {
    return formatElapsedTime(this.getElapsedMs());
  }

  public getDisplayTime(): string {
    if (this.timeLimitMs !== null) {
      return formatCountdownTime(this.getRemainingMs() ?? 0);
    }
    return this.getFormattedTime();
  }

  private shouldRun(): boolean {
    return (
      this.started &&
      !this.completed &&
      !this.manualPaused &&
      !this.modalSuspended &&
      !this.platformSuspended &&
      !this.lifecycleSuspended
    );
  }

  private syncRunningState(): void {
    if (this.shouldRun()) {
      this.activeSegmentStartMs ??= this.clock.now();
    } else {
      this.flushActiveSegment();
    }
  }

  private flushActiveSegment(): void {
    if (this.activeSegmentStartMs !== null) {
      const delta = Math.max(0, this.clock.now() - this.activeSegmentStartMs);
      this.accumulatedMs += delta;
      this.activeSegmentStartMs = null;
    }
  }
}
