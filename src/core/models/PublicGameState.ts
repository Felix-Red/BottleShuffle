import type { BottleId } from './BottleId';
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
  readonly bestMatchCount: number;
  readonly lastSwap: SwapResult | null;
  readonly status: PuzzleStatus;
}

export function toPublicGameState(state: PuzzleState): PublicGameState {
  return Object.freeze({
    puzzleId: state.puzzleId,
    currentSequence: Object.freeze([...state.currentSequence]),
    selectedSlotIndex: state.selectedSlotIndex,
    currentMatchCount: state.currentMatchCount,
    totalBottleCount: state.currentSequence.length,
    moveCount: state.moveCount,
    bestMatchCount: state.bestMatchCount,
    lastSwap: state.lastSwap === null ? null : Object.freeze({ ...state.lastSwap }),
    status: state.status,
  });
}
