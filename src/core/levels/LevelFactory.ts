import { PUZZLE_GENERATOR_VERSION } from '../engine/PuzzleGenerator';
import type { ChallengeMode } from '../models/ChallengeMode';
import {
  CAMPAIGN_BALANCE_CONFIG,
  getBottleCountPuzzleDefaults,
  PROGRESSIVE_BOTTLE_SEQUENCE,
} from './CampaignBalanceConfig';
import type { ChapterDefinition, ChapterSpec, LevelSpec } from './ChapterDefinition';
import { createLevelCatalog, type LevelCatalog } from './LevelCatalog';
import type { LevelDefinition } from './LevelDefinition';
import { formatChapterId, formatLevelId, type LevelId } from './LevelId';
import { deriveCampaignLevelSeed } from './LevelSeedGenerator';

function createLevelSpec(
  bottleCount: number,
  challengeMode: ChallengeMode,
  timeLimitSeconds: number | null,
  moveLimit: number | null,
  seedSalt?: string,
): LevelSpec {
  const defaults = getBottleCountPuzzleDefaults(bottleCount);
  return Object.freeze({
    bottleCount,
    difficulty: defaults.difficulty,
    challengeMode,
    timeLimitSeconds,
    moveLimit,
    minInitialMatches: defaults.minInitialMatches,
    maxInitialMatches: defaults.maxInitialMatches,
    minRequiredSwaps: defaults.minRequiredSwaps,
    ...(seedSalt !== undefined ? { seedSalt } : {}),
  });
}

/**
 * Redesigned 6-chapter, 50-level campaign specification (Catalogue v2.0.0).
 * Every level introduces a meaningful step in bottle count, time pressure, move discipline,
 * or combined mastery — eliminating repetitive consecutive identical-bottle classic levels.
 */
