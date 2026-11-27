import { generatePuzzle, PUZZLE_GENERATOR_VERSION } from '../engine/PuzzleGenerator';
import { ProgressionError } from '../errors/ProgressionError';
import type { DifficultyId } from '../models/Difficulty';
import type { Puzzle } from '../models/Puzzle';
import type { PuzzleConfig } from '../models/PuzzleConfig';
import type { ChapterId, LevelId } from './LevelId';

/**
 * Immutable static definition of a single campaign level.
 * Uses a stable string ID independent of array indices and includes an explicit
 * deterministic seed plus generatorVersion for long-term reproducibility.
 */
export interface LevelDefinition {
  readonly id: LevelId;
  readonly levelNumber: number;
  readonly chapterId: ChapterId;
  readonly difficulty: DifficultyId;
  readonly bottleCount: number;
  readonly seed: string;
  readonly generatorVersion: string;
  readonly minInitialMatches?: number;
  readonly maxInitialMatches?: number;
  readonly minRequiredSwaps?: number;
  readonly prerequisiteLevelId: LevelId | null;
}

export function toLevelPuzzleConfig(level: LevelDefinition): PuzzleConfig {
  return Object.freeze({
    difficulty: level.difficulty,
    bottleCount: level.bottleCount,
    seed: level.seed,
    ...(level.minInitialMatches !== undefined
      ? { minInitialMatches: level.minInitialMatches }
      : {}),
    ...(level.maxInitialMatches !== undefined
      ? { maxInitialMatches: level.maxInitialMatches }
      : {}),
    ...(level.minRequiredSwaps !== undefined ? { minRequiredSwaps: level.minRequiredSwaps } : {}),
  });
}

/**
 * Generates the deterministic puzzle for a campaign level on demand.
 * Explicitly guards generatorVersion so existing levels never silently drift.
 */
export function generateLevelPuzzle(level: LevelDefinition): Puzzle {
  if (level.generatorVersion !== PUZZLE_GENERATOR_VERSION) {
    throw new ProgressionError(
      'UNSUPPORTED_GENERATOR_VERSION',
      `Level "${level.id}" requires generator version "${level.generatorVersion}", but active generator is "${PUZZLE_GENERATOR_VERSION}".`,
      {
        levelId: level.id,
        expectedVersion: level.generatorVersion,
        activeVersion: PUZZLE_GENERATOR_VERSION,
      },
    );
  }

  return generatePuzzle(toLevelPuzzleConfig(level));
}
