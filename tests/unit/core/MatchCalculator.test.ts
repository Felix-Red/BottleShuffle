import { describe, expect, it } from 'vitest';
import {
  calculateCorrectMatches,
  isSequenceSolved,
} from '../../../src/core/engine/MatchCalculator';
import { PuzzleError } from '../../../src/core/errors/PuzzleError';
import { CANONICAL_BOTTLE_IDS, type BottleId } from '../../../src/core/models/BottleId';

describe('MatchCalculator', () => {
  it('calculates 0, 1, partial, and full matches accurately across 3-bottle and 10-bottle sequences', () => {
    const target3: readonly BottleId[] = ['red', 'blue', 'green'];
    expect(calculateCorrectMatches(['blue', 'green', 'red'], target3)).toBe(0);
    expect(calculateCorrectMatches(['red', 'green', 'blue'], target3)).toBe(1);
    expect(calculateCorrectMatches(['red', 'blue', 'green'], target3)).toBe(3);
    expect(isSequenceSolved(['red', 'blue', 'green'], target3)).toBe(true);
    expect(isSequenceSolved(['red', 'green', 'blue'], target3)).toBe(false);

    const target5: readonly BottleId[] = ['red', 'blue', 'green', 'yellow', 'purple'];
    const current5: readonly BottleId[] = ['green', 'blue', 'red', 'yellow', 'purple'];
    expect(calculateCorrectMatches(current5, target5)).toBe(3);

    const target10 = [...CANONICAL_BOTTLE_IDS];
    const [firstBottle, ...remainingBottles] = target10;
    if (firstBottle === undefined) {
      expect.unreachable('Expected non-empty canonical bottle list');
    }
    const rotated10: readonly BottleId[] = [...remainingBottles, firstBottle];
    expect(calculateCorrectMatches(rotated10, target10)).toBe(0);
    expect(calculateCorrectMatches(target10, target10)).toBe(10);
    expect(isSequenceSolved(target10, target10)).toBe(true);
  });

  it('does not mutate either input sequence', () => {
    const current: BottleId[] = ['green', 'blue', 'red'];
    const target: BottleId[] = ['red', 'blue', 'green'];
    calculateCorrectMatches(current, target);

    expect(current).toEqual(['green', 'blue', 'red']);
    expect(target).toEqual(['red', 'blue', 'green']);
  });

  it('rejects mismatched lengths, mismatched identity sets, duplicates, and unsupported IDs', () => {
    expect(() => calculateCorrectMatches(['red', 'blue'], ['red', 'blue', 'green'])).toThrow(
      PuzzleError,
    );

    expect(() =>
      calculateCorrectMatches(['red', 'blue', 'pink'], ['red', 'blue', 'green']),
    ).toThrow(PuzzleError);

    expect(() =>
      calculateCorrectMatches(['red', 'red', 'green'], ['red', 'blue', 'green']),
    ).toThrow(PuzzleError);

    expect(() =>
      calculateCorrectMatches(['red', 'cyan' as BottleId, 'green'], ['red', 'blue', 'green']),
    ).toThrow(PuzzleError);
  });
});
