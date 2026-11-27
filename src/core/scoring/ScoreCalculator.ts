import type { LevelId } from '../levels/LevelId';
import type { AttemptResult, ScoredGameplayMode } from '../models/AttemptResult';
import type { DifficultyId } from '../models/Difficulty';
import type { ScoreBreakdown } from '../models/ScoreBreakdown';
import { calculateMoveEfficiency } from './EfficiencyCalculator';
import { DEFAULT_SCORING_CONFIG, type ScoringConfig } from './ScoringConfig';
import {
  assertValidDifficultyMultiplier,
  assertValidElapsedMs,
  assertValidMoveMetrics,
  assertValidScoringConfig,
} from './ScoreValidator';
import { calculateStarRating } from './StarRatingCalculator';

export interface ScoreCalculationInput {
  readonly difficulty: DifficultyId;
  readonly minimumRequiredSwaps: number;
  readonly actualMoves: number;
}

export interface CreateAttemptResultInput {
  readonly attemptId: string;
  readonly puzzleId: string;
  readonly mode: ScoredGameplayMode;
  readonly levelId: LevelId | null;
  readonly difficulty: DifficultyId;
  readonly bottleCount: number;
  readonly actualMoves: number;
  readonly minimumRequiredSwaps: number;
  readonly elapsedMs: number;
}

/**
 * Pure deterministic score calculation:
 *   score = max(minimumAwardedScore, round(baseScore * difficultyMultiplier * moveEfficiency))
 * Elapsed time is intentionally excluded from scoring.
 */
export function calculateScoreBreakdown(
  input: ScoreCalculationInput,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
): ScoreBreakdown {
  assertValidScoringConfig(config);
  assertValidMoveMetrics(input.minimumRequiredSwaps, input.actualMoves);
  const difficultyMultiplier = assertValidDifficultyMultiplier(input.difficulty, config);
  const moveEfficiency = calculateMoveEfficiency(input.minimumRequiredSwaps, input.actualMoves);
  const rawScore = Math.round(config.baseScore * difficultyMultiplier * moveEfficiency);
  const totalScore = Math.max(config.minimumAwardedScore, rawScore);

  return Object.freeze({
    baseScore: config.baseScore,
    difficultyMultiplier,
    moveEfficiency,
    totalScore,
    scoringPolicyVersion: config.scoringPolicyVersion,
  });
}

/**
 * Creates a deeply frozen, validated AttemptResult for a legitimately completed attempt.
 */
export function createAttemptResult(
  input: CreateAttemptResultInput,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
): AttemptResult {
  const normalizedElapsedMs = assertValidElapsedMs(input.elapsedMs);
  const breakdown = calculateScoreBreakdown(
    {
      difficulty: input.difficulty,
      minimumRequiredSwaps: input.minimumRequiredSwaps,
      actualMoves: input.actualMoves,
    },
    config,
  );
  const starRating = calculateStarRating(input.minimumRequiredSwaps, input.actualMoves, config);

  return Object.freeze({
    attemptId: input.attemptId,
    puzzleId: input.puzzleId,
    mode: input.mode,
    levelId: input.levelId,
    difficulty: input.difficulty,
    bottleCount: input.bottleCount,
    actualMoves: input.actualMoves,
    minimumRequiredSwaps: input.minimumRequiredSwaps,
    extraMoves: input.actualMoves - input.minimumRequiredSwaps,
    elapsedMs: normalizedElapsedMs,
    moveEfficiency: breakdown.moveEfficiency,
    starRating,
    totalScore: breakdown.totalScore,
    isOptimalSolution: input.actualMoves === input.minimumRequiredSwaps,
    scoringPolicyVersion: config.scoringPolicyVersion,
    breakdown,
  });
}
