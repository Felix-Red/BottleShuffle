import { PuzzleError, type PuzzleErrorCode } from '../errors/PuzzleError';
import { resolvePuzzleConfig } from '../levels/DifficultyConfig';
import { isBottleId, MAX_BOTTLE_COUNT, MIN_BOTTLE_COUNT, type BottleId } from '../models/BottleId';
import { isDifficultyId } from '../models/Difficulty';
import type { Puzzle } from '../models/Puzzle';
import type { PuzzleConfig, ResolvedPuzzleConfig } from '../models/PuzzleConfig';
import { normalizeSeed } from '../random/SeededRandom';
import { calculateMinimumSwapDistance, countMatchingPositions } from './SwapDistance';

export type PuzzleValidationResult =
  | {
      readonly valid: true;
      readonly initialMatchCount: number;
      readonly minimumSwapDistance: number;
    }
  | {
      readonly valid: false;
      readonly code: PuzzleErrorCode;
      readonly message: string;
      readonly details?: Readonly<Record<string, unknown>>;
    };

export function validateBottleCount(bottleCount: number): void {
  if (!Number.isInteger(bottleCount)) {
    throw new PuzzleError(
      'INVALID_BOTTLE_COUNT',
      `Bottle count must be an integer between ${String(MIN_BOTTLE_COUNT)} and ${String(MAX_BOTTLE_COUNT)}; received ${String(bottleCount)}.`,
      { bottleCount },
    );
  }

  if (bottleCount < MIN_BOTTLE_COUNT || bottleCount > MAX_BOTTLE_COUNT) {
    throw new PuzzleError(
      'INVALID_BOTTLE_COUNT',
      `Bottle count must be between ${String(MIN_BOTTLE_COUNT)} and ${String(MAX_BOTTLE_COUNT)}; received ${String(bottleCount)}.`,
      { bottleCount, min: MIN_BOTTLE_COUNT, max: MAX_BOTTLE_COUNT },
    );
  }
}

export function validatePuzzleConfig(config: PuzzleConfig): ResolvedPuzzleConfig {
  if (!isDifficultyId(config.difficulty)) {
    throw new PuzzleError(
      'INVALID_DIFFICULTY',
      `Unsupported difficulty identifier: "${String(config.difficulty)}".`,
      { difficulty: config.difficulty },
    );
  }

  if (config.bottleCount !== undefined) {
    validateBottleCount(config.bottleCount);
  }

  if (config.seed !== undefined) {
    normalizeSeed(config.seed);
  }

  const resolved = resolvePuzzleConfig(config);
  validateBottleCount(resolved.bottleCount);

  const { bottleCount, minInitialMatches, maxInitialMatches, minRequiredSwaps } = resolved;
  const maxValidUnsolvedMatches = bottleCount - 2;

  if (!Number.isInteger(minInitialMatches) || !Number.isInteger(maxInitialMatches)) {
    throw new PuzzleError(
      'INVALID_MATCH_CONSTRAINTS',
      `Initial match constraints must be integers; received min=${String(minInitialMatches)}, max=${String(maxInitialMatches)}.`,
      { minInitialMatches, maxInitialMatches },
    );
  }

  if (minInitialMatches < 0 || maxInitialMatches < 0) {
    throw new PuzzleError(
      'INVALID_MATCH_CONSTRAINTS',
      `Initial match constraints cannot be negative; received min=${String(minInitialMatches)}, max=${String(maxInitialMatches)}.`,
      { minInitialMatches, maxInitialMatches },
    );
  }

  if (minInitialMatches > maxInitialMatches) {
    throw new PuzzleError(
      'INVALID_MATCH_CONSTRAINTS',
      `minInitialMatches (${String(minInitialMatches)}) cannot exceed maxInitialMatches (${String(maxInitialMatches)}).`,
      { minInitialMatches, maxInitialMatches },
    );
  }

  if (minInitialMatches > maxValidUnsolvedMatches || maxInitialMatches > maxValidUnsolvedMatches) {
    throw new PuzzleError(
      'INVALID_MATCH_CONSTRAINTS',
      `Invalid initial match bounds [${String(minInitialMatches)}, ${String(maxInitialMatches)}] for a ${String(bottleCount)}-bottle puzzle. A puzzle with ${String(bottleCount)} unique bottles cannot start solved or with ${String(bottleCount - 1)} matches; maximum valid initial matches is ${String(maxValidUnsolvedMatches)}.`,
      { bottleCount, minInitialMatches, maxInitialMatches, maxValidUnsolvedMatches },
    );
  }

  if (!Number.isInteger(minRequiredSwaps) || minRequiredSwaps < 1) {
    throw new PuzzleError(
      'INVALID_SWAP_CONSTRAINTS',
      `minRequiredSwaps must be an integer >= 1; received ${String(minRequiredSwaps)}.`,
      { minRequiredSwaps },
    );
  }

  const maxPossibleSwapsOverall = bottleCount - 1;
  if (minRequiredSwaps > maxPossibleSwapsOverall) {
    throw new PuzzleError(
      'INVALID_SWAP_CONSTRAINTS',
      `minRequiredSwaps (${String(minRequiredSwaps)}) exceeds the maximum possible swap distance (${String(maxPossibleSwapsOverall)}) for ${String(bottleCount)} bottles.`,
      { bottleCount, minRequiredSwaps, maxPossibleSwapsOverall },
    );
  }

  const maxAchievableSwapsWithMinMatches = bottleCount - minInitialMatches - 1;
  if (minRequiredSwaps > maxAchievableSwapsWithMinMatches) {
    throw new PuzzleError(
      'INVALID_SWAP_CONSTRAINTS',
      `Impossible constraint combination: a ${String(bottleCount)}-bottle puzzle with at least ${String(minInitialMatches)} initial matches can require at most ${String(maxAchievableSwapsWithMinMatches)} swaps, but minRequiredSwaps is ${String(minRequiredSwaps)}.`,
      {
        bottleCount,
        minInitialMatches,
        minRequiredSwaps,
        maxAchievableSwapsWithMinMatches,
      },
    );
  }

  return resolved;
}

