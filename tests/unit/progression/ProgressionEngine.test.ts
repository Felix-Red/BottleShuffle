import { describe, expect, it } from 'vitest';
import {
  buildCatalogFromChapterSpecs,
  DEFAULT_CHAPTER_SPECS,
  formatChapterId,
  formatLevelId,
  ProgressionEngine,
  ProgressionError,
  type ChapterSpec,
} from '../../../src/core';

describe('ProgressionEngine', () => {
  it('initialises with Level 1 unlocked, Levels 2-50 locked, and 0% campaign progress', () => {
    const engine = new ProgressionEngine();
    const state = engine.createInitialState();

    expect(engine.getLevelStatus(state, 'level-001')).toBe('unlocked');
    expect(engine.canPlayLevel(state, 'level-001')).toBe(true);
    expect(engine.getLevelStatus(state, 'level-002')).toBe('locked');
    expect(engine.canPlayLevel(state, 'level-002')).toBe(false);
    expect(engine.getLevelStatus(state, 'level-050')).toBe('locked');

    expect(engine.getCompletedLevels(state)).toHaveLength(0);
    expect(engine.getUnlockedLevels(state)).toHaveLength(1);
    expect(engine.getLockedLevels(state)).toHaveLength(49);

    const campaign = engine.getCampaignProgress(state);
    expect(campaign.totalLevels).toBe(50);
    expect(campaign.completedLevels).toBe(0);
    expect(campaign.remainingLevels).toBe(50);
    expect(campaign.completionPercentage).toBe(0);
    expect(campaign.isComplete).toBe(false);
    expect(campaign.recommendedNextLevel).toEqual({
      status: 'available',
      level: engine.getCatalog().getFirstLevel(),
    });
  });

  it('unlocks sequential levels across chapter boundaries, tracks best records independently on replay, and stays idempotent', () => {
    const engine = new ProgressionEngine();
    let state = engine.createInitialState();

    // Locked level cannot be recorded
    const lockedAttempt = engine.recordCompletion(state, {
      levelId: 'level-002',
      attemptId: 'att-locked',
      moveCount: 3,
      elapsedMs: 4000,
    });
    expect(lockedAttempt.accepted).toBe(false);
    expect(lockedAttempt.rejectionReason).toBe('LEVEL_LOCKED');

    // Complete Level 1 -> emits LEVEL_COMPLETED then LEVEL_UNLOCKED(level-002)
    const res1 = engine.recordCompletion(state, {
      levelId: 'level-001',
      attemptId: 'att-1',
      moveCount: 5,
      elapsedMs: 12000,
    });
    expect(res1.accepted).toBe(true);
    expect(res1.events.map((e) => e.type)).toEqual(['LEVEL_COMPLETED', 'LEVEL_UNLOCKED']);
    state = res1.state;
    expect(engine.getLevelStatus(state, 'level-001')).toBe('completed');
    expect(engine.getLevelStatus(state, 'level-002')).toBe('unlocked');
    expect(engine.getLevelStatus(state, 'level-003')).toBe('locked');

    // Duplicate attemptId is rejected idempotently
    const dup = engine.recordCompletion(state, {
      levelId: 'level-001',
      attemptId: 'att-1',
      moveCount: 1,
      elapsedMs: 500,
    });
    expect(dup.accepted).toBe(false);
    expect(dup.rejectionReason).toBe('DUPLICATE_ATTEMPT');
    expect(engine.getCompletionRecord(state, 'level-001')?.completionCount).toBe(1);

    // Replay Level 1 with better moves but worse time -> retains better moves & previous best time, does NOT unlock level-003
    const replayBetterMoves = engine.recordCompletion(state, {
      levelId: 'level-001',
      attemptId: 'att-1-replay-a',
      moveCount: 2,
      elapsedMs: 20000,
    });
    expect(replayBetterMoves.accepted).toBe(true);
    expect(replayBetterMoves.events.map((e) => e.type)).toEqual([
      'LEVEL_COMPLETED',
      'LEVEL_RECORD_IMPROVED',
    ]);
    state = replayBetterMoves.state;
    expect(engine.getCompletionRecord(state, 'level-001')).toEqual({
      levelId: 'level-001',
      completionCount: 2,
      bestMoveCount: 2,
      bestElapsedMs: 12000,
    });
    expect(engine.getLevelStatus(state, 'level-003')).toBe('locked');
    expect(engine.getCampaignProgress(state).completedLevels).toBe(1);

    // Replay Level 1 with worse moves & better time -> retains bestMoveCount=2 and updates bestElapsedMs=6000
    const replayBetterTime = engine.recordCompletion(state, {
      levelId: 'level-001',
      attemptId: 'att-1-replay-b',
      moveCount: 8,
      elapsedMs: 6000,
    });
    state = replayBetterTime.state;
    expect(engine.getCompletionRecord(state, 'level-001')).toEqual({
      levelId: 'level-001',
      completionCount: 3,
      bestMoveCount: 2,
      bestElapsedMs: 6000,
    });

    // Recommended next level stays at Level 2 (never moves backwards on replay)
    const rec = engine.getRecommendedNextLevel(state);
    expect(rec.status).toBe('available');
    if (rec.status === 'available') {
      expect(rec.level.id).toBe('level-002');
    }

    // Complete Levels 2..8 -> Level 8 unlocks Level 9 and emits CHAPTER_COMPLETED for chapter-01
    let lastEvents: readonly { readonly type: string }[] = [];
    for (let n = 2; n <= 8; n += 1) {
      const r = engine.recordCompletion(state, {
        levelId: formatLevelId(n),
        attemptId: `att-${String(n)}`,
        moveCount: 3,
        elapsedMs: 5000,
      });
      expect(r.accepted).toBe(true);
      state = r.state;
      lastEvents = r.events;
    }

    expect(lastEvents.map((e) => e.type)).toEqual([
      'LEVEL_COMPLETED',
      'LEVEL_UNLOCKED',
      'CHAPTER_COMPLETED',
    ]);
    expect(engine.getChapterProgress(state, 'chapter-01')?.isComplete).toBe(true);
    expect(engine.getChapterProgress(state, 'chapter-01')?.completionPercentage).toBe(100);
    expect(engine.getLevelStatus(state, 'level-009')).toBe('unlocked');
    expect(engine.getChapterProgress(state, 'chapter-02')?.hasPlayableLevel).toBe(true);
  });

  it('validates invalid completion inputs, serialises cleanly, and scales automatically to expanded catalogues', () => {
    const extraChapter: ChapterSpec = {
      id: formatChapterId(7),
      displayName: 'Bonus Tier',
      order: 7,
      difficulty: 'expert',
      bottleCount: 10,
      startLevelNumber: 51,
      levelCount: 10,
      minInitialMatches: 0,
      maxInitialMatches: 4,
      minRequiredSwaps: 4,
    };
    const expandedCatalog = buildCatalogFromChapterSpecs([...DEFAULT_CHAPTER_SPECS, extraChapter]);
    const engine = new ProgressionEngine(expandedCatalog);
    let state = engine.createInitialState();

    // Invalid inputs rejected
    expect(
      engine.recordCompletion(state, {
        levelId: 'level-001',
        attemptId: 'bad-moves',
        moveCount: 0,
        elapsedMs: 1000,
      }).rejectionReason,
    ).toBe('INVALID_MOVE_COUNT');

    expect(
      engine.recordCompletion(state, {
        levelId: 'level-001',
        attemptId: 'bad-time',
        moveCount: 2,
        elapsedMs: Number.NaN,
      }).rejectionReason,
    ).toBe('INVALID_ELAPSED_TIME');

    expect(
      engine.recordCompletion(state, {
        levelId: 'level-001',
        attemptId: '   ',
        moveCount: 2,
        elapsedMs: 1000,
      }).rejectionReason,
    ).toBe('INVALID_ATTEMPT_ID');

    // Complete 30 of 60 levels -> 50% derived dynamically (not hardcoded to 50!)
    for (let n = 1; n <= 30; n += 1) {
      const r = engine.recordCompletion(state, {
        levelId: formatLevelId(n),
        attemptId: `exp-${String(n)}`,
        moveCount: 4,
        elapsedMs: 8000,
      });
      state = r.state;
    }

    const progress = engine.getCampaignProgress(state);
    expect(progress.totalLevels).toBe(60);
    expect(progress.completedLevels).toBe(30);
    expect(progress.remainingLevels).toBe(30);
    expect(progress.completionPercentage).toBe(50);

    // Round-trip serialisation & unsupported schema rejection
    const json = engine.serializeState(state);
    const restored = engine.deserializeState(json);
    expect(restored).toEqual(state);

    const badSchemaJson = JSON.stringify({ ...state, schemaVersion: 999 });
    expect(() => engine.deserializeState(badSchemaJson)).toThrow(ProgressionError);
  });
});
