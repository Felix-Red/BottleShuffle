import { PuzzleError } from '../errors/PuzzleError';
import type { BottleId } from '../models/BottleId';
import type { DifficultyId } from '../models/Difficulty';
import type { Puzzle } from '../models/Puzzle';
import type { PuzzleConfig, ResolvedPuzzleConfig } from '../models/PuzzleConfig';
import type { SeedProvider } from '../random/RandomSource';
import { createSeededRandom, hashStringToHex, normalizeSeed } from '../random/SeededRandom';
import { assertValidPuzzle, validatePuzzleConfig } from './PuzzleValidator';
import {
  DEFAULT_MAX_GENERATION_ATTEMPTS,
  generateStartingSequence,
  generateTargetSequence,
  selectUniqueBottles,
} from './SequenceGenerator';
import { calculateMinimumSwapDistance, countMatchingPositions } from './SwapDistance';

export const PUZZLE_GENERATOR_VERSION = '1.0.0';

export interface PuzzleGeneratorOptions {
  /** Injected boundary provider used only when PuzzleConfig.seed is omitted. */
  readonly seedProvider?: SeedProvider;
  /** Maximum bounded shuffle attempts before applying deterministic constructive fallback. */
  readonly maxAttempts?: number;
  /** Enables deterministic constructive fallback when random attempts exhaust (default: true). */
  readonly allowConstructiveFallback?: boolean;
}

export interface PuzzleDiagnostics {
  readonly id: string;
  readonly seed: string;
  readonly generatorVersion: string;
  readonly difficulty: DifficultyId;
  readonly bottleCount: number;
  readonly startingSequence: readonly BottleId[];
  readonly targetSequence: readonly BottleId[];
  readonly initialMatchCount: number;
  readonly minimumSwapDistance: number;
}

export function computeDeterministicPuzzleId(
  resolvedConfig: ResolvedPuzzleConfig,
  normalizedSeed: string,
  generatorVersion: string = PUZZLE_GENERATOR_VERSION,
): string {
  const fingerprint = [
    generatorVersion,
    resolvedConfig.difficulty,
    String(resolvedConfig.bottleCount),
    String(resolvedConfig.minInitialMatches),
    String(resolvedConfig.maxInitialMatches),
    String(resolvedConfig.minRequiredSwaps),
    normalizedSeed,
  ].join('|');

  const digest = hashStringToHex(fingerprint);
  return `pzl-${resolvedConfig.difficulty}-${String(resolvedConfig.bottleCount)}-${digest}`;
}

function resolveEffectiveSeed(config: PuzzleConfig, seedProvider?: SeedProvider): string {
  if (config.seed !== undefined) {
    return normalizeSeed(config.seed);
  }

  if (seedProvider !== undefined) {
    return normalizeSeed(seedProvider());
  }

  throw new PuzzleError(
    'MISSING_SEED',
    'No puzzle seed was supplied and no seedProvider dependency was injected. Pass config.seed or configure PuzzleGeneratorOptions.seedProvider.',
  );
}

/**
 * Main pure TypeScript entry point for deterministic puzzle generation.
 *
 * Flow:
 * 1. Validate configuration.
 * 2. Resolve effective seed.
 * 3. Initialise deterministic seeded random source (Mulberry32).
 * 4. Select unique bottle identities.
 * 5. Generate hidden target sequence.
 * 6. Generate valid unsolved starting sequence.
 * 7. Construct immutable puzzle definition.
 * 8. Validate complete puzzle against constraints.
 * 9. Return frozen puzzle definition.
 */
export function generatePuzzle(config: PuzzleConfig, options: PuzzleGeneratorOptions = {}): Puzzle {
  const resolvedConfig = validatePuzzleConfig(config);
  const effectiveSeed = resolveEffectiveSeed(config, options.seedProvider);
  const randomSource = createSeededRandom(effectiveSeed);

  const selectedBottles = selectUniqueBottles(resolvedConfig.bottleCount, randomSource);
  const targetSequence = generateTargetSequence(selectedBottles, randomSource);
  const startingResult = generateStartingSequence(
    targetSequence,
    {
      minInitialMatches: resolvedConfig.minInitialMatches,
      maxInitialMatches: resolvedConfig.maxInitialMatches,
      minRequiredSwaps: resolvedConfig.minRequiredSwaps,
      maxAttempts: options.maxAttempts ?? DEFAULT_MAX_GENERATION_ATTEMPTS,
      ...(options.allowConstructiveFallback !== undefined
        ? { allowConstructiveFallback: options.allowConstructiveFallback }
        : {}),
    },
    randomSource,
  );

  const id = computeDeterministicPuzzleId(resolvedConfig, effectiveSeed, PUZZLE_GENERATOR_VERSION);

  const puzzle: Puzzle = Object.freeze({
    id,
    seed: effectiveSeed,
    generatorVersion: PUZZLE_GENERATOR_VERSION,
    difficulty: resolvedConfig.difficulty,
    bottleCount: resolvedConfig.bottleCount,
    startingSequence: startingResult.sequence,
    targetSequence,
  });

  assertValidPuzzle(puzzle, resolvedConfig);
  return puzzle;
}

/**
 * Computes internal diagnostic metrics for development tooling and tests.
 * Must not be used to expose target details in production UI.
 */
export function inspectPuzzleDiagnostics(puzzle: Puzzle): PuzzleDiagnostics {
  return Object.freeze({
    id: puzzle.id,
    seed: puzzle.seed,
    generatorVersion: puzzle.generatorVersion,
    difficulty: puzzle.difficulty,
    bottleCount: puzzle.bottleCount,
    startingSequence: Object.freeze([...puzzle.startingSequence]),
    targetSequence: Object.freeze([...puzzle.targetSequence]),
    initialMatchCount: countMatchingPositions(puzzle.startingSequence, puzzle.targetSequence),
    minimumSwapDistance: calculateMinimumSwapDistance(
      puzzle.startingSequence,
      puzzle.targetSequence,
    ),
  });
}
