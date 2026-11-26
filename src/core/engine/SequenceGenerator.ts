import { PuzzleError } from '../errors/PuzzleError';
import { CANONICAL_BOTTLE_IDS, type BottleId } from '../models/BottleId';
import type { RandomSource } from '../random/RandomSource';
import { shuffle } from '../random/Shuffle';
import { validateBottleCount, validateBottleSequence } from './PuzzleValidator';
import { calculateMinimumSwapDistance, countMatchingPositions } from './SwapDistance';

export const DEFAULT_MAX_GENERATION_ATTEMPTS = 256;

export interface StartingSequenceConstraints {
  readonly minInitialMatches: number;
  readonly maxInitialMatches: number;
  readonly minRequiredSwaps: number;
  readonly maxAttempts?: number;
  readonly allowConstructiveFallback?: boolean;
}

export interface StartingSequenceGenerationResult {
  readonly sequence: readonly BottleId[];
  readonly attempts: number;
  readonly usedFallback: boolean;
  readonly initialMatchCount: number;
  readonly minimumSwapDistance: number;
}

/**
 * Deterministically selects `bottleCount` unique bottles from the canonical collection
 * without mutating `CANONICAL_BOTTLE_IDS`.
 */
export function selectUniqueBottles(
  bottleCount: number,
  randomSource: RandomSource,
): readonly BottleId[] {
  validateBottleCount(bottleCount);
  const shuffled = shuffle(CANONICAL_BOTTLE_IDS, randomSource);
  return Object.freeze(shuffled.slice(0, bottleCount));
}

/**
 * Generates an immutable hidden target sequence from a validated set of unique bottles.
 */
export function generateTargetSequence(
  selectedBottles: readonly BottleId[],
  randomSource: RandomSource,
): readonly BottleId[] {
  validateBottleCount(selectedBottles.length);
  validateBottleSequence(selectedBottles, selectedBottles.length, 'selectedBottles');
  return Object.freeze(shuffle(selectedBottles, randomSource));
}

/**
 * Deterministic constructive fallback:
 * Picks a valid fixed-point count `k` satisfying:
 *   minInitialMatches <= k <= Math.min(maxInitialMatches, n - 2)
 *   and n - k - 1 >= minRequiredSwaps
 * Keeps `k` randomly chosen slots fixed and places the remaining `m = n - k >= 2`
 * slots into a single `m`-cycle, guaranteeing exact match count `k` and exact
 * swap distance `m - 1 >= minRequiredSwaps`.
 */
function constructConstrainedStartingSequence(
  targetSequence: readonly BottleId[],
  constraints: StartingSequenceConstraints,
  randomSource: RandomSource,
): readonly BottleId[] {
  const n = targetSequence.length;
  const maxFeasibleK = Math.min(
    constraints.maxInitialMatches,
    n - 2,
    n - 1 - constraints.minRequiredSwaps,
  );

  if (maxFeasibleK < constraints.minInitialMatches) {
    throw new PuzzleError(
      'GENERATION_EXHAUSTED',
      `No feasible starting permutation exists for ${String(n)} bottles with matches in [${String(constraints.minInitialMatches)}, ${String(constraints.maxInitialMatches)}] and minRequiredSwaps=${String(constraints.minRequiredSwaps)}.`,
      { bottleCount: n, ...constraints },
    );
  }

  const candidateSpan = maxFeasibleK - constraints.minInitialMatches + 1;
  const chosenK = constraints.minInitialMatches + Math.floor(randomSource.next() * candidateSpan);

  const indices = Array.from({ length: n }, (_, index) => index);
  const shuffledIndices = shuffle(indices, randomSource);
  const fixedIndices = shuffledIndices.slice(0, chosenK);
  const derangedIndices = shuffledIndices.slice(chosenK);

  const result = new Array<BottleId>(n);

  for (const idx of fixedIndices) {
    const bottle = targetSequence[idx];
    if (bottle !== undefined) {
      result[idx] = bottle;
    }
  }

  const cycleLen = derangedIndices.length;
  for (let i = 0; i < cycleLen; i += 1) {
    const fromSlot = derangedIndices[i];
    const sourceSlot = derangedIndices[(i + 1) % cycleLen];
    if (fromSlot !== undefined && sourceSlot !== undefined) {
      const bottle = targetSequence[sourceSlot];
      if (bottle !== undefined) {
        result[fromSlot] = bottle;
      }
    }
  }

  return Object.freeze(result);
}

/**
 * Generates an unsolved starting sequence satisfying match and minimum-swap constraints
 * within a bounded number of attempts, with an optional deterministic constructive fallback.
 */
export function generateStartingSequence(
  targetSequence: readonly BottleId[],
  constraints: StartingSequenceConstraints,
  randomSource: RandomSource,
): StartingSequenceGenerationResult {
  const n = targetSequence.length;
  validateBottleCount(n);
  validateBottleSequence(targetSequence, n, 'targetSequence');

  const maxAttempts = constraints.maxAttempts ?? DEFAULT_MAX_GENERATION_ATTEMPTS;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new PuzzleError(
      'INVALID_CONFIG',
      `maxAttempts must be a positive integer; received ${String(maxAttempts)}.`,
      { maxAttempts },
    );
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const candidate = shuffle(targetSequence, randomSource);
    const matches = countMatchingPositions(candidate, targetSequence);
    if (
      matches >= n ||
      matches < constraints.minInitialMatches ||
      matches > constraints.maxInitialMatches
    ) {
      continue;
    }

    const swapDistance = calculateMinimumSwapDistance(candidate, targetSequence);
    if (swapDistance < constraints.minRequiredSwaps) {
      continue;
    }

    return {
      sequence: Object.freeze(candidate),
      attempts: attempt,
      usedFallback: false,
      initialMatchCount: matches,
      minimumSwapDistance: swapDistance,
    };
  }

  if (constraints.allowConstructiveFallback === false) {
    throw new PuzzleError(
      'GENERATION_EXHAUSTED',
      `Unable to generate a valid starting sequence within ${String(maxAttempts)} attempts.`,
      { bottleCount: n, maxAttempts, ...constraints },
    );
  }

  const fallback = constructConstrainedStartingSequence(targetSequence, constraints, randomSource);
  const matches = countMatchingPositions(fallback, targetSequence);
  const swapDistance = calculateMinimumSwapDistance(fallback, targetSequence);

  return {
    sequence: fallback,
    attempts: maxAttempts,
    usedFallback: true,
    initialMatchCount: matches,
    minimumSwapDistance: swapDistance,
  };
}
