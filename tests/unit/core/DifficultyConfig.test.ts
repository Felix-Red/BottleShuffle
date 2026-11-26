import { describe, expect, it } from 'vitest';
import { PuzzleError } from '../../../src/core/errors/PuzzleError';
import { validatePuzzleConfig } from '../../../src/core/engine/PuzzleValidator';
import {
  ALL_DIFFICULTY_DEFINITIONS,
  DIFFICULTY_DEFINITIONS,
  getDifficultyDefinition,
  resolvePuzzleConfig,
} from '../../../src/core/levels/DifficultyConfig';
import type { DifficultyId } from '../../../src/core/models/Difficulty';

describe('DifficultyConfig', () => {
  it('maps each difficulty to the required bottle count', () => {
    expect(DIFFICULTY_DEFINITIONS.beginner.bottleCount).toBe(3);
    expect(DIFFICULTY_DEFINITIONS.easy.bottleCount).toBe(4);
    expect(DIFFICULTY_DEFINITIONS.normal.bottleCount).toBe(5);
    expect(DIFFICULTY_DEFINITIONS.intermediate.bottleCount).toBe(6);
    expect(DIFFICULTY_DEFINITIONS.hard.bottleCount).toBe(8);
    expect(DIFFICULTY_DEFINITIONS.expert.bottleCount).toBe(10);
    expect(ALL_DIFFICULTY_DEFINITIONS).toHaveLength(6);
  });

  it('validates every default difficulty configuration cleanly', () => {
    for (const def of ALL_DIFFICULTY_DEFINITIONS) {
      const resolved = validatePuzzleConfig({ difficulty: def.id, seed: `seed-${def.id}` });
      expect(resolved.difficulty).toBe(def.id);
      expect(resolved.bottleCount).toBe(def.bottleCount);
      expect(resolved.maxInitialMatches).toBeLessThanOrEqual(def.bottleCount - 2);
      expect(resolved.minRequiredSwaps).toBeGreaterThanOrEqual(1);
    }
  });

  it('allows validated level-specific overrides over difficulty defaults', () => {
    const resolved = resolvePuzzleConfig({
      difficulty: 'normal',
      bottleCount: 7,
      minInitialMatches: 1,
      maxInitialMatches: 3,
      minRequiredSwaps: 3,
    });

    expect(resolved).toEqual({
      difficulty: 'normal',
      bottleCount: 7,
      minInitialMatches: 1,
      maxInitialMatches: 3,
      minRequiredSwaps: 3,
    });
  });

  it('rejects unsupported difficulty identifiers with a typed PuzzleError', () => {
    expect(() => getDifficultyDefinition('impossible' as DifficultyId)).toThrow(PuzzleError);
    try {
      getDifficultyDefinition('impossible' as DifficultyId);
    } catch (error) {
      expect(error).toBeInstanceOf(PuzzleError);
      expect((error as PuzzleError).code).toBe('INVALID_DIFFICULTY');
    }
  });
});
