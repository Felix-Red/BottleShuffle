import { PUZZLE_GENERATOR_VERSION } from '../engine/PuzzleGenerator';
import { validateBottleCount, validatePuzzleConfig } from '../engine/PuzzleValidator';
import { ProgressionError } from '../errors/ProgressionError';
import { isDifficultyId } from '../models/Difficulty';
import type { ChapterDefinition } from './ChapterDefinition';
import { toLevelPuzzleConfig, type LevelDefinition } from './LevelDefinition';
import { isValidChapterId, isValidLevelId, type ChapterId, type LevelId } from './LevelId';

export interface LevelCatalogValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export function validateLevelCatalog(
  levels: readonly LevelDefinition[],
  chapters: readonly ChapterDefinition[],
): LevelCatalogValidationResult {
  const errors: string[] = [];

  if (levels.length === 0) {
    errors.push('Level catalogue must contain at least one level.');
  }
  if (chapters.length === 0) {
    errors.push('Level catalogue must contain at least one chapter.');
  }

  const chapterMap = new Map<ChapterId, ChapterDefinition>();
  const seenChapterOrders = new Set<number>();
  const levelToChapterFromChapters = new Map<LevelId, ChapterId>();

  for (const chapter of chapters) {
    if (!isValidChapterId(chapter.id)) {
      errors.push(`Invalid chapter identifier: "${String(chapter.id)}".`);
    }
    if (chapterMap.has(chapter.id)) {
      errors.push(`Duplicate chapter identifier: "${chapter.id}".`);
    } else {
      chapterMap.set(chapter.id, chapter);
    }

    if (chapter.displayName.trim().length === 0) {
      errors.push(`Chapter "${chapter.id}" must have a non-empty displayName.`);
    }
    if (!Number.isInteger(chapter.order) || chapter.order < 1) {
      errors.push(`Chapter "${chapter.id}" has invalid order: ${String(chapter.order)}.`);
    } else if (seenChapterOrders.has(chapter.order)) {
      errors.push(`Duplicate chapter order: ${String(chapter.order)}.`);
    } else {
      seenChapterOrders.add(chapter.order);
    }

    if (!isDifficultyId(chapter.difficulty)) {
      errors.push(
        `Chapter "${chapter.id}" has invalid difficulty: "${String(chapter.difficulty)}".`,
      );
    }

    try {
      validateBottleCount(chapter.bottleCount);
    } catch {
      errors.push(
        `Chapter "${chapter.id}" has unsupported bottle count: ${String(chapter.bottleCount)}.`,
      );
    }

    if (chapter.levelIds.length === 0) {
      errors.push(`Chapter "${chapter.id}" must contain at least one level.`);
    }

    for (const levelId of chapter.levelIds) {
      if (levelToChapterFromChapters.has(levelId)) {
        errors.push(`Level "${levelId}" is listed in multiple chapters.`);
      } else {
        levelToChapterFromChapters.set(levelId, chapter.id);
      }
    }
  }

  const levelMap = new Map<LevelId, LevelDefinition>();
  const seenLevelNumbers = new Set<number>();

  for (let i = 0; i < levels.length; i += 1) {
    const level = levels[i];
    if (level === undefined) {
      continue;
    }

    if (!isValidLevelId(level.id)) {
      errors.push(`Invalid level identifier: "${String(level.id)}".`);
    }
    if (levelMap.has(level.id)) {
      errors.push(`Duplicate level identifier: "${level.id}".`);
    } else {
      levelMap.set(level.id, level);
    }

    if (!Number.isInteger(level.levelNumber) || level.levelNumber < 1) {
      errors.push(`Level "${level.id}" has invalid levelNumber: ${String(level.levelNumber)}.`);
    } else {
      if (seenLevelNumbers.has(level.levelNumber)) {
        errors.push(`Duplicate display levelNumber: ${String(level.levelNumber)}.`);
      } else {
        seenLevelNumbers.add(level.levelNumber);
      }
      if (level.levelNumber !== i + 1) {
        errors.push(
          `Level "${level.id}" has out-of-order levelNumber ${String(level.levelNumber)} (expected ${String(i + 1)}).`,
        );
      }
    }

    const chapter = chapterMap.get(level.chapterId);
    if (chapter === undefined) {
      errors.push(`Level "${level.id}" references unknown chapter "${level.chapterId}".`);
    } else {
      const assignedChapterId = levelToChapterFromChapters.get(level.id);
      if (assignedChapterId !== chapter.id) {
        errors.push(
          `Level "${level.id}" references chapter "${chapter.id}" but is not listed in chapter.levelIds.`,
        );
      }
      if (level.difficulty !== chapter.difficulty) {
        errors.push(
          `Level "${level.id}" difficulty "${level.difficulty}" does not match chapter "${chapter.id}" difficulty "${chapter.difficulty}".`,
        );
      }
      if (level.bottleCount !== chapter.bottleCount) {
        errors.push(
          `Level "${level.id}" bottleCount ${String(level.bottleCount)} does not match chapter "${chapter.id}" bottleCount ${String(chapter.bottleCount)}.`,
        );
      }
    }

    if (level.seed.trim().length === 0) {
      errors.push(`Level "${level.id}" must have a non-empty deterministic seed.`);
    }

    if (level.generatorVersion !== PUZZLE_GENERATOR_VERSION) {
      errors.push(
        `Level "${level.id}" specifies unsupported generatorVersion "${level.generatorVersion}" (supported: "${PUZZLE_GENERATOR_VERSION}").`,
      );
    }

    try {
      validatePuzzleConfig(toLevelPuzzleConfig(level));
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`Level "${level.id}" has invalid puzzle constraints: ${msg}`);
    }
  }

  // Ensure chapters do not reference missing levels
  for (const [levelId, chapterId] of levelToChapterFromChapters.entries()) {
    if (!levelMap.has(levelId)) {
      errors.push(`Chapter "${chapterId}" references unknown level "${levelId}".`);
    }
  }

  // Validate prerequisite references, cycle freedom, and full reachability
  const rootLevels: LevelId[] = [];
  for (const level of levels) {
    if (level.prerequisiteLevelId === null) {
      rootLevels.push(level.id);
      continue;
    }
    if (level.prerequisiteLevelId === level.id) {
      errors.push(`Level "${level.id}" cannot list itself as a prerequisite.`);
      continue;
    }
    if (!levelMap.has(level.prerequisiteLevelId)) {
      errors.push(
        `Level "${level.id}" references unknown prerequisite "${level.prerequisiteLevelId}".`,
      );
    }
  }

  if (levels.length > 0 && rootLevels.length === 0) {
    errors.push('Level catalogue must have at least one initially unlocked root level.');
  }

  // Detect cycles & unreachable levels by walking prerequisite chains
  const reachable = new Set<LevelId>();
  const visiting = new Set<LevelId>();

  const checkReachable = (levelId: LevelId): boolean => {
    if (reachable.has(levelId)) {
      return true;
    }
    if (visiting.has(levelId)) {
      errors.push(`Circular prerequisite detected involving level "${levelId}".`);
      return false;
    }

    const level = levelMap.get(levelId);
    if (level === undefined) {
      return false;
    }

    visiting.add(levelId);
    const isOk =
      level.prerequisiteLevelId === null ? true : checkReachable(level.prerequisiteLevelId);
    visiting.delete(levelId);

    if (isOk) {
      reachable.add(levelId);
    }
    return isOk;
  };

  for (const level of levels) {
    if (!checkReachable(level.id)) {
      errors.push(`Level "${level.id}" is inaccessible from any unlocked root level.`);
    }
  }

  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors),
  });
}

export function assertValidLevelCatalog(
  levels: readonly LevelDefinition[],
  chapters: readonly ChapterDefinition[],
): void {
  const result = validateLevelCatalog(levels, chapters);
  if (!result.valid) {
    throw new ProgressionError(
      'INVALID_CATALOG',
      `Invalid level catalogue (${String(result.errors.length)} issue${result.errors.length === 1 ? '' : 's'}): ${result.errors[0] ?? 'Unknown error'}`,
      { errors: result.errors },
    );
  }
}
