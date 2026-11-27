import type { Unsubscribe } from '../platform/contracts/GamePlatform';

export type GameplaySuspensionReason =
  | 'manual_pause'
  | 'settings_overlay'
  | 'confirmation_dialog'
  | 'challenge_intro'
  | 'browser_hidden'
  | 'platform_suspended'
  | 'scene_inactive';

export interface GameplayLifecycleSnapshot {
  readonly activeReasons: readonly GameplaySuspensionReason[];
  readonly isSuspended: boolean;
  readonly isCompleted: boolean;
  readonly canResumeGameplay: boolean;
}

export type GameplayLifecycleListener = (snapshot: GameplayLifecycleSnapshot) => void;

const ATTEMPT_LOCAL_OVERLAY_REASONS: readonly GameplaySuspensionReason[] = [
  'manual_pause',
  'settings_overlay',
  'confirmation_dialog',
  'challenge_intro',
];

/**
 * Central gameplay lifecycle coordinator tracking overlapping suspension reasons
 * in an idempotent set. Ensures gameplay (engine, clock, and input) resumes ONLY
 * when every active suspension reason has been cleared and the attempt is incomplete.
 */
export class GameplayLifecycleCoordinator {
  private readonly activeReasons = new Set<GameplaySuspensionReason>();
  private readonly listeners = new Set<GameplayLifecycleListener>();
  private completed = false;
  private disposed = false;

  public getSnapshot(): GameplayLifecycleSnapshot {
    const reasons = Object.freeze([...this.activeReasons]);
    const isSuspended = reasons.length > 0;
    return Object.freeze({
      activeReasons: reasons,
      isSuspended,
      isCompleted: this.completed,
      canResumeGameplay: !this.completed && !isSuspended,
    });
  }

  public addReason(reason: GameplaySuspensionReason): boolean {
    if (this.disposed || this.activeReasons.has(reason)) {
      return false;
    }
    this.activeReasons.add(reason);
    this.notify();
    return true;
  }

  public removeReason(reason: GameplaySuspensionReason): boolean {
    if (this.disposed || !this.activeReasons.has(reason)) {
      return false;
    }
    this.activeReasons.delete(reason);
    this.notify();
    return true;
  }

  public hasReason(reason: GameplaySuspensionReason): boolean {
    return this.activeReasons.has(reason);
  }

  public isSuspended(): boolean {
    return this.activeReasons.size > 0;
  }

  public isCompleted(): boolean {
    return this.completed;
  }

  public canResumeGameplay(): boolean {
    return !this.completed && this.activeReasons.size === 0;
  }

  public markCompleted(): void {
    if (this.disposed || this.completed) {
      return;
    }
    this.completed = true;
    this.notify();
  }

  /**
   * Resets completion status and attempt-local overlay reasons (manual pause, settings,
   * confirmation dialogs) while preserving external host/platform suspension reasons.
   */
  public resetForNewAttempt(): void {
    if (this.disposed) {
      return;
    }
    let changed = this.completed;
    this.completed = false;
    for (const reason of ATTEMPT_LOCAL_OVERLAY_REASONS) {
      if (this.activeReasons.delete(reason)) {
        changed = true;
      }
    }
    if (changed) {
      this.notify();
    }
  }

  public subscribe(listener: GameplayLifecycleListener): Unsubscribe {
    if (this.disposed) {
      return () => undefined;
    }
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.activeReasons.clear();
    this.listeners.clear();
  }

  private notify(): void {
    const snapshot = this.getSnapshot();
    for (const listener of [...this.listeners]) {
      listener(snapshot);
    }
  }
}
