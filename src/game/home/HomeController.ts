import { isDifficultyId, type DifficultyId, type LevelId } from '../../core';
import type { SceneNavigator } from '../navigation/SceneNavigator';
import type { ProgressionController } from '../progression/ProgressionController';
import type { HomeFocusTarget, HomeOverlayMode, HomeViewState } from './HomeViewState';
import { mapHomeViewState } from './HomeViewStateMapper';

export interface HomeControllerCallbacks {
  readonly onViewStateChange?: (state: HomeViewState) => void;
  /**
   * Explicit integration point for Task 11 (Interactive Tutorial) to intercept
   * first-time campaign launch if desired. Return true if handled externally.
   */
  readonly onBeforeFirstTimePlay?: (firstLevelId: LevelId) => boolean;
}

export interface HomeControllerOptions {
  readonly progressionController: ProgressionController;
  readonly navigator: SceneNavigator;
  readonly callbacks?: HomeControllerCallbacks;
}

const FOCUS_ORDER: readonly HomeFocusTarget[] = ['primary', 'levels', 'practice', 'settings'];

/**
 * Pure, Phaser-free presentation controller for the production Home screen.
 * Derives view state from ProgressionController, coordinates overlays and typed
 * scene navigation, prevents duplicate launches, and recovers cleanly from errors.
 */
export class HomeController {
  private readonly progressionController: ProgressionController;
  private readonly navigator: SceneNavigator;
  private readonly callbacks: HomeControllerCallbacks;
  private readonly unsubscribeProgression: () => void;

  private overlayMode: HomeOverlayMode = 'none';
  private focusedControl: HomeFocusTarget | null = null;
  private errorMessage: string | null = null;
  private suspended = false;
  private navigating = false;
  private disposed = false;

  public constructor(options: HomeControllerOptions) {
    this.progressionController = options.progressionController;
    this.navigator = options.navigator;
    this.callbacks = options.callbacks ?? {};

    this.unsubscribeProgression = this.progressionController.onChange(() => {
      if (!this.disposed) {
        this.emitState();
      }
    });
  }

  public getViewState(): HomeViewState {
    const canNavigate =
      !this.disposed &&
      !this.suspended &&
      !this.navigating &&
      !this.navigator.isTransitioning() &&
      this.overlayMode === 'none';

    return mapHomeViewState({
      campaignProgress: this.progressionController.getCampaignProgress(),
      campaignAchievementSummary: this.progressionController.getCampaignAchievementSummary(),
      catalog: this.progressionController.getCatalog(),
      canNavigate,
      overlayMode: this.overlayMode,
      focusedControl: this.focusedControl,
      errorMessage: this.errorMessage,
    });
  }

  public refresh(): HomeViewState {
    if (this.disposed) {
      return this.getViewState();
    }
    this.navigating = this.navigator.isTransitioning();
    return this.emitState();
  }

  public handlePrimaryAction(): boolean {
    if (this.disposed || this.suspended || this.navigating || this.overlayMode !== 'none') {
      return false;
    }

    const view = this.getViewState();
    if (view.primaryActionKind === 'open_levels') {
      return this.openLevels();
    }

    if (view.recommendedLevelId === null) {
      this.showError('No playable campaign level is currently available.');
      return false;
    }

    if (
      view.playerStatus === 'new' &&
      this.callbacks.onBeforeFirstTimePlay?.(view.recommendedLevelId) === true
    ) {
      return true;
    }

    return this.launchCampaignLevel(view.recommendedLevelId);
  }

  public launchCampaignLevel(levelId: LevelId): boolean {
    if (this.disposed || this.suspended || this.navigating) {
      return false;
    }

    const level = this.progressionController.getCatalog().getLevelById(levelId);
    if (level === undefined) {
      this.showError('The requested campaign level could not be found.');
      return false;
    }

    if (!this.progressionController.canPlayLevel(level.id)) {
      this.showError('Complete the previous level first to unlock this level.');
      return false;
    }

    this.navigating = true;
    this.overlayMode = 'none';
    this.errorMessage = null;
    this.emitState();

    const launched = this.navigator.launchCampaignLevel(level.id);
    if (!launched) {
      this.navigating = false;
      this.showError('Unable to start the level right now. Please try again.');
      return false;
    }

    return true;
  }

