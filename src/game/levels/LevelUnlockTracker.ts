import type { ChapterId, LevelId, ProgressionEvent } from '../../core';
import type { ProgressionController } from '../progression/ProgressionController';

const MAX_PENDING_UNLOCKS = 16;

export interface PendingChapterCompletionNotice {
  readonly chapterId: ChapterId;
  readonly chapterName: string;
  readonly nextChapterName: string | null;
}

/**
 * Session-scoped, bounded presentation tracker observing authoritative ProgressionController
 * events so newly unlocked level animations and chapter-completion notices play once when
 * visible and never mutate progression or require persistent storage.
 */
export class LevelUnlockTracker {
  private readonly progressionController: ProgressionController;
  private readonly unsubscribe: () => void;
  private readonly pendingUnlockedLevels = new Set<LevelId>();
  private readonly pendingCompletedChapters = new Map<ChapterId, PendingChapterCompletionNotice>();
  private disposed = false;

  public constructor(progressionController: ProgressionController) {
    this.progressionController = progressionController;
    this.unsubscribe = this.progressionController.onChange((_state, events) => {
      this.handleProgressionEvents(events);
    });
  }

  public getPendingUnlockedLevelIds(): ReadonlySet<LevelId> {
    return new Set(this.pendingUnlockedLevels);
  }

  public hasPendingUnlock(levelId: LevelId): boolean {
    return this.pendingUnlockedLevels.has(levelId);
  }

  public consumeUnlockedLevels(levelIds: readonly LevelId[]): void {
    for (const id of levelIds) {
      this.pendingUnlockedLevels.delete(id);
    }
  }

  public peekCompletedChapterNotice(chapterId: ChapterId): PendingChapterCompletionNotice | null {
    return this.pendingCompletedChapters.get(chapterId) ?? null;
  }

  public consumeCompletedChapterNotice(
    chapterId: ChapterId,
  ): PendingChapterCompletionNotice | null {
    const notice = this.pendingCompletedChapters.get(chapterId) ?? null;
    if (notice !== null) {
      this.pendingCompletedChapters.delete(chapterId);
    }
    return notice;
  }

  public clearAll(): void {
    this.pendingUnlockedLevels.clear();
    this.pendingCompletedChapters.clear();
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.unsubscribe();
    this.clearAll();
  }

  private handleProgressionEvents(events: readonly ProgressionEvent[]): void {
    if (this.disposed) {
      return;
    }

    const catalog = this.progressionController.getCatalog();
    const chapters = catalog.getAllChapters();

    for (const event of events) {
      if (event.type === 'LEVEL_UNLOCKED') {
        if (this.pendingUnlockedLevels.size >= MAX_PENDING_UNLOCKS) {
          const oldest = this.pendingUnlockedLevels.values().next().value;
          if (oldest !== undefined) {
            this.pendingUnlockedLevels.delete(oldest);
          }
        }
        this.pendingUnlockedLevels.add(event.levelId);
      } else if (event.type === 'CHAPTER_COMPLETED') {
        const chapter = catalog.getChapterById(event.chapterId);
        const chapterIdx = chapters.findIndex((c) => c.id === event.chapterId);
        const nextChapter =
          chapterIdx >= 0 && chapterIdx + 1 < chapters.length
            ? chapters[chapterIdx + 1]
            : undefined;
        this.pendingCompletedChapters.set(
          event.chapterId,
          Object.freeze({
            chapterId: event.chapterId,
            chapterName: chapter?.displayName ?? event.chapterId,
            nextChapterName: nextChapter?.displayName ?? null,
          }),
        );
      }
    }
  }
}
