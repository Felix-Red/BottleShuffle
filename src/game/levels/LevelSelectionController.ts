import type { ChapterId, LevelId } from '../../core';
import type { SceneNavigator } from '../navigation/SceneNavigator';
import type { ProgressionController } from '../progression/ProgressionController';
import type { LevelSelectionSceneData } from './LevelSelectionSceneData';
import type { LevelSelectionViewState } from './LevelSelectionViewState';
import {
  mapLevelSelectionViewState,
  resolveDefaultChapterId,
} from './LevelSelectionViewStateMapper';
import type { LevelUnlockTracker } from './LevelUnlockTracker';

export type ChapterTransitionDirection = -1 | 0 | 1;

export interface LevelSelectionControllerCallbacks {
  readonly onViewStateChange?: (state: LevelSelectionViewState) => void;
  readonly onChapterChange?: (
    state: LevelSelectionViewState,
    direction: ChapterTransitionDirection,
    transitionToken: number,
  ) => void;
  readonly onLockedLevelAttempt?: (message: string, levelId: LevelId) => void;
}

export interface LevelSelectionControllerOptions {
  readonly progressionController: ProgressionController;
  readonly navigator: SceneNavigator;
  readonly unlockTracker?: LevelUnlockTracker;
  readonly initialData?: LevelSelectionSceneData;
  readonly callbacks?: LevelSelectionControllerCallbacks;
}

/**
 * Pure, Phaser-free presentation controller for the Production Level Selection screen.
 * Derives all view state from ProgressionController + LevelCatalog, manages chapter switching
 * with stale-transition protection, coordinates preview dialogs, guards duplicate launches,
 * and supports keyboard navigation and graceful error recovery.
 */
export class LevelSelectionController {
  private readonly progressionController: ProgressionController;
  private readonly navigator: SceneNavigator;
  private readonly unlockTracker?: LevelUnlockTracker;
  private readonly callbacks: LevelSelectionControllerCallbacks;
  private readonly unsubscribeProgression: () => void;

  private selectedChapterId: ChapterId;
  private selectedLevelId: LevelId | null = null;
  private focusedLevelIndex: number | null = null;
  private previewLevelId: LevelId | null = null;
  private chapterCompletedBanner: string | null = null;
  private lockedFeedbackMessage: string | null = null;
  private errorMessage: string | null = null;

  private chapterTransitionToken = 0;
  private suspended = false;
  private navigating = false;
  private disposed = false;

  public constructor(options: LevelSelectionControllerOptions) {
    this.progressionController = options.progressionController;
    this.navigator = options.navigator;
    this.unlockTracker = options.unlockTracker;
    this.callbacks = options.callbacks ?? {};

    this.selectedChapterId = this.resolveInitialChapter(options.initialData);
    this.updateChapterCompletionBannerForSelected();

    this.unsubscribeProgression = this.progressionController.onChange(() => {
      if (!this.disposed) {
        this.emitState();
      }
    });
  }

  public getViewState(): LevelSelectionViewState {
    const canNavigate =
      !this.disposed && !this.suspended && !this.navigating && !this.navigator.isTransitioning();

    return mapLevelSelectionViewState({
      progressionController: this.progressionController,
      selectedChapterId: this.selectedChapterId,
      selectedLevelId: this.selectedLevelId,
      focusedLevelIndex: this.focusedLevelIndex,
      previewLevelId: this.previewLevelId,
      pendingUnlockLevelIds: this.unlockTracker?.getPendingUnlockedLevelIds() ?? new Set(),
      canNavigate,
      chapterCompletedBanner: this.chapterCompletedBanner,
      lockedFeedbackMessage: this.lockedFeedbackMessage,
      errorMessage: this.errorMessage,
    });
  }

  public getTransitionToken(): number {
    return this.chapterTransitionToken;
  }

  public isCurrentTransitionToken(token: number): boolean {
    return !this.disposed && token === this.chapterTransitionToken;
  }

  /**
   * Marks newly unlocked level animations in the currently visible chapter as presented
   * so they do not replay on subsequent visits or chapter switches.
   */
  public acknowledgeVisibleUnlocks(): readonly LevelId[] {
    if (this.disposed || this.unlockTracker === undefined) {
      return Object.freeze([]);
    }
    const visibleCards = this.getViewState().levelCards;
    const toConsume = visibleCards
      .filter((card) => card.shouldAnimateUnlock)
      .map((card) => card.levelId);
    if (toConsume.length > 0) {
      this.unlockTracker.consumeUnlockedLevels(toConsume);
    }
    return Object.freeze(toConsume);
  }

  public previousChapter(): boolean {
    if (this.disposed || this.suspended || this.navigating || this.previewLevelId !== null) {
      return false;
    }
    const chapters = this.progressionController.getCatalog().getAllChapters();
    const currentIndex = chapters.findIndex((c) => c.id === this.selectedChapterId);
    if (currentIndex <= 0) {
      return false;
    }
    const prev = chapters[currentIndex - 1];
    if (prev === undefined) {
      return false;
    }
    return this.switchChapter(prev.id, -1);
  }

