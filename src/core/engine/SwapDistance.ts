import { PuzzleError } from '../errors/PuzzleError';
import { isBottleId, type BottleId } from '../models/BottleId';

function validateUniqueBottleSequence(
  sequence: readonly BottleId[],
  label: string,
): Map<BottleId, number> {
  const indexById = new Map<BottleId, number>();

  for (let i = 0; i < sequence.length; i += 1) {
    const id = sequence[i];
    if (id === undefined || !isBottleId(id)) {
      throw new PuzzleError(
        'UNSUPPORTED_BOTTLE',
        `${label} contains unsupported bottle identifier "${String(id)}" at index ${String(i)}.`,
        { label, index: i, bottleId: id },
      );
    }

    if (indexById.has(id)) {
      throw new PuzzleError(
        'DUPLICATE_BOTTLE',
        `${label} contains duplicate bottle identifier "${id}" at index ${String(i)}.`,
        { label, index: i, bottleId: id },
      );
    }

    indexById.set(id, i);
  }

  return indexById;
}

/**
 * Counts how many bottles occupy the exact same logical slot index in both sequences.
 */
export function countMatchingPositions(
  sequenceA: readonly BottleId[],
  sequenceB: readonly BottleId[],
): number {
  if (sequenceA.length !== sequenceB.length) {
    throw new PuzzleError(
      'MISMATCHED_SEQUENCES',
      `Cannot count matches for sequences of different lengths (${String(sequenceA.length)} vs ${String(sequenceB.length)}).`,
      { lengthA: sequenceA.length, lengthB: sequenceB.length },
    );
  }

  let matches = 0;
  for (let i = 0; i < sequenceA.length; i += 1) {
    if (sequenceA[i] === sequenceB[i]) {
      matches += 1;
    }
  }
  return matches;
}

/**
 * Calculates the minimum number of arbitrary pairwise swaps required to transform
 * `fromSequence` into `toSequence` using permutation cycle decomposition:
 *
 *   minimumSwaps = bottleCount - numberOfPermutationCycles
 *
 * Does not mutate either input sequence.
 */
export function calculateMinimumSwapDistance(
  fromSequence: readonly BottleId[],
  toSequence: readonly BottleId[],
): number {
  if (fromSequence.length !== toSequence.length) {
    throw new PuzzleError(
      'MISMATCHED_SEQUENCES',
      `Cannot compute swap distance for sequences of different lengths (${String(fromSequence.length)} vs ${String(toSequence.length)}).`,
      { fromLength: fromSequence.length, toLength: toSequence.length },
    );
  }

  const fromIndexById = validateUniqueBottleSequence(fromSequence, 'fromSequence');
  const toIndexById = validateUniqueBottleSequence(toSequence, 'toSequence');

  for (const id of fromIndexById.keys()) {
    if (!toIndexById.has(id)) {
      throw new PuzzleError(
        'MISMATCHED_SEQUENCES',
        `Sequences do not share the same bottle identity set: "${id}" is missing from toSequence.`,
        { missingBottleId: id },
      );
    }
  }

  const length = fromSequence.length;
  const visited = new Array<boolean>(length).fill(false);
  let cycleCount = 0;

  for (let start = 0; start < length; start += 1) {
    if (visited[start]) {
      continue;
    }

    cycleCount += 1;
    let current = start;
    while (!visited[current]) {
      visited[current] = true;
      const bottleId = fromSequence[current];
      if (bottleId === undefined) {
        break;
      }
      const nextIndex = toIndexById.get(bottleId);
      if (nextIndex === undefined) {
        break;
      }
      current = nextIndex;
    }
  }

  return length - cycleCount;
}
