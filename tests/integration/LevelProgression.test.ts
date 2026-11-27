import { describe, expect, it } from 'vitest';
import { formatLevelId, generateLevelPuzzle, type ProgressionEvent } from '../../src/core';
import { GameplayController } from '../../src/game/gameplay/GameplayController';
import { ProgressionController } from '../../src/game/progression/ProgressionController';
import type { MonotonicClock } from '../../src/services/GameplayClock';

class FakeClock implements MonotonicClock {
  private ms = 0;
  public now(): number {
    return this.ms;
  }
  public advance(deltaMs: number): void {
    this.ms += deltaMs;
  }
}

describe('50-Level Campaign Progression Integration', () => {
  it('completes all 50 deterministic campaign levels sequentially across all 6 chapters with accurate unlocking, records, and replay stability', () => {
    const progression = new ProgressionController();
    const catalog = progression.getCatalog();
    const allEvents: ProgressionEvent[] = [];

    progression.onChange((_state, events) => {
      allEvents.push(...events);
    });

    const chapterUnlockCheckpoints = new Set([1, 5, 10, 20, 30, 40]);

    for (let n = 1; n <= 50; n += 1) {
      const levelId = formatLevelId(n);
      const level = catalog.getLevelById(levelId);
      expect(level).toBeDefined();
      if (level === undefined) {
        break;
      }

      // Confirm current level is unlocked and next level (if any) is still locked
      expect(progression.getLevelStatus(levelId)).toBe('unlocked');
      if (n < 50) {
        expect(progression.getLevelStatus(formatLevelId(n + 1))).toBe('locked');
      }

      // Test-only target sequence access to solve deterministically
      const deterministicPuzzle = generateLevelPuzzle(level);
      const clock = new FakeClock();
      const session = new GameplayController({
        sceneData: { mode: 'campaign', levelId },
        progressionController: progression,
        clock,
      });

      session.start();
      expect(session.getViewState().mode).toBe('campaign');
      expect(session.getViewState().levelNumber).toBe(n);
      expect(session.getViewState().headerTitle).toBe(`Level ${String(n)}`);

      while (session.getViewState().status !== 'completed') {
        clock.advance(750);
        const current = session.getViewState().currentSequence;
        const mismatch = current.findIndex(
          (id, idx) => id !== deterministicPuzzle.targetSequence[idx],
        );
        if (mismatch === -1) {
          break;
        }
        const needed = deterministicPuzzle.targetSequence[mismatch];
        if (needed === undefined) {
          break;
        }
        const source = current.indexOf(needed);
        session.handleBottleTap(mismatch);
        session.handleBottleTap(source);
        session.completeSwapTransition();
      }

      const finalView = session.getViewState();
      expect(finalView.status).toBe('completed');
      expect(finalView.overlayMode).toBe('completed');
      expect(progression.getLevelStatus(levelId)).toBe('completed');

      if (chapterUnlockCheckpoints.has(n)) {
        expect(progression.getLevelStatus(formatLevelId(n + 1))).toBe('unlocked');
      }

      if (n < 50) {
        expect(finalView.nextLevelId).toBe(formatLevelId(n + 1));
        expect(finalView.nextLevelNumber).toBe(n + 1);
      } else {
        expect(finalView.nextLevelId).toBeNull();
        expect(finalView.isCampaignComplete).toBe(true);
      }

      session.dispose();
    }

    // Verify final campaign & chapter completion state
    const finalProgress = progression.getCampaignProgress();
    expect(finalProgress.totalLevels).toBe(50);
    expect(finalProgress.completedLevels).toBe(50);
    expect(finalProgress.remainingLevels).toBe(0);
    expect(finalProgress.completionPercentage).toBe(100);
    expect(finalProgress.isComplete).toBe(true);
    expect(finalProgress.recommendedNextLevel.status).toBe('campaign_completed');

    const chapterCompletedEvents = allEvents.filter((e) => e.type === 'CHAPTER_COMPLETED');
    const campaignCompletedEvents = allEvents.filter((e) => e.type === 'CAMPAIGN_COMPLETED');
    const unlockEvents = allEvents.filter((e) => e.type === 'LEVEL_UNLOCKED');

    expect(chapterCompletedEvents).toHaveLength(6);
    expect(campaignCompletedEvents).toHaveLength(1);
    expect(unlockEvents).toHaveLength(49); // Levels 2..50 unlocked, no nonexistent Level 51

    // Replay Level 1 after campaign completion -> completion count increments, campaign remains 100%
    const level1 = catalog.getFirstLevel();
    const puzzle1 = generateLevelPuzzle(level1);
    const replayClock = new FakeClock();
    const replaySession = new GameplayController({
      sceneData: { mode: 'campaign', levelId: 'level-001' },
      progressionController: progression,
      clock: replayClock,
    });
    replaySession.start();
    while (replaySession.getViewState().status !== 'completed') {
      replayClock.advance(250);
      const current = replaySession.getViewState().currentSequence;
      const mismatch = current.findIndex((id, idx) => id !== puzzle1.targetSequence[idx]);
      if (mismatch === -1) {
        break;
      }
      const needed = puzzle1.targetSequence[mismatch];
      if (needed === undefined) {
        break;
      }
      replaySession.handleBottleTap(mismatch);
      replaySession.handleBottleTap(current.indexOf(needed));
      replaySession.completeSwapTransition();
    }
    replaySession.dispose();

    expect(progression.getCompletionRecord('level-001')?.completionCount).toBe(2);
    expect(progression.getCampaignProgress().completedLevels).toBe(50);
    expect(progression.getCampaignProgress().completionPercentage).toBe(100);
    expect(progression.getRecommendedNextLevel().status).toBe('campaign_completed');
  });
});