  public nextChapter(): boolean {
    if (this.disposed || this.suspended || this.navigating || this.previewLevelId !== null) {
      return false;
    }
    const chapters = this.progressionController.getCatalog().getAllChapters();
    const currentIndex = chapters.findIndex((c) => c.id === this.selectedChapterId);
    if (currentIndex < 0 || currentIndex >= chapters.length - 1) {
      return false;
    }
    const next = chapters[currentIndex + 1];
    if (next === undefined) {
      return false;
    }
    return this.switchChapter(next.id, 1);
  }

  public selectChapter(chapterId: ChapterId): boolean {
    if (this.disposed || this.suspended || this.navigating || this.previewLevelId !== null) {
      return false;
    }
    const catalog = this.progressionController.getCatalog();
    if (catalog.getChapterById(chapterId) === undefined) {
      return false;
    }
    if (chapterId === this.selectedChapterId) {
      return false;
    }
    const chapters = catalog.getAllChapters();
    const fromIdx = chapters.findIndex((c) => c.id === this.selectedChapterId);
    const toIdx = chapters.findIndex((c) => c.id === chapterId);
    const direction: ChapterTransitionDirection = toIdx > fromIdx ? 1 : -1;
    return this.switchChapter(chapterId, direction);
  }

  public selectLevel(levelId: LevelId): boolean {
    if (this.disposed || this.suspended || this.navigating) {
      return false;
    }

    const catalog = this.progressionController.getCatalog();
    const level = catalog.getLevelById(levelId);
    if (level === undefined) {
      this.showError('The requested campaign level could not be found.');
      return false;
    }

    if (!this.progressionController.canPlayLevel(level.id)) {
      const prereq =
        level.prerequisiteLevelId !== null
          ? catalog.getLevelById(level.prerequisiteLevelId)
          : undefined;
      const message =
        prereq !== undefined
          ? `Complete Level ${String(prereq.levelNumber)} to unlock Level ${String(level.levelNumber)}.`
          : `Level ${String(level.levelNumber)} is currently locked.`;
      this.lockedFeedbackMessage = message;
      this.callbacks.onLockedLevelAttempt?.(message, level.id);
      this.emitState();
      return false;
    }

    // Ensure selected level's chapter is active if invoked programmatically
    if (level.chapterId !== this.selectedChapterId) {
      this.selectedChapterId = level.chapterId;
    }

    this.selectedLevelId = level.id;
    this.previewLevelId = level.id;
    this.lockedFeedbackMessage = null;
    this.errorMessage = null;
    this.emitState();
    return true;
  }

  public closePreview(): LevelSelectionViewState {
    if (this.disposed || this.previewLevelId === null) {
      return this.getViewState();
    }
    this.previewLevelId = null;
    this.selectedLevelId = null;
    return this.emitState();
  }

  public launchSelectedLevel(): boolean {
    if (this.previewLevelId === null) {
      return false;
    }
    return this.launchLevel(this.previewLevelId);
  }

  public launchLevel(levelId: LevelId): boolean {
    if (this.disposed || this.suspended || this.navigating || this.navigator.isTransitioning()) {
      return false;
    }

    const catalog = this.progressionController.getCatalog();
    const level = catalog.getLevelById(levelId);
    if (level === undefined) {
      this.previewLevelId = null;
      this.selectedLevelId = null;
      this.showError('The requested campaign level could not be found.');
      return false;
    }

    if (!this.progressionController.canPlayLevel(level.id)) {
      this.previewLevelId = null;
      this.selectedLevelId = null;
      this.showError('Complete the previous level first to unlock this level.');
      return false;
    }

    this.navigating = true;
    this.previewLevelId = null;
    this.lockedFeedbackMessage = null;
    this.errorMessage = null;
    this.chapterTransitionToken += 1;
    this.emitState();

    const launched = this.navigator.launchCampaignLevel(level.id, 'level_selection');
    if (!launched) {
      this.navigating = false;
      this.showError('Unable to start this level right now. Please try again.');
      return false;
    }

    return true;
  }

  public returnToHome(): boolean {
    if (this.disposed || this.suspended || this.navigating || this.navigator.isTransitioning()) {
      return false;
    }

    this.navigating = true;
    this.previewLevelId = null;
    this.errorMessage = null;
    this.chapterTransitionToken += 1;
    this.emitState();

    const navigated = this.navigator.returnToHome();
    if (!navigated) {
      this.navigating = false;
      this.showError('Unable to return to Home right now. Please try again.');
      return false;
    }

    return true;
  }

  public dismissError(): LevelSelectionViewState {
    if (this.disposed || this.errorMessage === null) {
      return this.getViewState();
    }
    this.errorMessage = null;
    return this.emitState();
  }

  public dismissLockedFeedback(): LevelSelectionViewState {
    if (this.disposed || this.lockedFeedbackMessage === null) {
      return this.getViewState();
    }
    this.lockedFeedbackMessage = null;
    return this.emitState();
  }

