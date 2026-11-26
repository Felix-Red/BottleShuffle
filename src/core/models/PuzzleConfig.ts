import type { DifficultyId } from './Difficulty';

export type PuzzleSeedInput = string | number;

export interface PuzzleConfig {
  readonly difficulty: DifficultyId;
  readonly bottleCount?: number;
  readonly seed?: PuzzleSeedInput;
  readonly minInitialMatches?: number;
  readonly maxInitialMatches?: number;
  readonly minRequiredSwaps?: number;
}

export interface ResolvedPuzzleConfig {
  readonly difficulty: DifficultyId;
  readonly bottleCount: number;
  readonly minInitialMatches: number;
  readonly maxInitialMatches: number;
  readonly minRequiredSwaps: number;
}
