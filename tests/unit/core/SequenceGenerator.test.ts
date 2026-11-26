import { describe, expect, it } from 'vitest';
import {
  generateStartingSequence,
  generateTargetSequence,
  selectUniqueBottles,
} from '../../../src/core/engine/SequenceGenerator';
import {
  calculateMinimumSwapDistance,
  countMatchingPositions,
} from '../../../src/core/engine/SwapDistance';
import { PuzzleError } from '../../../src/core/errors/PuzzleError';
import { CANONICAL_BOTTLE_IDS } from '../../../src/core/models/BottleId';
import { createSeededRandom } from '../../../src/core/random/SeededRandom';

describe('SequenceGenerator', () => {
  it('selects the requested number of unique bottles and varies selection across seeds', () => {
    const canonicalSnapshot = [...CANONICAL_BOTTLE_IDS];
    const selections = new Set<string>();

    for (let i = 0; i < 20; i += 1) {
      const picked = selectUniqueBottles(3, createSeededRandom(`pick-seed-${String(i)}`));
      expect(picked).toHaveLength(3);
      expect(new Set(picked).size).toBe(3);
      selections.add([...picked].sort().join(','));
    }

    expect(selections.size).toBeGreaterThan(1);
    expect([...CANONICAL_BOTTLE_IDS]).toEqual(canonicalSnapshot);

    const allTen = selectUniqueBottles(10, createSeededRandom('all-ten'));
    expect(allTen).toHaveLength(10);
    expect(new Set(allTen).size).toBe(10);
  });

  it('generates immutable deterministic target sequences', () => {
    const picked = selectUniqueBottles(5, createSeededRandom('target-pick'));
    const targetA = generateTargetSequence(picked, createSeededRandom('target-order'));
    const targetB = generateTargetSequence(picked, createSeededRandom('target-order'));

    expect(targetA).toEqual(targetB);
    expect(Object.isFrozen(targetA)).toBe(true);
    expect([...targetA].sort()).toEqual([...picked].sort());
  });

  it('uses deterministic constructive fallback when random shuffles exhaust on rare valid constraints', () => {
    const target = [...CANONICAL_BOTTLE_IDS];
    const result = generateStartingSequence(
      target,
      {
        minInitialMatches: 7,
        maxInitialMatches: 7,
        minRequiredSwaps: 2,
        maxAttempts: 3,
        allowConstructiveFallback: true,
      },
      createSeededRandom('rare-constraint-seed'),
    );

    expect(result.initialMatchCount).toBe(7);
    expect(result.minimumSwapDistance).toBe(2);
    expect(countMatchingPositions(result.sequence, target)).toBe(7);
    expect(calculateMinimumSwapDistance(result.sequence, target)).toBe(2);
    expect(result.usedFallback).toBe(true);
  });

  it('terminates with GENERATION_EXHAUSTED when fallback is disabled and attempts are insufficient', () => {
    const target = [...CANONICAL_BOTTLE_IDS];

    expect(() =>
      generateStartingSequence(
        target,
        {
          minInitialMatches: 8,
          maxInitialMatches: 8,
          minRequiredSwaps: 1,
          maxAttempts: 1,
          allowConstructiveFallback: false,
        },
        createSeededRandom('exhaust-seed'),
      ),
    ).toThrow(PuzzleError);

    try {
      generateStartingSequence(
        target,
        {
          minInitialMatches: 8,
          maxInitialMatches: 8,
          minRequiredSwaps: 1,
          maxAttempts: 1,
          allowConstructiveFallback: false,
        },
        createSeededRandom('exhaust-seed'),
      );
    } catch (error) {
      expect(error).toBeInstanceOf(PuzzleError);
      expect((error as PuzzleError).code).toBe('GENERATION_EXHAUSTED');
    }
  });
});
