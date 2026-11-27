import { describe, expect, it } from 'vitest';
import {
  generateLevelPuzzle,
  getDefaultLevelCatalog,
  inspectPuzzleDiagnostics,
  resolvePuzzleConfig,
  toLevelPuzzleConfig,
  validatePuzzle,
} from '../../../src/core';

/**
 * Golden fixtures across all 6 chapters of Campaign Catalogue v2.0.0 to guarantee
 * deterministic level generation never silently drifts across code changes.
 */
const GOLDEN_FIXTURES = [
  {
    levelId: 'level-001',
    seed: 'level-001-1c4caebc8abf56f5',
    starting: ['pink', 'teal', 'purple'],
    target: ['pink', 'purple', 'teal'],
  },
  {
    levelId: 'level-008',
    seed: 'level-008-07f6bc1d88d2a5b6',
    starting: [
      'orange',
      'red',
      'green',
      'blue',
      'pink',
      'purple',
      'yellow',
      'teal',
      'silver',
      'brown',
    ],
    target: [
      'brown',
      'orange',
      'teal',
      'pink',
      'green',
      'purple',
      'red',
      'yellow',
      'blue',
      'silver',
    ],
  },
  {
    levelId: 'level-009',
    seed: 'level-009-ea44115303711e84',
    starting: ['green', 'purple', 'brown'],
    target: ['green', 'brown', 'purple'],
  },
  {
    levelId: 'level-017',
    seed: 'level-017-78137bfeab1a7df7',
    starting: ['purple', 'green', 'pink'],
    target: ['green', 'pink', 'purple'],
  },
  {
    levelId: 'level-025',
    seed: 'level-025-42f56c5071650d01',
    starting: ['yellow', 'red', 'teal'],
    target: ['yellow', 'teal', 'red'],
  },
  {
    levelId: 'level-033',
    seed: 'level-033-fd384724befc6945',
    starting: ['green', 'teal', 'yellow'],
    target: ['green', 'yellow', 'teal'],
  },
  {
    levelId: 'level-041',
    seed: 'level-041-2718de78264821c1',
    starting: ['silver', 'green', 'orange', 'teal', 'blue', 'brown'],
    target: ['orange', 'teal', 'brown', 'blue', 'green', 'silver'],
  },
  {
    levelId: 'level-050',
    seed: 'level-050-f6cfafce8e6caaef',
    starting: [
      'silver',
      'purple',
      'pink',
      'green',
      'orange',
      'red',
      'blue',
      'teal',
      'yellow',
      'brown',
    ],
    target: [
      'pink',
      'red',
      'silver',
      'teal',
      'orange',
      'brown',
      'blue',
      'purple',
      'yellow',
      'green',
    ],
  },
] as const;

describe('Deterministic 50-Level Generation & Variety', () => {
  it('generates 50 valid, unsolved, unique campaign puzzles with exact deterministic replay', () => {
    const catalog = getDefaultLevelCatalog();
    const seenCompleteSignatures = new Set<string>();
    const threeBottleSets = new Set<string>();

    for (const level of catalog.getAllLevels()) {
      const first = generateLevelPuzzle(level);
      const replay = generateLevelPuzzle(level);

      // Replaying generates the exact same puzzle
      expect(replay).toEqual(first);

      // Every generated puzzle satisfies its level constraints and starts unsolved
      const validation = validatePuzzle(first, resolvePuzzleConfig(toLevelPuzzleConfig(level)));
      expect(validation.valid).toBe(true);

      const diag = inspectPuzzleDiagnostics(first);
      expect(diag.initialMatchCount).toBeLessThan(level.bottleCount);
      expect(diag.minimumSwapDistance).toBeGreaterThanOrEqual(level.minRequiredSwaps ?? 1);

      // Zero duplicate complete puzzles across the entire 50-level catalogue
      const signature = `${first.startingSequence.join(',')}=>${first.targetSequence.join(',')}`;
      expect(seenCompleteSignatures.has(signature)).toBe(false);
      seenCompleteSignatures.add(signature);

      if (level.bottleCount === 3) {
        threeBottleSets.add([...first.targetSequence].sort().join(','));
      }
    }

    expect(seenCompleteSignatures.size).toBe(50);
    // All 5 three-bottle chapter opener levels use distinct bottle sets
    expect(threeBottleSets.size).toBe(5);
  });

  it('matches golden deterministic fixtures across all six chapters', () => {
    const catalog = getDefaultLevelCatalog();

    for (const fixture of GOLDEN_FIXTURES) {
      const level = catalog.getLevelById(fixture.levelId);
      expect(level).toBeDefined();
      if (level !== undefined) {
        expect(level.seed).toBe(fixture.seed);
        const puzzle = generateLevelPuzzle(level);
        expect(puzzle.startingSequence).toEqual(fixture.starting);
        expect(puzzle.targetSequence).toEqual(fixture.target);
      }
    }
  });
});
