import { assertValidMoveMetrics } from './ScoreValidator';

/**
 * Calculates unrounded move efficiency: minimumRequiredSwaps / actualMoves.
 * Strictly within (0, 1] for valid completed attempts.
 */
export function calculateMoveEfficiency(minimumRequiredSwaps: number, actualMoves: number): number {
  assertValidMoveMetrics(minimumRequiredSwaps, actualMoves);
  return minimumRequiredSwaps / actualMoves;
}

/**
 * Formats an efficiency ratio (0..1] as a rounded display percentage (e.g. "75%").
 * Never used as input to score calculation.
 */
export function formatEfficiencyPercentage(efficiency: number): string {
  const clamped = Number.isFinite(efficiency) ? Math.min(1, Math.max(0, efficiency)) : 0;
  return `${String(Math.round(clamped * 100))}%`;
}
