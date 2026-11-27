import {
  createAttemptResult,
  GameEngine,
  generatePuzzle,
  type AttemptResult,
  type ChapterId,
  type GameEvent,
  type LevelId,
  type PersonalBestComparison,
  type ProgressionEvent,
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
import {
  GameplayLifecycleCoordinator,
  type GameplaySuspensionReason,
} from '../../services/GameplayLifecycleCoordinator';
import type { ProgressionController } from '../progression/ProgressionController';
import type { VictoryViewState } from '../victory/VictoryViewState';
import { mapVictoryViewState } from '../victory/VictoryViewStateMapper';
import {
  resolveGameplayLaunch,
  type GameplayMode,
  type GameplaySceneData,
} from './GameplaySceneData';
import type {
  GameplayOverlayMode,
  GameplayViewState,
  MatchFeedbackView,
  PendingSwapTransition,
} from './GameplayViewState';

export interface GameplayControllerCallbacks {
  readonly onViewStateChange?: (viewState: GameplayViewState) => void;
  readonly onSwapStarted?: (transition: PendingSwapTransition) => void;
  readonly onSwapCompleted?: (transition: PendingSwapTransition) => void;
  readonly onEvents?: (events: readonly GameEvent[]) => void;
  readonly onPlayerGameEvents?: (events: readonly GameEvent[]) => void;
  readonly onProgressionEvents?: (events: readonly ProgressionEvent[]) => void;
  readonly onExitConfirmed?: () => void;
  readonly onTutorialConfirmed?: () => void;
}

export interface GameplayControllerOptions {
  readonly sceneData?: GameplaySceneData;
  readonly progressionController?: ProgressionController;
  readonly puzzle?: Puzzle;
  readonly clock?: MonotonicClock;
  readonly lifecycle?: GameplayLifecycleCoordinator;
  readonly seedProvider?: SeedProvider;
  readonly callbacks?: GameplayControllerCallbacks;
}

/**
 * Presentation-layer controller coordinating GameEngine, GameplayClock,
 * GameplayLifecycleCoordinator, swap transition locking, deterministic scoring,
 * authoritative campaign completion recording, pause/settings/confirmation overlays,
 * and keyboard focus. Contains zero domain rule duplication.
 */
export class GameplayController {
  private readonly engine: GameEngine | null;
  private readonly clock: GameplayClock;
  private readonly lifecycle: GameplayLifecycleCoordinator;
  private readonly ownsLifecycle: boolean;
  private readonly progressionController?: ProgressionController;
  private readonly mode: GameplayMode;
  private readonly levelId: LevelId | null;
  private readonly levelNumber: number | null;
  private readonly chapterId: ChapterId | null;
  private readonly chapterName: string | null;
  private readonly headerTitle: string;
  private readonly headerSubtitle: string;
  private readonly callbacks: GameplayControllerCallbacks;

  private campaignAttemptId: string | null = null;
  private nextLevelId: LevelId | null = null;
  private nextLevelNumber: number | null = null;
  private isCampaignComplete = false;

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
  private completionCommitted = false;
  private completionModalShown = false;
  private latestAttemptResult: AttemptResult | null = null;
  private latestVictoryState: VictoryViewState | null = null;
  private exitDispatched = false;
  private disposed = false;

  public constructor(options: GameplayControllerOptions = {}) {
    this.callbacks = options.callbacks ?? {};
    this.clock = new GameplayClock(options.clock);
    if (options.lifecycle !== undefined) {
      this.lifecycle = options.lifecycle;
      this.ownsLifecycle = false;
    } else {
      this.lifecycle = new GameplayLifecycleCoordinator();
      this.ownsLifecycle = true;
    }
    this.progressionController = options.progressionController;

    const launch = resolveGameplayLaunch(options.sceneData);
    let resolvedMode: GameplayMode = launch.mode;
    let resolvedLevelId: LevelId | null = null;
    let resolvedLevelNumber: number | null = null;
    let resolvedChapterId: ChapterId | null = null;
    let resolvedChapterName: string | null = null;
    let resolvedHeaderTitle = launch.headerTitle;
    let resolvedHeaderSubtitle = launch.headerSubtitle;

    let createdEngine: GameEngine | null = null;

    if (launch.mode === 'campaign' && options.progressionController !== undefined) {
      if (launch.levelId === null) {
        this.errorMessage = 'No campaign level was specified.';
        this.overlayMode = 'error';
      } else {
        const beginResult = options.progressionController.beginCampaignAttempt(launch.levelId);
        if (!beginResult.accepted) {
          this.errorMessage =
            beginResult.reason === 'LEVEL_LOCKED'
              ? 'Complete the previous level first to unlock this level.'
              : 'This campaign level could not be found.';
          this.overlayMode = 'error';
        } else {
          resolvedLevelId = beginResult.level.id;
          resolvedLevelNumber = beginResult.level.levelNumber;
          resolvedChapterId = beginResult.level.chapterId;
          resolvedChapterName = beginResult.chapterName;
          resolvedHeaderTitle = `Level ${String(beginResult.level.levelNumber)}`;
          resolvedHeaderSubtitle = `${beginResult.chapterName} · ${String(beginResult.level.bottleCount)} Bottles`;
          this.campaignAttemptId = beginResult.attempt.attemptId;
          createdEngine = new GameEngine(options.puzzle ?? beginResult.puzzle);
        }
      }
    } else {
      resolvedMode = 'practice';
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
    }

    this.mode = resolvedMode;
    this.levelId = resolvedLevelId;
    this.levelNumber = resolvedLevelNumber;
    this.chapterId = resolvedChapterId;
    this.chapterName = resolvedChapterName;
    this.headerTitle = resolvedHeaderTitle;
    this.headerSubtitle = resolvedHeaderSubtitle;
    this.engine = createdEngine;

    if (this.engine !== null) {
      const pub = this.engine.getPublicState();
      this.displayedMatchCount = pub.currentMatchCount;
      this.displayedMoveCount = pub.moveCount;
    }

    this.refreshCampaignMeta();
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
      this.syncEngineAndClockWithLifecycle();
      this.lastFormattedTime = this.clock.getFormattedTime();
      this.callbacks.onEvents?.(result.events);
    }

    return this.emitState();
  }

  public getPublicGameState(): PublicGameState | null {
    return this.engine?.getPublicState() ?? null;
  }

  public getLifecycleCoordinator(): GameplayLifecycleCoordinator {
    return this.lifecycle;
  }

  public getElapsedMs(): number {
    return this.clock.getElapsedMs();
  }

  public getActiveCampaignAttemptId(): string | null {
    return this.campaignAttemptId;
  }

  public getLatestAttemptResult(): AttemptResult | null {
    return this.latestAttemptResult;
  }

  public getViewState(): GameplayViewState {
    if (this.engine === null) {
      return Object.freeze({
        mode: this.mode,
        levelId: this.levelId,
        levelNumber: this.levelNumber,
        chapterName: this.chapterName,
        nextLevelId: this.nextLevelId,
        nextLevelNumber: this.nextLevelNumber,
        isCampaignComplete: this.isCampaignComplete,
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
        isSuspended: true,
        inputEnabled: false,
        isSwapping: false,
        instructionText: '',
        matchFeedback: null,
        victory: null,
        overlayMode: 'error' as const,
        errorMessage: this.errorMessage,
      });
    }

    const pub = this.engine.getPublicState();
    const isSwapping = this.pendingSwap !== null;
    const isSuspended = this.lifecycle.isSuspended();
    const inputEnabled =
      pub.status === 'playing' && !isSwapping && !isSuspended && this.overlayMode === 'none';

    let instructionText: string = GAMEPLAY_COPY.instructions.noSelection;
    if (pub.status === 'completed' && !isSwapping) {
      instructionText = GAMEPLAY_COPY.instructions.completed;
    } else if (isSwapping) {
      instructionText = GAMEPLAY_COPY.instructions.swapping;
    } else if (pub.selectedSlotIndex !== null) {
      instructionText = GAMEPLAY_COPY.instructions.bottleSelected;
    }

    return Object.freeze({
      mode: this.mode,
      levelId: this.levelId,
      levelNumber: this.levelNumber,
      chapterName: this.chapterName,
      nextLevelId: this.nextLevelId,
      nextLevelNumber: this.nextLevelNumber,
      isCampaignComplete: this.isCampaignComplete,
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
      isSuspended,
      inputEnabled,
      isSwapping,
      instructionText,
      matchFeedback: this.matchFeedback,
      victory: this.latestVictoryState,
      overlayMode: this.overlayMode,
      errorMessage: this.errorMessage,
    });
  }

  public handleBottleTap(slotIndex: number): GameplayViewState {
    if (this.disposed || this.engine === null) {
      return this.getViewState();
    }

    if (this.overlayMode !== 'none' || this.pendingSwap !== null || this.lifecycle.isSuspended()) {
      return this.getViewState();
    }

    const result = this.engine.selectBottle(slotIndex);
    this.callbacks.onEvents?.(result.events);

    if (!result.accepted) {
      return this.getViewState();
    }

    if (result.events.length > 0) {
      this.callbacks.onPlayerGameEvents?.(result.events);
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
        // Freeze clock and commit authoritative scoring & progression IMMEDIATELY
        // before animations play so earned completions can never be lost on interruption.
        this.lifecycle.markCompleted();
        this.clock.complete();
        this.processCompletedAttemptOnce(result.publicState.moveCount, this.clock.getElapsedMs());
      }
      const nextState = this.emitState();
      this.callbacks.onSwapStarted?.(this.pendingSwap);
      return nextState;
    }

    return this.emitState();
  }

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
      this.lifecycle.markCompleted();
      this.clock.complete();
      this.processCompletedAttemptOnce(pub.moveCount, this.clock.getElapsedMs());
      this.overlayMode = 'completed';
    }

    this.callbacks.onSwapCompleted?.(finished);
    return this.emitState();
  }

  public clearSelection(): GameplayViewState {
    if (
      this.disposed ||
      this.engine === null ||
      this.overlayMode !== 'none' ||
      this.pendingSwap !== null ||
      this.lifecycle.isSuspended()
    ) {
      return this.getViewState();
    }

    const result = this.engine.clearSelection();
    if (result.accepted && result.events.length > 0) {
      this.callbacks.onEvents?.(result.events);
      this.callbacks.onPlayerGameEvents?.(result.events);
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

    if (this.overlayMode !== 'none' || this.lifecycle.isCompleted()) {
      return this.getViewState();
    }

    const status = this.engine.getPublicState().status;
    if (status !== 'playing' && status !== 'paused') {
      return this.getViewState();
    }

    this.lifecycle.addReason('manual_pause');
    this.overlayMode = 'pause';
    this.syncEngineAndClockWithLifecycle();
    return this.emitState();
  }

  public resumeFromPause(): GameplayViewState {
    if (
      this.disposed ||
      this.engine === null ||
      this.overlayMode !== 'pause' ||
      this.lifecycle.isCompleted()
    ) {
      return this.getViewState();
    }

    this.overlayMode = 'none';
    this.lifecycle.removeReason('manual_pause');
    this.syncEngineAndClockWithLifecycle();
    return this.emitState();
  }

  public openSettingsFromPause(): GameplayViewState {
    if (this.disposed || this.engine === null || this.overlayMode !== 'pause') {
      return this.getViewState();
    }

    this.lifecycle.addReason('settings_overlay');
    this.overlayMode = 'settings';
    this.syncEngineAndClockWithLifecycle();
    return this.emitState();
  }

  public closeSettings(): GameplayViewState {
    if (this.disposed || this.overlayMode !== 'settings') {
      return this.getViewState();
    }

    this.lifecycle.removeReason('settings_overlay');
    // Closing settings returns to the pause menu and NEVER auto-resumes gameplay
    this.overlayMode = 'pause';
    this.syncEngineAndClockWithLifecycle();
    return this.emitState();
  }

  public requestRestartConfirmation(): GameplayViewState {
    if (this.disposed || this.engine === null) {
      return this.getViewState();
    }

    if (this.pendingSwap !== null) {
      this.completeSwapTransition();
    }

    if (
      this.overlayMode === 'error' ||
      this.overlayMode === 'restart_confirm' ||
      this.overlayMode === 'exit_confirm' ||
      this.overlayMode === 'tutorial_confirm'
    ) {
      return this.getViewState();
    }

    if (this.overlayMode === 'completed') {
      return this.confirmRestart();
    }

    this.returnToPauseOnCancel = this.overlayMode === 'pause';
    this.overlayMode = 'restart_confirm';
    this.lifecycle.addReason('confirmation_dialog');
    this.syncEngineAndClockWithLifecycle();
    return this.emitState();
  }

  public cancelRestartConfirmation(): GameplayViewState {
    if (this.disposed || this.overlayMode !== 'restart_confirm') {
      return this.getViewState();
    }

    this.lifecycle.removeReason('confirmation_dialog');
    this.overlayMode = this.returnToPauseOnCancel ? 'pause' : 'none';
    this.returnToPauseOnCancel = false;
    this.syncEngineAndClockWithLifecycle();
    return this.emitState();
  }

  public confirmRestart(): GameplayViewState {
    if (this.disposed || this.engine === null) {
      return this.getViewState();
    }

    this.attemptId += 1;
    this.pendingSwap = null;
    this.matchFeedback = null;
    this.completionCommitted = false;
    this.completionModalShown = false;
    this.latestAttemptResult = null;
    this.latestVictoryState = null;
    this.returnToPauseOnCancel = false;
    this.overlayMode = 'none';
    this.lifecycle.resetForNewAttempt();

    if (
      this.mode === 'campaign' &&
      this.progressionController !== undefined &&
      this.levelId !== null
    ) {
      const nextAttempt = this.progressionController.restartActiveAttempt(this.levelId);
      this.campaignAttemptId = nextAttempt?.attemptId ?? null;
    }

    const result = this.engine.restart();
    if (result.accepted) {
      this.displayedMatchCount = result.publicState.currentMatchCount;
      this.displayedMoveCount = result.publicState.moveCount;
      this.clock.reset(true);
      this.syncEngineAndClockWithLifecycle();
      this.lastFormattedTime = this.clock.getFormattedTime();
      this.callbacks.onEvents?.(result.events);
    }

    this.refreshCampaignMeta();
    return this.emitState();
  }

  public requestExitConfirmation(): GameplayViewState {
    if (this.disposed || this.engine === null) {
      return this.getViewState();
    }

    if (this.pendingSwap !== null) {
      this.completeSwapTransition();
    }

    if (this.overlayMode !== 'pause' || this.lifecycle.isCompleted()) {
      return this.getViewState();
    }

    this.overlayMode = 'exit_confirm';
    this.lifecycle.addReason('confirmation_dialog');
    this.syncEngineAndClockWithLifecycle();
    return this.emitState();
  }

  public cancelExitConfirmation(): GameplayViewState {
    if (this.disposed || this.overlayMode !== 'exit_confirm') {
      return this.getViewState();
    }

    this.lifecycle.removeReason('confirmation_dialog');
    this.overlayMode = 'pause';
    this.syncEngineAndClockWithLifecycle();
    return this.emitState();
  }

  public confirmExit(): boolean {
    if (this.disposed || this.exitDispatched || this.overlayMode !== 'exit_confirm') {
      return false;
    }

    this.exitDispatched = true;
    this.abandonIncompleteAttempt();
    this.callbacks.onExitConfirmed?.();
    return true;
  }

  public requestTutorialConfirmation(): GameplayViewState {
    if (this.disposed || this.engine === null || this.overlayMode !== 'settings') {
      return this.getViewState();
    }

    this.overlayMode = 'tutorial_confirm';
    this.lifecycle.addReason('confirmation_dialog');
    this.syncEngineAndClockWithLifecycle();
    return this.emitState();
  }

  public cancelTutorialConfirmation(): GameplayViewState {
    if (this.disposed || this.overlayMode !== 'tutorial_confirm') {
      return this.getViewState();
    }

    this.lifecycle.removeReason('confirmation_dialog');
    this.overlayMode = 'settings';
    this.syncEngineAndClockWithLifecycle();
    return this.emitState();
  }

  public confirmTutorialReplay(): boolean {
    if (this.disposed || this.exitDispatched || this.overlayMode !== 'tutorial_confirm') {
      return false;
    }

    this.exitDispatched = true;
    this.abandonIncompleteAttempt();
    this.callbacks.onTutorialConfirmed?.();
    return true;
  }

  public addSuspensionReason(reason: GameplaySuspensionReason): GameplayViewState {
    if (this.disposed) {
      return this.getViewState();
    }
    if (this.pendingSwap !== null) {
      this.completeSwapTransition();
    }
    this.lifecycle.addReason(reason);
    this.syncEngineAndClockWithLifecycle();
    return this.emitState();
  }

  public removeSuspensionReason(reason: GameplaySuspensionReason): GameplayViewState {
    if (this.disposed) {
      return this.getViewState();
    }
    this.lifecycle.removeReason(reason);
    this.syncEngineAndClockWithLifecycle();
    return this.emitState();
  }

  public handlePlatformSuspend(): GameplayViewState {
    return this.addSuspensionReason('platform_suspended');
  }

  public handlePlatformResume(): GameplayViewState {
    return this.removeSuspensionReason('platform_suspended');
  }

  public handleBrowserHidden(): GameplayViewState {
    return this.addSuspensionReason('browser_hidden');
  }

  public handleBrowserVisible(): GameplayViewState {
    return this.removeSuspensionReason('browser_hidden');
  }

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
      this.pendingSwap !== null ||
      this.lifecycle.isSuspended()
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

    if (this.overlayMode === 'tutorial_confirm') {
      return this.cancelTutorialConfirmation();
    }
    if (this.overlayMode === 'exit_confirm') {
      return this.cancelExitConfirmation();
    }
    if (this.overlayMode === 'restart_confirm') {
      return this.cancelRestartConfirmation();
    }
    if (this.overlayMode === 'settings') {
      return this.closeSettings();
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
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.abandonIncompleteAttempt();
    if (this.ownsLifecycle) {
      this.lifecycle.dispose();
    }
  }

  private abandonIncompleteAttempt(): void {
    this.pendingSwap = null;
    this.lifecycle.addReason('scene_inactive');
    this.clock.setLifecycleSuspended(true);
    if (this.campaignAttemptId !== null) {
      this.progressionController?.abandonActiveAttempt(this.campaignAttemptId);
      this.campaignAttemptId = null;
    }
  }

  private syncEngineAndClockWithLifecycle(): void {
    if (this.engine === null) {
      this.clock.setLifecycleSuspended(true);
      return;
    }

    const suspended = this.lifecycle.isSuspended();
    this.clock.setLifecycleSuspended(suspended);

    const status = this.engine.getPublicState().status;
    if (status === 'completed' || this.lifecycle.isCompleted()) {
      return;
    }

    if (suspended && status === 'playing') {
      const pauseRes = this.engine.pause();
      if (pauseRes.accepted && pauseRes.events.length > 0) {
        this.callbacks.onEvents?.(pauseRes.events);
      }
    } else if (!suspended && status === 'paused' && this.lifecycle.canResumeGameplay()) {
      const resumeRes = this.engine.resume();
      if (resumeRes.accepted && resumeRes.events.length > 0) {
        this.callbacks.onEvents?.(resumeRes.events);
      }
    }
  }

  /**
   * Computes deterministic AttemptResult, commits campaign progression immediately,
   * and builds VictoryViewState exactly once per attempt.
   */
  private processCompletedAttemptOnce(moveCount: number, elapsedMs: number): void {
    if (this.completionCommitted || this.engine === null) {
      return;
    }
    const scoringMeta = this.engine.getCompletedScoringMetadata();
    if (scoringMeta === null) {
      return;
    }

    this.completionCommitted = true;

    const scoredMode = this.mode === 'campaign' ? 'campaign' : 'practice';
    const resolvedAttemptId =
      this.campaignAttemptId ?? `practice-${scoringMeta.puzzleId}-${String(this.attemptId)}`;

    const attemptResult = createAttemptResult({
      attemptId: resolvedAttemptId,
      puzzleId: scoringMeta.puzzleId,
      mode: scoredMode,
      levelId: scoredMode === 'campaign' ? this.levelId : null,
      difficulty: scoringMeta.difficulty,
      bottleCount: scoringMeta.bottleCount,
      actualMoves: moveCount,
      minimumRequiredSwaps: scoringMeta.minimumRequiredSwaps,
      elapsedMs,
    });
    this.latestAttemptResult = attemptResult;

    let progressionEvents: readonly ProgressionEvent[] = Object.freeze([]);
    let personalBest: PersonalBestComparison | null = null;

    if (
      scoredMode === 'campaign' &&
      this.progressionController !== undefined &&
      this.levelId !== null &&
      this.campaignAttemptId !== null
    ) {
      const result = this.progressionController.completeActiveAttempt({
        attemptId: this.campaignAttemptId,
        levelId: this.levelId,
        moveCount: attemptResult.actualMoves,
        elapsedMs: attemptResult.elapsedMs,
        score: attemptResult.totalScore,
        starRating: attemptResult.starRating,
        scoringPolicyVersion: attemptResult.scoringPolicyVersion,
      });

      this.campaignAttemptId = null;
      this.refreshCampaignMeta();

      if (result.accepted) {
        progressionEvents = result.events;
        personalBest = result.personalBest ?? null;
        if (result.events.length > 0) {
          this.callbacks.onProgressionEvents?.(result.events);
        }
      }
    }

    const campaignSummary =
      scoredMode === 'campaign' && this.progressionController !== undefined
        ? this.progressionController.getCampaignAchievementSummary()
        : null;
    const chapterStarSummary =
      scoredMode === 'campaign' &&
      this.progressionController !== undefined &&
      this.chapterId !== null
        ? (this.progressionController.getChapterStarSummary(this.chapterId) ?? null)
        : null;

    this.latestVictoryState = mapVictoryViewState({
      attemptResult,
      headerTitle: this.headerTitle,
      levelNumber: this.levelNumber,
      chapterId: this.chapterId,
      nextLevelId: this.nextLevelId,
      nextLevelNumber: this.nextLevelNumber,
      progressionEvents,
      personalBest,
      campaignSummary,
      chapterStarSummary,
      catalog: this.progressionController?.getCatalog() ?? null,
    });
  }

  private refreshCampaignMeta(): void {
    if (
      this.mode !== 'campaign' ||
      this.progressionController === undefined ||
      this.levelId === null
    ) {
      this.nextLevelId = null;
      this.nextLevelNumber = null;
      this.isCampaignComplete = false;
      return;
    }

    const next = this.progressionController.getNextPlayableLevelAfter(this.levelId);
    this.nextLevelId = next?.id ?? null;
    this.nextLevelNumber = next?.levelNumber ?? null;
    this.isCampaignComplete = this.progressionController.isCampaignComplete();
  }

  private emitState(): GameplayViewState {
    const snapshot = this.getViewState();
    this.callbacks.onViewStateChange?.(snapshot);
    return snapshot;
  }
}
