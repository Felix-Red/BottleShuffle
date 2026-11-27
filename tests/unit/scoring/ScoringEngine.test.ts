import { describe, expect, it } from 'vitest';
import {
  calculateMoveEfficiency,
  calculateScoreBreakdown,
  calculateStarRating,
  createAttemptResult,
  DEFAULT_SCORING_CONFIG,
  formatEfficiencyPercentage,
  GameError,
  SCORING_POLICY_VERSION,
  type DifficultyId,
} from '../../../src/core';

describe('EfficiencyCalculator', () => {
  it('returns 1.0 for optimal solutions and accurate fractional efficiency for extra moves', () => {
    expect(calculateMoveEfficiency(3, 3)).toBe(1);
    expect(calculateMoveEfficiency(3, 4)).toBeCloseTo(0.75, 10);
    expect(calculateMoveEfficiency(5, 10)).toBeCloseTo(0.5, 10);
    expect(calculateMoveEfficiency(4, 16)).toBeCloseTo(0.25, 10);
  });

  it('formats efficiency percentages cleanly', () => {
    expect(formatEfficiencyPercentage(1)).toBe('100%');
    expect(formatEfficiencyPercentage(0.75)).toBe('75%');
    expect(formatEfficiencyPercentage(2 / 3)).toBe('67%');
    expect(formatEfficiencyPercentage(0.01)).toBe('1%');
  });

  it('rejects invalid move metrics (zero, negative, non-integer, NaN, actual < min)', () => {
    expect(() => calculateMoveEfficiency(0, 1)).toThrow(GameError);
    expect(() => calculateMoveEfficiency(-1, 2)).toThrow(GameError);
    expect(() => calculateMoveEfficiency(3, 0)).toThrow(GameError);
    expect(() => calculateMoveEfficiency(3, 2)).toThrow(GameError);
    expect(() => calculateMoveEfficiency(2.5, 3)).toThrow(GameError);
    expect(() => calculateMoveEfficiency(2, Number.NaN)).toThrow(GameError);
    expect(() => calculateMoveEfficiency(2, Number.POSITIVE_INFINITY)).toThrow(GameError);
  });
});

describe('StarRatingCalculator', () => {
  it('awards 3 stars for optimal and minSwaps + 1, 2 stars up to minSwaps * 2, and 1 star above', () => {
    // minSwaps = 4: 3★ => 4,5 | 2★ => 6,7,8 | 1★ => 9+
    expect(calculateStarRating(4, 4)).toBe(3);
    expect(calculateStarRating(4, 5)).toBe(3);
    expect(calculateStarRating(4, 6)).toBe(2);
    expect(calculateStarRating(4, 7)).toBe(2);
    expect(calculateStarRating(4, 8)).toBe(2);
    expect(calculateStarRating(4, 9)).toBe(1);
    expect(calculateStarRating(4, 25)).toBe(1);
  });

  it('handles small-puzzle threshold overlap deterministically when minimumRequiredSwaps === 1', () => {
    // 3★ threshold = 1 + 1 = 2; 2★ threshold = 1 * 2 = 2 -> 3★ takes precedence for 1..2, 1★ for 3+
    expect(calculateStarRating(1, 1)).toBe(3);
    expect(calculateStarRating(1, 2)).toBe(3);
    expect(calculateStarRating(1, 3)).toBe(1);
    expect(calculateStarRating(1, 5)).toBe(1);
  });

  it('handles minimumRequiredSwaps === 2 cleanly', () => {
    // 3★ => 2,3 | 2★ => 4 | 1★ => 5+
    expect(calculateStarRating(2, 2)).toBe(3);
    expect(calculateStarRating(2, 3)).toBe(3);
    expect(calculateStarRating(2, 4)).toBe(2);
    expect(calculateStarRating(2, 5)).toBe(1);
  });

  it('rejects impossible move metrics', () => {
    expect(() => calculateStarRating(4, 3)).toThrow(GameError);
    expect(() => calculateStarRating(0, 1)).toThrow(GameError);
  });
});

