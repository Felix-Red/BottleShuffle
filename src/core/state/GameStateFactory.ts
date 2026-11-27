import { calculateCorrectMatches } from '../engine/MatchCalculator';
import {
  DEFAULT_CLASSIC_OBJECTIVE,
  resolveChallengeObjective,
  type LevelChallengeObjective,
} from '../models/ChallengeMode';
import type { Puzzle } from '../models/Puzzle';
import { createInitialPuzzleState, type PuzzleState } from '../models/PuzzleState';

/**
 * Creates a validated initial Ready gameplay state from an immutable Puzzle.
 */
export function createReadyGameState(
  puzzle: Puzzle,
  objective: Partial<LevelChallengeObjective> = DEFAULT_CLASSIC_OBJECTIVE,
): PuzzleState {
  // Validate sequence compatibility and derive initial match count accurately
  calculateCorrectMatches(puzzle.startingSequence, puzzle.targetSequence);
  return createInitialPuzzleState(puzzle, objective);
}

/**
 * Creates a fresh Playing gameplay state for restarting an existing Puzzle
 * without regenerating its sequences, seed, or identity, preserving its challenge objective.
 */
export function createRestartedGameState(
  puzzle: Puzzle,
  objective: Partial<LevelChallengeObjective> = DEFAULT_CLASSIC_OBJECTIVE,
): PuzzleState {
  const initialMatches = calculateCorrectMatches(puzzle.startingSequence, puzzle.targetSequence);
  const resolved = resolveChallengeObjective(objective);

  return Object.freeze({
    puzzleId: puzzle.id,
    currentSequence: Object.freeze([...puzzle.startingSequence]),
    selectedSlotIndex: null,
    moveCount: 0,
    moveLimit: resolved.moveLimit,
    remainingMoves: resolved.moveLimit,
    challengeMode: resolved.challengeMode,
    timeLimitSeconds: resolved.timeLimitSeconds,
    currentMatchCount: initialMatches,
    bestMatchCount: initialMatches,
    lastSwap: null,
    status: 'playing' as const,
    failureReason: null,
  });
}
