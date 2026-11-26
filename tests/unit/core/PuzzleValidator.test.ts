import { describe, expect, it } from 'vitest';
import {
  assertValidPuzzle,
  validatePuzzle,
  validatePuzzleConfig,
} from '../../../src/core/engine/PuzzleValidator';
import { calculateMinimumSwapDistance } from '../../../src/core/engine/SwapDistance';
import { PuzzleError, type PuzzleErrorCode } from '../../../src/core/errors/PuzzleError';
import type { BottleId } from '../../../src/core/models/BottleId';
import type { DifficultyId } from '../../../src/core/models/Difficulty';
import type { Puzzle } from '../../../src/core/models/Puzzle';
import type { PuzzleConfig } from '../../../src/core/models/PuzzleConfig';

function expectPuzzleErrorCode(fn: () => unknown, expectedCode: PuzzleErrorCode): void {
  try {
    fn();
    expect.unreachable(`Expected PuzzleError(${expectedCode}) to be thrown`);
  } catch (error) {
    expect(error).toBeInstanceOf(PuzzleError);
    expect((error as PuzzleError).code).toBe(expectedCode);
  }
}

describe('calculateMinimumSwapDistance', () => {
  it('returns 0 for identical sequences and never mutates inputs', () => {
    const seq: readonly BottleId[] = ['red', 'blue', 'green', 'yellow'];
    expect(calculateMinimumSwapDistance(seq, [...seq])).toBe(0);
    expect(seq).toEqual(['red', 'blue', 'green', 'yellow']);
  });

  it('returns 1 for a single pair exchange', () => {
    const target: readonly BottleId[] = ['red', 'blue', 'green', 'yellow'];
    const swapped: readonly BottleId[] = ['red', 'yellow', 'green', 'blue'];
    expect(calculateMinimumSwapDistance(swapped, target)).toBe(1);
  });

  it('returns 2 for a 3-element cycle and 3 for a 4-element cycle', () => {
    const target3: readonly BottleId[] = ['red', 'blue', 'green'];
    const cycle3: readonly BottleId[] = ['blue', 'green', 'red'];
    expect(calculateMinimumSwapDistance(cycle3, target3)).toBe(2);

    const target4: readonly BottleId[] = ['red', 'blue', 'green', 'yellow'];
    const cycle4: readonly BottleId[] = ['blue', 'green', 'yellow', 'red'];
    expect(calculateMinimumSwapDistance(cycle4, target4)).toBe(3);
  });

  it('calculates multiple independent cycles accurately', () => {
    // 6 bottles: (red <-> blue) [2-cycle], (green -> yellow -> purple -> green) [3-cycle], (orange) [1-cycle]
    // Cycles = 3, minimumSwaps = 6 - 3 = 3
    const target: readonly BottleId[] = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];
    const start: readonly BottleId[] = ['blue', 'red', 'yellow', 'purple', 'green', 'orange'];
    expect(calculateMinimumSwapDistance(start, target)).toBe(3);
  });

  it('rejects mismatched lengths, duplicate bottles, unsupported IDs, and mismatched identity sets', () => {
    expectPuzzleErrorCode(
      () => calculateMinimumSwapDistance(['red', 'blue'], ['red', 'blue', 'green']),
      'MISMATCHED_SEQUENCES',
    );
    expectPuzzleErrorCode(
      () => calculateMinimumSwapDistance(['red', 'red', 'blue'], ['red', 'blue', 'green']),
      'DUPLICATE_BOTTLE',
    );
    expectPuzzleErrorCode(
      () =>
        calculateMinimumSwapDistance(['red', 'cyan' as BottleId, 'blue'], ['red', 'green', 'blue']),
      'UNSUPPORTED_BOTTLE',
    );
    expectPuzzleErrorCode(
      () => calculateMinimumSwapDistance(['red', 'blue', 'pink'], ['red', 'blue', 'green']),
      'MISMATCHED_SEQUENCES',
    );
  });
});

