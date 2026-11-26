import {
  GameEngine,
  generatePuzzle,
  type GameEvent,
  type PublicGameState,
  type Puzzle,
  type SeedProvider,
} from '../../core';
import {
  createBoundarySeedProvider,
  formatMatchDeltaFeedback,
  GAMEPLAY_COPY,
} from '../../config/GameplayConfig';
import { GameplayClock, type MonotonicClock } from '../../services/GameplayClock';
import { resolveGameplayLaunch, type GameplaySceneData } from './GameplaySceneData';
import type {
  GameplayOverlayMode,
  GameplayViewState,
  MatchFeedbackView,
  PendingSwapTransition,
} from './GameplayViewState';

export interface GameplayControllerCallbacks {
  readonly onViewStateChange?: (viewState: GameplayViewState) => void;
  readonly onSwapStarted?: (transition: PendingSwapTransition) => void;
  readonly onEvents?: (events: readonly GameEvent[]) => void;
}

export interface GameplayControllerOptions {
  readonly sceneData?: GameplaySceneData;
  readonly puzzle?: Puzzle;
  readonly clock?: MonotonicClock;
  readonly seedProvider?: SeedProvider;
  readonly callbacks?: GameplayControllerCallbacks;
}

/**
 * Presentation-layer controller coordinating GameEngine, GameplayClock, swap transition
 * locking, overlays, and keyboard slot focus. Contains zero domain rule duplication
 * and never exposes private puzzle targets to rendering components.
 */
export class GameplayController {
  private readonly engine: GameEngine | null;
  private readonly clock: GameplayClock;
  private readonly headerTitle: string;
  private readonly headerSubtitle: string;
  private readonly callbacks: GameplayControllerCallbacks;

  private overlayMode: GameplayOverlayMode = 'none';
  private returnToPauseOnCancel = false;
  private errorMessage: string | null = null;

  private attemptId = 1;
  private nextTransitionId = 1;
  private pendingSwap: PendingSwapTransition | null = null;
  private displayedMatchCount = 0;
  private displayedMoveCount = 0;
  private focusedSlotIndex: number | null = null;
  private matchFeedback: MatchFeedbackView | null = null;
  private feedbackSequence = 0;
  private lastFormattedTime = '00:00';
  private completionModalShown = false;
  private disposed = false;

  public constructor(options: GameplayControllerOptions = {}) {
    this.callbacks = options.callbacks ?? {};
    this.clock = new GameplayClock(options.clock);

    const launch = resolveGameplayLaunch(options.sceneData);
    this.headerTitle = launch.headerTitle;
    this.headerSubtitle = launch.headerSubtitle;

    let createdEngine: GameEngine | null = null;
    try {
      const puzzle =
        options.puzzle ??
        generatePuzzle(launch.puzzleConfig, {
          seedProvider: options.seedProvider ?? createBoundarySeedProvider(),
        });
      createdEngine = new GameEngine(puzzle);
    } catch (error) {
      this.errorMessage =
        error instanceof Error ? error.message : GAMEPLAY_COPY.errorRecovery.fallbackMessage;
      this.overlayMode = 'error';
    }

    this.engine = createdEngine;

    if (this.engine !== null) {
      const pub = this.engine.getPublicState();
      this.displayedMatchCount = pub.currentMatchCount;
      this.displayedMoveCount = pub.moveCount;
    }
  }

  public start(): GameplayViewState {
    if (this.engine === null) {
      return this.emitState();
    }

    const result = this.engine.start();
    if (result.accepted) {
      this.displayedMatchCount = result.publicState.currentMatchCount;
      this.displayedMoveCount = result.publicState.moveCount;
      this.clock.start();
      this.lastFormattedTime = this.clock.getFormattedTime();
      this.callbacks.onEvents?.(result.events);
    }

    return this.emitState();
  }

  public getPublicGameState(): PublicGameState | null {
    return this.engine?.getPublicState() ?? null;
  }

