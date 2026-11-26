import { describe, expect, it } from 'vitest';
import {
  ALL_DIFFICULTY_DEFINITIONS,
  calculateCorrectMatches,
  generatePuzzle,
} from '../../src/core';
import { GameplayController } from '../../src/game/gameplay/GameplayController';
import { calculateGameplayLayout } from '../../src/game/layout/GameplayLayout';
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

describe('Gameplay Integration', () => {
  it('completes full deterministic puzzles across all difficulties while preserving invariants across resizes and interrupted swaps', () => {
    for (const def of ALL_DIFFICULTY_DEFINITIONS) {
      const clock = new FakeClock();
      const puzzle = generatePuzzle({
        difficulty: def.id,
        seed: `integration-${def.id}-seed`,
      });

      const controller = new GameplayController({
        puzzle,
        sceneData: { difficulty: def.id },
        clock,
      });

      controller.start();
      let completionEvents = 0;

      // Verify layout recalculation across landscape and portrait preserves gameplay state
      const landscapeLayout = calculateGameplayLayout({
        width: 1280,
        height: 720,
        bottleCount: def.bottleCount,
      });
      const portraitLayout = calculateGameplayLayout({
        width: 390,
        height: 844,
        bottleCount: def.bottleCount,
      });
      expect(landscapeLayout.board.rackLayout.slots).toHaveLength(def.bottleCount);
      expect(portraitLayout.board.rackLayout.slots).toHaveLength(def.bottleCount);

      // Select & deselect does not increment moves
      controller.handleBottleTap(0);
      controller.handleBottleTap(0);
      expect(controller.getViewState().moveCount).toBe(0);

      // Solve deterministically using test-only puzzle target access
      let expectedMoves = 0;
      while (controller.getViewState().status !== 'completed') {
        clock.advance(1_000);
        const current = controller.getViewState().currentSequence;
        const mismatchIdx = current.findIndex((id, idx) => id !== puzzle.targetSequence[idx]);
        if (mismatchIdx === -1) {
          break;
        }
        const needed = puzzle.targetSequence[mismatchIdx];
        if (needed === undefined) {
          break;
        }
        const sourceIdx = current.indexOf(needed);

        controller.handleBottleTap(mismatchIdx);
        const midSwap = controller.handleBottleTap(sourceIdx);
        expectedMoves += 1;

        // Rapid duplicate tap while swapping must not trigger another swap
        controller.handleBottleTap(0);
        expect(midSwap.moveCount).toBe(expectedMoves);

        // Simulate mid-swap interruption on move 1 (e.g. platform suspend reconciles cleanly)
        if (expectedMoves === 1 && !midSwap.overlayMode.includes('completed')) {
          controller.handlePlatformSuspend();
          controller.handlePlatformResume();
        } else {
          controller.completeSwapTransition();
        }

        const view = controller.getViewState();
        const refMatches = calculateCorrectMatches(view.currentSequence, puzzle.targetSequence);
        expect(view.displayedMatchCount).toBe(refMatches);
        expect(view.moveCount).toBe(expectedMoves);

        // Confirm private fields never leak onto view state
        expect('targetSequence' in view).toBe(false);
        expect('seed' in view).toBe(false);

        if (view.overlayMode === 'completed') {
          completionEvents += 1;
        }
      }

      expect(completionEvents).toBe(1);
      expect(controller.getViewState().status).toBe('completed');
      expect(controller.getViewState().displayedMatchCount).toBe(def.bottleCount);

      // Further taps after completion are ignored
      controller.handleBottleTap(0);
      controller.handleBottleTap(1);
      expect(controller.getViewState().moveCount).toBe(expectedMoves);

      // Restart restores exact starting puzzle and resets timer & moves
      const restarted = controller.confirmRestart();
      expect(restarted.puzzleId).toBe(puzzle.id);
      expect(restarted.currentSequence).toEqual(puzzle.startingSequence);
      expect(restarted.moveCount).toBe(0);
      expect(restarted.formattedTime).toBe('00:00');
      expect(restarted.status).toBe('playing');
      expect(restarted.overlayMode).toBe('none');

      controller.dispose();
    }
  });
});
