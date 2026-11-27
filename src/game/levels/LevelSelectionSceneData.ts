import type { ChapterId, LevelId } from '../../core';

/**
 * Typed navigation payload accepted by LevelSelectionScene.
 * All requested identifiers are validated against LevelCatalog before use.
 */
export interface LevelSelectionSceneData {
  readonly chapterId?: ChapterId;
  readonly levelId?: LevelId;
  readonly returnFromLevelId?: LevelId;
  /** Development-only preview trigger (ignored in production builds). */
  readonly devPreviewLevelId?: LevelId;
}