  public getViewState(): GameplayViewState {
    if (this.engine === null) {
      return Object.freeze({
        puzzleId: '',
        attemptId: this.attemptId,
        headerTitle: this.headerTitle,
        headerSubtitle: this.headerSubtitle,
        currentSequence: Object.freeze([]),
        selectedSlotIndex: null,
        focusedSlotIndex: null,
        displayedMatchCount: 0,
        displayedMoveCount: 0,
        totalBottleCount: 0,
        moveCount: 0,
        bestMatchCount: 0,
        formattedTime: '00:00',
        status: 'ready' as const,
        inputEnabled: false,
        isSwapping: false,
        instructionText: '',
        matchFeedback: null,
        overlayMode: 'error' as const,
        errorMessage: this.errorMessage,
      });
    }

    const pub = this.engine.getPublicState();
    const isSwapping = this.pendingSwap !== null;
    const inputEnabled = pub.status === 'playing' && !isSwapping && this.overlayMode === 'none';

    let instructionText: string = GAMEPLAY_COPY.instructions.noSelection;
    if (pub.status === 'completed' && !isSwapping) {
      instructionText = GAMEPLAY_COPY.instructions.completed;
    } else if (isSwapping) {
      instructionText = GAMEPLAY_COPY.instructions.swapping;
    } else if (pub.selectedSlotIndex !== null) {
      instructionText = GAMEPLAY_COPY.instructions.bottleSelected;
    }

    return Object.freeze({
      puzzleId: pub.puzzleId,
      attemptId: this.attemptId,
      headerTitle: this.headerTitle,
      headerSubtitle: this.headerSubtitle,
      currentSequence: pub.currentSequence,
      selectedSlotIndex: pub.selectedSlotIndex,
      focusedSlotIndex: this.focusedSlotIndex,
      displayedMatchCount: this.displayedMatchCount,
      displayedMoveCount: this.displayedMoveCount,
      totalBottleCount: pub.totalBottleCount,
      moveCount: pub.moveCount,
      bestMatchCount: pub.bestMatchCount,
      formattedTime: this.clock.getFormattedTime(),
      status: pub.status,
      inputEnabled,
      isSwapping,
      instructionText,
      matchFeedback: this.matchFeedback,
      overlayMode: this.overlayMode,
      errorMessage: this.errorMessage,
    });
  }

  public handleBottleTap(slotIndex: number): GameplayViewState {
    if (this.disposed || this.engine === null) {
      return this.getViewState();
    }

    if (this.overlayMode !== 'none' || this.pendingSwap !== null) {
      return this.getViewState();
    }

    const result = this.engine.selectBottle(slotIndex);
    this.callbacks.onEvents?.(result.events);

    if (!result.accepted) {
      return this.getViewState();
    }

    const swapEvent = result.events.find((event) => event.type === 'BOTTLES_SWAPPED');
    if (swapEvent?.type === 'BOTTLES_SWAPPED') {
      const completedAfterSwap = result.events.some((event) => event.type === 'PUZZLE_COMPLETED');
      const transitionId = this.nextTransitionId;
      this.nextTransitionId += 1;

      this.pendingSwap = {
        transitionId,
        attemptId: this.attemptId,
        firstIndex: swapEvent.swap.firstIndex,
        secondIndex: swapEvent.swap.secondIndex,
        swap: swapEvent.swap,
        completedAfterSwap,
      };
      if (completedAfterSwap) {
        this.clock.complete();
      }
      const nextState = this.emitState();
      this.callbacks.onSwapStarted?.(this.pendingSwap);
      return nextState;
    }

    return this.emitState();
  }

  /**
   * Called by the view once the visual swap transition completes (or immediately when
   * interrupted by resize/pause/platform suspension) to synchronise HUD feedback and
   * trigger completion UI if the swap solved the puzzle.
   *
   * Passing an explicit transitionId prevents stale callbacks from superseded or
   * previous-attempt transitions from affecting the current state.
   */
  public completeSwapTransition(transitionId?: number): GameplayViewState {
    if (this.disposed || this.engine === null || this.pendingSwap === null) {
      return this.getViewState();
    }

    if (transitionId !== undefined && this.pendingSwap.transitionId !== transitionId) {
      return this.getViewState();
    }

    const finished = this.pendingSwap;
    this.pendingSwap = null;

    const pub = this.engine.getPublicState();
    this.displayedMatchCount = pub.currentMatchCount;
    this.displayedMoveCount = pub.moveCount;

    const formatted = formatMatchDeltaFeedback(finished.swap.matchDelta);
    this.feedbackSequence += 1;
    this.matchFeedback = Object.freeze({
      text: formatted.text,
      tone: formatted.tone,
      sequenceId: this.feedbackSequence,
    });

    if (finished.completedAfterSwap && !this.completionModalShown) {
      this.completionModalShown = true;
      this.clock.complete();
      this.overlayMode = 'completed';
    }

    return this.emitState();
  }

  public clearSelection(): GameplayViewState {
    if (
      this.disposed ||
      this.engine === null ||
      this.overlayMode !== 'none' ||
      this.pendingSwap !== null
    ) {
      return this.getViewState();
    }

    const result = this.engine.clearSelection();
    if (result.accepted && result.events.length > 0) {
      this.callbacks.onEvents?.(result.events);
      return this.emitState();
    }

    return this.getViewState();
  }

  public clearMatchFeedback(): GameplayViewState {
    if (this.matchFeedback === null) {
      return this.getViewState();
    }
    this.matchFeedback = null;
    return this.emitState();
  }

  public requestPause(): GameplayViewState {
    if (this.disposed || this.engine === null) {
      return this.getViewState();
    }

    if (this.pendingSwap !== null) {
      this.completeSwapTransition();
    }

    if (this.overlayMode !== 'none') {
      return this.getViewState();
    }

    const result = this.engine.pause();
    if (result.accepted) {
      this.clock.setManualPaused(true);
      this.overlayMode = 'pause';
      this.callbacks.onEvents?.(result.events);
      return this.emitState();
    }

    return this.getViewState();
  }

