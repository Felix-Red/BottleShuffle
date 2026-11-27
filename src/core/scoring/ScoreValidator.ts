import { GameError } from '../errors/GameError';
import { isDifficultyId, type DifficultyId } from '../models/Difficulty';
import { DEFAULT_SCORING_CONFIG, type ScoringConfig } from './ScoringConfig';

export function assertValidScoringConfig(config: ScoringConfig): void {
  if (!Number.isInteger(config.scoringPolicyVersion) || config.scoringPolicyVersion < 1) {
    throw new GameError(
      'INVALID_SCORING_INPUT',
      `Invalid scoringPolicyVersion: ${String(config.scoringPolicyVersion)}.`,
    );
  }
  if (!Number.isFinite(config.baseScore) || config.baseScore <= 0) {
    throw new GameError('INVALID_SCORING_INPUT', `Invalid baseScore: ${String(config.baseScore)}.`);
  }
  if (!Number.isInteger(config.minimumAwardedScore) || config.minimumAwardedScore < 1) {
    throw new GameError(
      'INVALID_SCORING_INPUT',
      `Invalid minimumAwardedScore: ${String(config.minimumAwardedScore)}.`,
    );
  }
  if (!Number.isInteger(config.threeStarExtraMoves) || config.threeStarExtraMoves < 0) {
    throw new GameError(
      'INVALID_SCORING_INPUT',
      `Invalid threeStarExtraMoves: ${String(config.threeStarExtraMoves)}.`,
    );
  }
  if (!Number.isFinite(config.twoStarMoveMultiplier) || config.twoStarMoveMultiplier < 1) {
    throw new GameError(
      'INVALID_SCORING_INPUT',
      `Invalid twoStarMoveMultiplier: ${String(config.twoStarMoveMultiplier)}.`,
    );
  }
}

export function assertValidMoveMetrics(minimumRequiredSwaps: number, actualMoves: number): void {
  if (!Number.isInteger(minimumRequiredSwaps) || minimumRequiredSwaps < 1) {
    throw new GameError(
      'INVALID_SCORING_INPUT',
      `minimumRequiredSwaps must be an integer >= 1; received ${String(minimumRequiredSwaps)}.`,
    );
  }
  if (!Number.isInteger(actualMoves) || actualMoves < 1) {
    throw new GameError(
      'INVALID_SCORING_INPUT',
      `actualMoves must be an integer >= 1; received ${String(actualMoves)}.`,
    );
  }
  if (actualMoves < minimumRequiredSwaps) {
    throw new GameError(
      'INVALID_SCORING_INPUT',
      `actualMoves (${String(actualMoves)}) cannot be less than minimumRequiredSwaps (${String(minimumRequiredSwaps)}).`,
    );
  }
}

export function assertValidDifficultyMultiplier(
  difficulty: DifficultyId,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
): number {
  if (!isDifficultyId(difficulty)) {
    throw new GameError(
      'INVALID_SCORING_INPUT',
      `Unsupported difficulty: "${String(difficulty)}".`,
    );
  }
  const multiplier = config.difficultyMultipliers[difficulty];
  if (!Number.isFinite(multiplier) || multiplier <= 0) {
    throw new GameError(
      'INVALID_SCORING_INPUT',
      `Invalid difficulty multiplier for "${difficulty}": ${String(multiplier)}.`,
    );
  }
  return multiplier;
}

export function assertValidElapsedMs(elapsedMs: number): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
    throw new GameError(
      'INVALID_SCORING_INPUT',
      `elapsedMs must be a finite non-negative number; received ${String(elapsedMs)}.`,
    );
  }
  return Math.round(elapsedMs);
}
