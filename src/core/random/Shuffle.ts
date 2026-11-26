import { PuzzleError } from '../errors/PuzzleError';
import type { RandomSource } from './RandomSource';

function nextValidatedUnitFloat(randomSource: RandomSource): number {
  const value = randomSource.next();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new PuzzleError(
      'INVALID_CONFIG',
      `RandomSource.next() must return a number in [0, 1); received ${String(value)}.`,
      { value },
    );
  }
  return value;
}

/**
 * Pure generic Fisher-Yates shuffle.
 * Returns a new array without mutating the input collection.
 */
export function shuffle<T>(items: readonly T[], randomSource: RandomSource): T[] {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(nextValidatedUnitFloat(randomSource) * (i + 1));
    const current = result[i];
    const target = result[j];
    if (current !== undefined && target !== undefined) {
      result[i] = target;
      result[j] = current;
    }
  }

  return result;
}
