import { swapBottles } from '../engine/BottleSwapper';
import { countMatchingPositions } from '../engine/SwapDistance';
import {
  validatePlayingStatus,
  validateSelectionRequest,
  validateSwapRequest,
} from '../engine/SwapValidator';
import type { ActionRejectionReason } from '../errors/GameError';
import type { GameAction, GameActionType } from '../models/GameAction';
import type { GameEvent, GameTransitionResult } from '../models/GameEvent';
import { toPublicGameState } from '../models/PublicGameState';
import type { Puzzle } from '../models/Puzzle';
import type { PuzzleState } from '../models/PuzzleState';
import type { SwapResult } from '../models/SwapResult';
import { createRestartedGameState } from './GameStateFactory';

function acceptTransition(
  nextState: PuzzleState,
  events: readonly GameEvent[],
): GameTransitionResult {
  return Object.freeze({
    state: nextState,
    publicState: toPublicGameState(nextState),
    accepted: true,
    events: Object.freeze([...events]),
  });
}

function rejectTransition(
  currentState: PuzzleState,
  actionType: GameActionType,
  reason: ActionRejectionReason,
  message: string,
): GameTransitionResult {
  const rejectionEvent: GameEvent = Object.freeze({
    type: 'ACTION_REJECTED',
    actionType,
    reason,
    message,
  });

  return Object.freeze({
    state: currentState,
    publicState: toPublicGameState(currentState),
    accepted: false,
    events: Object.freeze([rejectionEvent]),
    rejectionReason: reason,
    rejectionMessage: message,
  });
}

function executeValidatedSwap(
  puzzle: Puzzle,
  state: PuzzleState,
  firstIndex: number,
  secondIndex: number,
): GameTransitionResult {
  const nextSequence = swapBottles(state.currentSequence, firstIndex, secondIndex);
  const previousMatchCount = state.currentMatchCount;
  const currentMatchCount = countMatchingPositions(nextSequence, puzzle.targetSequence);
  const matchDelta = currentMatchCount - previousMatchCount;
  const moveCount = state.moveCount + 1;
  const bestMatchCount = Math.max(state.bestMatchCount, currentMatchCount);
  const isCompleted = currentMatchCount === puzzle.bottleCount;

  const swapResult: SwapResult = Object.freeze({
    firstIndex,
    secondIndex,
    previousMatchCount,
    currentMatchCount,
    matchDelta,
    moveCount,
    isCompleted,
  });

  const nextState: PuzzleState = Object.freeze({
    puzzleId: state.puzzleId,
    currentSequence: nextSequence,
    selectedSlotIndex: null,
    moveCount,
    currentMatchCount,
    bestMatchCount,
    lastSwap: swapResult,
    status: isCompleted ? 'completed' : 'playing',
  });

  const events: GameEvent[] = [
    Object.freeze({
      type: 'BOTTLES_SWAPPED' as const,
      swap: swapResult,
      currentSequence: nextSequence,
    }),
  ];

  // Deterministic ordering: swap event always precedes completion event
  if (isCompleted) {
    events.push(
      Object.freeze({
        type: 'PUZZLE_COMPLETED' as const,
        puzzleId: puzzle.id,
        totalMoves: moveCount,
        totalBottleCount: puzzle.bottleCount,
      }),
    );
  }

  return acceptTransition(nextState, events);
}

/**
 * Pure, authoritative state-transition reducer for a Bottle Shuffle session.
 * Both tap-to-swap (SELECT_BOTTLE) and direct drag-and-drop (SWAP_BOTTLES) share
 * the exact same swap validation and state-transition logic.
 */
