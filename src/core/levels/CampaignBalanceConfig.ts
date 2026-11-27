import type { DifficultyId } from '../models/Difficulty';

export const CAMPAIGN_CATALOG_VERSION = '2.0.0' as const;

export interface BottleCountPuzzleDefaults {
  readonly bottleCount: number;
  readonly difficulty: DifficultyId;
  readonly minInitialMatches: number;
  readonly maxInitialMatches: number;
  readonly minRequiredSwaps: number;
}

/**
 * Configurable puzzle-constraint defaults for every supported bottle count (3..10).
 * Keeps 7-bottle and 9-bottle puzzles cleanly mapped to existing scoring difficulties
 * while preserving Scoring Policy v1 compatibility.
 */
export const BOTTLE_COUNT_PUZZLE_DEFAULTS: Readonly<Record<number, BottleCountPuzzleDefaults>> =
  Object.freeze({
    3: Object.freeze({
      bottleCount: 3,
      difficulty: 'beginner',
      minInitialMatches: 0,
      maxInitialMatches: 1,
      minRequiredSwaps: 1,
    }),
    4: Object.freeze({
      bottleCount: 4,
      difficulty: 'easy',
      minInitialMatches: 0,
      maxInitialMatches: 2,
      minRequiredSwaps: 1,
    }),
    5: Object.freeze({
      bottleCount: 5,
      difficulty: 'normal',
      minInitialMatches: 0,
      maxInitialMatches: 2,
      minRequiredSwaps: 2,
    }),
    6: Object.freeze({
      bottleCount: 6,
      difficulty: 'intermediate',
      minInitialMatches: 0,
      maxInitialMatches: 3,
      minRequiredSwaps: 2,
    }),
    7: Object.freeze({
      bottleCount: 7,
      difficulty: 'hard',
      minInitialMatches: 0,
      maxInitialMatches: 3,
      minRequiredSwaps: 3,
    }),
    8: Object.freeze({
      bottleCount: 8,
      difficulty: 'hard',
      minInitialMatches: 0,
      maxInitialMatches: 3,
      minRequiredSwaps: 3,
    }),
    9: Object.freeze({
      bottleCount: 9,
      difficulty: 'expert',
      minInitialMatches: 0,
      maxInitialMatches: 4,
      minRequiredSwaps: 4,
    }),
    10: Object.freeze({
      bottleCount: 10,
      difficulty: 'expert',
      minInitialMatches: 0,
      maxInitialMatches: 4,
      minRequiredSwaps: 4,
    }),
  });

const DEFAULT_FIVE_BOTTLE_FALLBACK: BottleCountPuzzleDefaults = Object.freeze({
  bottleCount: 5,
  difficulty: 'normal',
  minInitialMatches: 0,
  maxInitialMatches: 2,
  minRequiredSwaps: 2,
});

export function getBottleCountPuzzleDefaults(bottleCount: number): BottleCountPuzzleDefaults {
  return BOTTLE_COUNT_PUZZLE_DEFAULTS[bottleCount] ?? DEFAULT_FIVE_BOTTLE_FALLBACK;
}

export const PROGRESSIVE_BOTTLE_SEQUENCE: readonly number[] = Object.freeze([
  3, 4, 5, 6, 7, 8, 9, 10,
]);

export interface TimedLevelTuning {
  readonly bottleCount: number;
  readonly timeLimitSeconds: number;
}

export interface LimitedMovesLevelTuning {
  readonly bottleCount: number;
  readonly moveLimit: number;
}

export interface CombinedLevelTuning {
  readonly bottleCount: number;
  readonly timeLimitSeconds: number;
  readonly moveLimit: number;
}

/**
 * Configurable campaign balancing tables.
 * Initial tuning values designed for hidden-sequence deduction without knowledge of
 * the target sequence (exploratory probing swaps + convergence swaps).
 */
