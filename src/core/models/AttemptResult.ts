import type { LevelId } from '../levels/LevelId';
import type { DifficultyId } from './Difficulty';
import type { ScoreBreakdown } from './ScoreBreakdown';
import type { EarnedStarRating } from './StarRating';

export type ScoredGameplayMode = 'campaign' | 'practice';

/**
 * Immutable result of a legitimately completed campaign or practice puzzle attempt.
 * Deliberately excludes private puzzle fields (targetSequence, seed).
 */
export interface AttemptResult {
  readonly attemptId: string;
  readonly puzzleId: string;
  readonly mode: ScoredGameplayMode;
  readonly levelId: LevelId | null;
  readonly difficulty: DifficultyId;
  readonly bottleCount: number;
  readonly actualMoves: number;
  readonly minimumRequiredSwaps: number;
  readonly extraMoves: number;
  readonly elapsedMs: number;
  readonly moveEfficiency: number;
  readonly starRating: EarnedStarRating;
  readonly totalScore: number;
  readonly isOptimalSolution: boolean;
  readonly scoringPolicyVersion: number;
  readonly breakdown: ScoreBreakdown;
}
