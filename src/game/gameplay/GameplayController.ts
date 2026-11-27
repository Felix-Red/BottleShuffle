import {
  createAttemptResult,
  DEFAULT_CLASSIC_OBJECTIVE,
  GameEngine,
  generatePuzzle,
  getChallengeModeDisplayName,
  isChallengeIntroMode,
  resolveChallengeObjective,
  toLevelChallengeObjective,
  type AttemptFailureReason,
  type AttemptResult,
  type ChallengeIntroMode,
  type ChapterId,
  type GameEvent,
  type LevelChallengeObjective,
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
import type { ChallengeIntroService } from '../../services/ChallengeIntroService';
import {
  formatElapsedTime,
  formatTimeLimitShort,
  GameplayClock,
  type MonotonicClock,
} from '../../services/GameplayClock';
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
  ChallengeIntroViewState,
  FailureViewState,
  GameplayOverlayMode,
  GameplayViewState,
  MatchFeedbackView,
  PendingSwapTransition,
  TimerPollUpdate,
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
  readonly challengeIntroService?: ChallengeIntroService;
  readonly challengeObjective?: Partial<LevelChallengeObjective>;
  readonly puzzle?: Puzzle;
  readonly clock?: MonotonicClock;
  readonly lifecycle?: GameplayLifecycleCoordinator;
  readonly seedProvider?: SeedProvider;
  readonly callbacks?: GameplayControllerCallbacks;
}

function formatChallengeRestrictionSummary(objective: LevelChallengeObjective): string {
  const parts: string[] = [];
  if (objective.timeLimitSeconds !== null) {
    parts.push(`Time Limit: ${formatTimeLimitShort(objective.timeLimitSeconds)}`);
  }
  if (objective.moveLimit !== null) {
    parts.push(`Move Limit: ${String(objective.moveLimit)} Swaps`);
  }
  return parts.join('  ·  ');
}

function buildHeaderSubtitle(
  chapterName: string | null,
  bottleCount: number,
  objective: LevelChallengeObjective,
): string {
  const parts: string[] = [];
  if (chapterName !== null) {
    parts.push(chapterName);
  }
  parts.push(`${String(bottleCount)} Bottles`);
  if (objective.challengeMode !== 'classic') {
    parts.push(getChallengeModeDisplayName(objective.challengeMode));
  }
  return parts.join(' · ');
}

/**
 * Presentation-layer controller coordinating GameEngine, GameplayClock,
 * GameplayLifecycleCoordinator, swap transition locking, challenge intros,
 * countdown expiration, move-limit failure handling, deterministic scoring,
 * authoritative campaign completion recording, overlays, and keyboard focus.
 */
export class GameplayController {
  private readonly engine: GameEngine | null;
  private readonly clock: GameplayClock;
  private readonly lifecycle: GameplayLifecycleCoordinator;
  private readonly ownsLifecycle: boolean;
  private readonly progressionController?: ProgressionController;
  private readonly challengeIntroService?: ChallengeIntroService;
  private readonly objective: LevelChallengeObjective;
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
  private displayedRemainingMoves: number | null = null;
  private focusedSlotIndex: number | null = null;
  private matchFeedback: MatchFeedbackView | null = null;
  private feedbackSequence = 0;
  private lastFormattedTime = '00:00';
  private lastCountdownRatioKey = '';
  private completionCommitted = false;
  private completionModalShown = false;
  private failureCommitted = false;
  private failureModalShown = false;
  private latestAttemptResult: AttemptResult | null = null;
  private latestVictoryState: VictoryViewState | null = null;
  private latestFailureState: FailureViewState | null = null;
  private activeChallengeIntro: ChallengeIntroViewState | null = null;
  private exitDispatched = false;
  private disposed = false;

