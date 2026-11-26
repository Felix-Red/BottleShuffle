import { calculateCorrectMatches } from '../engine/MatchCalculator';
import type { Puzzle } from '../models/Puzzle';
import { createInitialPuzzleState, type PuzzleState } from '../models/PuzzleState';

/**
 * Creates a validated initial Ready gameplay state from an immutable Puzzle.
 */
export function createReadyGameState(puzzle: Puzzle): PuzzleState {
  // Validate sequence compatibility and derive initial match count accurately
  calculateCorrectMatches(puzzle.startingSequence, puzzle.targetSequence);
  return createInitialPuzzleState(puzzle);
}

/**
 * Creates a fresh Playing gameplay state for restarting an existing Puzzle
 * without regenerating its sequences, seed, or identity.
 */
export function createRestartedGameState(puzzle: Puzzle): PuzzleState {
  const initialMatches = calculateCorrectMatches(puzzle.startingSequence, puzzle.targetSequence);

  return Object.freeze({
    puzzleId: puzzle.id,
    currentSequence: Object.freeze([...puzzle.startingSequence]),
    selectedSlotIndex: null,
    moveCount: 0,
    currentMatchCount: initialMatches,
    bestMatchCount: initialMatches,
    lastSwap: null,
    status: 'playing' as const,
  });
}
