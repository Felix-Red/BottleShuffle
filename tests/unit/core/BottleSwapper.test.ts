import { describe, expect, it } from 'vitest';
import { swapBottles } from '../../../src/core/engine/BottleSwapper';
import { GameError } from '../../../src/core/errors/GameError';
import type { BottleId } from '../../../src/core/models/BottleId';

describe('BottleSwapper', () => {
  it('swaps adjacent, non-adjacent, and boundary bottles without mutating the original sequence', () => {
    const original: readonly BottleId[] = Object.freeze([
      'red',
      'blue',
      'green',
      'yellow',
      'purple',
    ]);

    const adjacent = swapBottles(original, 1, 2);
    expect(adjacent).toEqual(['red', 'green', 'blue', 'yellow', 'purple']);
    expect(Object.isFrozen(adjacent)).toBe(true);

    const nonAdjacent = swapBottles(original, 0, 2);
    expect(nonAdjacent).toEqual(['green', 'blue', 'red', 'yellow', 'purple']);

    const ends = swapBottles(original, 0, 4);
    expect(ends).toEqual(['purple', 'blue', 'green', 'yellow', 'red']);

    expect(original).toEqual(['red', 'blue', 'green', 'yellow', 'purple']);
    expect(ends).toHaveLength(original.length);
    expect([...ends].sort()).toEqual([...original].sort());
  });

  it('rejects negative, out-of-range, fractional, non-finite, and identical indices', () => {
    const seq: readonly BottleId[] = ['red', 'blue', 'green', 'yellow'];

    const invalidPairs: readonly [number, number][] = [
      [-1, 2],
      [0, -1],
      [0, 4],
      [5, 1],
      [0.5, 2],
      [1, 2.7],
      [Number.NaN, 1],
      [0, Number.POSITIVE_INFINITY],
      [2, 2],
    ];

    for (const [first, second] of invalidPairs) {
      expect(() => swapBottles(seq, first, second)).toThrow(GameError);
      try {
        swapBottles(seq, first, second);
      } catch (error) {
        expect(error).toBeInstanceOf(GameError);
        expect((error as GameError).code).toBe('INVALID_SWAP_INDEX');
      }
    }
  });
});
