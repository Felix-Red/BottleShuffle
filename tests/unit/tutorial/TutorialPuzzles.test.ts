import { describe, expect, it } from 'vitest';
import {
  calculateCorrectMatches,
  calculateMinimumSwapDistance,
  getAllTutorialPuzzles,
  getCounterDemoExamples,
  getTutorialPuzzle,
  isSequenceSolved,
  swapBottles,
  validatePuzzle,
} from '../../../src/core';

describe('TutorialPuzzleFactory & Fixtures', () => {
  it('provides valid, immutable, unsolved handcrafted tutorial puzzles passing PuzzleValidator', () => {
    const puzzles = getAllTutorialPuzzles();
    expect(puzzles).toHaveLength(4);

    for (const puzzle of puzzles) {
      const validation = validatePuzzle(puzzle);
      expect(validation.valid).toBe(true);
      expect(isSequenceSolved(puzzle.startingSequence, puzzle.targetSequence)).toBe(false);
      expect(Object.isFrozen(puzzle)).toBe(true);
      expect(Object.isFrozen(puzzle.startingSequence)).toBe(true);
      expect(Object.isFrozen(puzzle.targetSequence)).toBe(true);
    }

    // Guided 3-bottle puzzle: starts at 1/3 and solves in 1 swap (0, 1) -> 3/3
    const guided = getTutorialPuzzle('tutorial-guided-01');
    expect(calculateCorrectMatches(guided.startingSequence, guided.targetSequence)).toBe(1);
    const afterGuidedSwap = swapBottles(guided.startingSequence, 0, 1);
    expect(calculateCorrectMatches(afterGuidedSwap, guided.targetSequence)).toBe(3);
    expect(isSequenceSolved(afterGuidedSwap, guided.targetSequence)).toBe(true);

    // Independent 3-bottle puzzle: starts at 0/3 and requires 2 swaps to solve
    const independent = getTutorialPuzzle('tutorial-independent-01');
    expect(calculateCorrectMatches(independent.startingSequence, independent.targetSequence)).toBe(
      0,
    );
    expect(
      calculateMinimumSwapDistance(independent.startingSequence, independent.targetSequence),
    ).toBe(2);
  });

  it('verifies increasing, decreasing, and genuinely unchanged match counter demos via MatchCalculator', () => {
    const demos = getCounterDemoExamples();
    expect(demos).toHaveLength(3);

    const increase = demos.find((d) => d.id === 'increase');
    const decrease = demos.find((d) => d.id === 'decrease');
    const unchanged = demos.find((d) => d.id === 'unchanged');

    expect(increase).toMatchObject({
      matchesBefore: 1,
      matchesAfter: 3,
      delta: 2,
      totalBottles: 3,
    });
    expect(decrease).toMatchObject({
      matchesBefore: 2,
      matchesAfter: 1,
      delta: -1,
      totalBottles: 4,
    });
    expect(unchanged).toMatchObject({
      matchesBefore: 0,
      matchesAfter: 0,
      delta: 0,
      totalBottles: 4,
    });
  });
});
