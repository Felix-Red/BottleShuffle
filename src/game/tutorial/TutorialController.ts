import {
  GameEngine,
  getTutorialPuzzle,
  TutorialEngine,
  type GameEvent,
  type LevelId,
  type TutorialEvent,
  type TutorialPuzzleId,
  type TutorialStageId,
} from '../../core';
import { formatMatchDeltaFeedback } from '../../config/GameplayConfig';
import { TUTORIAL_CONFIG } from '../../config/TutorialConfig';
import { GameplayClock, type MonotonicClock } from '../../services/GameplayClock';
import {
  GameplayLifecycleCoordinator,
  type GameplaySuspensionReason,
} from '../../services/GameplayLifecycleCoordinator';
import type { TutorialPreferenceService } from '../../services/TutorialPreferenceService';
import type { GameplayReturnDestination } from '../gameplay/GameplaySceneData';
import type {
  GameplayOverlayMode,
  MatchFeedbackView,
  PendingSwapTransition,
} from '../gameplay/GameplayViewState';
import type { TutorialOrigin, TutorialViewState } from './TutorialViewState';
import { mapTutorialViewState } from './TutorialViewStateMapper';

export type TutorialExitReason = 'completed' | 'skipped' | 'abandoned';

export interface TutorialControllerCallbacks {
  readonly onViewStateChange?: (viewState: TutorialViewState) => void;
  readonly onSwapStarted?: (transition: PendingSwapTransition) => void;
  readonly onSwapCompleted?: (transition: PendingSwapTransition) => void;
  readonly onPlayerGameEvents?: (events: readonly GameEvent[]) => void;
  readonly onPuzzleChanged?: (puzzleId: TutorialPuzzleId) => void;
  readonly onTutorialEvents?: (events: readonly TutorialEvent[]) => void;
  readonly onExitRequested?: (reason: TutorialExitReason) => void;
}

export interface TutorialControllerOptions {
  readonly origin?: TutorialOrigin;
  readonly returnTo?: GameplayReturnDestination;
  readonly nextCampaignLevelId?: LevelId | null;
  readonly nextCampaignLevelNumber?: number | null;
  readonly tutorialPreference?: TutorialPreferenceService;
  readonly clock?: MonotonicClock;
  readonly callbacks?: TutorialControllerCallbacks;
  /** Optional dev-only stage override for visual inspection (never used in production). */
  readonly initialStage?: TutorialStageId;
}

/**
 * Pure, Phaser-free presentation controller uniting TutorialEngine and the real GameEngine.
 * Enforces tutorial input restrictions at the controller boundary without altering core swap
 * rules or campaign progression, synchronises animation completion before advancing stages,
 * and handles skip, replay, pause, restart, keyboard input, and inactivity reminders.
 */
export class TutorialController {
  private readonly tutorialEngine: TutorialEngine;
  private gameEngine: GameEngine;
  private readonly clock: GameplayClock;
  private readonly lifecycle: GameplayLifecycleCoordinator;
  private readonly origin: TutorialOrigin;
  private readonly returnTo: GameplayReturnDestination;
  private readonly nextCampaignLevelId: LevelId | null;
  private readonly nextCampaignLevelNumber: number | null;
  private readonly tutorialPreference?: TutorialPreferenceService;
  private readonly callbacks: TutorialControllerCallbacks;

  private attemptId = 1;
  private nextTransitionId = 1;
  private pendingSwap: PendingSwapTransition | null = null;
  private displayedMatchCount = 0;
  private displayedMoveCount = 0;
  private focusedSlotIndex: number | null = null;
  private matchFeedback: MatchFeedbackView | null = null;
  private feedbackSequence = 0;
  private guidanceHint: string | null = null;
  private overlayMode: GameplayOverlayMode = 'none';
  private returnToPauseOnCancel = false;
  private errorMessage: string | null = null;
  private lastFormattedTime = '00:00';
  private exitDispatched = false;
  private disposed = false;

