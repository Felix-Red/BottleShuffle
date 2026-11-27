import { describe, expect, it } from 'vitest';
import {
  calculateScoreBreakdown,
  calculateStarRating,
  createAttemptResult,
  DEFAULT_SCORING_CONFIG,
  DIFFICULTY_IDS,
  formatLevelId,
  getDefaultLevelCatalog,
  ProgressionEngine,
} from '../../../src/core';

describe('Scoring boundaries & progression edge-case matrix (Task 19)', () => {
  it('enforces monotonic non-increasing scores with extra moves and time-independence across all difficulties', () => {
    for (const difficulty of DIFFICULTY_IDS) {
      for (const minSwaps of [1, 2, 3, 5, 7]) {
        let previousScore = Number.POSITIVE_INFINITY;
        let previousStars = 3;

        for (let extra = 0; extra <= 25; extra += 1) {
          const actualMoves = minSwaps + extra;
          const breakdown = calculateScoreBreakdown({
            difficulty,
            actualMoves,
            minimumRequiredSwaps: minSwaps,
          });
          const stars = calculateStarRating(minSwaps, actualMoves);

          expect(breakdown.totalScore).toBeLessThanOrEqual(previousScore);
          expect(breakdown.totalScore).toBeGreaterThanOrEqual(
            DEFAULT_SCORING_CONFIG.minimumAwardedScore,
          );
          expect(stars).toBeLessThanOrEqual(previousStars);
          expect(stars).toBeGreaterThanOrEqual(1);

          // Verify time does not alter score under current scoring policy
          const fast = createAttemptResult({
            attemptId: `fast-${difficulty}-${String(extra)}`,
            mode: 'campaign',
            levelId: 'level-001',
            puzzleId: 'p-1',
            difficulty,
            bottleCount: 5,
            actualMoves,
            minimumRequiredSwaps: minSwaps,
            elapsedMs: 1_000,
          });
          const slow = createAttemptResult({
            attemptId: `slow-${difficulty}-${String(extra)}`,
            mode: 'campaign',
            levelId: 'level-001',
            puzzleId: 'p-1',
            difficulty,
            bottleCount: 5,
            actualMoves,
            minimumRequiredSwaps: minSwaps,
            elapsedMs: 900_000,
          });
          expect(fast.totalScore).toBe(slow.totalScore);
          expect(fast.starRating).toBe(slow.starRating);

          previousScore = breakdown.totalScore;
          previousStars = stars;
        }
      }
    }
  });

  it('preserves independent personal best metrics achieved on separate replays and prevents score double-counting', () => {
    const catalog = getDefaultLevelCatalog();
    const engine = new ProgressionEngine(catalog);
    let state = engine.createInitialState();

    // Attempt 1: fast time (9s), suboptimal moves (5 moves -> 2 stars, 800 pts)
    const r1 = engine.recordCompletion(state, {
      attemptId: 'att-1',
      levelId: 'level-001',
      moveCount: 5,
      elapsedMs: 9_000,
      score: 800,
      starRating: 2,
      scoringPolicyVersion: 1,
    });
    expect(r1.accepted).toBe(true);
    state = r1.state;

    // Duplicate attemptId must be rejected cleanly
    const dup = engine.recordCompletion(state, {
      attemptId: 'att-1',
      levelId: 'level-001',
      moveCount: 2,
      elapsedMs: 5_000,
      score: 1200,
      starRating: 3,
      scoringPolicyVersion: 1,
    });
    expect(dup.accepted).toBe(false);
    expect(dup.state.completedLevels['level-001']?.completionCount).toBe(1);

    // Attempt 2: slower time (20s), optimal moves (2 moves -> 3 stars, 1000 pts)
    const r2 = engine.recordCompletion(state, {
      attemptId: 'att-2',
      levelId: 'level-001',
      moveCount: 2,
      elapsedMs: 20_000,
      score: 1000,
      starRating: 3,
      scoringPolicyVersion: 1,
    });
    expect(r2.accepted).toBe(true);
    state = r2.state;

    const record = state.completedLevels['level-001'];
    expect(record?.completionCount).toBe(2);
    expect(record?.bestMoveCount).toBe(2);
    expect(record?.bestElapsedMs).toBe(9_000); // preserved from Attempt 1!
    expect(record?.bestScore).toBe(1000);
    expect(record?.bestStarRating).toBe(3);

    // Attempt 3: worse replay must NOT reduce bests or inflate total best score
    const r3 = engine.recordCompletion(state, {
      attemptId: 'att-3',
      levelId: 'level-001',
      moveCount: 10,
      elapsedMs: 45_000,
      score: 400,
      starRating: 1,
      scoringPolicyVersion: 1,
    });
    state = r3.state;
    const summary = engine.getCampaignAchievementSummary(state);
    expect(summary.totalBestScore).toBe(1000);
    expect(summary.totalEarnedStars).toBe(3);
    expect(state.completedLevels['level-001']?.completionCount).toBe(3);
  });

  it('handles 0, 1, 49, and 50 completed levels cleanly and rejects locked or nonexistent levels', () => {
    const catalog = getDefaultLevelCatalog();
    const engine = new ProgressionEngine(catalog);
    let state = engine.createInitialState();

    // 0 completed: only level-001 unlocked
    expect(engine.getLevelStatus(state, 'level-001')).toBe('unlocked');
    expect(engine.getLevelStatus(state, 'level-002')).toBe('locked');
    expect(engine.getCampaignProgress(state).completedLevels).toBe(0);

    // Locked level rejected
    const lockedAttempt = engine.recordCompletion(state, {
      attemptId: 'att-locked',
      levelId: 'level-005',
      moveCount: 3,
      elapsedMs: 10_000,
      score: 1000,
      starRating: 3,
      scoringPolicyVersion: 1,
    });
    expect(lockedAttempt.accepted).toBe(false);

    // Complete 49 levels -> level-050 becomes recommended next level
    for (let n = 1; n <= 49; n += 1) {
      const id = formatLevelId(n);
      const res = engine.recordCompletion(state, {
        attemptId: `att-${id}`,
        levelId: id,
        moveCount: 3,
        elapsedMs: 12_000,
        score: 1000,
        starRating: 3,
        scoringPolicyVersion: 1,
      });
      expect(res.accepted).toBe(true);
      state = res.state;
    }

    const at49 = engine.getCampaignProgress(state);
    expect(at49.completedLevels).toBe(49);
    expect(at49.isComplete).toBe(false);
    expect(at49.recommendedNextLevel.status).toBe('available');
    if (at49.recommendedNextLevel.status === 'available') {
      expect(at49.recommendedNextLevel.level.id).toBe('level-050');
    }

    // Complete Level 50 -> campaign complete, no level-051
    const finalRes = engine.recordCompletion(state, {
      attemptId: 'att-level-050',
      levelId: 'level-050',
      moveCount: 6,
      elapsedMs: 25_000,
      score: 1500,
      starRating: 3,
      scoringPolicyVersion: 1,
    });
    expect(finalRes.accepted).toBe(true);
    expect(finalRes.events.some((e) => e.type === 'CAMPAIGN_COMPLETED')).toBe(true);
    state = finalRes.state;

    const at50 = engine.getCampaignProgress(state);
    expect(at50.isComplete).toBe(true);
    expect(at50.recommendedNextLevel.status).toBe('campaign_completed');
    expect(catalog.getLevelById('level-051')).toBeUndefined();
  });
});
