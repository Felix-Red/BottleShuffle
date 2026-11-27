import type { DifficultyId } from '../models/Difficulty';

export const SCORING_POLICY_VERSION = 1;

export interface ScoringConfig {
  readonly scoringPolicyVersion: number;
  readonly baseScore: number;
  readonly minimumAwardedScore: number;
  readonly threeStarExtraMoves: number;
  readonly twoStarMoveMultiplier: number;
  readonly difficultyMultipliers: Readonly<Record<DifficultyId, number>>;
}

export const DEFAULT_SCORING_CONFIG: ScoringConfig = Object.freeze({
  scoringPolicyVersion: SCORING_POLICY_VERSION,
  baseScore: 1000,
  minimumAwardedScore: 1,
  threeStarExtraMoves: 1,
  twoStarMoveMultiplier: 2,
  difficultyMultipliers: Object.freeze({
    beginner: 1.0,
    easy: 1.25,
    normal: 1.5,
    intermediate: 2.0,
    hard: 2.5,
    expert: 3.0,
  }),
});