  public constructor(options: TutorialControllerOptions = {}) {
    this.origin = options.origin ?? 'first_time';
    this.returnTo = options.returnTo ?? 'home';
    this.nextCampaignLevelId = options.nextCampaignLevelId ?? null;
    this.nextCampaignLevelNumber = options.nextCampaignLevelNumber ?? null;
    this.tutorialPreference = options.tutorialPreference;
    this.callbacks = options.callbacks ?? {};
    this.clock = new GameplayClock(options.clock);
    this.lifecycle = new GameplayLifecycleCoordinator();

    this.tutorialEngine = new TutorialEngine();
    this.gameEngine = this.createStartedEngine('tutorial-guided-01');
    this.syncDisplayedFromEngine();

    if (options.initialStage !== undefined && options.initialStage !== 'not_started') {
      this.fastForwardToDevStage(options.initialStage);
    }
  }

  public start(): TutorialViewState {
    if (this.disposed) {
      return this.getViewState();
    }
    if (this.tutorialEngine.getState().stage === 'not_started') {
      const result = this.tutorialEngine.dispatch({ type: 'START_TUTORIAL' });
      this.clock.start();
      this.lastFormattedTime = this.clock.getFormattedTime();
      if (result.events.length > 0) {
        this.callbacks.onTutorialEvents?.(result.events);
      }
    }
    return this.emitState();
  }

  public getViewState(): TutorialViewState {
    return mapTutorialViewState({
      tutorialState: this.tutorialEngine.getState(),
      gameState: this.gameEngine.getPublicState(),
      origin: this.origin,
      returnTo: this.returnTo,
      nextCampaignLevelId: this.nextCampaignLevelId,
      nextCampaignLevelNumber: this.nextCampaignLevelNumber,
      attemptId: this.attemptId,
      displayedMatchCount: this.displayedMatchCount,
      displayedMoveCount: this.displayedMoveCount,
      formattedTime: this.clock.getFormattedTime(),
      focusedSlotIndex: this.focusedSlotIndex,
      isSwapping: this.pendingSwap !== null,
      guidanceHint: this.guidanceHint,
      matchFeedback: this.matchFeedback,
      overlayMode: this.overlayMode,
      errorMessage: this.errorMessage,
    });
  }

  public handlePrimaryAction(): TutorialViewState {
    if (this.disposed || this.overlayMode !== 'none' || this.pendingSwap !== null) {
      return this.getViewState();
    }

    const stage = this.tutorialEngine.getState().stage;
    if (stage === 'introduction') {
      const res = this.tutorialEngine.dispatch({ type: 'ACKNOWLEDGE_INTRO' });
      if (res.accepted) {
        this.guidanceHint = null;
        this.callbacks.onTutorialEvents?.(res.events);
      }
      return this.emitState();
    }

    if (stage === 'counter_explanation') {
      const res = this.tutorialEngine.dispatch({ type: 'ACKNOWLEDGE_COUNTER' });
      if (res.accepted) {
        this.guidanceHint = null;
        this.applyPuzzleChangeEvents(res.events);
        this.callbacks.onTutorialEvents?.(res.events);
      }
      return this.emitState();
    }

    return this.getViewState();
  }

  public handleSecondaryAction(): TutorialViewState {
    if (this.disposed || this.overlayMode !== 'none' || this.pendingSwap !== null) {
      return this.getViewState();
    }

    const stage = this.tutorialEngine.getState().stage;
    if (stage !== 'counter_explanation') {
      return this.getViewState();
    }

    const res = this.tutorialEngine.dispatch({ type: 'ADVANCE_COUNTER_DEMO' });
    if (!res.accepted) {
      return this.getViewState();
    }

    this.guidanceHint = null;
    this.applyPuzzleChangeEvents(res.events);
    this.callbacks.onTutorialEvents?.(res.events);

    const swapReq = res.events.find((e) => e.type === 'COUNTER_DEMO_SWAP_REQUESTED');
    if (swapReq?.type === 'COUNTER_DEMO_SWAP_REQUESTED') {
      // Execute the real swap on GameEngine so MatchCalculator computes actual counters
      const gameRes = this.gameEngine.swapBottles(swapReq.firstIndex, swapReq.secondIndex);
      const swapEvent = gameRes.events.find((e) => e.type === 'BOTTLES_SWAPPED');
      if (gameRes.accepted && swapEvent?.type === 'BOTTLES_SWAPPED') {
        const transitionId = this.nextTransitionId;
        this.nextTransitionId += 1;
        this.pendingSwap = {
          transitionId,
          attemptId: this.attemptId,
          firstIndex: swapEvent.swap.firstIndex,
          secondIndex: swapEvent.swap.secondIndex,
          swap: swapEvent.swap,
          completedAfterSwap: false,
        };
        const state = this.emitState();
        this.callbacks.onSwapStarted?.(this.pendingSwap);
        return state;
      }
    }

    return this.emitState();
  }