describe('ScoreCalculator & createAttemptResult', () => {
  it('applies exact multipliers for all 6 difficulties on optimal solutions', () => {
    const expectedOptimalScores: Record<DifficultyId, number> = {
      beginner: 1000,
      easy: 1250,
      normal: 1500,
      intermediate: 2000,
      hard: 2500,
      expert: 3000,
    };

    for (const [difficulty, expected] of Object.entries(expectedOptimalScores)) {
      const breakdown = calculateScoreBreakdown({
        difficulty: difficulty as DifficultyId,
        minimumRequiredSwaps: 4,
        actualMoves: 4,
      });
      expect(breakdown.totalScore).toBe(expected);
      expect(breakdown.moveEfficiency).toBe(1);
      expect(breakdown.baseScore).toBe(DEFAULT_SCORING_CONFIG.baseScore);
      expect(breakdown.scoringPolicyVersion).toBe(SCORING_POLICY_VERSION);
    }
  });

  it('matches worked non-optimal examples with deterministic rounding', () => {
    // Normal (1.5x), min 4, actual 5 => round(1000 * 1.5 * 0.8) = 1200
    expect(
      calculateScoreBreakdown({ difficulty: 'normal', minimumRequiredSwaps: 4, actualMoves: 5 })
        .totalScore,
    ).toBe(1200);

    // Hard (2.5x), min 5, actual 8 => round(1000 * 2.5 * 5 / 8) = round(1562.5) = 1563
    expect(
      calculateScoreBreakdown({ difficulty: 'hard', minimumRequiredSwaps: 5, actualMoves: 8 })
        .totalScore,
    ).toBe(1563);

    // Expert (3.0x), min 6, actual 15 => round(1000 * 3.0 * 6 / 15) = 1200
    expect(
      calculateScoreBreakdown({ difficulty: 'expert', minimumRequiredSwaps: 6, actualMoves: 15 })
        .totalScore,
    ).toBe(1200);
  });

  it('enforces minimum awarded score of 1 even for extreme move counts', () => {
    const breakdown = calculateScoreBreakdown({
      difficulty: 'beginner',
      minimumRequiredSwaps: 1,
      actualMoves: 50000,
    });
    expect(breakdown.totalScore).toBe(1);
  });

  it('excludes elapsed time completely from score and star rating', () => {
    const fast = createAttemptResult({
      attemptId: 'a1',
      puzzleId: 'p1',
      mode: 'campaign',
      levelId: 'level-010',
      difficulty: 'normal',
      bottleCount: 6,
      actualMoves: 5,
      minimumRequiredSwaps: 4,
      elapsedMs: 1200,
    });

    const slow = createAttemptResult({
      attemptId: 'a2',
      puzzleId: 'p1',
      mode: 'campaign',
      levelId: 'level-010',
      difficulty: 'normal',
      bottleCount: 6,
      actualMoves: 5,
      minimumRequiredSwaps: 4,
      elapsedMs: 7200000,
    });

    expect(fast.totalScore).toBe(slow.totalScore);
    expect(fast.starRating).toBe(slow.starRating);
    expect(fast.moveEfficiency).toBe(slow.moveEfficiency);
  });

  it('marks isOptimalSolution true ONLY when actualMoves === minimumRequiredSwaps', () => {
    const optimal = createAttemptResult({
      attemptId: 'a1',
      puzzleId: 'p1',
      mode: 'campaign',
      levelId: 'level-006',
      difficulty: 'easy',
      bottleCount: 5,
      actualMoves: 4,
      minimumRequiredSwaps: 4,
      elapsedMs: 12000,
    });

    const threeStarPlusOne = createAttemptResult({
      attemptId: 'a2',
      puzzleId: 'p1',
      mode: 'campaign',
      levelId: 'level-006',
      difficulty: 'easy',
      bottleCount: 5,
      actualMoves: 5,
      minimumRequiredSwaps: 4,
      elapsedMs: 12000,
    });

    expect(optimal.starRating).toBe(3);
    expect(optimal.isOptimalSolution).toBe(true);
    expect(optimal.extraMoves).toBe(0);

    expect(threeStarPlusOne.starRating).toBe(3);
    expect(threeStarPlusOne.isOptimalSolution).toBe(false);
    expect(threeStarPlusOne.extraMoves).toBe(1);
    expect(Object.isFrozen(optimal)).toBe(true);
    expect(Object.isFrozen(optimal.breakdown)).toBe(true);
  });

  it('rejects unsupported difficulty and invalid elapsedMs', () => {
    expect(() =>
      calculateScoreBreakdown({
        difficulty: 'impossible' as DifficultyId,
        minimumRequiredSwaps: 3,
        actualMoves: 3,
      }),
    ).toThrow(GameError);

    expect(() =>
      createAttemptResult({
        attemptId: 'a1',
        puzzleId: 'p1',
        mode: 'practice',
        levelId: null,
        difficulty: 'easy',
        bottleCount: 5,
        actualMoves: 3,
        minimumRequiredSwaps: 3,
        elapsedMs: -50,
      }),
    ).toThrow(GameError);
  });
});
