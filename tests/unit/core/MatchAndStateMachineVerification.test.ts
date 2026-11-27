import { describe, expect, it } from 'vitest';
import {
  calculateCorrectMatches,
  CANONICAL_BOTTLE_IDS,
  createSeededRandom,
  DIFFICULTY_IDS,
  GameEngine,
  generatePuzzle,
  swapBottles,
  type BottleId,
} from '../../../src/core';

/** Independent reference match counter for differential verification. */
function referenceMatchCount(current: readonly BottleId[], target: readonly BottleId[]): number {
  let matches = 0;
  for (let i = 0; i < current.length; i += 1) {
    if (current[i] === target[i]) {
      matches += 1;
    }
  }
  return matches;
}

/** Generates all n! permutations of a small sequence. */
function generateAllPermutations(items: readonly BottleId[]): BottleId[][] {
  if (items.length <= 1) {
    return [[...items]];
  }
  const results: BottleId[][] = [];
  for (let i = 0; i < items.length; i += 1) {
    const head = items[i];
    if (head === undefined) continue;
    const rest = [...items.slice(0, i), ...items.slice(i + 1)];
    for (const tail of generateAllPermutations(rest)) {
      results.push([head, ...tail]);
    }
  }
  return results;
}

describe('Match calculation & gameplay state-machine exhaustive verification (Task 19)', () => {
  it('exhaustively verifies all permutations for 3, 4, and 5 bottles against reference implementation and |delta| <= 2 invariant', () => {
    for (const size of [3, 4, 5]) {
      const target = CANONICAL_BOTTLE_IDS.slice(0, size);
      const perms = generateAllPermutations(target);
      let sawZero = false;
      let sawOne = false;
      let sawMultiple = false;
      let sawAll = false;
      let sawIncrease = false;
      let sawDecrease = false;
      let sawUnchanged = false;

      for (const perm of perms) {
        const expected = referenceMatchCount(perm, target);
        const actual = calculateCorrectMatches(perm, target);
        expect(actual).toBe(expected);

        if (actual === 0) sawZero = true;
        if (actual === 1) sawOne = true;
        if (actual >= 2 && actual < size) sawMultiple = true;
        if (actual === size) sawAll = true;

        // Verify every distinct swap pair (i, j) satisfies |delta| <= 2
        for (let i = 0; i < size; i += 1) {
          for (let j = i + 1; j < size; j += 1) {
            const swapped = swapBottles(perm, i, j);
            const nextMatches = calculateCorrectMatches(swapped, target);
            expect(nextMatches).toBe(referenceMatchCount(swapped, target));
            const delta = nextMatches - actual;
            expect(Math.abs(delta)).toBeLessThanOrEqual(2);

            if (delta > 0) sawIncrease = true;
            if (delta < 0) sawDecrease = true;
            if (delta === 0) sawUnchanged = true;
          }
        }
      }

      expect(sawZero).toBe(true);
      expect(sawOne).toBe(true);
      if (size >= 4) {
        expect(sawMultiple).toBe(true);
      }
      expect(sawAll).toBe(true);
      expect(sawIncrease).toBe(true);
      expect(sawDecrease).toBe(true);
      if (size >= 4) {
        expect(sawUnchanged).toBe(true);
      }
    }
  });

  it('verifies sampled 6, 8, and 10 bottle permutations including first/last, adjacent, and nonadjacent swaps', () => {
    const rng = createSeededRandom('qa-match-sampling-v1');
    for (const size of [6, 8, 10]) {
      const target = CANONICAL_BOTTLE_IDS.slice(0, size);
      for (let sample = 0; sample < 60; sample += 1) {
        const perm = [...target];
        for (let i = perm.length - 1; i > 0; i -= 1) {
          const j = Math.floor(rng.next() * (i + 1));
          const a = perm[i];
          const b = perm[j];
          if (a !== undefined && b !== undefined) {
            perm[i] = b;
            perm[j] = a;
          }
        }
        const base = calculateCorrectMatches(perm, target);
        expect(base).toBe(referenceMatchCount(perm, target));

        // Adjacent, non-adjacent, and first-last swaps
        for (const [i, j] of [
          [0, 1],
          [0, size - 1],
          [1, size - 2],
        ] as const) {
          const swapped = swapBottles(perm, i, j);
          const next = calculateCorrectMatches(swapped, target);
          expect(next).toBe(referenceMatchCount(swapped, target));
          expect(Math.abs(next - base)).toBeLessThanOrEqual(2);
        }
      }
    }
  });

  it('never exposes targetSequence, seed, or per-slot match indicators in PublicGameState', () => {
    const puzzle = generatePuzzle({ difficulty: 'expert', seed: 'qa-privacy-check' });
    const engine = new GameEngine(puzzle);
    engine.start();

    const pub = engine.getPublicState();
    const keys = Object.keys(pub);
    expect(keys).not.toContain('targetSequence');
    expect(keys).not.toContain('seed');
    expect(keys).not.toContain('minimumSwapDistance');
    expect(JSON.stringify(pub)).not.toContain('qa-privacy-check');
  });

  it('preserves every state-machine invariant across 150 seeded randomised action sequences', () => {
    const rng = createSeededRandom('qa-state-machine-fuzz-v1');

    for (let run = 0; run < 150; run += 1) {
      const difficulty = DIFFICULTY_IDS[run % DIFFICULTY_IDS.length] ?? 'normal';
      const puzzle = generatePuzzle({ difficulty, seed: `qa-fuzz-${String(run)}` });
      const engine = new GameEngine(puzzle);

      // Invalid actions before start must not mutate state
      const preStart = engine.selectBottle(0);
      expect(preStart.accepted).toBe(false);
      expect(engine.getPublicState().status).toBe('ready');
      expect(engine.getPublicState().moveCount).toBe(0);

      engine.start();
      let expectedMoves = 0;
      let completionEvents = 0;

      for (let step = 0; step < 35; step += 1) {
        const before = engine.getPublicState();
        const op = Math.floor(rng.next() * 10);

        if (op <= 4) {
          // Valid bottle index tap
          const slot = Math.floor(rng.next() * puzzle.bottleCount);
          const res = engine.selectBottle(slot);
          const after = engine.getPublicState();

          if (before.status !== 'playing') {
            expect(res.accepted).toBe(false);
            expect(after.moveCount).toBe(expectedMoves);
          } else if (before.selectedSlotIndex === null) {
            expect(res.accepted).toBe(true);
            expect(after.selectedSlotIndex).toBe(slot);
            expect(after.moveCount).toBe(expectedMoves);
          } else if (before.selectedSlotIndex === slot) {
            // Deselect does not increment moves
            expect(res.accepted).toBe(true);
            expect(after.selectedSlotIndex).toBeNull();
            expect(after.moveCount).toBe(expectedMoves);
          } else {
            // Accepted swap increments moves exactly once
            expect(res.accepted).toBe(true);
            expectedMoves += 1;
            expect(after.moveCount).toBe(expectedMoves);
            expect(after.selectedSlotIndex).toBeNull();
            for (const ev of res.events) {
              if (ev.type === 'PUZZLE_COMPLETED') completionEvents += 1;
            }
          }
        } else if (op === 5) {
          // Invalid out-of-bounds index must never mutate state
          const res = engine.selectBottle(puzzle.bottleCount + 5);
          expect(res.accepted).toBe(false);
          expect(engine.getPublicState().moveCount).toBe(expectedMoves);
        } else if (op === 6) {
          engine.clearSelection();
          expect(engine.getPublicState().moveCount).toBe(expectedMoves);
        } else if (op === 7) {
          if (before.status === 'playing') {
            expect(engine.pause().accepted).toBe(true);
            expect(engine.getPublicState().status).toBe('paused');
          } else if (before.status === 'paused') {
            expect(engine.resume().accepted).toBe(true);
            expect(engine.getPublicState().status).toBe('playing');
          }
        } else if (op === 8 && before.status !== 'completed') {
          const res = engine.restart();
          expect(res.accepted).toBe(true);
          expectedMoves = 0;
          expect(engine.getPublicState().currentSequence).toEqual(puzzle.startingSequence);
          expect(engine.getPublicState().moveCount).toBe(0);
        }
      }

      // If completed, further swaps must be rejected and completion count must be 1
      if (engine.getPublicState().status === 'completed') {
        expect(completionEvents).toBe(1);
        expect(engine.selectBottle(0).accepted).toBe(false);
        expect(engine.getPublicState().moveCount).toBe(expectedMoves);
      }
    }
  });
});