export const DEFAULT_CHAPTER_SPECS: readonly ChapterSpec[] = Object.freeze([
  Object.freeze({
    id: formatChapterId(1),
    displayName: 'First Steps',
    order: 1,
    difficulty: 'beginner',
    bottleCount: 3,
    startLevelNumber: 1,
    levelCount: 8,
    challengeMode: 'classic' as const,
    timeLimitSeconds: null,
    moveLimit: null,
    minInitialMatches: 0,
    maxInitialMatches: 4,
    minRequiredSwaps: 1,
    description: 'Climb from 3 to 10 bottles with no timers or move limits.',
    levels: Object.freeze(
      PROGRESSIVE_BOTTLE_SEQUENCE.map((count) =>
        createLevelSpec(count, 'classic', null, null, 'c2-classic'),
      ),
    ),
  }),
  Object.freeze({
    id: formatChapterId(2),
    displayName: 'Beat the Clock',
    order: 2,
    difficulty: 'easy',
    bottleCount: 5,
    startLevelNumber: 9,
    levelCount: 8,
    challengeMode: 'timed' as const,
    timeLimitSeconds: null,
    moveLimit: null,
    minInitialMatches: 0,
    maxInitialMatches: 4,
    minRequiredSwaps: 1,
    description: 'Solve 3 to 10 bottles before the countdown runs out.',
    levels: Object.freeze(
      CAMPAIGN_BALANCE_CONFIG.chapter2BeatTheClock.map((entry) =>
        createLevelSpec(entry.bottleCount, 'timed', entry.timeLimitSeconds, null, 'c2-timed'),
      ),
    ),
  }),
  Object.freeze({
    id: formatChapterId(3),
    displayName: 'Speed Mastery',
    order: 3,
    difficulty: 'normal',
    bottleCount: 6,
    startLevelNumber: 17,
    levelCount: 8,
    challengeMode: 'timed' as const,
    timeLimitSeconds: null,
    moveLimit: null,
    minInitialMatches: 0,
    maxInitialMatches: 4,
    minRequiredSwaps: 1,
    description: 'Sharpen your pace with tighter countdown allowances from 3 to 10 bottles.',
    levels: Object.freeze(
      CAMPAIGN_BALANCE_CONFIG.chapter3SpeedMastery.map((entry) =>
        createLevelSpec(entry.bottleCount, 'timed', entry.timeLimitSeconds, null, 'c2-speed'),
      ),
    ),
  }),
  Object.freeze({
    id: formatChapterId(4),
    displayName: 'Every Move Counts',
    order: 4,
    difficulty: 'intermediate',
    bottleCount: 6,
    startLevelNumber: 25,
    levelCount: 8,
    challengeMode: 'limited_moves' as const,
    timeLimitSeconds: null,
    moveLimit: null,
    minInitialMatches: 0,
    maxInitialMatches: 4,
    minRequiredSwaps: 1,
    description: 'Deduce the hidden sequence within a fixed swap budget from 3 to 10 bottles.',
    levels: Object.freeze(
      CAMPAIGN_BALANCE_CONFIG.chapter4EveryMoveCounts.map((entry) =>
        createLevelSpec(entry.bottleCount, 'limited_moves', null, entry.moveLimit, 'c2-moves'),
      ),
    ),
  }),
  Object.freeze({
    id: formatChapterId(5),
    displayName: 'Double Trouble',
    order: 5,
    difficulty: 'hard',
    bottleCount: 8,
    startLevelNumber: 33,
    levelCount: 8,
    challengeMode: 'combined' as const,
    timeLimitSeconds: null,
    moveLimit: null,
    minInitialMatches: 0,
    maxInitialMatches: 4,
    minRequiredSwaps: 1,
    description: 'Balance both a countdown timer and a move limit from 3 to 10 bottles.',
    levels: Object.freeze(
      CAMPAIGN_BALANCE_CONFIG.chapter5DoubleTrouble.map((entry) =>
        createLevelSpec(
          entry.bottleCount,
          'combined',
          entry.timeLimitSeconds,
          entry.moveLimit,
          'c2-double',
        ),
      ),
    ),
  }),
  Object.freeze({
    id: formatChapterId(6),
    displayName: 'Shuffle Master',
    order: 6,
    difficulty: 'expert',
    bottleCount: 10,
    startLevelNumber: 41,
    levelCount: 10,
    challengeMode: 'combined' as const,
    timeLimitSeconds: null,
    moveLimit: null,
    minInitialMatches: 0,
    maxInitialMatches: 4,
    minRequiredSwaps: 2,
    description: 'Ten unique combined master challenges pushing speed and precision to the limit.',
    levels: Object.freeze(
      CAMPAIGN_BALANCE_CONFIG.chapter6ShuffleMaster.map((entry, idx) =>
        createLevelSpec(
          entry.bottleCount,
          'combined',
          entry.timeLimitSeconds,
          entry.moveLimit,
          `c2-master-${String(idx + 1)}`,
        ),
      ),
    ),
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
    const totalInChapter = spec.levels !== undefined ? spec.levels.length : spec.levelCount;
    let minBottleCount = Number.POSITIVE_INFINITY;
    let maxBottleCount = 0;

    for (let offset = 0; offset < totalInChapter; offset += 1) {
      const levelNumber = spec.startLevelNumber + offset;
      const id = formatLevelId(levelNumber);
      const override = spec.levels?.[offset];

      const bottleCount = override?.bottleCount ?? spec.bottleCount;
      const difficulty = override?.difficulty ?? spec.difficulty;
      const challengeMode: ChallengeMode =
        override?.challengeMode ?? spec.challengeMode ?? 'classic';
      const timeLimitSeconds =
        override?.timeLimitSeconds !== undefined
          ? override.timeLimitSeconds
          : (spec.timeLimitSeconds ?? null);
      const moveLimit =
        override?.moveLimit !== undefined ? override.moveLimit : (spec.moveLimit ?? null);
      const minInitialMatches = override?.minInitialMatches ?? spec.minInitialMatches;
      const maxInitialMatches = override?.maxInitialMatches ?? spec.maxInitialMatches;
      const minRequiredSwaps = override?.minRequiredSwaps ?? spec.minRequiredSwaps;
      const varietySalt = override?.seedSalt ?? spec.seedSalts?.[levelNumber];
      const seed = deriveCampaignLevelSeed(id, generatorVersion, varietySalt);

      minBottleCount = Math.min(minBottleCount, bottleCount);
      maxBottleCount = Math.max(maxBottleCount, bottleCount);

      const level: LevelDefinition = Object.freeze({
        id,
        levelNumber,
        chapterId: spec.id,
        difficulty,
        bottleCount,
        seed,
        generatorVersion,
        challengeMode,
        timeLimitSeconds,
        moveLimit,
        minInitialMatches,
        maxInitialMatches,
        minRequiredSwaps,
        prerequisiteLevelId: previousLevelId,
      });

      levels.push(level);
      chapterLevelIds.push(id);
      previousLevelId = id;
    }

    const resolvedMin = Number.isFinite(minBottleCount) ? minBottleCount : spec.bottleCount;
    const resolvedMax = maxBottleCount > 0 ? maxBottleCount : spec.bottleCount;

    chapters.push(
      Object.freeze({
        id: spec.id,
        displayName: spec.displayName,
        order: spec.order,
        difficulty: spec.difficulty,
        bottleCount: spec.bottleCount,
        minBottleCount: resolvedMin,
        maxBottleCount: resolvedMax,
        challengeMode: spec.challengeMode ?? 'classic',
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