  public handleBottleTap(slotIndex: number): TutorialViewState {
    if (this.disposed || this.overlayMode !== 'none' || this.pendingSwap !== null) {
      return this.getViewState();
    }

    const policyCheck = this.tutorialEngine.evaluateSlotInteraction(slotIndex);
    if (!policyCheck.allowed) {
      if (policyCheck.reason === 'WRONG_BOTTLE_TARGET') {
        this.guidanceHint = TUTORIAL_CONFIG.copy.wrongTargetHint;
        return this.emitState();
      }
      return this.getViewState();
    }

    const prevSelected = this.gameEngine.getPublicState().selectedSlotIndex;
    const gameRes = this.gameEngine.selectBottle(slotIndex);
    if (!gameRes.accepted) {
      return this.getViewState();
    }

    if (gameRes.events.length > 0) {
      this.callbacks.onPlayerGameEvents?.(gameRes.events);
    }

    this.guidanceHint = null;

    const swapEvent = gameRes.events.find((e) => e.type === 'BOTTLES_SWAPPED');
    if (swapEvent?.type === 'BOTTLES_SWAPPED') {
      const completedAfterSwap = gameRes.events.some((e) => e.type === 'PUZZLE_COMPLETED');
      if (this.tutorialEngine.getState().stage === 'guided_swap') {
        this.tutorialEngine.dispatch({ type: 'GUIDED_SWAP_STARTED' });
      }

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
      const nextState = this.emitState();
      this.callbacks.onSwapStarted?.(this.pendingSwap);
      return nextState;
    }

    const nextSelected = gameRes.publicState.selectedSlotIndex;
    if (prevSelected !== null && nextSelected === null) {
      const deselectRes = this.tutorialEngine.dispatch({ type: 'BOTTLE_DESELECTED' });
      if (deselectRes.accepted && this.tutorialEngine.getState().stage === 'guided_selection') {
        this.guidanceHint = TUTORIAL_CONFIG.copy.deselectedHint;
      }
      this.callbacks.onTutorialEvents?.(deselectRes.events);
    } else if (nextSelected !== null) {
      const selectRes = this.tutorialEngine.dispatch({
        type: 'BOTTLE_SELECTED',
        slotIndex: nextSelected,
      });
      this.callbacks.onTutorialEvents?.(selectRes.events);
    }

    return this.emitState();
  }

  public completeSwapTransition(transitionId?: number): TutorialViewState {
    if (this.disposed || this.pendingSwap === null) {
      return this.getViewState();
    }
    if (transitionId !== undefined && this.pendingSwap.transitionId !== transitionId) {
      return this.getViewState();
    }

    const finished = this.pendingSwap;
    this.pendingSwap = null;

    const pub = this.gameEngine.getPublicState();
    this.displayedMatchCount = pub.currentMatchCount;
    this.displayedMoveCount = pub.moveCount;

    const formatted = formatMatchDeltaFeedback(finished.swap.matchDelta);
    this.feedbackSequence += 1;
    this.matchFeedback = Object.freeze({
      text: formatted.text,
      tone: formatted.tone,
      sequenceId: this.feedbackSequence,
    });

    const stage = this.tutorialEngine.getState().stage;
    if (stage === 'guided_swap' || stage === 'counter_explanation') {
      const animRes = this.tutorialEngine.dispatch({ type: 'SWAP_ANIMATION_COMPLETED' });
      if (animRes.accepted) {
        this.applyPuzzleChangeEvents(animRes.events);
        this.callbacks.onTutorialEvents?.(animRes.events);
      }
    } else if (stage === 'independent_puzzle' && finished.completedAfterSwap) {
      const completeRes = this.tutorialEngine.dispatch({ type: 'INDEPENDENT_PUZZLE_SOLVED' });
      if (completeRes.accepted) {
        this.lifecycle.markCompleted();
        this.clock.complete();
        this.tutorialPreference?.markCompleted();
        this.overlayMode = 'completed';
        this.guidanceHint = null;
        this.callbacks.onTutorialEvents?.(completeRes.events);
      }
    }

    this.callbacks.onSwapCompleted?.(finished);
    return this.emitState();
  }