  public setSuspended(suspended: boolean): LevelSelectionViewState {
    if (this.disposed || this.suspended === suspended) {
      return this.getViewState();
    }
    this.suspended = suspended;
    return this.emitState();
  }

  public moveGridFocus(
    deltaCol: number,
    deltaRow: number,
    columns: number,
  ): LevelSelectionViewState {
    if (
      this.disposed ||
      this.suspended ||
      this.navigating ||
      this.previewLevelId !== null ||
      this.errorMessage !== null
    ) {
      return this.getViewState();
    }

    const cards = this.getViewState().levelCards;
    if (cards.length === 0) {
      return this.getViewState();
    }

    const safeCols = Math.max(1, columns);
    if (this.focusedLevelIndex === null) {
      const recIdx = cards.findIndex((c) => c.isRecommended);
      this.focusedLevelIndex = recIdx >= 0 ? recIdx : 0;
    } else {
      const nextIndex = this.focusedLevelIndex + deltaCol + deltaRow * safeCols;
      if (nextIndex >= 0 && nextIndex < cards.length) {
        this.focusedLevelIndex = nextIndex;
      }
    }

    return this.emitState();
  }

  public activateFocusedLevel(): boolean {
    if (
      this.disposed ||
      this.suspended ||
      this.navigating ||
      this.previewLevelId !== null ||
      this.errorMessage !== null ||
      this.focusedLevelIndex === null
    ) {
      return false;
    }

    const card = this.getViewState().levelCards[this.focusedLevelIndex];
    if (card === undefined) {
      return false;
    }
    return this.selectLevel(card.levelId);
  }

  public handleEscapeKey(): boolean {
    if (this.disposed || this.suspended || this.navigating) {
      return false;
    }
    if (this.errorMessage !== null) {
      this.dismissError();
      return true;
    }
    if (this.previewLevelId !== null) {
      this.closePreview();
      return true;
    }
    return this.returnToHome();
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.chapterTransitionToken += 1;
    this.unsubscribeProgression();
    this.navigator.cancelPendingTransition();
  }

  private resolveInitialChapter(initialData?: LevelSelectionSceneData): ChapterId {
    const catalog = this.progressionController.getCatalog();

    // Explicit validated levelId request takes priority
    if (initialData?.levelId !== undefined) {
      const level = catalog.getLevelById(initialData.levelId);
      if (level !== undefined) {
        return level.chapterId;
      }
    }

    // Explicit validated chapterId request
    if (initialData?.chapterId !== undefined) {
      const chapter = catalog.getChapterById(initialData.chapterId);
      if (chapter !== undefined) {
        return chapter.id;
      }
    }

    // Returning from gameplay: if the player just completed the final level of a chapter,
    // keep the completed chapter or jump cleanly if recommended moved into a new chapter?
    // Section 20: "Preserve the relevant chapter context where appropriate. If the completed
    // level unlocks the first level of a new chapter, provide a clear indication that the next
    // chapter is now available." Keeping the just-played chapter lets the player see the completed
    // chapter check + "Chapter X Complete! <Next Chapter> is now unlocked" banner, OR if they
    // returned without finishing / replaying an older chapter, stays right on that chapter!
    if (initialData?.returnFromLevelId !== undefined) {
      const returnedLevel = catalog.getLevelById(initialData.returnFromLevelId);
      if (returnedLevel !== undefined) {
        return returnedLevel.chapterId;
      }
    }

    return resolveDefaultChapterId(this.progressionController);
  }

  private switchChapter(
    targetChapterId: ChapterId,
    direction: ChapterTransitionDirection,
  ): boolean {
    this.chapterTransitionToken += 1;
    const token = this.chapterTransitionToken;
    this.selectedChapterId = targetChapterId;
    this.selectedLevelId = null;
    this.focusedLevelIndex = null;
    this.lockedFeedbackMessage = null;
    this.errorMessage = null;
    this.updateChapterCompletionBannerForSelected();

    const nextState = this.getViewState();
    this.callbacks.onChapterChange?.(nextState, direction, token);
    this.callbacks.onViewStateChange?.(nextState);
    return true;
  }

  private updateChapterCompletionBannerForSelected(): void {
    const notice =
      this.unlockTracker?.consumeCompletedChapterNotice(this.selectedChapterId) ?? null;
    if (notice === null) {
      this.chapterCompletedBanner = null;
      return;
    }

    this.chapterCompletedBanner =
      notice.nextChapterName !== null
        ? `${notice.chapterName} complete! ${notice.nextChapterName} is now available.`
        : `${notice.chapterName} complete! All campaign chapters mastered.`;
  }

  private showError(message: string): void {
    this.errorMessage = message;
    this.emitState();
  }

  private emitState(): LevelSelectionViewState {
    const next = this.getViewState();
    this.callbacks.onViewStateChange?.(next);
    return next;
  }
}
