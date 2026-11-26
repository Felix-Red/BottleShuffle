import type { BottleId } from './BottleId';
import type { DifficultyId } from './Difficulty';

/**
 * Internal, immutable puzzle definition owned by the domain/controller layer.
 * Must not be passed directly into reusable rendering components.
 */
export interface Puzzle {
  readonly id: string;
  readonly seed: string;
  readonly generatorVersion: string;
  readonly difficulty: DifficultyId;
  readonly bottleCount: number;
  readonly startingSequence: readonly BottleId[];
  readonly targetSequence: readonly BottleId[];
}

/**
 * Player-visible projection of a puzzle that omits the hidden target sequence,
 * internal seed, and generation diagnostics.
 */
export interface PublicPuzzleView {
  readonly id: string;
  readonly difficulty: DifficultyId;
  readonly bottleCount: number;
  readonly startingSequence: readonly BottleId[];
}

export function toPublicPuzzleView(puzzle: Puzzle): PublicPuzzleView {
  return Object.freeze({
    id: puzzle.id,
    difficulty: puzzle.difficulty,
    bottleCount: puzzle.bottleCount,
    startingSequence: Object.freeze([...puzzle.startingSequence]),
  });
}