  public resumeFromPause(): GameplayViewState {
    if (this.disposed || this.engine === null || this.overlayMode !== 'pause') {
      return this.getViewState();
    }

    const result = this.engine.resume();
    if (result.accepted) {
      this.overlayMode = 'none';
      this.clock.setManualPaused(false);
      this.callbacks.onEvents?.(result.events);
      return this.emitState();
    }

    return this.getViewState();
  }

  public requestRestartConfirmation(): GameplayViewState {
    if (this.disposed || this.engine === null) {
      return this.getViewState();
    }

    if (this.pendingSwap !== null) {
      this.completeSwapTransition();
    }

    if (this.overlayMode === 'error' || this.overlayMode === 'restart_confirm') {
      return this.getViewState();
    }

    if (this.overlayMode === 'completed') {
      return this.confirmRestart();
    }

    this.returnToPauseOnCancel = this.overlayMode === 'pause';
    this.overlayMode = 'restart_confirm';
    this.clock.setModalSuspended(true);
    return this.emitState();
  }

  public cancelRestartConfirmation(): GameplayViewState {
    if (this.disposed || this.overlayMode !== 'restart_confirm') {
      return this.getViewState();
    }

    this.clock.setModalSuspended(false);
    this.overlayMode = this.returnToPauseOnCancel ? 'pause' : 'none';
    this.returnToPauseOnCancel = false;
    return this.emitState();
  }

  public confirmRestart(): GameplayViewState {
    if (this.disposed || this.engine === null) {
      return this.getViewState();
    }

    this.attemptId += 1;
    this.pendingSwap = null;
    this.matchFeedback = null;
    this.completionModalShown = false;
    this.returnToPauseOnCancel = false;
    this.overlayMode = 'none';

    const result = this.engine.restart();
    if (result.accepted) {
      this.displayedMatchCount = result.publicState.currentMatchCount;
      this.displayedMoveCount = result.publicState.moveCount;
      this.clock.reset(true);
      this.lastFormattedTime = this.clock.getFormattedTime();
      this.callbacks.onEvents?.(result.events);
    }

    return this.emitState();
  }

  public handlePlatformSuspend(): GameplayViewState {
    if (this.disposed) {
      return this.getViewState();
    }
    if (this.pendingSwap !== null) {
      this.completeSwapTransition();
    }
    this.clock.setPlatformSuspended(true);
    return this.emitState();
  }

  public handlePlatformResume(): GameplayViewState {
    if (this.disposed) {
      return this.getViewState();
    }
    // Never overrides manual pause or modal suspension
    this.clock.setPlatformSuspended(false);
    return this.emitState();
  }

  /**
   * Checks whether the formatted MM:SS timer string changed since last poll.
   * Returns the updated formatted string only on change to avoid redundant text redraws.
   */
  public pollFormattedTime(): string | null {
    if (this.disposed) {
      return null;
    }
    const current = this.clock.getFormattedTime();
    if (current === this.lastFormattedTime) {
      return null;
    }
    this.lastFormattedTime = current;
    return current;
  }

  public moveKeyboardFocus(delta: number): GameplayViewState {
    if (
      this.disposed ||
      this.engine === null ||
      this.overlayMode !== 'none' ||
      this.pendingSwap !== null
    ) {
      return this.getViewState();
    }

    const total = this.engine.getPublicState().totalBottleCount;
    if (total <= 0) {
      return this.getViewState();
    }

    if (this.focusedSlotIndex === null) {
      this.focusedSlotIndex = delta >= 0 ? 0 : total - 1;
    } else {
      this.focusedSlotIndex = (this.focusedSlotIndex + delta + total) % total;
    }

    return this.emitState();
  }

  public activateFocusedSlot(): GameplayViewState {
    if (this.focusedSlotIndex === null) {
      return this.getViewState();
    }
    return this.handleBottleTap(this.focusedSlotIndex);
  }

  public handleEscapeKey(): GameplayViewState {
    if (this.disposed || this.engine === null) {
      return this.getViewState();
    }

    if (this.overlayMode === 'restart_confirm') {
      return this.cancelRestartConfirmation();
    }
    if (this.overlayMode === 'pause') {
      return this.resumeFromPause();
    }
    if (this.overlayMode !== 'none') {
      return this.getViewState();
    }

    const pub = this.engine.getPublicState();
    if (pub.selectedSlotIndex !== null) {
      return this.clearSelection();
    }
    if (pub.status === 'playing') {
      return this.requestPause();
    }
    return this.getViewState();
  }

  public dispose(): void {
    this.disposed = true;
    this.pendingSwap = null;
    this.clock.setPlatformSuspended(true);
  }

  private emitState(): GameplayViewState {
    const snapshot = this.getViewState();
    this.callbacks.onViewStateChange?.(snapshot);
    return snapshot;
  }
}