  public triggerInactivityReminder(): TutorialViewState {
    if (
      this.disposed ||
      this.overlayMode !== 'none' ||
      this.pendingSwap !== null ||
      this.tutorialEngine.getState().stage !== 'independent_puzzle'
    ) {
      return this.getViewState();
    }
    this.guidanceHint = TUTORIAL_CONFIG.copy.inactivityReminder;
    return this.emitState();
  }

  public skipTutorial(): boolean {
    if (this.disposed || this.exitDispatched) {
      return false;
    }
    if (this.pendingSwap !== null) {
      this.pendingSwap = null;
    }

    const res = this.tutorialEngine.dispatch({ type: 'SKIP_TUTORIAL' });
    if (!res.accepted) {
      return false;
    }

    this.exitDispatched = true;
    this.guidanceHint = null;
    this.overlayMode = 'none';
    this.tutorialPreference?.markSkipped();
    this.callbacks.onTutorialEvents?.(res.events);
    this.emitState();
    this.callbacks.onExitRequested?.('skipped');
    return true;
  }

  public continueAfterCompletion(): boolean {
    if (
      this.disposed ||
      this.exitDispatched ||
      this.tutorialEngine.getState().stage !== 'completed'
    ) {
      return false;
    }
    this.exitDispatched = true;
    this.callbacks.onExitRequested?.('completed');
    return true;
  }

  public abandonTutorial(): boolean {
    if (this.disposed || this.exitDispatched) {
      return false;
    }
    this.exitDispatched = true;
    this.pendingSwap = null;
    // Deliberately does NOT mark completed or skipped (Section 23)
    this.callbacks.onExitRequested?.('abandoned');
    return true;
  }

  public requestPause(): TutorialViewState {
    if (this.disposed) {
      return this.getViewState();
    }
    if (this.pendingSwap !== null) {
      this.completeSwapTransition();
    }
    if (this.overlayMode !== 'none' || this.lifecycle.isCompleted()) {
      return this.getViewState();
    }
    this.lifecycle.addReason('manual_pause');
    this.overlayMode = 'pause';
    this.syncLifecycle();
    return this.emitState();
  }

  public resumeFromPause(): TutorialViewState {
    if (this.disposed || this.overlayMode !== 'pause' || this.lifecycle.isCompleted()) {
      return this.getViewState();
    }
    this.overlayMode = 'none';
    this.lifecycle.removeReason('manual_pause');
    this.syncLifecycle();
    return this.emitState();
  }

  public openSettingsFromPause(): TutorialViewState {
    if (this.disposed || this.overlayMode !== 'pause') {
      return this.getViewState();
    }
    this.lifecycle.addReason('settings_overlay');
    this.overlayMode = 'settings';
    this.syncLifecycle();
    return this.emitState();
  }

  public closeSettings(): TutorialViewState {
    if (this.disposed || this.overlayMode !== 'settings') {
      return this.getViewState();
    }
    this.lifecycle.removeReason('settings_overlay');
    this.overlayMode = 'pause';
    this.syncLifecycle();
    return this.emitState();
  }

  public requestRestartConfirmation(): TutorialViewState {
    if (
      this.disposed ||
      this.overlayMode === 'error' ||
      this.overlayMode === 'restart_confirm' ||
      this.overlayMode === 'exit_confirm'
    ) {
      return this.getViewState();
    }
    if (this.pendingSwap !== null) {
      this.completeSwapTransition();
    }
    if (this.overlayMode === 'completed') {
      return this.confirmRestart();
    }
    this.returnToPauseOnCancel = this.overlayMode === 'pause';
    this.overlayMode = 'restart_confirm';
    this.lifecycle.addReason('confirmation_dialog');
    this.syncLifecycle();
    return this.emitState();
  }

  public cancelRestartConfirmation(): TutorialViewState {
    if (this.disposed || this.overlayMode !== 'restart_confirm') {
      return this.getViewState();
    }
    this.lifecycle.removeReason('confirmation_dialog');
    this.overlayMode = this.returnToPauseOnCancel ? 'pause' : 'none';
    this.returnToPauseOnCancel = false;
    this.syncLifecycle();
    return this.emitState();
  }

