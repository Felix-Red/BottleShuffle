import type { ChapterId, LevelId } from '../levels/LevelId';
import type { PersonalBestComparison } from '../models/PersonalBestResult';
import type { EarnedStarRating } from '../models/StarRating';
import type { ProgressionState } from './ProgressionState';

export type ProgressionEvent =
  | {
      readonly type: 'LEVEL_COMPLETED';
      readonly levelId: LevelId;
      readonly levelNumber: number;
      readonly firstTime: boolean;
      readonly completionCount: number;
      readonly moveCount: number;
      readonly elapsedMs: number;
      readonly score?: number;
      readonly starRating?: EarnedStarRating;
    }
  | {
      readonly type: 'LEVEL_UNLOCKED';
      readonly levelId: LevelId;
      readonly levelNumber: number;
      readonly unlockedByLevelId: LevelId;
    }
  | {
      readonly type: 'LEVEL_RECORD_IMPROVED';
      readonly levelId: LevelId;
      readonly improvedMoves: boolean;
      readonly improvedTime: boolean;
      readonly improvedScore: boolean;
      readonly improvedStars: boolean;
      readonly bestMoveCount: number;
      readonly bestElapsedMs: number;
      readonly bestScore?: number;
      readonly bestStarRating?: EarnedStarRating;
    }
  | {
      readonly type: 'CHAPTER_COMPLETED';
      readonly chapterId: ChapterId;
      readonly chapterName: string;
    }
  | {
      readonly type: 'CAMPAIGN_COMPLETED';
      readonly totalLevels: number;
    };

export type ProgressionRejectionReason =
  | 'UNKNOWN_LEVEL'
  | 'LEVEL_LOCKED'
  | 'DUPLICATE_ATTEMPT'
  | 'INVALID_ATTEMPT_ID'
  | 'INVALID_MOVE_COUNT'
  | 'INVALID_ELAPSED_TIME'
  | 'INVALID_SCORE'
  | 'INVALID_STAR_RATING'
  | 'INACTIVE_ATTEMPT'
  | 'LEVEL_MISMATCH';

export interface RecordCompletionInput {
  readonly levelId: LevelId;
  readonly attemptId: string;
  readonly moveCount: number;
  readonly elapsedMs: number;
  readonly score?: number;
  readonly starRating?: EarnedStarRating;
  readonly scoringPolicyVersion?: number;
}

export interface ProgressionTransitionResult {
  readonly accepted: boolean;
  readonly state: ProgressionState;
  readonly events: readonly ProgressionEvent[];
  readonly personalBest?: PersonalBestComparison;
  readonly rejectionReason?: ProgressionRejectionReason;
}