  public launchPracticePuzzle(difficulty: DifficultyId): boolean {
    if (this.disposed || this.suspended || this.navigating) {
      return false;
    }

    if (!isDifficultyId(difficulty)) {
      this.showError('Please choose a valid practice difficulty.');
      return false;
    }

    this.navigating = true;
    this.overlayMode = 'none';
    this.errorMessage = null;
    this.emitState();

    const launched = this.navigator.launchPracticePuzzle(difficulty);
    if (!launched) {
      this.navigating = false;
      this.showError('Unable to start practice mode right now. Please try again.');
      return false;
    }

    return true;
  }

  public launchTutorialReplay(): boolean {
    if (this.disposed || this.suspended || this.navigating || this.navigator.isTransitioning()) {
      return false;
    }

    this.navigating = true;
    this.overlayMode = 'none';
    this.errorMessage = null;
    this.emitState();

    const launched = this.navigator.launchTutorialReplay('home');
    if (!launched) {
      this.navigating = false;
      this.showError('Unable to open the tutorial right now. Please try again.');
      return false;
    }

    return true;
  }

  public openLevels(): boolean {
    if (this.disposed || this.suspended || this.navigating || this.navigator.isTransitioning()) {
      return false;
    }

    this.navigating = true;
    this.overlayMode = 'none';
    this.errorMessage = null;
    this.emitState();

    const opened = this.navigator.openLevelSelection();
    if (!opened) {
      this.navigating = false;
      this.showError('Unable to open level selection right now. Please try again.');
      return false;
    }

    return true;
  }

  public openPractice(): HomeViewState {
    if (this.disposed || this.suspended || this.navigating) {
      return this.getViewState();
    }
    this.errorMessage = null;
    this.overlayMode = 'practice';
    return this.emitState();
  }

  public openSettings(): HomeViewState {
    if (this.disposed || this.suspended || this.navigating) {
      return this.getViewState();
    }
    this.errorMessage = null;
    this.overlayMode = 'settings';
    return this.emitState();
  }

  public closeOverlay(): HomeViewState {
    if (this.disposed || this.overlayMode === 'none') {
      return this.getViewState();
    }
    this.overlayMode = 'none';
    this.errorMessage = null;
    return this.emitState();
  }

  public setSuspended(suspended: boolean): HomeViewState {
    if (this.disposed || this.suspended === suspended) {
      return this.getViewState();
    }
    this.suspended = suspended;
    return this.emitState();
  }

  public moveFocus(delta: number): HomeViewState {
    if (this.disposed || this.suspended || this.navigating || this.overlayMode !== 'none') {
      return this.getViewState();
    }

    if (this.focusedControl === null) {
      this.focusedControl = delta >= 0 ? 'primary' : 'settings';
    } else {
      const idx = FOCUS_ORDER.indexOf(this.focusedControl);
      const nextIdx = (idx + delta + FOCUS_ORDER.length) % FOCUS_ORDER.length;
      this.focusedControl = FOCUS_ORDER[nextIdx] ?? 'primary';
    }
    return this.emitState();
  }

  public activateFocusedControl(): boolean {
    if (this.disposed || this.suspended || this.navigating || this.overlayMode !== 'none') {
      return false;
    }
    switch (this.focusedControl) {
      case 'primary':
        return this.handlePrimaryAction();
      case 'levels':
        return this.openLevels();
      case 'practice':
        this.openPractice();
        return true;
      case 'settings':
        this.openSettings();
        return true;
      default:
        return false;
    }
  }

  public handleEscapeKey(): HomeViewState {
    if (this.disposed) {
      return this.getViewState();
    }
    if (this.overlayMode !== 'none') {
      return this.closeOverlay();
    }
    if (this.focusedControl !== null) {
      this.focusedControl = null;
      return this.emitState();
    }
    return this.getViewState();
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.unsubscribeProgression();
    this.navigator.cancelPendingTransition();
  }

  private showError(message: string): void {
    this.errorMessage = message;
    this.overlayMode = 'error';
    this.emitState();
  }

  private emitState(): HomeViewState {
    const next = this.getViewState();
    this.callbacks.onViewStateChange?.(next);
    return next;
  }
}
