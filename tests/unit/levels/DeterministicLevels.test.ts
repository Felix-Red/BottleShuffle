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
 * Golden fixtures across all 6 chapters to guarantee deterministic level generation
 * never silently drifts across code changes.
 */
const GOLDEN_FIXTURES = [
  {
    levelId: 'level-001',
    seed: 'level-001-f3d5e8e447e014dd',
    starting: ['brown', 'silver', 'blue'],
    target: ['brown', 'blue', 'silver'],
  },
  {
    levelId: 'level-005',
    seed: 'level-005-254088fdb3a75e7e',
    starting: ['pink', 'brown', 'orange'],
    target: ['orange', 'pink', 'brown'],
  },
  {
    levelId: 'level-006',
    seed: 'level-006-f2d5e75178d8343a',
    starting: ['orange', 'blue', 'purple', 'teal'],
    target: ['purple', 'teal', 'blue', 'orange'],
  },
  {
    levelId: 'level-011',
    seed: 'level-011-efd3a401648c52f2',
    starting: ['silver', 'red', 'teal', 'green', 'blue'],
    target: ['teal', 'red', 'green', 'blue', 'silver'],
  },
  {
    levelId: 'level-021',
    seed: 'level-021-e7d158d26ae540eb',
    starting: ['red', 'green', 'teal', 'silver', 'blue', 'yellow'],
    target: ['red', 'silver', 'yellow', 'green', 'blue', 'teal'],
  },
  {
    levelId: 'level-031',
    seed: 'level-031-e3cf13ef9db10780',
    starting: ['blue', 'silver', 'brown', 'red', 'purple', 'teal', 'yellow', 'green'],
    target: ['purple', 'silver', 'red', 'yellow', 'blue', 'green', 'teal', 'brown'],
  },
  {
    levelId: 'level-041',
    seed: 'level-041-5bcbff402279e539',
    starting: [
      'silver',
      'green',
      'brown',
      'blue',
      'purple',
      'pink',
      'orange',
      'teal',
      'yellow',
      'red',
    ],
    target: [
      'green',
      'brown',
      'pink',
      'teal',
      'red',
      'yellow',
      'silver',
      'purple',
      'orange',
      'blue',
    ],
  },
  {
    levelId: 'level-050',
    seed: 'level-050-76c9eb2abafe31cb',
    starting: [
      'brown',
      'red',
      'teal',
      'silver',
      'yellow',
      'pink',
      'purple',
      'orange',
      'blue',
      'green',
    ],
    target: [
      'purple',
      'blue',
      'yellow',
      'green',
      'silver',
      'orange',
      'red',
      'pink',
      'brown',
      'teal',
    ],
  },
] as const;

describe('Deterministic 50-Level Generation & Variety', () => {
  it('generates 50 valid, unsolved, unique campaign puzzles with exact deterministic replay', () => {
    const catalog = getDefaultLevelCatalog();
    const seenCompleteSignatures = new Set<string>();
    const beginnerBottleSets = new Set<string>();

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

      if (level.difficulty === 'beginner') {
        beginnerBottleSets.add([...first.targetSequence].sort().join(','));
      }
    }

    expect(seenCompleteSignatures.size).toBe(50);
    // All 5 beginner levels use distinct bottle combinations
    expect(beginnerBottleSets.size).toBe(5);
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
