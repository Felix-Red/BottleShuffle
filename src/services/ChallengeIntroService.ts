import { isChallengeIntroMode, type ChallengeIntroMode } from '../core';

export type ChallengeIntroListener = (seen: readonly ChallengeIntroMode[]) => void;

/**
 * Session-scoped application owner tracking which contextual challenge introductions
 * ('timed', 'limited_moves', 'combined') the player has already seen.
 * Hydrated and persisted via SaveService (Schema v2).
 */
export class ChallengeIntroService {
  private readonly seen = new Set<ChallengeIntroMode>();
  private readonly listeners = new Set<ChallengeIntroListener>();

  public constructor(initialSeen: readonly ChallengeIntroMode[] = []) {
    for (const mode of initialSeen) {
      if (isChallengeIntroMode(mode)) {
        this.seen.add(mode);
      }
    }
  }

  public hasSeen(mode: ChallengeIntroMode): boolean {
    return this.seen.has(mode);
  }

  public shouldShowIntro(mode: ChallengeIntroMode): boolean {
    return !this.seen.has(mode);
  }

  public getSeenModes(): readonly ChallengeIntroMode[] {
    return Object.freeze([...this.seen]);
  }

  public markSeen(mode: ChallengeIntroMode): void {
    if (!isChallengeIntroMode(mode) || this.seen.has(mode)) {
      return;
    }
    this.seen.add(mode);
    this.notify();
  }

  public restoreSeenModes(modes: readonly ChallengeIntroMode[]): void {
    const next = new Set<ChallengeIntroMode>();
    for (const mode of modes) {
      if (isChallengeIntroMode(mode)) {
        next.add(mode);
      }
    }
    if (next.size === this.seen.size && [...next].every((m) => this.seen.has(m))) {
      return;
    }
    this.seen.clear();
    for (const mode of next) {
      this.seen.add(mode);
    }
    this.notify();
  }

  public onChange(listener: ChallengeIntroListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public dispose(): void {
    this.listeners.clear();
  }

  private notify(): void {
    const snapshot = this.getSeenModes();
    for (const listener of [...this.listeners]) {
      listener(snapshot);
    }
  }
}
