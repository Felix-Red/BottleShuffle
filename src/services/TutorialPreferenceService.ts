export type TutorialCompletionStatus = 'not_seen' | 'completed' | 'skipped';

export type TutorialPreferenceListener = (status: TutorialCompletionStatus) => void;

/**
 * Session-scoped application owner for tutorial completion preference.
 * Maintains 'not_seen' | 'completed' | 'skipped' in memory until Task 15 adds persistence.
 * Replaying or skipping a manually replayed tutorial never erases an existing 'completed' status.
 */
export class TutorialPreferenceService {
  private status: TutorialCompletionStatus;
  private readonly listeners = new Set<TutorialPreferenceListener>();

  public constructor(initialStatus: TutorialCompletionStatus = 'not_seen') {
    this.status = initialStatus;
  }

  public getStatus(): TutorialCompletionStatus {
    return this.status;
  }

  public shouldOfferFirstTimeTutorial(): boolean {
    return this.status === 'not_seen';
  }

  public markCompleted(): void {
    if (this.status === 'completed') {
      return;
    }
    this.status = 'completed';
    this.notify();
  }

  /**
   * Marks the tutorial as skipped ONLY if not already completed so manual replay
   * skips never erase a previously earned completion status.
   */
  public markSkipped(): void {
    if (this.status === 'completed' || this.status === 'skipped') {
      return;
    }
    this.status = 'skipped';
    this.notify();
  }

  /** Restores validated persisted tutorial status during startup hydration or dev fixtures. */
  public restoreStatus(status: TutorialCompletionStatus): void {
    if (this.status === status) {
      return;
    }
    this.status = status;
    this.notify();
  }

  public onChange(listener: TutorialPreferenceListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public dispose(): void {
    this.listeners.clear();
  }

  private notify(): void {
    for (const listener of [...this.listeners]) {
      listener(this.status);
    }
  }
}
