export interface MonotonicClock {
  /** Returns monotonically increasing time in milliseconds. */
  now(): number;
}

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
 * Tracks active gameplay elapsed time using an injected monotonic clock.
 * Manual pause, modal suspension, and platform suspension are tracked independently
 * so platform resume never overrides a player-initiated pause.
 */
export class GameplayClock {
  private readonly clock: MonotonicClock;

  private started = false;
  private completed = false;
  private manualPaused = false;
  private modalSuspended = false;
  private platformSuspended = false;

  private accumulatedMs = 0;
  private activeSegmentStartMs: number | null = null;

  public constructor(clock: MonotonicClock = createSystemClock()) {
    this.clock = clock;
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

  public getElapsedMs(): number {
    if (this.activeSegmentStartMs === null) {
      return this.accumulatedMs;
    }
    const delta = Math.max(0, this.clock.now() - this.activeSegmentStartMs);
    return this.accumulatedMs + delta;
  }

  public getFormattedTime(): string {
    return formatElapsedTime(this.getElapsedMs());
  }

  private shouldRun(): boolean {
    return (
      this.started &&
      !this.completed &&
      !this.manualPaused &&
      !this.modalSuspended &&
      !this.platformSuspended
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
