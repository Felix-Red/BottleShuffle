import {
  getDifficultyDefinition,
  isDifficultyId,
  type DifficultyId,
  type PuzzleConfig,
  type PuzzleSeedInput,
} from '../../core';
import { GAMEPLAY_CONFIG } from '../../config/GameplayConfig';

export interface GameplaySceneData {
  readonly levelId?: string;
  readonly levelLabel?: string;
  readonly difficulty?: DifficultyId;
  readonly bottleCount?: number;
  readonly seed?: PuzzleSeedInput;
  readonly puzzleConfig?: PuzzleConfig;
}

export interface ResolvedGameplayLaunch {
  readonly puzzleConfig: PuzzleConfig;
  readonly headerTitle: string;
  readonly headerSubtitle: string;
}

export function resolveGameplayLaunch(data?: GameplaySceneData): ResolvedGameplayLaunch {
  const baseConfig: PuzzleConfig = data?.puzzleConfig ?? {
    difficulty: data?.difficulty ?? GAMEPLAY_CONFIG.defaultDifficulty,
    ...(data?.bottleCount !== undefined ? { bottleCount: data.bottleCount } : {}),
    ...(data?.seed !== undefined ? { seed: data.seed } : {}),
  };

  const difficultyId = baseConfig.difficulty;
  const displayDifficulty = isDifficultyId(difficultyId)
    ? getDifficultyDefinition(difficultyId).displayName
    : String(difficultyId);

  const expectedCount =
    baseConfig.bottleCount ??
    (isDifficultyId(difficultyId) ? getDifficultyDefinition(difficultyId).bottleCount : 5);

  const headerTitle =
    data?.levelLabel !== undefined && data.levelLabel.trim().length > 0
      ? data.levelLabel.trim()
      : data?.levelId !== undefined && data.levelId.trim().length > 0
        ? data.levelId.trim()
        : `${displayDifficulty} Puzzle`;

  const headerSubtitle = `${String(expectedCount)} Bottles`;

  return {
    puzzleConfig: baseConfig,
    headerTitle,
    headerSubtitle,
  };
}
