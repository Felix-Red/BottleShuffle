import { PuzzleError } from '../errors/PuzzleError';
import type { BottleId } from '../models/BottleId';
import { validateBottleCount, validateBottleSequence } from './PuzzleValidator';
import { countMatchingPositions } from './SwapDistance';

/**
 * Pure O(n) match calculator validating sequence compatibility and returning
 * only the aggregate number of correctly positioned bottles (0..bottleCount).
 *
 * Never mutates inputs and never exposes individual matching indices.
 */
export function calculateCorrectMatches(
  currentSequence: readonly BottleId[],
  targetSequence: readonly BottleId[],
): number {
  if (currentSequence.length !== targetSequence.length) {
    throw new PuzzleError(
      'MISMATCHED_SEQUENCES',
      `Current sequence length (${String(currentSequence.length)}) does not match target sequence length (${String(targetSequence.length)}).`,
      { currentLength: currentSequence.length, targetLength: targetSequence.length },
    );
  }

  validateBottleCount(targetSequence.length);
  validateBottleSequence(targetSequence, targetSequence.length, 'targetSequence');
  validateBottleSequence(currentSequence, currentSequence.length, 'currentSequence');

  const targetIds = new Set<BottleId>(targetSequence);
  for (const id of currentSequence) {
    if (!targetIds.has(id)) {
      throw new PuzzleError(
        'MISMATCHED_SEQUENCES',
        `Current sequence contains bottle "${id}" which is not present in targetSequence.`,
        { unexpectedBottleId: id },
      );
    }
  }

  return countMatchingPositions(currentSequence, targetSequence);
}

/**
 * Returns true when every bottle in `currentSequence` matches `targetSequence`.
 */
export function isSequenceSolved(
  currentSequence: readonly BottleId[],
  targetSequence: readonly BottleId[],
): boolean {
  return calculateCorrectMatches(currentSequence, targetSequence) === targetSequence.length;
}
