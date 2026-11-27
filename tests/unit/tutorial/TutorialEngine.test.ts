import { describe, expect, it } from 'vitest';
import {
  TUTORIAL_STEPS,
  TutorialEngine,
  type TutorialInstructionalStageId,
} from '../../../src/core';

describe('TutorialEngine state machine', () => {
  it('progresses cleanly across all stages, handles deselection, rejects invalid actions, and completes exactly once', () => {
    const engine = new TutorialEngine();
    expect(engine.getState().stage).toBe('not_started');

    // Invalid action before start is rejected
    expect(engine.dispatch({ type: 'ACKNOWLEDGE_INTRO' }).accepted).toBe(false);

    // Stage 1: Introduction
    expect(engine.dispatch({ type: 'START_TUTORIAL' }).accepted).toBe(true);
    expect(engine.getState().stage).toBe('introduction');
    expect(engine.evaluateSlotInteraction(0).allowed).toBe(false);

    // Stage 2: Guided selection
    expect(engine.dispatch({ type: 'ACKNOWLEDGE_INTRO' }).accepted).toBe(true);
    expect(engine.getState().stage).toBe('guided_selection');

    // Wrong slot rejected without changing stage
    expect(engine.evaluateSlotInteraction(2)).toEqual({
      allowed: false,
      reason: 'WRONG_BOTTLE_TARGET',
    });
    expect(engine.dispatch({ type: 'BOTTLE_SELECTED', slotIndex: 2 }).accepted).toBe(false);
    expect(engine.getState().stage).toBe('guided_selection');

    // Correct slot 0 advances to Stage 3: Guided swap
    expect(engine.evaluateSlotInteraction(0).allowed).toBe(true);
    expect(engine.dispatch({ type: 'BOTTLE_SELECTED', slotIndex: 0 }).accepted).toBe(true);
    expect(engine.getState().stage).toBe('guided_swap');

    // Deselecting slot 0 returns cleanly to Stage 2
    expect(engine.evaluateSlotInteraction(0).allowed).toBe(true);
    expect(engine.evaluateSlotInteraction(2).allowed).toBe(false);
    expect(engine.dispatch({ type: 'BOTTLE_DESELECTED' }).accepted).toBe(true);
    expect(engine.getState().stage).toBe('guided_selection');

    // Re-select slot 0 -> start guided swap -> animation completion advances to Stage 4
    expect(engine.dispatch({ type: 'BOTTLE_SELECTED', slotIndex: 0 }).accepted).toBe(true);
    expect(engine.dispatch({ type: 'GUIDED_SWAP_STARTED' }).accepted).toBe(true);
    expect(engine.getState().awaitingSwapAnimation).toBe(true);
    expect(engine.evaluateSlotInteraction(1)).toEqual({
      allowed: false,
      reason: 'AWAITING_ANIMATION',
    });

    const afterSwap = engine.dispatch({ type: 'SWAP_ANIMATION_COMPLETED' });
    expect(afterSwap.accepted).toBe(true);
    expect(engine.getState().stage).toBe('counter_explanation');
    expect(engine.getState().activePuzzleId).toBe('tutorial-counter-decrease');

    // Stage 4 counter demos (decrease & unchanged)
    const demo1 = engine.dispatch({ type: 'ADVANCE_COUNTER_DEMO' });
    expect(demo1.accepted).toBe(true);
    expect(demo1.events.some((e) => e.type === 'COUNTER_DEMO_SWAP_REQUESTED')).toBe(true);
    expect(engine.dispatch({ type: 'SWAP_ANIMATION_COMPLETED' }).accepted).toBe(true);
    expect(engine.getState().counterDemoPhase).toBe('decrease_shown');

    const demo2 = engine.dispatch({ type: 'ADVANCE_COUNTER_DEMO' });
    expect(demo2.accepted).toBe(true);
    expect(engine.getState().activePuzzleId).toBe('tutorial-counter-unchanged');
    expect(engine.dispatch({ type: 'SWAP_ANIMATION_COMPLETED' }).accepted).toBe(true);
    expect(engine.getState().counterDemoPhase).toBe('unchanged_shown');

    // Advance to Stage 5: Independent puzzle (unrestricted free play)
    expect(engine.dispatch({ type: 'ACKNOWLEDGE_COUNTER' }).accepted).toBe(true);
    expect(engine.getState().stage).toBe('independent_puzzle');
    expect(engine.getState().activePuzzleId).toBe('tutorial-independent-01');
    expect(engine.evaluateSlotInteraction(0).allowed).toBe(true);
    expect(engine.evaluateSlotInteraction(1).allowed).toBe(true);
    expect(engine.evaluateSlotInteraction(2).allowed).toBe(true);

    // Stage 6: Completion fires exactly once
    const done = engine.dispatch({ type: 'INDEPENDENT_PUZZLE_SOLVED' });
    expect(done.accepted).toBe(true);
    expect(engine.getState().stage).toBe('completed');
    expect(done.events.some((e) => e.type === 'TUTORIAL_COMPLETED')).toBe(true);

    // Duplicate completion is rejected
    expect(engine.dispatch({ type: 'INDEPENDENT_PUZZLE_SOLVED' }).accepted).toBe(false);
    expect(engine.dispatch({ type: 'SKIP_TUTORIAL' }).accepted).toBe(false);
  });

  it('supports skipping from every instructional stage and restarting guided/independent stages safely', () => {
    const stages: TutorialInstructionalStageId[] = TUTORIAL_STEPS.map((s) => s.id);

    for (const targetStage of stages) {
      const engine = new TutorialEngine();
      engine.dispatch({ type: 'START_TUTORIAL' });
      if (targetStage !== 'introduction') {
        engine.dispatch({ type: 'ACKNOWLEDGE_INTRO' });
      }
      if (
        targetStage === 'guided_swap' ||
        targetStage === 'counter_explanation' ||
        targetStage === 'independent_puzzle'
      ) {
        engine.dispatch({ type: 'BOTTLE_SELECTED', slotIndex: 0 });
      }
      if (targetStage === 'counter_explanation' || targetStage === 'independent_puzzle') {
        engine.dispatch({ type: 'GUIDED_SWAP_STARTED' });
        engine.dispatch({ type: 'SWAP_ANIMATION_COMPLETED' });
      }
      if (targetStage === 'independent_puzzle') {
        engine.dispatch({ type: 'ACKNOWLEDGE_COUNTER' });
      }

      expect(engine.getState().stage).toBe(targetStage);
      const skipRes = engine.dispatch({ type: 'SKIP_TUTORIAL' });
      expect(skipRes.accepted).toBe(true);
      expect(engine.getState().stage).toBe('skipped');
      expect(engine.getState().completedOnce).toBe(false);
    }

    // Restarting from guided_swap reconciles cleanly back to guided_selection
    const restartEngine = new TutorialEngine();
    restartEngine.dispatch({ type: 'START_TUTORIAL' });
    restartEngine.dispatch({ type: 'ACKNOWLEDGE_INTRO' });
    restartEngine.dispatch({ type: 'BOTTLE_SELECTED', slotIndex: 0 });
    expect(restartEngine.getState().stage).toBe('guided_swap');
    expect(restartEngine.dispatch({ type: 'RESTART_CURRENT_STAGE' }).accepted).toBe(true);
    expect(restartEngine.getState().stage).toBe('guided_selection');
  });
});
