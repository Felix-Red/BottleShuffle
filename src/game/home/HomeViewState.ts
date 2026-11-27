import type { LevelId } from '../../core';

export type HomePlayerStatus = 'new' | 'returning' | 'completed';
export type HomePrimaryActionKind = 'launch_level' | 'open_levels';
export type HomeOverlayMode = 'none' | 'practice' | 'settings' | 'error';
export type HomeFocusTarget = 'primary' | 'levels' | 'practice' | 'settings';

export interface HomeViewState {
  readonly playerStatus: HomePlayerStatus;
  readonly primaryActionLabel: string;
  readonly primarySupportingText: string;
  readonly primaryActionKind: HomePrimaryActionKind;
  readonly recommendedLevelId: LevelId | null;
  readonly recommendedLevelNumber: number | null;
  readonly recommendedChapterName: string;
  readonly recommendedChapterOrder: number | null;
  readonly completedLevelCount: number;
  readonly totalLevelCount: number;
  readonly totalEarnedStars: number;
  readonly maxAvailableStars: number;
  readonly totalBestScore: number;
  readonly completionPercentage: number;
  readonly isCampaignComplete: boolean;
  readonly canNavigate: boolean;
  readonly overlayMode: HomeOverlayMode;
  readonly focusedControl: HomeFocusTarget | null;
  readonly errorMessage: string | null;
}
