import type { PuzzleSeedInput } from '../models/PuzzleConfig';

/**
 * Deterministic or injectable source of pseudorandom numbers in [0, 1).
 */
export interface RandomSource {
  /** Returns a number strictly within 0 <= value < 1. */
  next(): number;
}

/**
 * Injected boundary dependency for producing a seed when a caller does not
 * specify one explicitly in PuzzleConfig.
 */
export type SeedProvider = () => PuzzleSeedInput;
