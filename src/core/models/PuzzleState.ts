import type { BottleId } from './BottleId';
import type { Puzzle } from './Puzzle';
import type { PuzzleStatus } from './PuzzleStatus';

/**
 * Minimal immutable snapshot of an active puzzle session.
 * Actual swap transitions and timers will be added in future gameplay tasks.
 */
export interface PuzzleState {
  readonly puzzleId: string;
  readonly currentSequence: readonly BottleId[];
  readonly moveCount: number;
  readonly status: PuzzleStatus;
}

export function createInitialPuzzleState(puzzle: Puzzle): PuzzleState {
  return Object.freeze({
    puzzleId: puzzle.id,
    currentSequence: Object.freeze([...puzzle.startingSequence]),
    moveCount: 0,
    status: 'ready' as const,
  });
}
