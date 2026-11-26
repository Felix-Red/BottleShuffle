import { describe, expect, it, vi } from 'vitest';
import type { DifficultyId, Puzzle } from '../../../src/core';
import { GameplayController } from '../../../src/game/gameplay/GameplayController';
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

const TEST_PUZZLE: Puzzle = Object.freeze({
  id: 'pzl-ctrl-test',
  seed: 'ctrl-seed',
  generatorVersion: '1.0.0',
  difficulty: 'easy',
  bottleCount: 4,
  // 2 matches initially (green @ 2, yellow @ 3); swapping 0 and 1 wins!
  startingSequence: Object.freeze(['blue', 'red', 'green', 'yellow'] as const),
  targetSequence: Object.freeze(['red', 'blue', 'green', 'yellow'] as const),
});

describe('GameplayController', () => {
  it('initialises, starts, handles selection/deselection, and never exposes target data on view state', () => {
    const clock = new FakeClock();
    const onSwapStarted = vi.fn();
    const controller = new GameplayController({
      puzzle: TEST_PUZZLE,
      clock,
      callbacks: { onSwapStarted },
    });

    const started = controller.start();
    expect(started.status).toBe('playing');
    expect(started.displayedMatchCount).toBe(2);
    expect(started.moveCount).toBe(0);
    expect(started.inputEnabled).toBe(true);
    expect('targetSequence' in started).toBe(false);
    expect('seed' in started).toBe(false);

    // First tap selects without incrementing moves
    const selected = controller.handleBottleTap(0);
    expect(selected.selectedSlotIndex).toBe(0);
    expect(selected.moveCount).toBe(0);
    expect(selected.instructionText).toContain('another bottle');

    // Tapping same bottle clears selection
    const deselected = controller.handleBottleTap(0);
    expect(deselected.selectedSlotIndex).toBeNull();
    expect(deselected.moveCount).toBe(0);

    // Tapping two different bottles starts swap transition and blocks rapid extra taps
    controller.handleBottleTap(0);
    const swapping = controller.handleBottleTap(1);
    expect(swapping.isSwapping).toBe(true);
    expect(swapping.inputEnabled).toBe(false);
    expect(swapping.moveCount).toBe(1);
    expect(onSwapStarted).toHaveBeenCalledTimes(1);

    // Rapid tap during swap is ignored
    controller.handleBottleTap(2);
    expect(controller.getViewState().moveCount).toBe(1);

    // Completing swap reveals final match count, feedback, and completion overlay
    const completed = controller.completeSwapTransition();
    expect(completed.isSwapping).toBe(false);
    expect(completed.displayedMatchCount).toBe(4);
    expect(completed.status).toBe('completed');
    expect(completed.overlayMode).toBe('completed');
    expect(completed.matchFeedback?.text).toBe('+2 matches');
    expect(completed.matchFeedback?.tone).toBe('positive');
  });

  it('handles pause, resume, restart confirmation (from both playing and pause), and platform suspension', () => {
    const clock = new FakeClock();
    const controller = new GameplayController({ puzzle: TEST_PUZZLE, clock });
    controller.start();
    clock.advance(4_000);

    // Open restart confirmation from playing, then cancel -> returns to playing
    controller.requestRestartConfirmation();
    expect(controller.getViewState().overlayMode).toBe('restart_confirm');
    clock.advance(10_000);
    controller.cancelRestartConfirmation();
    expect(controller.getViewState().overlayMode).toBe('none');
    expect(controller.getViewState().formattedTime).toBe('00:04');

    // Pause -> open restart confirmation -> cancel -> returns to paused!
    controller.requestPause();
    expect(controller.getViewState().overlayMode).toBe('pause');
    expect(controller.getViewState().status).toBe('paused');

    controller.requestRestartConfirmation();
    expect(controller.getViewState().overlayMode).toBe('restart_confirm');
    controller.cancelRestartConfirmation();
    expect(controller.getViewState().overlayMode).toBe('pause');
    expect(controller.getViewState().status).toBe('paused');

    // Platform suspend + resume must NOT override manual pause
    controller.handlePlatformSuspend();
    clock.advance(12_000);
    controller.handlePlatformResume();
    expect(controller.getViewState().status).toBe('paused');
    expect(controller.getViewState().formattedTime).toBe('00:04');

    // Confirm restart restores starting state and resets clock
    controller.requestRestartConfirmation();
    const restarted = controller.confirmRestart();
    expect(restarted.status).toBe('playing');
    expect(restarted.overlayMode).toBe('none');
    expect(restarted.moveCount).toBe(0);
    expect(restarted.displayedMatchCount).toBe(2);
    expect(restarted.formattedTime).toBe('00:00');
  });

  it('enters error recovery overlay gracefully when scene configuration is invalid', () => {
    const controller = new GameplayController({
      sceneData: { difficulty: 'invalid-diff' as DifficultyId },
    });

    const view = controller.getViewState();
    expect(view.overlayMode).toBe('error');
    expect(view.inputEnabled).toBe(false);
    expect(view.errorMessage).toBeTruthy();
  });

  it('supports keyboard navigation, selection activation, and Escape behaviour', () => {
    const controller = new GameplayController({ puzzle: TEST_PUZZLE });
    controller.start();

    expect(controller.moveKeyboardFocus(1).focusedSlotIndex).toBe(0);
    expect(controller.moveKeyboardFocus(1).focusedSlotIndex).toBe(1);
    expect(controller.activateFocusedSlot().selectedSlotIndex).toBe(1);

    // Escape first clears active selection
    expect(controller.handleEscapeKey().selectedSlotIndex).toBeNull();
    expect(controller.getViewState().overlayMode).toBe('none');

    // Escape with no selection opens pause overlay
    expect(controller.handleEscapeKey().overlayMode).toBe('pause');

    // Escape while paused resumes
    expect(controller.handleEscapeKey().overlayMode).toBe('none');
  });
});
