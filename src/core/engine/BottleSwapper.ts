import { GameError } from '../errors/GameError';
import type { BottleId } from '../models/BottleId';

function assertValidSwapIndex(index: number, length: number, label: string): void {
  if (!Number.isFinite(index) || !Number.isInteger(index)) {
    throw new GameError(
      'INVALID_SWAP_INDEX',
      `${label} must be a finite integer; received ${String(index)}.`,
      { label, index, length },
    );
  }

  if (index < 0 || index >= length) {
    throw new GameError(
      'INVALID_SWAP_INDEX',
      `${label} (${String(index)}) is out of bounds for sequence of length ${String(length)}.`,
      { label, index, length },
    );
  }
}

/**
 * Pure bottle-swapping utility using 0-based logical indices.
 * Returns a new frozen sequence with the two bottles exchanged without mutating the input.
 */
export function swapBottles(
  sequence: readonly BottleId[],
  firstIndex: number,
  secondIndex: number,
): readonly BottleId[] {
  if (sequence.length < 2) {
    throw new GameError(
      'INVALID_SEQUENCE',
      `Cannot swap bottles in a sequence of length ${String(sequence.length)}.`,
      { length: sequence.length },
    );
  }

  assertValidSwapIndex(firstIndex, sequence.length, 'firstIndex');
  assertValidSwapIndex(secondIndex, sequence.length, 'secondIndex');

  if (firstIndex === secondIndex) {
    throw new GameError(
      'INVALID_SWAP_INDEX',
      `Cannot swap bottle at index ${String(firstIndex)} with itself.`,
      { firstIndex, secondIndex },
    );
  }

  const next = [...sequence];
  const firstBottle = next[firstIndex];
  const secondBottle = next[secondIndex];

  if (firstBottle === undefined || secondBottle === undefined) {
    throw new GameError(
      'INVALID_SEQUENCE',
      `Sequence contains missing bottle entry at swap indices (${String(firstIndex)}, ${String(secondIndex)}).`,
      { firstIndex, secondIndex },
    );
  }

  next[firstIndex] = secondBottle;
  next[secondIndex] = firstBottle;

  return Object.freeze(next);
}
