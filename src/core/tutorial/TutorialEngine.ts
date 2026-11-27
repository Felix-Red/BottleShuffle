import type { TutorialAction } from './TutorialAction';
import { getTutorialStepDefinition } from './TutorialDefinition';
import type {
  TutorialEvent,
  TutorialRejectionReason,
  TutorialTransitionResult,
} from './TutorialEvent';
import { createInitialTutorialState, type TutorialState } from './TutorialState';
import type { TutorialPuzzleId, TutorialStageId } from './TutorialStep';

function reject(state: TutorialState, reason: TutorialRejectionReason): TutorialTransitionResult {
  const events: readonly TutorialEvent[] = Object.freeze([
    { type: 'TUTORIAL_ACTION_REJECTED', reason },
  ]);
  return Object.freeze({
    accepted: false,
    state,
    events,
    rejectionReason: reason,
  });
}

function accept(state: TutorialState, events: readonly TutorialEvent[]): TutorialTransitionResult {
  return Object.freeze({
    accepted: true,
    state: Object.freeze(state),
    events: Object.freeze(events),
  });
}

function isTerminal(stage: TutorialStageId): boolean {
  return stage === 'completed' || stage === 'skipped';
}

/**
 * Pure, deterministic state machine governing tutorial progression, input policy checks,
 * guided selection/deselection, counter demonstrations, independent puzzle completion,
 * restarting, and skipping. Contains zero Phaser or browser dependencies.
 */
export class TutorialEngine {
  private state: TutorialState;

  public constructor(initialState: TutorialState = createInitialTutorialState()) {
    this.state = Object.freeze({ ...initialState });
  }

  public getState(): TutorialState {
    return this.state;
  }

