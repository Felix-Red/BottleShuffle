import type {
  AttemptFailureReason,
  BottleId,
  ChallengeIntroMode,
  ChallengeMode,
  ChapterId,
  LevelId,
  PuzzleStatus,
  SwapResult,
} from '../../core';
import type { MatchFeedbackTone } from '../../config/GameplayConfig';
import type { CountdownUrgency } from '../../services/GameplayClock';
import type { VictoryViewState } from '../victory/VictoryViewState';
import type { GameplayMode } from './GameplaySceneData';

export type GameplayOverlayMode =
  | 'none'
  | 'challenge_intro'
  | 'pause'
  | 'settings'
  | 'restart_confirm'
  | 'exit_confirm'
  | 'tutorial_confirm'
  | 'completed'
  | 'failed'
  | 'error';

export interface MatchFeedbackView {
  readonly text: string;
  readonly tone: MatchFeedbackTone;
  readonly sequenceId: number;
}

export interface PendingSwapTransition {
  readonly transitionId: number;
  readonly attemptId: number;
  readonly firstIndex: number;
  readonly secondIndex: number;
  readonly swap: SwapResult;
  readonly completedAfterSwap: boolean;
  readonly failedAfterSwap?: boolean;
}

export interface ChallengeIntroViewState {
  readonly mode: ChallengeIntroMode;
  readonly badge: string;
  readonly title: string;
  readonly description: string;
  readonly restrictionSummary: string;
  readonly levelNumber: number | null;
  readonly bottleCount: number;
  readonly ctaLabel: string;
}

export interface FailureViewState {
  readonly reason: AttemptFailureReason;
  readonly title: string;
  readonly hint: string;
  readonly subtitle: string;
  readonly levelNumber: number | null;
  readonly chapterName: string | null;
  readonly chapterIdForLevels: ChapterId | null;
  readonly challengeMode: ChallengeMode;
  readonly finalMatchCount: number;
  readonly totalBottleCount: number;
  readonly movesUsed: number;
  readonly moveLimit: number | null;
  readonly formattedTimeUsed: string;
  readonly formattedTimeLimit: string | null;
}

export interface TimerPollUpdate {
  readonly formattedTime: string;
  readonly remainingTimeMs: number | null;
  readonly countdownRatio: number | null;
  readonly countdownUrgency: CountdownUrgency;
  readonly expired: boolean;
}

/**
 * Presentation-layer view model consumed by GameScene and gameplay UI components.
 * Deliberately excludes private puzzle data (targetSequence, seed, individual matches).
 */
export interface GameplayViewState {
  readonly mode: GameplayMode;
  readonly levelId: LevelId | null;
  readonly levelNumber: number | null;
  readonly chapterId: ChapterId | null;
  readonly chapterName: string | null;
  readonly nextLevelId: LevelId | null;
  readonly nextLevelNumber: number | null;
  readonly isCampaignComplete: boolean;
  readonly puzzleId: string;
  readonly attemptId: number;
  readonly headerTitle: string;
  readonly headerSubtitle: string;
  readonly challengeMode: ChallengeMode;
  readonly timeLimitSeconds: number | null;
  readonly remainingTimeMs: number | null;
  readonly countdownRatio: number | null;
  readonly countdownUrgency: CountdownUrgency;
  readonly moveLimit: number | null;
  readonly displayedRemainingMoves: number | null;
  readonly remainingMoves: number | null;
  readonly currentSequence: readonly BottleId[];
  readonly selectedSlotIndex: number | null;
  readonly focusedSlotIndex: number | null;
  readonly displayedMatchCount: number;
  readonly displayedMoveCount: number;
  readonly totalBottleCount: number;
  readonly moveCount: number;
  readonly bestMatchCount: number;
  readonly formattedTime: string;
  readonly status: PuzzleStatus;
  readonly failureReason: AttemptFailureReason | null;
  readonly isSuspended: boolean;
  readonly inputEnabled: boolean;
  readonly isSwapping: boolean;
  readonly instructionText: string;
  readonly matchFeedback: MatchFeedbackView | null;
  readonly victory: VictoryViewState | null;
  readonly failure: FailureViewState | null;
  readonly challengeIntro: ChallengeIntroViewState | null;
  readonly overlayMode: GameplayOverlayMode;
  readonly errorMessage: string | null;
}
