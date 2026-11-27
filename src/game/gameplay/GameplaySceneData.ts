import {
  getDifficultyDefinition,
  isDifficultyId,
  type DifficultyId,
  type LevelId,
  type PuzzleConfig,
  type PuzzleSeedInput,
  type TutorialStageId,
} from '../../core';
import { GAMEPLAY_CONFIG } from '../../config/GameplayConfig';
import type { TutorialOrigin } from '../tutorial/TutorialViewState';
import type { VictoryViewState } from '../victory/VictoryViewState';

export type GameplayMode = 'campaign' | 'practice' | 'tutorial';
export type GameplayReturnDestination = 'home' | 'level_selection';
export type DevVictoryPreviewKind =
  '3star' | '2star' | '1star' | 'practice' | 'chapter' | 'campaign';
export type DevGameplayOverlayPreviewKind = 'pause' | 'settings' | 'restart' | 'exit';

export interface GameplaySceneData {
  readonly mode?: GameplayMode;
  readonly levelId?: LevelId;
  readonly returnTo?: GameplayReturnDestination;
  readonly tutorialOrigin?: TutorialOrigin;
  readonly nextCampaignLevelId?: LevelId;
  /** Development-only initial tutorial stage for visual verification (ignored in production). */
  readonly devTutorialStage?: TutorialStageId;
  /** Development-only Victory overlay view state for visual verification (ignored in production). */
  readonly devVictoryViewState?: VictoryViewState;
  /** Development-only pause/settings/confirmation overlay preview (ignored in production). */
  readonly devOverlayPreview?: DevGameplayOverlayPreviewKind;
  readonly levelLabel?: string;
  readonly difficulty?: DifficultyId;
  readonly bottleCount?: number;
  readonly seed?: PuzzleSeedInput;
  readonly puzzleConfig?: PuzzleConfig;
}

export interface ResolvedGameplayLaunch {
  readonly mode: GameplayMode;
  readonly levelId: LevelId | null;
  readonly puzzleConfig: PuzzleConfig;
  readonly headerTitle: string;
  readonly headerSubtitle: string;
}

export function resolveGameplayLaunch(data?: GameplaySceneData): ResolvedGameplayLaunch {
  const mode: GameplayMode =
    data?.mode ??
    (data?.levelId !== undefined && data.levelId.trim().length > 0 ? 'campaign' : 'practice');

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
      : mode === 'campaign' && data?.levelId !== undefined && data.levelId.trim().length > 0
        ? data.levelId.trim()
        : `${displayDifficulty} Practice`;

  const headerSubtitle = `${String(expectedCount)} Bottles`;

  return {
    mode,
    levelId: mode === 'campaign' && data?.levelId !== undefined ? data.levelId.trim() : null,
    puzzleConfig: baseConfig,
    headerTitle,
    headerSubtitle,
  };
}
