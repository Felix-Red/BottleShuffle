import { describe, expect, it } from 'vitest';
import { PuzzleError } from '../../../src/core/errors/PuzzleError';
import { createSeededRandom } from '../../../src/core/random/SeededRandom';
import { shuffle } from '../../../src/core/random/Shuffle';

describe('shuffle (Fisher-Yates)', () => {
  it('preserves length and all elements without mutating the input array', () => {
    const original = Object.freeze(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
    const result = shuffle(original, createSeededRandom('shuffle-test-1'));

    expect(result).toHaveLength(original.length);
    expect([...result].sort()).toEqual([...original].sort());
    expect(original).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
  });

  it('handles empty and single-element collections safely', () => {
    const rng = createSeededRandom('edge-cases');
    expect(shuffle([], rng)).toEqual([]);
    expect(shuffle(['only'], rng)).toEqual(['only']);
  });

  it('produces identical results for identical seeded random sources', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const first = shuffle(items, createSeededRandom('deterministic-shuffle'));
    const second = shuffle(items, createSeededRandom('deterministic-shuffle'));
    expect(first).toEqual(second);
  });

  it('rejects broken random sources outside [0, 1)', () => {
    expect(() => shuffle([1, 2, 3], { next: () => 1 })).toThrow(PuzzleError);
    expect(() => shuffle([1, 2, 3], { next: () => -0.1 })).toThrow(PuzzleError);
    expect(() => shuffle([1, 2, 3], { next: () => Number.NaN })).toThrow(PuzzleError);
  });
});