describe('PuzzleValidator', () => {
  it('rejects invalid bottle counts (0, negative, 2, 11, fractional)', () => {
    const badCounts = [0, -3, 2, 11, 4.5, Number.NaN];
    for (const count of badCounts) {
      expectPuzzleErrorCode(
        () => validatePuzzleConfig({ difficulty: 'normal', bottleCount: count, seed: 's1' }),
        'INVALID_BOTTLE_COUNT',
      );
    }
  });

  it('rejects invalid difficulty identifiers and impossible match or swap constraints', () => {
    expectPuzzleErrorCode(
      () => validatePuzzleConfig({ difficulty: 'extreme' as DifficultyId, seed: 's1' }),
      'INVALID_DIFFICULTY',
    );

    const badMatchConfigs: readonly PuzzleConfig[] = [
      { difficulty: 'expert', bottleCount: 10, minInitialMatches: 9, maxInitialMatches: 9 },
      { difficulty: 'expert', bottleCount: 10, minInitialMatches: 0, maxInitialMatches: 9 },
      { difficulty: 'expert', bottleCount: 10, minInitialMatches: 0, maxInitialMatches: 10 },
      { difficulty: 'normal', bottleCount: 5, minInitialMatches: 3, maxInitialMatches: 1 },
      { difficulty: 'normal', bottleCount: 5, minInitialMatches: -1, maxInitialMatches: 2 },
      { difficulty: 'normal', bottleCount: 5, minInitialMatches: 1.5, maxInitialMatches: 2 },
    ];
    for (const cfg of badMatchConfigs) {
      expectPuzzleErrorCode(() => validatePuzzleConfig(cfg), 'INVALID_MATCH_CONSTRAINTS');
    }

    const badSwapConfigs: readonly PuzzleConfig[] = [
      { difficulty: 'normal', bottleCount: 5, minRequiredSwaps: 0 },
      { difficulty: 'normal', bottleCount: 5, minRequiredSwaps: -1 },
      { difficulty: 'normal', bottleCount: 5, minRequiredSwaps: 5 },
      // 5 bottles with >= 2 fixed points has at most 5 - 2 - 1 = 2 swaps; 3 is impossible
      {
        difficulty: 'normal',
        bottleCount: 5,
        minInitialMatches: 2,
        maxInitialMatches: 3,
        minRequiredSwaps: 3,
      },
    ];
    for (const cfg of badSwapConfigs) {
      expectPuzzleErrorCode(() => validatePuzzleConfig(cfg), 'INVALID_SWAP_CONSTRAINTS');
    }
  });

  it('rejects invalid, duplicate, unsupported, mismatched, and already-solved puzzle objects', () => {
    const base: Puzzle = {
      id: 'pzl-test',
      seed: 'seed-1',
      generatorVersion: '1.0.0',
      difficulty: 'beginner',
      bottleCount: 3,
      startingSequence: ['blue', 'green', 'red'],
      targetSequence: ['red', 'blue', 'green'],
    };

    expect(validatePuzzle(base).valid).toBe(true);

    // Solved starting sequence
    const solvedResult = validatePuzzle({
      ...base,
      startingSequence: ['red', 'blue', 'green'],
    });
    expect(solvedResult.valid).toBe(false);
    if (!solvedResult.valid) {
      expect(solvedResult.code).toBe('SOLVED_STARTING_SEQUENCE');
    }

    // Duplicate bottle
    expectPuzzleErrorCode(
      () =>
        assertValidPuzzle({
          ...base,
          startingSequence: ['red', 'red', 'green'],
        }),
      'DUPLICATE_BOTTLE',
    );

    // Unsupported bottle
    expectPuzzleErrorCode(
      () =>
        assertValidPuzzle({
          ...base,
          targetSequence: ['red', 'magenta' as BottleId, 'green'],
        }),
      'UNSUPPORTED_BOTTLE',
    );

    // Mismatched lengths
    expectPuzzleErrorCode(
      () =>
        assertValidPuzzle({
          ...base,
          startingSequence: ['blue', 'red'],
        }),
      'MISMATCHED_SEQUENCES',
    );

    // Mismatched identity sets
    expectPuzzleErrorCode(
      () =>
        assertValidPuzzle({
          ...base,
          startingSequence: ['blue', 'green', 'pink'],
        }),
      'MISMATCHED_SEQUENCES',
    );
  });
});
