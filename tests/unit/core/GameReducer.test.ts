import { describe, expect, it } from 'vitest';
import type { Puzzle } from '../../../src/core/models/Puzzle';
import { reduceGameState } from '../../../src/core/state/GameReducer';
import { createReadyGameState } from '../../../src/core/state/GameStateFactory';

function makePuzzle(
  startingSequence: readonly ('red' | 'blue' | 'green' | 'yellow' | 'purple')[],
  targetSequence: readonly ('red' | 'blue' | 'green' | 'yellow' | 'purple')[],
): Puzzle {
  return Object.freeze({
    id: 'pzl-reducer-test',
    seed: 'reducer-seed',
    generatorVersion: '1.0.0',
    difficulty: 'normal',
    bottleCount: targetSequence.length,
    startingSequence: Object.freeze([...startingSequence]),
    targetSequence: Object.freeze([...targetSequence]),
  });
}

describe('GameReducer', () => {
  it('supports every valid match delta outcome: +2, +1, 0, -1, and -2 while tracking best matches', () => {
    // Target: [red, blue, green, yellow, purple]
    // Start:  [blue, red, yellow, green, purple] -> 1 match (purple at index 4)
    const puzzle = makePuzzle(
      ['blue', 'red', 'yellow', 'green', 'purple'],
      ['red', 'blue', 'green', 'yellow', 'purple'],
    );
    let state = reduceGameState(puzzle, createReadyGameState(puzzle), {
      type: 'START_PUZZLE',
    }).state;
    expect(state.currentMatchCount).toBe(1);
    expect(state.bestMatchCount).toBe(1);

    // +2: swap indices 0 and 1 (blue <-> red) -> [red, blue, yellow, green, purple] (3 matches)
    const plusTwo = reduceGameState(puzzle, state, {
      type: 'SWAP_BOTTLES',
      firstIndex: 0,
      secondIndex: 1,
    });
    expect(plusTwo.accepted).toBe(true);
    expect(plusTwo.state.lastSwap?.matchDelta).toBe(2);
    expect(plusTwo.state.currentMatchCount).toBe(3);
    expect(plusTwo.state.bestMatchCount).toBe(3);
    state = plusTwo.state;

    // -2: swap indices 0 and 1 back -> [blue, red, yellow, green, purple] (1 match; best stays 3)
    const minusTwo = reduceGameState(puzzle, state, {
      type: 'SWAP_BOTTLES',
      firstIndex: 0,
      secondIndex: 1,
    });
    expect(minusTwo.state.lastSwap?.matchDelta).toBe(-2);
    expect(minusTwo.state.currentMatchCount).toBe(1);
    expect(minusTwo.state.bestMatchCount).toBe(3);
    state = minusTwo.state;

    // 0: swap indices 0 and 2 (blue <-> yellow) -> [yellow, red, blue, green, purple] (still 1 match)
    const zeroDelta = reduceGameState(puzzle, state, {
      type: 'SWAP_BOTTLES',
      firstIndex: 0,
      secondIndex: 2,
    });
    expect(zeroDelta.state.lastSwap?.matchDelta).toBe(0);
    expect(zeroDelta.state.currentMatchCount).toBe(1);
    state = zeroDelta.state;

    // +1: swap indices 1 and 2 (red <-> blue) -> [yellow, blue, red, green, purple] (2 matches: blue, purple)
    const plusOne = reduceGameState(puzzle, state, {
      type: 'SWAP_BOTTLES',
      firstIndex: 1,
      secondIndex: 2,
    });
    expect(plusOne.state.lastSwap?.matchDelta).toBe(1);
    expect(plusOne.state.currentMatchCount).toBe(2);
    state = plusOne.state;

    // -1: move correctly positioned bottle (purple at 4) with yellow at 0 -> [purple, blue, red, green, yellow] (1 match: blue)
    const minusOne = reduceGameState(puzzle, state, {
      type: 'SWAP_BOTTLES',
      firstIndex: 0,
      secondIndex: 4,
    });
    expect(minusOne.state.lastSwap?.matchDelta).toBe(-1);
    expect(minusOne.state.currentMatchCount).toBe(1);
    expect(minusOne.state.bestMatchCount).toBe(3);
  });

  it('handles bottle selection, deselecting same bottle, swapping on second selection, and clear selection', () => {
    const puzzle = makePuzzle(
      ['blue', 'red', 'green', 'yellow', 'purple'],
      ['red', 'blue', 'green', 'yellow', 'purple'],
    );
    let state = reduceGameState(puzzle, createReadyGameState(puzzle), {
      type: 'START_PUZZLE',
    }).state;

    // First select -> no move increment
    const s1 = reduceGameState(puzzle, state, { type: 'SELECT_BOTTLE', slotIndex: 0 });
    expect(s1.accepted).toBe(true);
    expect(s1.state.selectedSlotIndex).toBe(0);
    expect(s1.state.moveCount).toBe(0);
    expect(s1.events[0]?.type).toBe('BOTTLE_SELECTED');
    state = s1.state;

    // Selecting same bottle clears selection -> no move increment
    const deselect = reduceGameState(puzzle, state, { type: 'SELECT_BOTTLE', slotIndex: 0 });
    expect(deselect.accepted).toBe(true);
    expect(deselect.state.selectedSlotIndex).toBeNull();
    expect(deselect.state.moveCount).toBe(0);
    expect(deselect.events[0]?.type).toBe('SELECTION_CLEARED');
    state = deselect.state;

    // Explicit clear selection
    state = reduceGameState(puzzle, state, { type: 'SELECT_BOTTLE', slotIndex: 2 }).state;
    const cleared = reduceGameState(puzzle, state, { type: 'CLEAR_SELECTION' });
    expect(cleared.accepted).toBe(true);
    expect(cleared.state.selectedSlotIndex).toBeNull();
    expect(cleared.events[0]?.type).toBe('SELECTION_CLEARED');
    state = cleared.state;

    // Invalid selection preserves state
    const invalidSel = reduceGameState(puzzle, state, { type: 'SELECT_BOTTLE', slotIndex: 9 });
    expect(invalidSel.accepted).toBe(false);
    expect(invalidSel.rejectionReason).toBe('INVALID_SLOT_INDEX');
    expect(invalidSel.state).toBe(state);

    // Select 0 then select 1 -> swaps and completes puzzle in deterministic event order
    state = reduceGameState(puzzle, state, { type: 'SELECT_BOTTLE', slotIndex: 0 }).state;
    const winning = reduceGameState(puzzle, state, { type: 'SELECT_BOTTLE', slotIndex: 1 });
    expect(winning.accepted).toBe(true);
    expect(winning.state.selectedSlotIndex).toBeNull();
    expect(winning.state.moveCount).toBe(1);
    expect(winning.state.status).toBe('completed');
    expect(winning.events.map((e) => e.type)).toEqual(['BOTTLES_SWAPPED', 'PUZZLE_COMPLETED']);
  });

  it('enforces all lifecycle transition rules and clears active selection on pause', () => {
    const puzzle = makePuzzle(
      ['blue', 'red', 'green', 'yellow', 'purple'],
      ['red', 'blue', 'green', 'yellow', 'purple'],
    );
    const ready = createReadyGameState(puzzle);

    // Ready rejects select, swap, pause, resume
    expect(
      reduceGameState(puzzle, ready, { type: 'SELECT_BOTTLE', slotIndex: 0 }).rejectionReason,
    ).toBe('PUZZLE_NOT_STARTED');
    expect(
      reduceGameState(puzzle, ready, { type: 'SWAP_BOTTLES', firstIndex: 0, secondIndex: 1 })
        .rejectionReason,
    ).toBe('PUZZLE_NOT_STARTED');
    expect(reduceGameState(puzzle, ready, { type: 'RESUME_PUZZLE' }).rejectionReason).toBe(
      'INVALID_STATE_TRANSITION',
    );
    expect(reduceGameState(puzzle, ready, { type: 'PAUSE_PUZZLE' }).rejectionReason).toBe(
      'INVALID_STATE_TRANSITION',
    );

    // Start -> Playing -> Select -> Pause clears selection
    let state = reduceGameState(puzzle, ready, { type: 'START_PUZZLE' }).state;
    state = reduceGameState(puzzle, state, { type: 'SELECT_BOTTLE', slotIndex: 1 }).state;

    const paused = reduceGameState(puzzle, state, { type: 'PAUSE_PUZZLE' });
    expect(paused.accepted).toBe(true);
    expect(paused.state.status).toBe('paused');
    expect(paused.state.selectedSlotIndex).toBeNull();
    expect(paused.events.map((e) => e.type)).toEqual(['SELECTION_CLEARED', 'PUZZLE_PAUSED']);

    // Paused rejects select & swap
    expect(
      reduceGameState(puzzle, paused.state, { type: 'SELECT_BOTTLE', slotIndex: 0 })
        .rejectionReason,
    ).toBe('PUZZLE_PAUSED');
    expect(
      reduceGameState(puzzle, paused.state, {
        type: 'SWAP_BOTTLES',
        firstIndex: 0,
        secondIndex: 1,
      }).rejectionReason,
    ).toBe('PUZZLE_PAUSED');

    // Resume -> Playing
    const resumed = reduceGameState(puzzle, paused.state, { type: 'RESUME_PUZZLE' });
    expect(resumed.accepted).toBe(true);
    expect(resumed.state.status).toBe('playing');
  });
});
