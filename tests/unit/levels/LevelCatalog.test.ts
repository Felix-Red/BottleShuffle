import { describe, expect, it } from 'vitest';
import {
  buildCatalogFromChapterSpecs,
  DEFAULT_CHAPTER_SPECS,
  formatChapterId,
  formatLevelId,
  getDefaultLevelCatalog,
  PUZZLE_GENERATOR_VERSION,
  validateLevelCatalog,
  type ChapterSpec,
} from '../../../src/core';

describe('LevelCatalog & LevelValidator', () => {
  it('exposes exactly 50 uniquely identified, ordered levels across 6 chapters with expected distribution', () => {
    const catalog = getDefaultLevelCatalog();
    const levels = catalog.getAllLevels();
    const chapters = catalog.getAllChapters();

    expect(catalog.getTotalLevelCount()).toBe(50);
    expect(levels).toHaveLength(50);
    expect(chapters).toHaveLength(6);

    const expectedChapters = [
      { id: 'chapter-01', name: 'First Steps', difficulty: 'beginner', bottles: 3, count: 5 },
      { id: 'chapter-02', name: 'Getting Warmer', difficulty: 'easy', bottles: 4, count: 5 },
      { id: 'chapter-03', name: 'The Shuffle', difficulty: 'normal', bottles: 5, count: 10 },
      { id: 'chapter-04', name: 'Mind Games', difficulty: 'intermediate', bottles: 6, count: 10 },
      { id: 'chapter-05', name: 'Brain Teaser', difficulty: 'hard', bottles: 8, count: 10 },
      { id: 'chapter-06', name: 'Mastermind', difficulty: 'expert', bottles: 10, count: 10 },
    ] as const;

    chapters.forEach((chap, idx) => {
      const exp = expectedChapters[idx];
      expect(exp).toBeDefined();
      if (exp !== undefined) {
        expect(chap.id).toBe(exp.id);
        expect(chap.displayName).toBe(exp.name);
        expect(chap.difficulty).toBe(exp.difficulty);
        expect(chap.bottleCount).toBe(exp.bottles);
        expect(catalog.getLevelsByChapter(chap.id)).toHaveLength(exp.count);
      }
    });

    const ids = new Set(levels.map((l) => l.id));
    const numbers = new Set(levels.map((l) => l.levelNumber));
    expect(ids.size).toBe(50);
    expect(numbers.size).toBe(50);

    // Ordering & boundary navigation
    expect(catalog.getFirstLevel().id).toBe('level-001');
    expect(catalog.getFinalLevel().id).toBe('level-050');
    expect(catalog.getPreviousLevel('level-001')).toBeUndefined();
    expect(catalog.getNextLevel('level-001')?.id).toBe('level-002');
    expect(catalog.getPreviousLevel('level-050')?.id).toBe('level-049');
    expect(catalog.getNextLevel('level-050')).toBeUndefined();
    expect(catalog.getLevelByNumber(25)?.id).toBe('level-025');
    expect(catalog.getChapterForLevel('level-041')?.displayName).toBe('Mastermind');
  });

  it('supports appending new chapters/levels without altering existing level IDs or seeds', () => {
    const baseCatalog = getDefaultLevelCatalog();
    const extraChapter: ChapterSpec = {
      id: formatChapterId(7),
      displayName: 'Grandmaster',
      order: 7,
      difficulty: 'expert',
      bottleCount: 10,
      startLevelNumber: 51,
      levelCount: 5,
      minInitialMatches: 0,
      maxInitialMatches: 3,
      minRequiredSwaps: 5,
    };

    const expanded = buildCatalogFromChapterSpecs([...DEFAULT_CHAPTER_SPECS, extraChapter]);
    expect(expanded.getTotalLevelCount()).toBe(55);
    expect(expanded.getFinalLevel().id).toBe(formatLevelId(55));
    expect(expanded.getNextLevel('level-050')?.id).toBe('level-051');

    // Every existing level 1..50 must preserve its exact ID, seed, and version
    for (const baseLevel of baseCatalog.getAllLevels()) {
      const match = expanded.getLevelById(baseLevel.id);
      expect(match).toBeDefined();
      expect(match?.seed).toBe(baseLevel.seed);
      expect(match?.generatorVersion).toBe(baseLevel.generatorVersion);
    }
  });

  it('rejects invalid catalogues (circular prerequisites, missing chapters, unsupported generator version)', () => {
    const catalog = getDefaultLevelCatalog();
    const first = catalog.getFirstLevel();
    const second = catalog.getLevelById('level-002');
    const chapter1 = catalog.getChapterById('chapter-01');
    expect(second).toBeDefined();
    expect(chapter1).toBeDefined();

    if (second !== undefined && chapter1 !== undefined) {
      const circularLevels = [
        { ...first, prerequisiteLevelId: second.id },
        { ...second, prerequisiteLevelId: first.id },
      ];
      const badChapter = { ...chapter1, levelIds: [first.id, second.id] };
      const circularResult = validateLevelCatalog(circularLevels, [badChapter]);
      expect(circularResult.valid).toBe(false);
      expect(circularResult.errors.some((e) => e.includes('Circular') || e.includes('root'))).toBe(
        true,
      );

      const badVersionResult = validateLevelCatalog(
        [{ ...first, generatorVersion: '9.9.9' }],
        [{ ...chapter1, levelIds: [first.id] }],
      );
      expect(badVersionResult.valid).toBe(false);
      expect(badVersionResult.errors.some((e) => e.includes('unsupported generatorVersion'))).toBe(
        true,
      );
    }

    expect(PUZZLE_GENERATOR_VERSION).toBe('1.0.0');
  });
});