  public confirmRestart(): TutorialViewState {
    if (this.disposed) {
      return this.getViewState();
    }
    this.attemptId += 1;
    this.pendingSwap = null;
    this.matchFeedback = null;
    this.guidanceHint = null;
    this.returnToPauseOnCancel = false;
    this.overlayMode = 'none';
    this.lifecycle.resetForNewAttempt();

    const res = this.tutorialEngine.dispatch({ type: 'RESTART_CURRENT_STAGE' });
    if (res.accepted) {
      this.loadTutorialPuzzle(this.tutorialEngine.getState().activePuzzleId);
      this.clock.reset(true);
      this.syncLifecycle();
      this.lastFormattedTime = this.clock.getFormattedTime();
      this.callbacks.onTutorialEvents?.(res.events);
    }
    return this.emitState();
  }

  public requestExitConfirmation(): TutorialViewState {
    if (this.disposed || this.overlayMode !== 'pause' || this.lifecycle.isCompleted()) {
      return this.getViewState();
    }
    this.overlayMode = 'exit_confirm';
    this.lifecycle.addReason('confirmation_dialog');
    this.syncLifecycle();
    return this.emitState();
  }

  public cancelExitConfirmation(): TutorialViewState {
    if (this.disposed || this.overlayMode !== 'exit_confirm') {
      return this.getViewState();
    }
    this.lifecycle.removeReason('confirmation_dialog');
    this.overlayMode = 'pause';
    this.syncLifecycle();
    return this.emitState();
  }

  public confirmExit(): boolean {
    if (this.disposed || this.overlayMode !== 'exit_confirm') {
      return false;
    }
    return this.abandonTutorial();
  }

  public clearSelection(): TutorialViewState {
    if (this.disposed || this.overlayMode !== 'none' || this.pendingSwap !== null) {
      return this.getViewState();
    }
    const prevSelected = this.gameEngine.getPublicState().selectedSlotIndex;
    if (prevSelected === null) {
      return this.getViewState();
    }
    const res = this.gameEngine.clearSelection();
    if (res.accepted) {
      if (res.events.length > 0) {
        this.callbacks.onPlayerGameEvents?.(res.events);
      }
      const deselectRes = this.tutorialEngine.dispatch({ type: 'BOTTLE_DESELECTED' });
      if (deselectRes.accepted && this.tutorialEngine.getState().stage === 'guided_selection') {
        this.guidanceHint = TUTORIAL_CONFIG.copy.deselectedHint;
      }
      this.callbacks.onTutorialEvents?.(deselectRes.events);
      return this.emitState();
    }
    return this.getViewState();
  }

  public addSuspensionReason(reason: GameplaySuspensionReason): TutorialViewState {
    if (this.disposed) {
      return this.getViewState();
    }
    if (this.pendingSwap !== null) {
      this.completeSwapTransition();
    }
    this.lifecycle.addReason(reason);
    this.syncLifecycle();
    return this.emitState();
  }

  public removeSuspensionReason(reason: GameplaySuspensionReason): TutorialViewState {
    if (this.disposed) {
      return this.getViewState();
    }
    this.lifecycle.removeReason(reason);
    this.syncLifecycle();
    return this.emitState();
  }

  public handlePlatformSuspend(): TutorialViewState {
    return this.addSuspensionReason('platform_suspended');
  }

  public handlePlatformResume(): TutorialViewState {
    return this.removeSuspensionReason('platform_suspended');
  }

  public handleBrowserHidden(): TutorialViewState {
    return this.addSuspensionReason('browser_hidden');
  }

