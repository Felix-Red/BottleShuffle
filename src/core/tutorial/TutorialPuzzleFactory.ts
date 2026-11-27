import { swapBottles } from '../engine/BottleSwapper';
import { calculateCorrectMatches } from '../engine/MatchCalculator';
import { PUZZLE_GENERATOR_VERSION } from '../engine/PuzzleGenerator';
import { assertValidPuzzle } from '../engine/PuzzleValidator';
import type { BottleId } from '../models/BottleId';
import type { DifficultyId } from '../models/Difficulty';
import type { Puzzle } from '../models/Puzzle';
import type { TutorialPuzzleId } from './TutorialStep';

interface TutorialFixtureSpec {
  readonly id: TutorialPuzzleId;
  readonly seed: string;
  readonly difficulty: DifficultyId;
  readonly startingSequence: readonly BottleId[];
  readonly targetSequence: readonly BottleId[];
}

export interface CounterDemoExample {
  readonly id: 'increase' | 'decrease' | 'unchanged';
  readonly label: string;
  readonly puzzleId: TutorialPuzzleId;
  readonly swapIndices: readonly [number, number];
  readonly matchesBefore: number;
  readonly matchesAfter: number;
  readonly delta: number;
  readonly totalBottles: number;
}

const TUTORIAL_FIXTURE_SPECS: Readonly<Record<TutorialPuzzleId, TutorialFixtureSpec>> = {
  /**
   * Stage 1–3 guided 3-bottle puzzle.
   * Target: [red, blue, green], Starting: [blue, red, green] -> 1/3 matches.
   * Swapping slots 0 and 1 solves the puzzle directly (1/3 -> 3/3).
   */
  'tutorial-guided-01': {
    id: 'tutorial-guided-01',
    seed: 'tutorial-guided-01',
    difficulty: 'beginner',
    startingSequence: Object.freeze(['blue', 'red', 'green']),
    targetSequence: Object.freeze(['red', 'blue', 'green']),
  },

  /**
   * Stage 4 decreasing-match 4-bottle demonstration.
   * Target: [red, blue, green, yellow], Starting: [red, green, blue, yellow] -> 2/4 matches.
   * Swapping slots 0 and 1 yields [green, red, blue, yellow] -> 1/4 matches (delta -1).
   */
  'tutorial-counter-decrease': {
    id: 'tutorial-counter-decrease',
    seed: 'tutorial-counter-decrease',
    difficulty: 'easy',
    startingSequence: Object.freeze(['red', 'green', 'blue', 'yellow']),
    targetSequence: Object.freeze(['red', 'blue', 'green', 'yellow']),
  },

  /**
   * Stage 4 unchanged-match 4-bottle demonstration.
   * Target: [red, blue, green, yellow], Starting: [blue, green, yellow, red] -> 0/4 matches.
   * Swapping slots 0 and 2 yields [yellow, green, blue, red] -> 0/4 matches (delta 0).
   */
  'tutorial-counter-unchanged': {
    id: 'tutorial-counter-unchanged',
    seed: 'tutorial-counter-unchanged',
    difficulty: 'easy',
    startingSequence: Object.freeze(['blue', 'green', 'yellow', 'red']),
    targetSequence: Object.freeze(['red', 'blue', 'green', 'yellow']),
  },

  /**
   * Stage 5 independent 3-bottle puzzle.
   * Target: [red, blue, green], Starting: [green, red, blue] -> 0/3 matches.
   * Requires at least 2 swaps; lets the player experience match feedback freely.
   */
  'tutorial-independent-01': {
    id: 'tutorial-independent-01',
    seed: 'tutorial-independent-01',
    difficulty: 'beginner',
    startingSequence: Object.freeze(['green', 'red', 'blue']),
    targetSequence: Object.freeze(['red', 'blue', 'green']),
  },
};

const VALIDATED_TUTORIAL_PUZZLES: ReadonlyMap<TutorialPuzzleId, Puzzle> = buildValidatedFixtures();

function buildValidatedFixtures(): ReadonlyMap<TutorialPuzzleId, Puzzle> {
  const map = new Map<TutorialPuzzleId, Puzzle>();

  for (const spec of Object.values(TUTORIAL_FIXTURE_SPECS)) {
    const puzzle: Puzzle = Object.freeze({
      id: spec.id,
      seed: spec.seed,
      generatorVersion: PUZZLE_GENERATOR_VERSION,
      difficulty: spec.difficulty,
      bottleCount: spec.startingSequence.length,
      startingSequence: Object.freeze([...spec.startingSequence]),
      targetSequence: Object.freeze([...spec.targetSequence]),
    });

    assertValidPuzzle(puzzle);
    map.set(spec.id, puzzle);
  }

  return map;
}

/**
 * Returns an immutable, pre-validated handcrafted tutorial puzzle by stable identifier.
 */
export function getTutorialPuzzle(puzzleId: TutorialPuzzleId): Puzzle {
  const puzzle = VALIDATED_TUTORIAL_PUZZLES.get(puzzleId);
  if (puzzle === undefined) {
    throw new Error(`Unknown tutorial puzzle identifier: "${puzzleId}".`);
  }
  return puzzle;
}

export function getAllTutorialPuzzles(): readonly Puzzle[] {
  return Object.freeze([...VALIDATED_TUTORIAL_PUZZLES.values()]);
}

function computeDemoExample(
  id: CounterDemoExample['id'],
  label: string,
  puzzleId: TutorialPuzzleId,
  swapIndices: readonly [number, number],
): CounterDemoExample {
  const puzzle = getTutorialPuzzle(puzzleId);
  const matchesBefore = calculateCorrectMatches(puzzle.startingSequence, puzzle.targetSequence);
  const swapped = swapBottles(puzzle.startingSequence, swapIndices[0], swapIndices[1]);
  const matchesAfter = calculateCorrectMatches(swapped, puzzle.targetSequence);

  return Object.freeze({
    id,
    label,
    puzzleId,
    swapIndices,
    matchesBefore,
    matchesAfter,
    delta: matchesAfter - matchesBefore,
    totalBottles: puzzle.bottleCount,
  });
}

const VALIDATED_COUNTER_DEMO_EXAMPLES: readonly CounterDemoExample[] = Object.freeze([
  computeDemoExample('increase', 'Increase', 'tutorial-guided-01', [0, 1]),
  computeDemoExample('decrease', 'Decrease', 'tutorial-counter-decrease', [0, 1]),
  computeDemoExample('unchanged', 'No change', 'tutorial-counter-unchanged', [0, 2]),
]);

/**
 * Returns MatchCalculator-verified counter demonstration outcomes (increase, decrease, unchanged)
 * so presentation never hardcodes match counts.
 */
export function getCounterDemoExamples(): readonly CounterDemoExample[] {
  return VALIDATED_COUNTER_DEMO_EXAMPLES;
}
