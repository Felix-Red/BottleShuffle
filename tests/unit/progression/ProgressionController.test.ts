import { describe, expect, it } from 'vitest';
import { generateLevelPuzzle, type BottleId } from '../../../src/core';
import { GameplayController } from '../../../src/game/gameplay/GameplayController';
import { ProgressionController } from '../../../src/game/progression/ProgressionController';
import type { MonotonicClock } from '../../../src/services/GameplayClock';

class FakeClock implements MonotonicClock {
  private ms = 0;
  public now(): number {
    return this.ms;
  }
  public advance(deltaMs: number): void {
    this.ms += deltaMs;
  }
}

function solveGameplayController(
  controller: GameplayController,
  targetSequence: readonly BottleId[],
  clock: FakeClock,
): void {
  while (controller.getViewState().status !== 'completed') {
    clock.advance(1000);
    const current = controller.getViewState().currentSequence;
    const mismatch = current.findIndex((id, idx) => id !== targetSequence[idx]);
    if (mismatch === -1) {
      break;
    }
    const needed = targetSequence[mismatch];
    if (needed === undefined) {
      break;
    }
    const source = current.indexOf(needed);
    controller.handleBottleTap(mismatch);
    controller.handleBottleTap(source);
    controller.completeSwapTransition();
  }
}

describe('ProgressionController & GameplayController Campaign/Practice Modes', () => {
  it('blocks locked levels, enforces active attempt idempotency, rotates attempt IDs on restart, and abandons safely on dispose', () => {
    const progression = new ProgressionController();

    // Locked level cannot begin
    expect(progression.beginCampaignAttempt('level-002')).toEqual({
      accepted: false,
      reason: 'LEVEL_LOCKED',
    });

    // Launching locked level via GameplayController enters error recovery cleanly
    const lockedSession = new GameplayController({
      sceneData: { mode: 'campaign', levelId: 'level-002' },
      progressionController: progression,
    });
    expect(lockedSession.getViewState().overlayMode).toBe('error');
    lockedSession.dispose();

    // Begin Level 1, restart it -> previous attempt ID becomes stale and rejected
    const clock = new FakeClock();
    const session = new GameplayController({
      sceneData: { mode: 'campaign', levelId: 'level-001' },
      progressionController: progression,
      clock,
    });
    session.start();

    expect(session.getViewState().headerTitle).toBe('Level 1');
    const firstAttemptId = session.getActiveCampaignAttemptId();
    expect(firstAttemptId).toBeTruthy();

    session.confirmRestart();
    const secondAttemptId = session.getActiveCampaignAttemptId();
    expect(secondAttemptId).not.toBe(firstAttemptId);
    expect(progression.getLevelStatus('level-001')).toBe('unlocked');
    expect(progression.getLevelStatus('level-002')).toBe('locked');

    // Stale first attempt cannot complete progression
    if (firstAttemptId !== null) {
      const staleResult = progression.completeActiveAttempt({
        attemptId: firstAttemptId,
        levelId: 'level-001',
        moveCount: 1,
        elapsedMs: 1000,
      });
      expect(staleResult.accepted).toBe(false);
      expect(staleResult.rejectionReason).toBe('INACTIVE_ATTEMPT');
    }

    // Wrong level ID is rejected even with active attempt ID
    if (secondAttemptId !== null) {
      const mismatchResult = progression.completeActiveAttempt({
        attemptId: secondAttemptId,
        levelId: 'level-002',
        moveCount: 1,
        elapsedMs: 1000,
      });
      expect(mismatchResult.accepted).toBe(false);
      expect(mismatchResult.rejectionReason).toBe('LEVEL_MISMATCH');
    }

    // Abandoning (returning home / scene destroy) without solving does not unlock Level 2
    session.dispose();
    expect(progression.getActiveAttempt()).toBeNull();
    expect(progression.getLevelStatus('level-001')).toBe('unlocked');
    expect(progression.getLevelStatus('level-002')).toBe('locked');
  });

  it('keeps practice mode completely isolated from campaign progression', () => {
    const progression = new ProgressionController();
    const clock = new FakeClock();
    const level1 = progression.getCatalog().getFirstLevel();
    const practicePuzzle = generateLevelPuzzle(level1);

    const practiceSession = new GameplayController({
      sceneData: { mode: 'practice', difficulty: 'beginner' },
      progressionController: progression,
      puzzle: practicePuzzle,
      clock,
    });
    practiceSession.start();

    expect(practiceSession.getViewState().mode).toBe('practice');
    solveGameplayController(practiceSession, practicePuzzle.targetSequence, clock);

    expect(practiceSession.getViewState().status).toBe('completed');
    expect(practiceSession.getViewState().nextLevelId).toBeNull();

    // Campaign progression remains completely untouched
    expect(progression.getCampaignProgress().completedLevels).toBe(0);
    expect(progression.getLevelStatus('level-001')).toBe('unlocked');
    expect(progression.getLevelStatus('level-002')).toBe('locked');

    practiceSession.dispose();
  });
});
