import { describe, expect, it } from 'vitest';
import { GameEngine } from '../../../src/core/engine/GameEngine';
import { calculateCorrectMatches } from '../../../src/core/engine/MatchCalculator';
import { generatePuzzle } from '../../../src/core/engine/PuzzleGenerator';
import { calculateMinimumSwapDistance } from '../../../src/core/engine/SwapDistance';
import { GameError } from '../../../src/core/errors/GameError';
import { ALL_DIFFICULTY_DEFINITIONS } from '../../../src/core/levels/DifficultyConfig';
import type { BottleId } from '../../../src/core/models/BottleId';
import type { Puzzle } from '../../../src/core/models/Puzzle';

describe('GameEngine', () => {
  it('rejects invalid puzzle definitions at construction time', () => {
    const solvedPuzzle: Puzzle = {
      id: 'bad-solved',
      seed: 'bad',
      generatorVersion: '1.0.0',
      difficulty: 'beginner',
      bottleCount: 3,
      startingSequence: ['red', 'blue', 'green'],
      targetSequence: ['red', 'blue', 'green'],
    };

    expect(() => new GameEngine(solvedPuzzle)).toThrow(GameError);
    try {
      new GameEngine(solvedPuzzle);
    } catch (error) {
      expect(error).toBeInstanceOf(GameError);
      expect((error as GameError).code).toBe('INVALID_PUZZLE');
    }
  });

  it('keeps public state isolated from private target data and immutable across instances', () => {
    const puzzle = generatePuzzle({ difficulty: 'normal', seed: 'public-state-check' });
    const engineA = new GameEngine(puzzle);
    const engineB = new GameEngine(puzzle);

    engineA.start();
    engineA.swapBottles(0, 1);

    const pubA = engineA.getPublicState();
    const pubB = engineB.getPublicState();

    // Independent instances never share mutable state
    expect(pubA.moveCount).toBe(1);
    expect(pubB.moveCount).toBe(0);
    expect(pubB.status).toBe('ready');

    // Public state exposes only safe aggregate fields
    expect('targetSequence' in pubA).toBe(false);
    expect('seed' in pubA).toBe(false);
    expect('minimumSwapDistance' in pubA).toBe(false);
    expect('matchingIndices' in pubA).toBe(false);

    // Returned collections cannot mutate internal engine state
    expect(Object.isFrozen(pubA)).toBe(true);
    expect(Object.isFrozen(pubA.currentSequence)).toBe(true);
    expect(() => {
      (pubA.currentSequence as BottleId[])[0] = 'silver';
    }).toThrow(TypeError);
  });

  it('emits completion exactly once, blocks further swaps, and allows re-solving after restart', () => {
    const puzzle: Puzzle = {
      id: 'pzl-complete-restart',
      seed: 'complete-seed',
      generatorVersion: '1.0.0',
      difficulty: 'beginner',
      bottleCount: 3,
      startingSequence: ['blue', 'red', 'green'],
      targetSequence: ['red', 'blue', 'green'],
    };

    const engine = new GameEngine(puzzle);
    engine.start();

    const win1 = engine.swapBottles(0, 1);
    expect(win1.accepted).toBe(true);
    expect(win1.publicState.status).toBe('completed');
    expect(win1.events.map((e) => e.type)).toEqual(['BOTTLES_SWAPPED', 'PUZZLE_COMPLETED']);

    // Further swaps and pause/resume are rejected with zero duplicate completion events
    const afterSwap = engine.swapBottles(0, 2);
    expect(afterSwap.accepted).toBe(false);
    expect(afterSwap.rejectionReason).toBe('PUZZLE_ALREADY_COMPLETED');
    expect(afterSwap.events.some((e) => e.type === 'PUZZLE_COMPLETED')).toBe(false);
    expect(engine.pause().accepted).toBe(false);
    expect(engine.resume().accepted).toBe(false);

    // Restart preserves puzzle identity & starting sequence, resets moves and allows new completion
    const restarted = engine.restart();
    expect(restarted.accepted).toBe(true);
    expect(restarted.publicState.puzzleId).toBe(puzzle.id);
    expect(restarted.publicState.currentSequence).toEqual(puzzle.startingSequence);
    expect(restarted.publicState.moveCount).toBe(0);
    expect(restarted.publicState.selectedSlotIndex).toBeNull();
    expect(restarted.publicState.currentMatchCount).toBe(1);
    expect(restarted.publicState.bestMatchCount).toBe(1);
    expect(restarted.publicState.status).toBe('playing');

    const win2 = engine.swapBottles(0, 1);
    expect(win2.accepted).toBe(true);
    expect(win2.publicState.status).toBe('completed');
    expect(win2.events.map((e) => e.type)).toEqual(['BOTTLES_SWAPPED', 'PUZZLE_COMPLETED']);
  });

  it('programmatically solves 60 deterministic puzzles across all difficulties while preserving all invariants', () => {
    let puzzlesSolved = 0;
    let totalSwapsVerified = 0;

    for (const def of ALL_DIFFICULTY_DEFINITIONS) {
      for (let i = 0; i < 10; i += 1) {
        const puzzle = generatePuzzle({
          difficulty: def.id,
          seed: `solver-invariant-${def.id}-${String(i)}`,
        });
        const expectedMinSwaps = calculateMinimumSwapDistance(
          puzzle.startingSequence,
          puzzle.targetSequence,
        );

        const engine = new GameEngine(puzzle);
        expect(engine.start().accepted).toBe(true);

        // Exercise invalid actions mid-game to confirm they never corrupt state or moves
        expect(engine.swapBottles(0, 0).accepted).toBe(false);
        expect(engine.selectBottle(-1).accepted).toBe(false);
        expect(engine.getPublicState().moveCount).toBe(0);

        let previousBest = engine.getPublicState().bestMatchCount;
        let expectedMoves = 0;

        while (engine.getPublicState().status !== 'completed') {
          const current = engine.getPublicState().currentSequence;
          const mismatchIndex = current.findIndex((id, idx) => id !== puzzle.targetSequence[idx]);
          expect(mismatchIndex).toBeGreaterThanOrEqual(0);

          const neededId = puzzle.targetSequence[mismatchIndex];
          if (neededId === undefined) {
            expect.unreachable('Expected valid bottle ID at mismatch index');
          }
          const sourceIndex = current.indexOf(neededId);
          expect(sourceIndex).toBeGreaterThanOrEqual(0);

          // Alternate between tap-to-swap (selectBottle) and direct swapBottles
          const result =
            expectedMoves % 2 === 0
              ? (engine.selectBottle(mismatchIndex), engine.selectBottle(sourceIndex))
              : engine.swapBottles(mismatchIndex, sourceIndex);

          expect(result.accepted).toBe(true);
          expectedMoves += 1;
          totalSwapsVerified += 1;

          const pub = result.publicState;
          expect(pub.moveCount).toBe(expectedMoves);
          expect(pub.currentSequence).toHaveLength(puzzle.bottleCount);
          expect(new Set(pub.currentSequence).size).toBe(puzzle.bottleCount);
          expect([...pub.currentSequence].sort()).toEqual([...puzzle.targetSequence].sort());

          const refMatches = calculateCorrectMatches(pub.currentSequence, puzzle.targetSequence);
          expect(pub.currentMatchCount).toBe(refMatches);
          expect(pub.bestMatchCount).toBeGreaterThanOrEqual(previousBest);
          previousBest = pub.bestMatchCount;

          const swapEvent = result.events.find((e) => e.type === 'BOTTLES_SWAPPED');
          expect(swapEvent).toBeDefined();
          if (swapEvent?.type === 'BOTTLES_SWAPPED') {
            expect(swapEvent.swap.matchDelta).toBeGreaterThanOrEqual(-2);
            expect(swapEvent.swap.matchDelta).toBeLessThanOrEqual(2);
          }

          if (refMatches === puzzle.bottleCount) {
            expect(pub.status).toBe('completed');
            expect(result.events.map((e) => e.type)).toEqual([
              'BOTTLES_SWAPPED',
              'PUZZLE_COMPLETED',
            ]);
          } else {
            expect(pub.status).toBe('playing');
          }
        }

        // Cycle-guided greedy swapping always solves in the exact minimum swap distance!
        expect(engine.getPublicState().moveCount).toBe(expectedMinSwaps);
        puzzlesSolved += 1;
      }
    }

    expect(puzzlesSolved).toBe(60);
    expect(totalSwapsVerified).toBeGreaterThan(150);
  });
});