export function validateBottleSequence(
  sequence: readonly BottleId[],
  expectedLength: number,
  label: string,
): void {
  if (sequence.length !== expectedLength) {
    throw new PuzzleError(
      'INVALID_SEQUENCE',
      `${label} must have length ${String(expectedLength)}; received ${String(sequence.length)}.`,
      { label, expectedLength, actualLength: sequence.length },
    );
  }

  const seen = new Set<BottleId>();
  for (let i = 0; i < sequence.length; i += 1) {
    const id = sequence[i];
    if (id === undefined || !isBottleId(id)) {
      throw new PuzzleError(
        'UNSUPPORTED_BOTTLE',
        `${label} contains unsupported bottle identifier "${String(id)}" at index ${String(i)}.`,
        { label, index: i, bottleId: id },
      );
    }

    if (seen.has(id)) {
      throw new PuzzleError(
        'DUPLICATE_BOTTLE',
        `${label} contains duplicate bottle identifier "${id}" at index ${String(i)}.`,
        { label, index: i, bottleId: id },
      );
    }
    seen.add(id);
  }
}

export function assertValidPuzzle(
  puzzle: Puzzle,
  constraints?: Pick<
    ResolvedPuzzleConfig,
    'minInitialMatches' | 'maxInitialMatches' | 'minRequiredSwaps'
  >,
): { readonly initialMatchCount: number; readonly minimumSwapDistance: number } {
  if (!isDifficultyId(puzzle.difficulty)) {
    throw new PuzzleError(
      'INVALID_DIFFICULTY',
      `Puzzle references unsupported difficulty "${String(puzzle.difficulty)}".`,
      { difficulty: puzzle.difficulty },
    );
  }

  validateBottleCount(puzzle.bottleCount);
  normalizeSeed(puzzle.seed);

  if (puzzle.startingSequence.length !== puzzle.targetSequence.length) {
    throw new PuzzleError(
      'MISMATCHED_SEQUENCES',
      `Starting sequence length (${String(puzzle.startingSequence.length)}) does not match target sequence length (${String(puzzle.targetSequence.length)}).`,
      {
        startingLength: puzzle.startingSequence.length,
        targetLength: puzzle.targetSequence.length,
      },
    );
  }

  validateBottleSequence(puzzle.targetSequence, puzzle.bottleCount, 'targetSequence');
  validateBottleSequence(puzzle.startingSequence, puzzle.bottleCount, 'startingSequence');

  const minimumSwapDistance = calculateMinimumSwapDistance(
    puzzle.startingSequence,
    puzzle.targetSequence,
  );
  const initialMatchCount = countMatchingPositions(puzzle.startingSequence, puzzle.targetSequence);

  if (initialMatchCount >= puzzle.bottleCount || minimumSwapDistance === 0) {
    throw new PuzzleError(
      'SOLVED_STARTING_SEQUENCE',
      'Starting sequence matches target sequence; a puzzle must never start already solved.',
      { puzzleId: puzzle.id, bottleCount: puzzle.bottleCount, initialMatchCount },
    );
  }

  if (constraints !== undefined) {
    if (
      initialMatchCount < constraints.minInitialMatches ||
      initialMatchCount > constraints.maxInitialMatches
    ) {
      throw new PuzzleError(
        'INVALID_MATCH_CONSTRAINTS',
        `Initial match count (${String(initialMatchCount)}) is outside configured bounds [${String(constraints.minInitialMatches)}, ${String(constraints.maxInitialMatches)}].`,
        {
          initialMatchCount,
          minInitialMatches: constraints.minInitialMatches,
          maxInitialMatches: constraints.maxInitialMatches,
        },
      );
    }

    if (minimumSwapDistance < constraints.minRequiredSwaps) {
      throw new PuzzleError(
        'INVALID_SWAP_CONSTRAINTS',
        `Minimum swap distance (${String(minimumSwapDistance)}) is below required minimum (${String(constraints.minRequiredSwaps)}).`,
        { minimumSwapDistance, minRequiredSwaps: constraints.minRequiredSwaps },
      );
    }
  }

  return { initialMatchCount, minimumSwapDistance };
}

export function validatePuzzle(
  puzzle: Puzzle,
  constraints?: Pick<
    ResolvedPuzzleConfig,
    'minInitialMatches' | 'maxInitialMatches' | 'minRequiredSwaps'
  >,
): PuzzleValidationResult {
  try {
    const metrics = assertValidPuzzle(puzzle, constraints);
    return {
      valid: true,
      initialMatchCount: metrics.initialMatchCount,
      minimumSwapDistance: metrics.minimumSwapDistance,
    };
  } catch (error) {
    if (error instanceof PuzzleError) {
      return {
        valid: false,
        code: error.code,
        message: error.message,
        ...(error.details !== undefined ? { details: error.details } : {}),
      };
    }
    throw error;
  }
}