  public handleBrowserVisible(): TutorialViewState {
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

  public moveKeyboardFocus(delta: number): TutorialViewState {
    if (this.disposed || this.overlayMode !== 'none' || this.pendingSwap !== null) {
      return this.getViewState();
    }
    const total = this.gameEngine.getPublicState().totalBottleCount;
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

  public activateKeyboardAction(): TutorialViewState {
    if (this.disposed || this.pendingSwap !== null) {
      return this.getViewState();
    }
    if (this.overlayMode === 'completed') {
      this.continueAfterCompletion();
      return this.getViewState();
    }
    if (this.overlayMode !== 'none') {
      return this.getViewState();
    }
    const stage = this.tutorialEngine.getState().stage;
    if (stage === 'introduction' || stage === 'counter_explanation') {
      return this.handlePrimaryAction();
    }
    if (this.focusedSlotIndex !== null) {
      return this.handleBottleTap(this.focusedSlotIndex);
    }
    const highlight = this.getViewState().highlight;
    if (highlight.kind === 'bottle_slot' && highlight.slotIndex !== undefined) {
      return this.handleBottleTap(highlight.slotIndex);
    }
    return this.getViewState();
  }

  public handleEscapeKey(): TutorialViewState {
    if (this.disposed) {
      return this.getViewState();
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
    if (this.gameEngine.getPublicState().selectedSlotIndex !== null) {
      return this.clearSelection();
    }
    return this.requestPause();
  }

  public dispose(): void {
    this.disposed = true;
    this.pendingSwap = null;
    this.lifecycle.dispose();
    this.clock.setLifecycleSuspended(true);
  }

  private syncLifecycle(): void {
    const suspended = this.lifecycle.isSuspended();
    this.clock.setLifecycleSuspended(suspended);
    const status = this.gameEngine.getPublicState().status;
    if (status === 'completed' || this.lifecycle.isCompleted()) {
      return;
    }
    if (suspended && status === 'playing') {
      this.gameEngine.pause();
    } else if (!suspended && status === 'paused' && this.lifecycle.canResumeGameplay()) {
      this.gameEngine.resume();
    }
  }

  private createStartedEngine(puzzleId: TutorialPuzzleId): GameEngine {
    const puzzle = getTutorialPuzzle(puzzleId);
    const engine = new GameEngine(puzzle);
    engine.start();
    return engine;
  }

  private loadTutorialPuzzle(puzzleId: TutorialPuzzleId): void {
    this.gameEngine = this.createStartedEngine(puzzleId);
    this.focusedSlotIndex = null;
    this.syncDisplayedFromEngine();
    this.callbacks.onPuzzleChanged?.(puzzleId);
  }

  private syncDisplayedFromEngine(): void {
    const pub = this.gameEngine.getPublicState();
    this.displayedMatchCount = pub.currentMatchCount;
    this.displayedMoveCount = pub.moveCount;
  }

  private applyPuzzleChangeEvents(events: readonly TutorialEvent[]): void {
    for (const event of events) {
      if (event.type === 'PUZZLE_CHANGED') {
        this.loadTutorialPuzzle(event.puzzleId);
      }
    }
  }

  private fastForwardToDevStage(targetStage: TutorialStageId): void {
    this.tutorialEngine.dispatch({ type: 'START_TUTORIAL' });
    this.clock.start();
    if (targetStage === 'introduction') {
      return;
    }
    this.tutorialEngine.dispatch({ type: 'ACKNOWLEDGE_INTRO' });
    if (targetStage === 'guided_selection') {
      return;
    }
    this.gameEngine.selectBottle(0);
    this.tutorialEngine.dispatch({ type: 'BOTTLE_SELECTED', slotIndex: 0 });
    if (targetStage === 'guided_swap') {
      return;
    }
    this.gameEngine.selectBottle(1);
    this.tutorialEngine.dispatch({ type: 'GUIDED_SWAP_STARTED' });
    this.tutorialEngine.dispatch({ type: 'SWAP_ANIMATION_COMPLETED' });
    this.loadTutorialPuzzle('tutorial-counter-decrease');
    if (targetStage === 'counter_explanation') {
      return;
    }
    this.tutorialEngine.dispatch({ type: 'ACKNOWLEDGE_COUNTER' });
    this.loadTutorialPuzzle('tutorial-independent-01');
    if (targetStage === 'independent_puzzle') {
      return;
    }
    if (targetStage === 'completed') {
      this.tutorialEngine.dispatch({ type: 'INDEPENDENT_PUZZLE_SOLVED' });
      this.overlayMode = 'completed';
    }
  }

  private emitState(): TutorialViewState {
    const snapshot = this.getViewState();
    this.callbacks.onViewStateChange?.(snapshot);
    return snapshot;
  }
}