  public constructor(options: GameplayControllerOptions = {}) {
    this.callbacks = options.callbacks ?? {};
    if (options.lifecycle !== undefined) {
      this.lifecycle = options.lifecycle;
      this.ownsLifecycle = false;
    } else {
      this.lifecycle = new GameplayLifecycleCoordinator();
      this.ownsLifecycle = true;
    }
    this.progressionController = options.progressionController;
    this.challengeIntroService = options.challengeIntroService;

    const launch = resolveGameplayLaunch(options.sceneData);
    let resolvedMode: GameplayMode = launch.mode;
    let resolvedLevelId: LevelId | null = null;
    let resolvedLevelNumber: number | null = null;
    let resolvedChapterId: ChapterId | null = null;
    let resolvedChapterName: string | null = null;
    let resolvedHeaderTitle = launch.headerTitle;
    let resolvedHeaderSubtitle = launch.headerSubtitle;
    let resolvedObjective: LevelChallengeObjective = resolveChallengeObjective(
      options.challengeObjective ?? DEFAULT_CLASSIC_OBJECTIVE,
    );

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
          resolvedObjective =
            options.challengeObjective !== undefined
              ? resolveChallengeObjective(options.challengeObjective)
              : toLevelChallengeObjective(beginResult.level);
          resolvedHeaderTitle = `Level ${String(beginResult.level.levelNumber)}`;
          resolvedHeaderSubtitle = buildHeaderSubtitle(
            beginResult.chapterName,
            beginResult.level.bottleCount,
            resolvedObjective,
          );
          this.campaignAttemptId = beginResult.attempt.attemptId;
          createdEngine = new GameEngine(options.puzzle ?? beginResult.puzzle, resolvedObjective);
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
        createdEngine = new GameEngine(puzzle, resolvedObjective);
        resolvedHeaderSubtitle = buildHeaderSubtitle(null, puzzle.bottleCount, resolvedObjective);
      } catch (error) {
        this.errorMessage =
          error instanceof Error ? error.message : GAMEPLAY_COPY.errorRecovery.fallbackMessage;
        this.overlayMode = 'error';
      }
    }

    this.objective = resolvedObjective;
    this.clock = new GameplayClock(
      options.clock,
      resolvedObjective.timeLimitSeconds !== null
        ? resolvedObjective.timeLimitSeconds * 1000
        : null,
    );
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
      this.displayedRemainingMoves = pub.remainingMoves;
    }

    this.lastFormattedTime = this.clock.getDisplayTime();
    this.refreshCampaignMeta();
  }

  public start(): GameplayViewState {
    if (this.engine === null) {
      return this.emitState();
    }

    const introMode = this.resolvePendingChallengeIntroMode();
    if (introMode !== null) {
      const copy = GAMEPLAY_COPY.challengeIntros[introMode];
      const pub = this.engine.getPublicState();
      this.activeChallengeIntro = Object.freeze({
        mode: introMode,
        badge: copy.badge,
        title: copy.title,
        description: copy.description,
        restrictionSummary: formatChallengeRestrictionSummary(this.objective),
        levelNumber: this.levelNumber,
        bottleCount: pub.totalBottleCount,
        ctaLabel: copy.ctaLabel,
      });
      this.overlayMode = 'challenge_intro';
      this.lifecycle.addReason('challenge_intro');
    }

    const result = this.engine.start();
    if (result.accepted) {
      this.displayedMatchCount = result.publicState.currentMatchCount;
      this.displayedMoveCount = result.publicState.moveCount;
      this.displayedRemainingMoves = result.publicState.remainingMoves;
      this.clock.start();
      this.syncEngineAndClockWithLifecycle();
      this.lastFormattedTime = this.clock.getDisplayTime();
      this.callbacks.onEvents?.(result.events);
    }

    return this.emitState();
  }

  public dismissChallengeIntro(): GameplayViewState {
    if (this.disposed || this.overlayMode !== 'challenge_intro') {
      return this.getViewState();
    }

    const mode = this.activeChallengeIntro?.mode;
    this.activeChallengeIntro = null;
    this.overlayMode = 'none';
    if (mode !== undefined) {
      this.challengeIntroService?.markSeen(mode);
    }
    this.lifecycle.removeReason('challenge_intro');
    this.syncEngineAndClockWithLifecycle();
    this.lastFormattedTime = this.clock.getDisplayTime();
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

  public getRemainingMs(): number | null {
    return this.clock.getRemainingMs();
  }

  public getChallengeObjective(): LevelChallengeObjective {
    return this.objective;
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
        chapterId: this.chapterId,
        chapterName: this.chapterName,
        nextLevelId: this.nextLevelId,
        nextLevelNumber: this.nextLevelNumber,
        isCampaignComplete: this.isCampaignComplete,
        puzzleId: '',
        attemptId: this.attemptId,
        headerTitle: this.headerTitle,
        headerSubtitle: this.headerSubtitle,
        challengeMode: this.objective.challengeMode,
        timeLimitSeconds: this.objective.timeLimitSeconds,
        remainingTimeMs: this.clock.getRemainingMs(),
        countdownRatio: this.clock.getRemainingRatio(),
        countdownUrgency: 'normal' as const,
        moveLimit: this.objective.moveLimit,
        displayedRemainingMoves: this.objective.moveLimit,
        remainingMoves: this.objective.moveLimit,
        currentSequence: Object.freeze([]),
        selectedSlotIndex: null,
        focusedSlotIndex: null,
        displayedMatchCount: 0,
        displayedMoveCount: 0,
        totalBottleCount: 0,
        moveCount: 0,
        bestMatchCount: 0,
        formattedTime: this.clock.getDisplayTime(),
        status: 'ready' as const,
        failureReason: null,
        isSuspended: true,
        inputEnabled: false,
        isSwapping: false,
        instructionText: '',
        matchFeedback: null,
        victory: null,
        failure: null,
        challengeIntro: null,
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
    } else if (pub.status === 'failed' && !isSwapping) {
      instructionText =
        pub.failureReason === 'time_expired'
          ? GAMEPLAY_COPY.instructions.failedTime
          : GAMEPLAY_COPY.instructions.failedMoves;
    } else if (isSwapping) {
      instructionText = GAMEPLAY_COPY.instructions.swapping;
    } else if (pub.selectedSlotIndex !== null) {
      instructionText = GAMEPLAY_COPY.instructions.bottleSelected;
    }

    return Object.freeze({
      mode: this.mode,
      levelId: this.levelId,
      levelNumber: this.levelNumber,
      chapterId: this.chapterId,
      chapterName: this.chapterName,
      nextLevelId: this.nextLevelId,
      nextLevelNumber: this.nextLevelNumber,
      isCampaignComplete: this.isCampaignComplete,
      puzzleId: pub.puzzleId,
      attemptId: this.attemptId,
      headerTitle: this.headerTitle,
      headerSubtitle: this.headerSubtitle,
      challengeMode: pub.challengeMode,
      timeLimitSeconds: pub.timeLimitSeconds,
      remainingTimeMs: this.clock.getRemainingMs(),
      countdownRatio: this.clock.getRemainingRatio(),
      countdownUrgency: this.clock.getCountdownUrgency(),
      moveLimit: pub.moveLimit,
      displayedRemainingMoves: this.displayedRemainingMoves,
      remainingMoves: pub.remainingMoves,
      currentSequence: pub.currentSequence,
      selectedSlotIndex: pub.selectedSlotIndex,
      focusedSlotIndex: this.focusedSlotIndex,
      displayedMatchCount: this.displayedMatchCount,
      displayedMoveCount: this.displayedMoveCount,
      totalBottleCount: pub.totalBottleCount,
      moveCount: pub.moveCount,
      bestMatchCount: pub.bestMatchCount,
      formattedTime: this.clock.getDisplayTime(),
      status: pub.status,
      failureReason: pub.failureReason,
      isSuspended,
      inputEnabled,
      isSwapping,
      instructionText,
      matchFeedback: this.matchFeedback,
      victory: this.latestVictoryState,
      failure: this.latestFailureState,
      challengeIntro: this.activeChallengeIntro,
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

    // Evaluate deadline BEFORE accepting any tap so late taps past 00:00 fail consistently.
    if (this.clock.isExpired()) {
      return this.triggerTimerExpiration();
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
      const failedAfterSwap = result.events.some((event) => event.type === 'PUZZLE_FAILED');
      const transitionId = this.nextTransitionId;
      this.nextTransitionId += 1;

      this.pendingSwap = {
        transitionId,
        attemptId: this.attemptId,
        firstIndex: swapEvent.swap.firstIndex,
        secondIndex: swapEvent.swap.secondIndex,
        swap: swapEvent.swap,
        completedAfterSwap,
        failedAfterSwap,
      };

      if (completedAfterSwap) {
        // Freeze clock and commit authoritative scoring & progression IMMEDIATELY before
        // animations play so timer ticks or interruptions can NEVER cancel a winning swap.
        this.lifecycle.markCompleted();
        this.clock.complete();
        this.processCompletedAttemptOnce(result.publicState.moveCount, this.clock.getElapsedMs());
      } else if (failedAfterSwap) {
        // Stop countdown immediately on move exhaustion without awarding progression.
        this.lifecycle.markCompleted();
        this.clock.complete();
        this.processFailedAttemptOnce(
          'moves_exhausted',
          result.publicState.moveCount,
          result.publicState.currentMatchCount,
          result.publicState.totalBottleCount,
          this.clock.getElapsedMs(),
        );
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
    this.displayedRemainingMoves = pub.remainingMoves;

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
    } else if (finished.failedAfterSwap === true && !this.failureModalShown) {
      this.failureModalShown = true;
      this.lifecycle.markCompleted();
      this.clock.complete();
      this.processFailedAttemptOnce(
        'moves_exhausted',
        pub.moveCount,
        pub.currentMatchCount,
        pub.totalBottleCount,
        this.clock.getElapsedMs(),
      );
      this.overlayMode = 'failed';
    } else if (
      !finished.completedAfterSwap &&
      finished.failedAfterSwap !== true &&
      this.clock.isExpired()
    ) {
      this.callbacks.onSwapCompleted?.(finished);
      return this.triggerTimerExpiration();
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
      this.overlayMode === 'challenge_intro' ||
      this.overlayMode === 'restart_confirm' ||
      this.overlayMode === 'exit_confirm' ||
      this.overlayMode === 'tutorial_confirm'
    ) {
      return this.getViewState();
    }

    if (this.overlayMode === 'completed' || this.overlayMode === 'failed') {
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
    this.failureCommitted = false;
    this.failureModalShown = false;
    this.latestAttemptResult = null;
    this.latestVictoryState = null;
    this.latestFailureState = null;
    this.activeChallengeIntro = null;
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
      this.displayedRemainingMoves = result.publicState.remainingMoves;
      this.clock.reset(true);
      this.syncEngineAndClockWithLifecycle();
      this.lastFormattedTime = this.clock.getDisplayTime();
      this.lastCountdownRatioKey = '';
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

  /**
   * Polls both elapsed/remaining display time and countdown progress bar updates.
   * Triggers authoritative timer expiration cleanly when the monotonic clock reaches 0.
   */
  public pollTimer(): TimerPollUpdate | null {
    if (this.disposed || this.engine === null) {
      return null;
    }

    const pub = this.engine.getPublicState();
    if (
      this.clock.isTimed() &&
      this.clock.isExpired() &&
      pub.status === 'playing' &&
      this.pendingSwap === null &&
      !this.lifecycle.isSuspended() &&
      this.overlayMode === 'none'
    ) {
      this.triggerTimerExpiration();
      return Object.freeze({
        formattedTime: this.clock.getDisplayTime(),
        remainingTimeMs: 0,
        countdownRatio: 0,
        countdownUrgency: 'critical' as const,
        expired: true,
      });
    }

    const formatted = this.clock.getDisplayTime();
    const ratio = this.clock.getRemainingRatio();
    const urgency = this.clock.getCountdownUrgency();
    const ratioKey =
      ratio !== null ? `${formatted}|${ratio.toFixed(3)}|${urgency}` : `${formatted}|classic`;

    if (formatted === this.lastFormattedTime && ratioKey === this.lastCountdownRatioKey) {
      return null;
    }

    this.lastFormattedTime = formatted;
    this.lastCountdownRatioKey = ratioKey;

    return Object.freeze({
      formattedTime: formatted,
      remainingTimeMs: this.clock.getRemainingMs(),
      countdownRatio: ratio,
      countdownUrgency: urgency,
      expired: false,
    });
  }

  public pollFormattedTime(): string | null {
    const update = this.pollTimer();
    return update !== null ? update.formattedTime : null;
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

    if (this.overlayMode === 'challenge_intro') {
      return this.dismissChallengeIntro();
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

  private resolvePendingChallengeIntroMode(): ChallengeIntroMode | null {
    if (this.mode !== 'campaign' || this.challengeIntroService === undefined) {
      return null;
    }
    const mode = this.objective.challengeMode;
    if (!isChallengeIntroMode(mode)) {
      return null;
    }
    return this.challengeIntroService.shouldShowIntro(mode) ? mode : null;
  }

  private triggerTimerExpiration(): GameplayViewState {
    if (
      this.disposed ||
      this.engine === null ||
      this.completionCommitted ||
      this.failureCommitted
    ) {
      return this.getViewState();
    }

    const res = this.engine.expireTimer();
    if (!res.accepted) {
      return this.getViewState();
    }

    this.lifecycle.markCompleted();
    this.clock.complete();
    this.processFailedAttemptOnce(
      'time_expired',
      res.publicState.moveCount,
      res.publicState.currentMatchCount,
      res.publicState.totalBottleCount,
      this.clock.getElapsedMs(),
    );
    this.failureModalShown = true;
    this.overlayMode = 'failed';
    this.lastFormattedTime = this.clock.getDisplayTime();
    this.callbacks.onEvents?.(res.events);
    return this.emitState();
  }

  private processFailedAttemptOnce(
    reason: AttemptFailureReason,
    movesUsed: number,
    finalMatchCount: number,
    totalBottleCount: number,
    elapsedMs: number,
  ): void {
    if (this.failureCommitted || this.completionCommitted) {
      return;
    }

    this.failureCommitted = true;

    // Abandon active campaign attempt so failed attempts NEVER award stars, scores, or unlocks
    // and NEVER mutate existing completion records.
    if (this.campaignAttemptId !== null) {
      this.progressionController?.abandonActiveAttempt(this.campaignAttemptId);
      this.campaignAttemptId = null;
    }

    const timeLimitMs = this.clock.getTimeLimitMs();
    const clampedElapsedMs =
      timeLimitMs !== null ? Math.min(elapsedMs, timeLimitMs) : Math.max(0, elapsedMs);

    const title =
      reason === 'time_expired'
        ? GAMEPLAY_COPY.failureModal.timeExpiredTitle
        : GAMEPLAY_COPY.failureModal.movesExhaustedTitle;
    const hint =
      reason === 'time_expired'
        ? GAMEPLAY_COPY.failureModal.timeExpiredHint
        : GAMEPLAY_COPY.failureModal.movesExhaustedHint;

    this.latestFailureState = Object.freeze({
      reason,
      title,
      hint,
      subtitle: `${this.headerTitle} · ${this.headerSubtitle}`,
      levelNumber: this.levelNumber,
      chapterName: this.chapterName,
      chapterIdForLevels: this.chapterId,
      challengeMode: this.objective.challengeMode,
      finalMatchCount,
      totalBottleCount,
      movesUsed,
      moveLimit: this.objective.moveLimit,
      formattedTimeUsed: formatElapsedTime(clampedElapsedMs),
      formattedTimeLimit:
        this.objective.timeLimitSeconds !== null
          ? formatElapsedTime(this.objective.timeLimitSeconds * 1000)
          : null,
    });
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
    if (status === 'completed' || status === 'failed' || this.lifecycle.isCompleted()) {
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
    if (this.completionCommitted || this.failureCommitted || this.engine === null) {
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
