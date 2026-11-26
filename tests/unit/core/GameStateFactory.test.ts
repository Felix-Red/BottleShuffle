import { describe, expect, it } from 'vitest';
import type { Puzzle } from '../../../src/core/models/Puzzle';
import {
  createReadyGameState,
  createRestartedGameState,
} from '../../../src/core/state/GameStateFactory';

const SAMPLE_PUZZLE: Puzzle = Object.freeze({
  id: 'pzl-normal-5-sample',
  seed: 'factory-seed',
  generatorVersion: '1.0.0',
  difficulty: 'normal',
  bottleCount: 5,
  // 2 initial matches: blue (index 1) and purple (index 4)
  startingSequence: Object.freeze(['green', 'blue', 'yellow', 'red', 'purple'] as const),
  targetSequence: Object.freeze(['red', 'blue', 'green', 'yellow', 'purple'] as const),
});

describe('GameStateFactory', () => {
  it('derives the initial match count from the puzzle rather than hardcoding zero', () => {
    const state = createReadyGameState(SAMPLE_PUZZLE);

    expect(state.puzzleId).toBe(SAMPLE_PUZZLE.id);
    expect(state.currentSequence).toEqual(SAMPLE_PUZZLE.startingSequence);
    expect(state.currentSequence).not.toBe(SAMPLE_PUZZLE.startingSequence);
    expect(state.selectedSlotIndex).toBeNull();
    expect(state.moveCount).toBe(0);
    expect(state.currentMatchCount).toBe(2);
    expect(state.bestMatchCount).toBe(2);
    expect(state.lastSwap).toBeNull();
    expect(state.status).toBe('ready');
    expect(Object.isFrozen(state)).toBe(true);
    expect(Object.isFrozen(state.currentSequence)).toBe(true);
  });

  it('creates a clean playing state when restarting an existing puzzle', () => {
    const restarted = createRestartedGameState(SAMPLE_PUZZLE);

    expect(restarted.status).toBe('playing');
    expect(restarted.currentSequence).toEqual(SAMPLE_PUZZLE.startingSequence);
    expect(restarted.moveCount).toBe(0);
    expect(restarted.selectedSlotIndex).toBeNull();
    expect(restarted.currentMatchCount).toBe(2);
    expect(restarted.bestMatchCount).toBe(2);
    expect(restarted.lastSwap).toBeNull();
  });
});