export const CAMPAIGN_BALANCE_CONFIG = Object.freeze({
  chapter2BeatTheClock: Object.freeze<readonly TimedLevelTuning[]>([
    Object.freeze({ bottleCount: 3, timeLimitSeconds: 30 }),
    Object.freeze({ bottleCount: 4, timeLimitSeconds: 45 }),
    Object.freeze({ bottleCount: 5, timeLimitSeconds: 60 }),
    Object.freeze({ bottleCount: 6, timeLimitSeconds: 90 }),
    Object.freeze({ bottleCount: 7, timeLimitSeconds: 120 }),
    Object.freeze({ bottleCount: 8, timeLimitSeconds: 150 }),
    Object.freeze({ bottleCount: 9, timeLimitSeconds: 180 }),
    Object.freeze({ bottleCount: 10, timeLimitSeconds: 210 }),
  ]),
  chapter3SpeedMastery: Object.freeze<readonly TimedLevelTuning[]>([
    Object.freeze({ bottleCount: 3, timeLimitSeconds: 20 }),
    Object.freeze({ bottleCount: 4, timeLimitSeconds: 30 }),
    Object.freeze({ bottleCount: 5, timeLimitSeconds: 45 }),
    Object.freeze({ bottleCount: 6, timeLimitSeconds: 60 }),
    Object.freeze({ bottleCount: 7, timeLimitSeconds: 90 }),
    Object.freeze({ bottleCount: 8, timeLimitSeconds: 120 }),
    Object.freeze({ bottleCount: 9, timeLimitSeconds: 150 }),
    Object.freeze({ bottleCount: 10, timeLimitSeconds: 180 }),
  ]),
  chapter4EveryMoveCounts: Object.freeze<readonly LimitedMovesLevelTuning[]>([
    Object.freeze({ bottleCount: 3, moveLimit: 6 }),
    Object.freeze({ bottleCount: 4, moveLimit: 10 }),
    Object.freeze({ bottleCount: 5, moveLimit: 15 }),
    Object.freeze({ bottleCount: 6, moveLimit: 20 }),
    Object.freeze({ bottleCount: 7, moveLimit: 26 }),
    Object.freeze({ bottleCount: 8, moveLimit: 32 }),
    Object.freeze({ bottleCount: 9, moveLimit: 38 }),
    Object.freeze({ bottleCount: 10, moveLimit: 45 }),
  ]),
  chapter5DoubleTrouble: Object.freeze<readonly CombinedLevelTuning[]>([
    Object.freeze({ bottleCount: 3, timeLimitSeconds: 30, moveLimit: 7 }),
    Object.freeze({ bottleCount: 4, timeLimitSeconds: 45, moveLimit: 11 }),
    Object.freeze({ bottleCount: 5, timeLimitSeconds: 65, moveLimit: 16 }),
    Object.freeze({ bottleCount: 6, timeLimitSeconds: 95, moveLimit: 22 }),
    Object.freeze({ bottleCount: 7, timeLimitSeconds: 125, moveLimit: 28 }),
    Object.freeze({ bottleCount: 8, timeLimitSeconds: 155, moveLimit: 34 }),
    Object.freeze({ bottleCount: 9, timeLimitSeconds: 185, moveLimit: 40 }),
    Object.freeze({ bottleCount: 10, timeLimitSeconds: 215, moveLimit: 48 }),
  ]),
  chapter6ShuffleMaster: Object.freeze<readonly CombinedLevelTuning[]>([
    Object.freeze({ bottleCount: 6, timeLimitSeconds: 75, moveLimit: 19 }),
    Object.freeze({ bottleCount: 7, timeLimitSeconds: 105, moveLimit: 25 }),
    Object.freeze({ bottleCount: 7, timeLimitSeconds: 90, moveLimit: 24 }),
    Object.freeze({ bottleCount: 8, timeLimitSeconds: 135, moveLimit: 31 }),
    Object.freeze({ bottleCount: 8, timeLimitSeconds: 115, moveLimit: 29 }),
    Object.freeze({ bottleCount: 9, timeLimitSeconds: 160, moveLimit: 37 }),
    Object.freeze({ bottleCount: 9, timeLimitSeconds: 140, moveLimit: 35 }),
    Object.freeze({ bottleCount: 10, timeLimitSeconds: 195, moveLimit: 44 }),
    Object.freeze({ bottleCount: 10, timeLimitSeconds: 175, moveLimit: 42 }),
    Object.freeze({ bottleCount: 10, timeLimitSeconds: 160, moveLimit: 40 }),
  ]),
});
