import { countMatchingPositions } from '../engine/SwapDistance';
import type { BottleId } from './BottleId';
import type { Puzzle } from './Puzzle';
import type { PuzzleStatus } from './PuzzleStatus';
import type { SwapResult } from './SwapResult';

/**
 * Immutable snapshot of an active gameplay session for a single Puzzle.
 * The immutable startingSequence and hidden targetSequence remain in Puzzle.
 */
export interface PuzzleState {
  readonly puzzleId: string;
  readonly currentSequence: readonly BottleId[];
  readonly selectedSlotIndex: number | null;
  readonly moveCount: number;
  readonly currentMatchCount: number;
  readonly bestMatchCount: number;
  readonly lastSwap: SwapResult | null;
  readonly status: PuzzleStatus;
}

export function createInitialPuzzleState(puzzle: Puzzle): PuzzleState {
  const initialMatches = countMatchingPositions(puzzle.startingSequence, puzzle.targetSequence);

  return Object.freeze({
    puzzleId: puzzle.id,
    currentSequence: Object.freeze([...puzzle.startingSequence]),
    selectedSlotIndex: null,
    moveCount: 0,
    currentMatchCount: initialMatches,
    bestMatchCount: initialMatches,
    lastSwap: null,
    status: 'ready' as const,
  });
}
