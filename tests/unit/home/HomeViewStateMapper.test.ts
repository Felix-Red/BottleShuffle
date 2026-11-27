import { describe, expect, it } from 'vitest';
import {
  buildCatalogFromChapterSpecs,
  DEFAULT_CHAPTER_SPECS,
  formatChapterId,
  formatLevelId,
  ProgressionEngine,
  type ChapterSpec,
} from '../../../src/core';
import { mapHomeViewState } from '../../../src/game/home/HomeViewStateMapper';

describe('HomeViewStateMapper', () => {
  it('maps new player, returning player, replayed level, and completed campaign states accurately', () => {
    const engine = new ProgressionEngine();
    const catalog = engine.getCatalog();
    let state = engine.createInitialState();

    // New player
    const newView = mapHomeViewState({
      campaignProgress: engine.getCampaignProgress(state),
      catalog,
      canNavigate: true,
    });
    expect(newView.playerStatus).toBe('new');
    expect(newView.primaryActionLabel).toBe('PLAY');
    expect(newView.primarySupportingText).toBe('Level 1');
    expect(newView.primaryActionKind).toBe('launch_level');
    expect(newView.recommendedLevelId).toBe('level-001');
    expect(newView.recommendedLevelNumber).toBe(1);
    expect(newView.recommendedChapterName).toBe('First Steps');
    expect(newView.recommendedChapterOrder).toBe(1);
    expect(newView.completedLevelCount).toBe(0);
    expect(newView.totalLevelCount).toBe(50);
    expect(newView.completionPercentage).toBe(0);

    // Complete Levels 1..7 -> returning player recommends Level 8 (Chapter 2 · Getting Warmer)
    for (let n = 1; n <= 7; n += 1) {
      state = engine.recordCompletion(state, {
        levelId: formatLevelId(n),
        attemptId: `att-${String(n)}`,
        moveCount: 3,
        elapsedMs: 10000,
      }).state;
    }

    // Replaying Level 1 must NOT move recommended level backwards from Level 8
    state = engine.recordCompletion(state, {
      levelId: 'level-001',
      attemptId: 'att-replay-1',
      moveCount: 1,
      elapsedMs: 4000,
    }).state;

    const returningView = mapHomeViewState({
      campaignProgress: engine.getCampaignProgress(state),
      catalog,
      canNavigate: true,
    });
    expect(returningView.playerStatus).toBe('returning');
    expect(returningView.primaryActionLabel).toBe('CONTINUE');
    expect(returningView.primarySupportingText).toBe('Level 8');
    expect(returningView.recommendedLevelId).toBe('level-008');
    expect(returningView.recommendedChapterName).toBe('Getting Warmer');
    expect(returningView.recommendedChapterOrder).toBe(2);
    expect(returningView.completedLevelCount).toBe(7);
    expect(returningView.completionPercentage).toBe(14);

    // Complete remaining levels 8..50 -> Campaign Completed state
    for (let n = 8; n <= 50; n += 1) {
      state = engine.recordCompletion(state, {
        levelId: formatLevelId(n),
        attemptId: `att-${String(n)}`,
        moveCount: 4,
        elapsedMs: 12000,
      }).state;
    }

    const completedView = mapHomeViewState({
      campaignProgress: engine.getCampaignProgress(state),
      catalog,
      canNavigate: true,
    });
    expect(completedView.playerStatus).toBe('completed');
    expect(completedView.primaryActionLabel).toBe('PLAY AGAIN');
    expect(completedView.primarySupportingText).toBe('Choose a level');
    expect(completedView.primaryActionKind).toBe('open_levels');
    expect(completedView.recommendedLevelId).toBeNull();
    expect(completedView.isCampaignComplete).toBe(true);
    expect(completedView.completedLevelCount).toBe(50);
    expect(completedView.completionPercentage).toBe(100);

    // Expanding catalogue to 55 levels automatically transitions back to returning (Level 51!)
    const extraChapter: ChapterSpec = {
      id: formatChapterId(7),
      displayName: 'Grandmaster',
      order: 7,
      difficulty: 'expert',
      bottleCount: 10,
      startLevelNumber: 51,
      levelCount: 5,
      minInitialMatches: 0,
      maxInitialMatches: 4,
      minRequiredSwaps: 4,
    };
    const expandedCatalog = buildCatalogFromChapterSpecs([...DEFAULT_CHAPTER_SPECS, extraChapter]);
    const expandedEngine = new ProgressionEngine(expandedCatalog);
    const expandedView = mapHomeViewState({
      campaignProgress: expandedEngine.getCampaignProgress(state),
      catalog: expandedCatalog,
      canNavigate: true,
    });
    expect(expandedView.playerStatus).toBe('returning');
    expect(expandedView.primaryActionLabel).toBe('CONTINUE');
    expect(expandedView.primarySupportingText).toBe('Level 51');
    expect(expandedView.totalLevelCount).toBe(55);
    expect(expandedView.recommendedChapterName).toBe('Grandmaster');
  });
});
