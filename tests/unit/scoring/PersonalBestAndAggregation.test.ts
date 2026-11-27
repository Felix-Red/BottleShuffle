import { describe, expect, it } from 'vitest';
import {
  calculateMinimumSwapDistance,
  comparePersonalBest,
  formatLevelId,
  GameEngine,
  generatePuzzle,
  getDefaultLevelCatalog,
  LevelCatalog,
  ProgressionEngine,
  PUZZLE_GENERATOR_VERSION,
  type ChapterDefinition,
  type LevelDefinition,
} from '../../../src/core';

describe('PersonalBestComparison', () => {
  it('identifies first completion distinctly from record improvements', () => {
    const result = comparePersonalBest(null, {
      score: 1500,
      starRating: 3,
      moveCount: 4,
      elapsedMs: 18000,
    });

    expect(result.isFirstCompletion).toBe(true);
    expect(result.hasAnyImprovement).toBe(false);
    expect(result.improvedScore).toBe(false);
    expect(result.improvedStars).toBe(false);
    expect(result.previousBestScore).toBeNull();
    expect(result.bestScore).toBe(1500);
    expect(result.bestStars).toBe(3);
  });

  it('updates each metric independently and never treats equal values as improvements', () => {
    const previous = {
      levelId: 'level-001',
      bestMoveCount: 5,
      bestElapsedMs: 20000,
      completionCount: 1,
      bestScore: 1000,
      bestStarRating: 2 as const,
      scoringPolicyVersion: 1,
    };

    const equalAttempt = comparePersonalBest(previous, {
      score: 1000,
      starRating: 2,
      moveCount: 5,
      elapsedMs: 20000,
    });
    expect(equalAttempt.hasAnyImprovement).toBe(false);

    // Faster time only, weaker moves/score/stars
    const fasterOnly = comparePersonalBest(previous, {
      score: 600,
      starRating: 1,
      moveCount: 9,
      elapsedMs: 14000,
    });
    expect(fasterOnly.hasAnyImprovement).toBe(true);
    expect(fasterOnly.improvedTime).toBe(true);
    expect(fasterOnly.improvedScore).toBe(false);
    expect(fasterOnly.improvedStars).toBe(false);
    expect(fasterOnly.improvedMoves).toBe(false);
    expect(fasterOnly.bestScore).toBe(1000);
    expect(fasterOnly.bestStars).toBe(2);
    expect(fasterOnly.bestMoves).toBe(5);
    expect(fasterOnly.bestElapsedMs).toBe(14000);
  });
});

