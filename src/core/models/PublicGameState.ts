import type { BottleId } from './BottleId';
import type { AttemptFailureReason, ChallengeMode } from './ChallengeMode';
import type { PuzzleState } from './PuzzleState';
import type { PuzzleStatus } from './PuzzleStatus';
import type { SwapResult } from './SwapResult';

/**
 * Player-visible gameplay state projection safe for presentation layers.
 * Never exposes the hidden target sequence, seed, swap distance, or individual matches.
 */
export interface PublicGameState {
  readonly puzzleId: string;
  readonly currentSequence: readonly BottleId[];
  readonly selectedSlotIndex: number | null;
  readonly currentMatchCount: number;
  readonly totalBottleCount: number;
  readonly moveCount: number;
  readonly moveLimit: number | null;
  readonly remainingMoves: number | null;
  readonly challengeMode: ChallengeMode;
  readonly timeLimitSeconds: number | null;
  readonly bestMatchCount: number;
  readonly lastSwap: SwapResult | null;
  readonly status: PuzzleStatus;
  readonly failureReason: AttemptFailureReason | null;
}

export function toPublicGameState(state: PuzzleState): PublicGameState {
  return Object.freeze({
    puzzleId: state.puzzleId,
    currentSequence: Object.freeze([...state.currentSequence]),
    selectedSlotIndex: state.selectedSlotIndex,
    currentMatchCount: state.currentMatchCount,
    totalBottleCount: state.currentSequence.length,
    moveCount: state.moveCount,
    moveLimit: state.moveLimit,
    remainingMoves: state.remainingMoves,
    challengeMode: state.challengeMode,
    timeLimitSeconds: state.timeLimitSeconds,
    bestMatchCount: state.bestMatchCount,
    lastSwap: state.lastSwap === null ? null : Object.freeze({ ...state.lastSwap }),
    status: state.status,
    failureReason: state.failureReason,
  });
}
