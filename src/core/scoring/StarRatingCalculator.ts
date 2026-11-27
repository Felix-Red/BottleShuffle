import type { EarnedStarRating } from '../models/StarRating';
import { DEFAULT_SCORING_CONFIG, type ScoringConfig } from './ScoringConfig';
import { assertValidMoveMetrics, assertValidScoringConfig } from './ScoreValidator';

/**
 * Deterministic three-star rating calculation:
 * - 3 stars: actualMoves <= minimumRequiredSwaps + threeStarExtraMoves (default +1)
 * - 2 stars: actualMoves <= minimumRequiredSwaps * twoStarMoveMultiplier (default *2)
 * - 1 star:  all other valid completed attempts
 *
 * Note: For puzzles with minimumRequiredSwaps === 1, 1 + 1 === 2 === 1 * 2, so three-star
 * precedence means 1 or 2 moves earn 3 stars and 3+ moves earn 1 star.
 */
export function calculateStarRating(
  minimumRequiredSwaps: number,
  actualMoves: number,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
): EarnedStarRating {
  assertValidScoringConfig(config);
  assertValidMoveMetrics(minimumRequiredSwaps, actualMoves);

  if (actualMoves <= minimumRequiredSwaps + config.threeStarExtraMoves) {
    return 3;
  }
  if (actualMoves <= minimumRequiredSwaps * config.twoStarMoveMultiplier) {
    return 2;
  }
  return 1;
}
