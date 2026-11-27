export interface ScoreBreakdown {
  readonly baseScore: number;
  readonly difficultyMultiplier: number;
  readonly moveEfficiency: number;
  readonly totalScore: number;
  readonly scoringPolicyVersion: number;
}
