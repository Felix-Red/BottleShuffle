import { describe, expect, it } from 'vitest';
import {
  generatePuzzle,
  inspectPuzzleDiagnostics,
  PUZZLE_GENERATOR_VERSION,
} from '../../../src/core/engine/PuzzleGenerator';
import { validatePuzzle, validatePuzzleConfig } from '../../../src/core/engine/PuzzleValidator';
import { PuzzleError } from '../../../src/core/errors/PuzzleError';
import { ALL_DIFFICULTY_DEFINITIONS } from '../../../src/core/levels/DifficultyConfig';
import type { BottleId } from '../../../src/core/models/BottleId';
import { toPublicPuzzleView } from '../../../src/core/models/Puzzle';
import { createInitialPuzzleState } from '../../../src/core/models/PuzzleState';

describe('PuzzleGenerator', () => {
  it('generates valid puzzles across 3, 4, 5, 6, 8, and 10 bottle difficulties', () => {
    for (const def of ALL_DIFFICULTY_DEFINITIONS) {
      const config = { difficulty: def.id, seed: `verify-${def.id}` };
      const resolved = validatePuzzleConfig(config);
      const puzzle = generatePuzzle(config);

      expect(puzzle.difficulty).toBe(def.id);
      expect(puzzle.bottleCount).toBe(def.bottleCount);
      expect(puzzle.generatorVersion).toBe(PUZZLE_GENERATOR_VERSION);
      expect(puzzle.startingSequence).toHaveLength(def.bottleCount);
      expect(puzzle.targetSequence).toHaveLength(def.bottleCount);
      expect(new Set(puzzle.startingSequence).size).toBe(def.bottleCount);
      expect([...puzzle.startingSequence].sort()).toEqual([...puzzle.targetSequence].sort());
      expect(puzzle.startingSequence).not.toEqual(puzzle.targetSequence);

      const validation = validatePuzzle(puzzle, resolved);
      expect(validation.valid).toBe(true);
    }
  });

  it('produces byte-for-byte identical puzzles for identical seeds and configurations', () => {
    const config = { difficulty: 'expert' as const, seed: 'replay-2026' };
    const first = generatePuzzle(config);
    const second = generatePuzzle(config);

    expect(first).toEqual(second);
    expect(first.id).toBe(second.id);
  });

  it('supports injected seedProvider and rejects omitted seed when no provider is configured', () => {
    const puzzle = generatePuzzle(
      { difficulty: 'normal' },
      { seedProvider: () => 'injected-seed-99' },
    );
    expect(puzzle.seed).toBe('injected-seed-99');

    expect(() => generatePuzzle({ difficulty: 'normal' })).toThrow(PuzzleError);
    try {
      generatePuzzle({ difficulty: 'normal' });
    } catch (error) {
      expect((error as PuzzleError).code).toBe('MISSING_SEED');
    }
  });

  it('returns deeply frozen puzzles, clean public projections, and ready initial states', () => {
    const puzzle = generatePuzzle({ difficulty: 'hard', seed: 'immutability-check' });

    expect(Object.isFrozen(puzzle)).toBe(true);
    expect(Object.isFrozen(puzzle.startingSequence)).toBe(true);
    expect(Object.isFrozen(puzzle.targetSequence)).toBe(true);

    expect(() => {
      (puzzle.startingSequence as BottleId[]).push('red');
    }).toThrow(TypeError);

    const publicView = toPublicPuzzleView(puzzle);
    expect('targetSequence' in publicView).toBe(false);
    expect('seed' in publicView).toBe(false);
    expect(publicView.startingSequence).toEqual(puzzle.startingSequence);

    const initialState = createInitialPuzzleState(puzzle);
    expect(initialState).toEqual({
      puzzleId: puzzle.id,
      currentSequence: puzzle.startingSequence,
      moveCount: 0,
      status: 'ready',
    });
    expect(Object.isFrozen(initialState.currentSequence)).toBe(true);
  });

  it('respects explicit initial match and minimum swap constraints', () => {
    const config = {
      difficulty: 'expert' as const,
      bottleCount: 10,
      seed: 'strict-constraints-42',
      minInitialMatches: 2,
      maxInitialMatches: 3,
      minRequiredSwaps: 6,
    };

    const puzzle = generatePuzzle(config);
    const diag = inspectPuzzleDiagnostics(puzzle);

    expect(diag.initialMatchCount).toBeGreaterThanOrEqual(2);
    expect(diag.initialMatchCount).toBeLessThanOrEqual(3);
    expect(diag.minimumSwapDistance).toBeGreaterThanOrEqual(6);
  });

  it('passes deterministic stress generation across 1,260 puzzles covering all difficulties and custom constraints', () => {
    let totalGenerated = 0;

    // 200 deterministic puzzles per difficulty (6 * 200 = 1,200)
    for (const def of ALL_DIFFICULTY_DEFINITIONS) {
      for (let i = 0; i < 200; i += 1) {
        const config = {
          difficulty: def.id,
          seed: `stress-${def.id}-${String(i)}`,
        };
        const resolved = validatePuzzleConfig(config);
        const puzzle = generatePuzzle(config);
        const result = validatePuzzle(puzzle, resolved);

        expect(result.valid).toBe(true);
        totalGenerated += 1;
      }
    }

    // 60 additional strict custom-constraint puzzles exercising tight match & swap combinations
    for (let i = 0; i < 60; i += 1) {
      const bottleCount = 3 + (i % 8); // cycles across 3..10
      const maxMatches = Math.max(0, bottleCount - 2);
      const minMatches = Math.min(maxMatches, i % 3);
      const maxFeasibleSwaps = Math.max(1, bottleCount - minMatches - 1);
      const minSwaps = Math.min(maxFeasibleSwaps, 1 + (i % maxFeasibleSwaps));

      const config = {
        difficulty: 'normal' as const,
        bottleCount,
        seed: `stress-custom-${String(i)}`,
        minInitialMatches: minMatches,
        maxInitialMatches: maxMatches,
        minRequiredSwaps: minSwaps,
      };
      const resolved = validatePuzzleConfig(config);
      const puzzle = generatePuzzle(config);
      const result = validatePuzzle(puzzle, resolved);

      expect(result.valid).toBe(true);
      totalGenerated += 1;
    }

    expect(totalGenerated).toBe(1260);
  });
});