  /**
   * Evaluates the tutorial input policy for a bottle slot tap without altering core swap rules.
   */
  public evaluateSlotInteraction(
    slotIndex: number,
  ):
    | { readonly allowed: true }
    | { readonly allowed: false; readonly reason: TutorialRejectionReason } {
    if (isTerminal(this.state.stage)) {
      return { allowed: false, reason: 'ALREADY_TERMINATED' };
    }
    if (this.state.awaitingSwapAnimation) {
      return { allowed: false, reason: 'AWAITING_ANIMATION' };
    }

    const step = getTutorialStepDefinition(this.state.stage);
    if (step === undefined) {
      return { allowed: false, reason: 'INVALID_STAGE' };
    }

    if (step.inputPolicy === 'none') {
      return { allowed: false, reason: 'INVALID_STAGE' };
    }
    if (step.inputPolicy === 'free_play') {
      return { allowed: true };
    }
    if (step.inputPolicy === 'specific_slot') {
      return slotIndex === step.requiredSlotIndex
        ? { allowed: true }
        : { allowed: false, reason: 'WRONG_BOTTLE_TARGET' };
    }

    // specific_or_deselect: allow tapping the target slot OR deselecting the already-selected slot
    if (
      slotIndex === step.requiredSlotIndex ||
      (this.state.selectedSlotIndex !== null && slotIndex === this.state.selectedSlotIndex)
    ) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'WRONG_BOTTLE_TARGET' };
  }

  public dispatch(action: TutorialAction): TutorialTransitionResult {
    const result = this.reduce(this.state, action);
    if (result.accepted) {
      this.state = result.state;
    }
    return result;
  }

  public reset(): TutorialState {
    this.state = createInitialTutorialState();
    return this.state;
  }

  private reduce(state: TutorialState, action: TutorialAction): TutorialTransitionResult {
    switch (action.type) {
      case 'START_TUTORIAL': {
        if (state.stage !== 'not_started') {
          return reject(state, 'INVALID_STAGE');
        }
        const next: TutorialState = {
          ...state,
          stage: 'introduction',
          activePuzzleId: 'tutorial-guided-01',
          selectedSlotIndex: null,
          awaitingSwapAnimation: false,
          counterDemoPhase: 'decrease_ready',
        };
        return accept(next, [
          { type: 'TUTORIAL_STARTED', stage: 'introduction' },
          { type: 'STAGE_CHANGED', previousStage: 'not_started', nextStage: 'introduction' },
        ]);
      }

      case 'SKIP_TUTORIAL': {
        if (isTerminal(state.stage) || state.stage === 'not_started') {
          return reject(state, isTerminal(state.stage) ? 'ALREADY_TERMINATED' : 'INVALID_STAGE');
        }
        const next: TutorialState = {
          ...state,
          stage: 'skipped',
          selectedSlotIndex: null,
          awaitingSwapAnimation: false,
          skipped: true,
        };
        return accept(next, [
          { type: 'TUTORIAL_SKIPPED', fromStage: state.stage },
          { type: 'STAGE_CHANGED', previousStage: state.stage, nextStage: 'skipped' },
        ]);
      }

      case 'ACKNOWLEDGE_INTRO': {
        if (state.stage !== 'introduction') {
          return reject(state, 'INVALID_STAGE');
        }
        const next: TutorialState = {
          ...state,
          stage: 'guided_selection',
          selectedSlotIndex: null,
        };
        return accept(next, [
          { type: 'STAGE_CHANGED', previousStage: 'introduction', nextStage: 'guided_selection' },
        ]);
      }

      case 'BOTTLE_SELECTED': {
        if (state.awaitingSwapAnimation) {
          return reject(state, 'AWAITING_ANIMATION');
        }
        if (state.stage === 'guided_selection') {
          const step = getTutorialStepDefinition('guided_selection');
          if (action.slotIndex !== step?.requiredSlotIndex) {
            return reject(state, 'WRONG_BOTTLE_TARGET');
          }
          const next: TutorialState = {
            ...state,
            stage: 'guided_swap',
            selectedSlotIndex: action.slotIndex,
          };
          return accept(next, [
            { type: 'STAGE_CHANGED', previousStage: 'guided_selection', nextStage: 'guided_swap' },
          ]);
        }
        if (state.stage === 'independent_puzzle') {
          return accept({ ...state, selectedSlotIndex: action.slotIndex }, []);
        }
        return reject(state, 'INVALID_STAGE');
      }

      case 'BOTTLE_DESELECTED': {
        if (state.awaitingSwapAnimation) {
          return reject(state, 'AWAITING_ANIMATION');
        }
        if (state.stage === 'guided_swap') {
          const next: TutorialState = {
            ...state,
            stage: 'guided_selection',
            selectedSlotIndex: null,
          };
          return accept(next, [
            { type: 'STAGE_CHANGED', previousStage: 'guided_swap', nextStage: 'guided_selection' },
          ]);
        }
        if (state.stage === 'independent_puzzle') {
          return accept({ ...state, selectedSlotIndex: null }, []);
        }
        return reject(state, 'INVALID_STAGE');
      }

      case 'GUIDED_SWAP_STARTED': {
        if (state.stage !== 'guided_swap' || state.awaitingSwapAnimation) {
          return reject(
            state,
            state.awaitingSwapAnimation ? 'AWAITING_ANIMATION' : 'INVALID_STAGE',
          );
        }
        const next: TutorialState = {
          ...state,
          selectedSlotIndex: null,
          awaitingSwapAnimation: true,
        };
        return accept(next, []);
      }

      case 'SWAP_ANIMATION_COMPLETED': {
        if (state.stage === 'guided_swap' && state.awaitingSwapAnimation) {
          const next: TutorialState = {
            ...state,
            stage: 'counter_explanation',
            activePuzzleId: 'tutorial-counter-decrease',
            selectedSlotIndex: null,
            awaitingSwapAnimation: false,
            counterDemoPhase: 'decrease_ready',
          };
          return accept(next, [
            { type: 'PUZZLE_CHANGED', puzzleId: 'tutorial-counter-decrease' },
            {
              type: 'STAGE_CHANGED',
              previousStage: 'guided_swap',
              nextStage: 'counter_explanation',
            },
          ]);
        }
        if (state.stage === 'counter_explanation' && state.awaitingSwapAnimation) {
          const nextPhase =
            state.counterDemoPhase === 'decrease_ready' ? 'decrease_shown' : 'unchanged_shown';
          const next: TutorialState = {
            ...state,
            awaitingSwapAnimation: false,
            counterDemoPhase: nextPhase,
          };
          return accept(next, []);
        }
        return reject(state, 'INVALID_STAGE');
      }

      case 'ADVANCE_COUNTER_DEMO': {
        if (state.stage !== 'counter_explanation' || state.awaitingSwapAnimation) {
          return reject(
            state,
            state.awaitingSwapAnimation ? 'AWAITING_ANIMATION' : 'INVALID_STAGE',
          );
        }

        if (state.counterDemoPhase === 'decrease_ready') {
          const next: TutorialState = {
            ...state,
            awaitingSwapAnimation: true,
          };
          return accept(next, [
            {
              type: 'COUNTER_DEMO_SWAP_REQUESTED',
              puzzleId: 'tutorial-counter-decrease',
              firstIndex: 0,
              secondIndex: 1,
            },
          ]);
        }

        if (state.counterDemoPhase === 'decrease_shown') {
          const next: TutorialState = {
            ...state,
            activePuzzleId: 'tutorial-counter-unchanged',
            counterDemoPhase: 'unchanged_ready',
            awaitingSwapAnimation: true,
          };
          return accept(next, [
            { type: 'PUZZLE_CHANGED', puzzleId: 'tutorial-counter-unchanged' },
            {
              type: 'COUNTER_DEMO_SWAP_REQUESTED',
              puzzleId: 'tutorial-counter-unchanged',
              firstIndex: 0,
              secondIndex: 2,
            },
          ]);
        }

        // Cycle back to decrease demo cleanly if clicked again after both demos shown
        const next: TutorialState = {
          ...state,
          activePuzzleId: 'tutorial-counter-decrease',
          counterDemoPhase: 'decrease_ready',
          awaitingSwapAnimation: true,
        };
        return accept(next, [
          { type: 'PUZZLE_CHANGED', puzzleId: 'tutorial-counter-decrease' },
          {
            type: 'COUNTER_DEMO_SWAP_REQUESTED',
            puzzleId: 'tutorial-counter-decrease',
            firstIndex: 0,
            secondIndex: 1,
          },
        ]);
      }

      case 'ACKNOWLEDGE_COUNTER': {
        if (state.stage !== 'counter_explanation') {
          return reject(state, 'INVALID_STAGE');
        }
        const next: TutorialState = {
          ...state,
          stage: 'independent_puzzle',
          activePuzzleId: 'tutorial-independent-01',
          selectedSlotIndex: null,
          awaitingSwapAnimation: false,
        };
        return accept(next, [
          { type: 'PUZZLE_CHANGED', puzzleId: 'tutorial-independent-01' },
          {
            type: 'STAGE_CHANGED',
            previousStage: 'counter_explanation',
            nextStage: 'independent_puzzle',
          },
        ]);
      }

      case 'INDEPENDENT_PUZZLE_SOLVED': {
        if (state.stage !== 'independent_puzzle' || state.completedOnce) {
          return reject(state, state.completedOnce ? 'ALREADY_TERMINATED' : 'INVALID_STAGE');
        }
        const next: TutorialState = {
          ...state,
          stage: 'completed',
          selectedSlotIndex: null,
          awaitingSwapAnimation: false,
          completedOnce: true,
        };
        return accept(next, [
          { type: 'TUTORIAL_COMPLETED' },
          { type: 'STAGE_CHANGED', previousStage: 'independent_puzzle', nextStage: 'completed' },
        ]);
      }

      case 'RESTART_CURRENT_STAGE': {
        if (isTerminal(state.stage) || state.stage === 'not_started') {
          return reject(state, isTerminal(state.stage) ? 'ALREADY_TERMINATED' : 'INVALID_STAGE');
        }

        if (state.stage === 'guided_swap') {
          const next: TutorialState = {
            ...state,
            stage: 'guided_selection',
            activePuzzleId: 'tutorial-guided-01',
            selectedSlotIndex: null,
            awaitingSwapAnimation: false,
          };
          return accept(next, [
            { type: 'PUZZLE_CHANGED', puzzleId: 'tutorial-guided-01' },
            { type: 'STAGE_CHANGED', previousStage: 'guided_swap', nextStage: 'guided_selection' },
          ]);
        }

        const resetPuzzleId: TutorialPuzzleId =
          state.stage === 'counter_explanation'
            ? 'tutorial-counter-decrease'
            : state.activePuzzleId;

        const next: TutorialState = {
          ...state,
          activePuzzleId: resetPuzzleId,
          selectedSlotIndex: null,
          awaitingSwapAnimation: false,
          counterDemoPhase: 'decrease_ready',
        };
        return accept(next, [{ type: 'PUZZLE_CHANGED', puzzleId: resetPuzzleId }]);
      }
    }
  }
}