export function reduceGameState(
  puzzle: Puzzle,
  state: PuzzleState,
  action: GameAction,
): GameTransitionResult {
  switch (action.type) {
    case 'START_PUZZLE': {
      if (state.status !== 'ready') {
        return rejectTransition(
          state,
          action.type,
          'INVALID_STATE_TRANSITION',
          `Cannot start puzzle from "${state.status}" status; puzzle must be in "ready" status.`,
        );
      }

      const nextState: PuzzleState = Object.freeze({
        ...state,
        status: 'playing',
      });

      return acceptTransition(nextState, [
        Object.freeze({
          type: 'PUZZLE_STARTED',
          puzzleId: puzzle.id,
          initialMatchCount: nextState.currentMatchCount,
          totalBottleCount: puzzle.bottleCount,
        }),
      ]);
    }

    case 'SELECT_BOTTLE': {
      const check = validateSelectionRequest(
        state.status,
        action.slotIndex,
        state.currentSequence.length,
      );
      if (!check.valid) {
        return rejectTransition(state, action.type, check.reason, check.message);
      }

      if (state.selectedSlotIndex === null) {
        const nextState: PuzzleState = Object.freeze({
          ...state,
          selectedSlotIndex: action.slotIndex,
        });
        return acceptTransition(nextState, [
          Object.freeze({
            type: 'BOTTLE_SELECTED',
            slotIndex: action.slotIndex,
          }),
        ]);
      }

      if (state.selectedSlotIndex === action.slotIndex) {
        const previousSlotIndex = state.selectedSlotIndex;
        const nextState: PuzzleState = Object.freeze({
          ...state,
          selectedSlotIndex: null,
        });
        return acceptTransition(nextState, [
          Object.freeze({
            type: 'SELECTION_CLEARED',
            previousSlotIndex,
          }),
        ]);
      }

      return executeValidatedSwap(puzzle, state, state.selectedSlotIndex, action.slotIndex);
    }

    case 'CLEAR_SELECTION': {
      const statusCheck = validatePlayingStatus(state.status);
      if (!statusCheck.valid) {
        return rejectTransition(state, action.type, statusCheck.reason, statusCheck.message);
      }

      if (state.selectedSlotIndex === null) {
        return acceptTransition(state, []);
      }

      const previousSlotIndex = state.selectedSlotIndex;
      const nextState: PuzzleState = Object.freeze({
        ...state,
        selectedSlotIndex: null,
      });

      return acceptTransition(nextState, [
        Object.freeze({
          type: 'SELECTION_CLEARED',
          previousSlotIndex,
        }),
      ]);
    }

    case 'SWAP_BOTTLES': {
      const check = validateSwapRequest(
        state.status,
        action.firstIndex,
        action.secondIndex,
        state.currentSequence.length,
      );
      if (!check.valid) {
        return rejectTransition(state, action.type, check.reason, check.message);
      }

      return executeValidatedSwap(puzzle, state, action.firstIndex, action.secondIndex);
    }

    case 'PAUSE_PUZZLE': {
      if (state.status !== 'playing') {
        return rejectTransition(
          state,
          action.type,
          'INVALID_STATE_TRANSITION',
          `Cannot pause puzzle from "${state.status}" status; puzzle must be "playing".`,
        );
      }

      const events: GameEvent[] = [];
      if (state.selectedSlotIndex !== null) {
        events.push(
          Object.freeze({
            type: 'SELECTION_CLEARED' as const,
            previousSlotIndex: state.selectedSlotIndex,
          }),
        );
      }
      events.push(
        Object.freeze({
          type: 'PUZZLE_PAUSED' as const,
          puzzleId: puzzle.id,
        }),
      );

      const nextState: PuzzleState = Object.freeze({
        ...state,
        selectedSlotIndex: null,
        status: 'paused',
      });

      return acceptTransition(nextState, events);
    }

    case 'RESUME_PUZZLE': {
      if (state.status !== 'paused') {
        return rejectTransition(
          state,
          action.type,
          'INVALID_STATE_TRANSITION',
          `Cannot resume puzzle from "${state.status}" status; puzzle must be "paused".`,
        );
      }

      const nextState: PuzzleState = Object.freeze({
        ...state,
        status: 'playing',
      });

      return acceptTransition(nextState, [
        Object.freeze({
          type: 'PUZZLE_RESUMED',
          puzzleId: puzzle.id,
        }),
      ]);
    }

    case 'RESTART_PUZZLE': {
      const nextState = createRestartedGameState(puzzle);
      return acceptTransition(nextState, [
        Object.freeze({
          type: 'PUZZLE_RESTARTED',
          puzzleId: puzzle.id,
          initialMatchCount: nextState.currentMatchCount,
          totalBottleCount: puzzle.bottleCount,
        }),
      ]);
    }
  }
}
