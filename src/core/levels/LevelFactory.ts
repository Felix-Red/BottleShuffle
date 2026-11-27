import { PUZZLE_GENERATOR_VERSION } from '../engine/PuzzleGenerator';
import type { ChapterDefinition, ChapterSpec } from './ChapterDefinition';
import { createLevelCatalog, type LevelCatalog } from './LevelCatalog';
import type { LevelDefinition } from './LevelDefinition';
import { formatChapterId, formatLevelId, type LevelId } from './LevelId';
import { deriveCampaignLevelSeed } from './LevelSeedGenerator';

/**
 * Initial 6-chapter, 50-level campaign specification.
 * Adding Chapter 7 (levels 51+) appends cleanly without altering existing level IDs or seeds.
 */
export const DEFAULT_CHAPTER_SPECS: readonly ChapterSpec[] = Object.freeze([
  Object.freeze({
    id: formatChapterId(1),
    displayName: 'First Steps',
    order: 1,
    difficulty: 'beginner',
    bottleCount: 3,
    startLevelNumber: 1,
    levelCount: 5,
    minInitialMatches: 0,
    maxInitialMatches: 1,
    minRequiredSwaps: 1,
    description: 'Introduces basic bottle selection and swapping with 3 bottles.',
    // Levels 1-3 introduce single-swap transpositions; levels 4-5 introduce 3-bottle cycles (0 initial matches, 2 swaps)
    seedSalts: Object.freeze({ 4: 'c1', 5: 'c2' }),
  }),
  Object.freeze({
    id: formatChapterId(2),
    displayName: 'Getting Warmer',
    order: 2,
    difficulty: 'easy',
    bottleCount: 4,
    startLevelNumber: 6,
    levelCount: 5,
    minInitialMatches: 0,
    maxInitialMatches: 2,
    minRequiredSwaps: 1,
    description: 'Introduces a larger 4-bottle deduction space.',
  }),
  Object.freeze({
    id: formatChapterId(3),
    displayName: 'The Shuffle',
    order: 3,
    difficulty: 'normal',
    bottleCount: 5,
    startLevelNumber: 11,
    levelCount: 10,
    minInitialMatches: 0,
    maxInitialMatches: 2,
    minRequiredSwaps: 2,
    description: 'Encourages deliberate experimentation across 5 bottles.',
  }),
  Object.freeze({
    id: formatChapterId(4),
    displayName: 'Mind Games',
    order: 4,
    difficulty: 'intermediate',
    bottleCount: 6,
    startLevelNumber: 21,
    levelCount: 10,
    minInitialMatches: 0,
    maxInitialMatches: 3,
    minRequiredSwaps: 2,
    description: 'Requires structured deduction across 6 unique bottles.',
  }),
  Object.freeze({
    id: formatChapterId(5),
    displayName: 'Brain Teaser',
    order: 5,
    difficulty: 'hard',
    bottleCount: 8,
    startLevelNumber: 31,
    levelCount: 10,
    minInitialMatches: 0,
    maxInitialMatches: 3,
    minRequiredSwaps: 3,
    description: 'Introduces deeper 8-bottle deduction arrangements.',
  }),
  Object.freeze({
    id: formatChapterId(6),
    displayName: 'Mastermind',
    order: 6,
    difficulty: 'expert',
    bottleCount: 10,
    startLevelNumber: 41,
    levelCount: 10,
    minInitialMatches: 0,
    maxInitialMatches: 4,
    minRequiredSwaps: 4,
    description: 'The ultimate 10-bottle deduction challenge.',
  }),
]);

export function buildCatalogFromChapterSpecs(
  chapterSpecs: readonly ChapterSpec[],
  generatorVersion: string = PUZZLE_GENERATOR_VERSION,
): LevelCatalog {
  const levels: LevelDefinition[] = [];
  const chapters: ChapterDefinition[] = [];
  let previousLevelId: LevelId | null = null;

  const orderedSpecs = [...chapterSpecs].sort((a, b) => a.order - b.order);

  for (const spec of orderedSpecs) {
    const chapterLevelIds: LevelId[] = [];

    for (let offset = 0; offset < spec.levelCount; offset += 1) {
      const levelNumber = spec.startLevelNumber + offset;
      const id = formatLevelId(levelNumber);
      const varietySalt = spec.seedSalts?.[levelNumber];
      const seed = deriveCampaignLevelSeed(id, generatorVersion, varietySalt);

      const level: LevelDefinition = Object.freeze({
        id,
        levelNumber,
        chapterId: spec.id,
        difficulty: spec.difficulty,
        bottleCount: spec.bottleCount,
        seed,
        generatorVersion,
        minInitialMatches: spec.minInitialMatches,
        maxInitialMatches: spec.maxInitialMatches,
        minRequiredSwaps: spec.minRequiredSwaps,
        prerequisiteLevelId: previousLevelId,
      });

      levels.push(level);
      chapterLevelIds.push(id);
      previousLevelId = id;
    }

    chapters.push(
      Object.freeze({
        id: spec.id,
        displayName: spec.displayName,
        order: spec.order,
        difficulty: spec.difficulty,
        bottleCount: spec.bottleCount,
        levelIds: Object.freeze(chapterLevelIds),
        ...(spec.description !== undefined ? { description: spec.description } : {}),
      }),
    );
  }

  return createLevelCatalog(levels, chapters);
}

let cachedDefaultCatalog: LevelCatalog | undefined;

/**
 * Lazily constructs and caches the immutable 50-level campaign catalogue.
 * Only constructs lightweight metadata; never generates puzzles at startup.
 */
export function getDefaultLevelCatalog(): LevelCatalog {
  cachedDefaultCatalog ??= buildCatalogFromChapterSpecs(DEFAULT_CHAPTER_SPECS);
  return cachedDefaultCatalog;
}
