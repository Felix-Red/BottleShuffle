import type { BottleId, PuzzleStatus, SwapResult } from '../../core';
import type { MatchFeedbackTone } from '../../config/GameplayConfig';

export type GameplayOverlayMode = 'none' | 'pause' | 'restart_confirm' | 'completed' | 'error';

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
}

/**
 * Presentation-layer view model consumed by GameScene and gameplay UI components.
 * Deliberately excludes private puzzle data (targetSequence, seed, individual matches).
 */
export interface GameplayViewState {
  readonly puzzleId: string;
  readonly attemptId: number;
  readonly headerTitle: string;
  readonly headerSubtitle: string;
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
  readonly inputEnabled: boolean;
  readonly isSwapping: boolean;
  readonly instructionText: string;
  readonly matchFeedback: MatchFeedbackView | null;
  readonly overlayMode: GameplayOverlayMode;
  readonly errorMessage: string | null;
}
