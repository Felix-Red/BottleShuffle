import { countMatchingPositions } from '../engine/SwapDistance';
import type { BottleId } from './BottleId';
import {
  DEFAULT_CLASSIC_OBJECTIVE,
  resolveChallengeObjective,
  type AttemptFailureReason,
  type ChallengeMode,
  type LevelChallengeObjective,
} from './ChallengeMode';
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
  readonly moveLimit: number | null;
  readonly remainingMoves: number | null;
  readonly challengeMode: ChallengeMode;
  readonly timeLimitSeconds: number | null;
  readonly currentMatchCount: number;
  readonly bestMatchCount: number;
  readonly lastSwap: SwapResult | null;
  readonly status: PuzzleStatus;
  readonly failureReason: AttemptFailureReason | null;
}

export function createInitialPuzzleState(
  puzzle: Puzzle,
  objective: Partial<LevelChallengeObjective> = DEFAULT_CLASSIC_OBJECTIVE,
): PuzzleState {
  const initialMatches = countMatchingPositions(puzzle.startingSequence, puzzle.targetSequence);
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
    status: 'ready' as const,
    failureReason: null,
  });
}
