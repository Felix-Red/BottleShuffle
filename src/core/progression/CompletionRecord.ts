import type { LevelId } from '../levels/LevelId';
import type { EarnedStarRating } from '../models/StarRating';

/**
 * Immutable, JSON-serialisable completion record for a single campaign level.
 *
 * Note: `bestScore`, `bestStarRating`, `bestMoveCount`, and `bestElapsedMs` are
 * tracked independently and may originate from different completed attempts.
 * Historical records created prior to scoring support remain valid with optional
 * score/star fields omitted rather than fabricated.
 */
export interface CompletionRecord {
  readonly levelId: LevelId;
  readonly completionCount: number;
  readonly bestMoveCount: number;
  readonly bestElapsedMs: number;
  readonly bestScore?: number;
  readonly bestStarRating?: EarnedStarRating;
  readonly scoringPolicyVersion?: number;
}