describe('ProgressionEngine scoring, backwards compatibility, and achievement aggregation', () => {
  it('preserves historical records without score/stars and adopts score/stars on next scored run', () => {
    const engine = new ProgressionEngine(getDefaultLevelCatalog());
    let state = engine.createInitialState();

    // Historical Task-08 style completion without score or starRating
    const legacy = engine.recordCompletion(state, {
      levelId: 'level-001',
      attemptId: 'legacy-1',
      moveCount: 4,
      elapsedMs: 15000,
    });
    expect(legacy.accepted).toBe(true);
    state = legacy.state;
    expect(state.completedLevels['level-001']?.bestScore).toBeUndefined();
    expect(state.completedLevels['level-001']?.bestStarRating).toBeUndefined();

    // Historical record never fabricates stars
    const summaryBefore = engine.getCampaignAchievementSummary(state);
    expect(summaryBefore.completedLevels).toBe(1);
    expect(summaryBefore.totalEarnedStars).toBe(0);
    expect(summaryBefore.totalBestScore).toBe(0);

    // Scored replay populates bestScore and bestStarRating cleanly
    const scored = engine.recordCompletion(state, {
      levelId: 'level-001',
      attemptId: 'scored-2',
      moveCount: 4,
      elapsedMs: 16000,
      score: 1000,
      starRating: 3,
      scoringPolicyVersion: 1,
    });
    expect(scored.accepted).toBe(true);
    expect(scored.personalBest?.improvedScore).toBe(true);
    expect(scored.personalBest?.improvedStars).toBe(true);
    expect(scored.state.completedLevels['level-001']?.bestScore).toBe(1000);
    expect(scored.state.completedLevels['level-001']?.bestStarRating).toBe(3);
    expect(scored.state.completedLevels['level-001']?.bestElapsedMs).toBe(15000);
  });

  it('aggregates campaign stars and best scores without duplicating replays', () => {
    const catalog = getDefaultLevelCatalog();
    const engine = new ProgressionEngine(catalog);
    const totalLevels = catalog.getTotalLevelCount();
    let state = engine.createInitialState();

    state = engine.recordCompletion(state, {
      levelId: 'level-001',
      attemptId: 'a1',
      moveCount: 6,
      elapsedMs: 25000,
      score: 500,
      starRating: 1,
      scoringPolicyVersion: 1,
    }).state;

    // Replay level-001 with 3 stars -> upgrades best, does not double-count
    state = engine.recordCompletion(state, {
      levelId: 'level-001',
      attemptId: 'a2',
      moveCount: 3,
      elapsedMs: 18000,
      score: 1000,
      starRating: 3,
      scoringPolicyVersion: 1,
    }).state;

    // Weaker replay of level-001 -> never weakens best
    state = engine.recordCompletion(state, {
      levelId: 'level-001',
      attemptId: 'a3',
      moveCount: 10,
      elapsedMs: 50000,
      score: 300,
      starRating: 1,
      scoringPolicyVersion: 1,
    }).state;

    state = engine.recordCompletion(state, {
      levelId: 'level-002',
      attemptId: 'a4',
      moveCount: 5,
      elapsedMs: 19000,
      score: 600,
      starRating: 2,
      scoringPolicyVersion: 1,
    }).state;

    const summary = engine.getCampaignAchievementSummary(state);
    expect(summary.totalLevels).toBe(totalLevels);
    expect(summary.maxAvailableStars).toBe(totalLevels * 3);
    expect(summary.completedLevels).toBe(2);
    expect(summary.totalEarnedStars).toBe(5);
    expect(summary.totalBestScore).toBe(1600);
    expect(summary.threeStarCount).toBe(1);
    expect(summary.twoStarCount).toBe(1);
    expect(summary.oneStarCount).toBe(0);
    expect(summary.isCampaignComplete).toBe(false);
    expect(summary.isPerfectCampaign).toBe(false);
  });

  it('derives maxAvailableStars dynamically for expanded multi-chapter catalogues (e.g. 7 chapters / 55 levels)', () => {
    const base = getDefaultLevelCatalog();
    const baseChapters = [...base.getAllChapters()];
    const baseLevels = [...base.getAllLevels()];

    const extraLevels: LevelDefinition[] = [];
    for (let i = 1; i <= 5; i += 1) {
      const levelNumber = baseLevels.length + i;
      extraLevels.push({
        id: formatLevelId(levelNumber),
        levelNumber,
        chapterId: 'chapter-07',
        difficulty: 'expert',
        bottleCount: 10,
        seed: `bonus-${String(levelNumber)}`,
        generatorVersion: PUZZLE_GENERATOR_VERSION,
        challengeMode: 'classic',
        timeLimitSeconds: null,
        moveLimit: null,
        minRequiredSwaps: 5,
        prerequisiteLevelId: formatLevelId(levelNumber - 1),
      });
    }

    const extraChapter: ChapterDefinition = {
      id: 'chapter-07',
      order: baseChapters.length + 1,
      displayName: 'Chapter 7: Master Bonus',
      difficulty: 'expert',
      bottleCount: 10,
      minBottleCount: 10,
      maxBottleCount: 10,
      challengeMode: 'classic',
      levelIds: extraLevels.map((l) => l.id),
    };

    const expandedCatalog = new LevelCatalog(
      [...baseLevels, ...extraLevels],
      [...baseChapters, extraChapter],
    );
    const engine = new ProgressionEngine(expandedCatalog);
    const state = engine.createInitialState();
    const summary = engine.getCampaignAchievementSummary(state);

    expect(summary.totalLevels).toBe(55);
    expect(summary.maxAvailableStars).toBe(165);
    expect(engine.getChapterStarSummary(state, extraChapter.id)?.maxStars).toBe(15);
  });

  it('rejects invalid score or star rating values in ProgressionEngine', () => {
    const engine = new ProgressionEngine(getDefaultLevelCatalog());
    const state = engine.createInitialState();

    const badScore = engine.recordCompletion(state, {
      levelId: 'level-001',
      attemptId: 'bad-score',
      moveCount: 3,
      elapsedMs: 10000,
      score: 0,
      starRating: 3,
    });
    expect(badScore.accepted).toBe(false);
    expect(badScore.rejectionReason).toBe('INVALID_SCORE');

    const badStar = engine.recordCompletion(state, {
      levelId: 'level-001',
      attemptId: 'bad-star',
      moveCount: 3,
      elapsedMs: 10000,
      score: 1000,
      starRating: 4 as unknown as 3,
    });
    expect(badStar.accepted).toBe(false);
    expect(badStar.rejectionReason).toBe('INVALID_STAR_RATING');
  });
});

describe('GameEngine scoring metadata privacy boundary', () => {
  it('hides minimumRequiredSwaps until puzzle is legitimately completed', () => {
    const puzzle = generatePuzzle({ difficulty: 'beginner', seed: 'privacy-check-1' });
    const expectedMinSwaps = calculateMinimumSwapDistance(
      puzzle.startingSequence,
      puzzle.targetSequence,
    );
    const engine = new GameEngine(puzzle);

    expect(engine.getCompletedScoringMetadata()).toBeNull();
    engine.start();
    expect(engine.getCompletedScoringMetadata()).toBeNull();
    engine.pause();
    expect(engine.getCompletedScoringMetadata()).toBeNull();
    engine.resume();
    expect(engine.getCompletedScoringMetadata()).toBeNull();

    // Solve puzzle cleanly using target sequence
    while (engine.getPublicState().status !== 'completed') {
      const current = engine.getPublicState().currentSequence;
      let firstMismatch = -1;
      for (let i = 0; i < current.length; i += 1) {
        if (current[i] !== puzzle.targetSequence[i]) {
          firstMismatch = i;
          break;
        }
      }
      const targetColor = puzzle.targetSequence[firstMismatch];
      if (targetColor === undefined) {
        break;
      }
      const swapWith = current.indexOf(targetColor);
      engine.swapBottles(firstMismatch, swapWith);
    }

    const meta = engine.getCompletedScoringMetadata();
    expect(meta).not.toBeNull();
    expect(meta?.minimumRequiredSwaps).toBe(expectedMinSwaps);
    expect(meta?.difficulty).toBe('beginner');
  });
});
