import { GameError } from '../errors/GameError';
import { PuzzleError } from '../errors/PuzzleError';
import {
  DEFAULT_CLASSIC_OBJECTIVE,
  resolveChallengeObjective,
  validateChallengeObjective,
  type LevelChallengeObjective,
} from '../models/ChallengeMode';
import type { DifficultyId } from '../models/Difficulty';
import type { GameAction } from '../models/GameAction';
import type { GameTransitionResult } from '../models/GameEvent';
import { toPublicGameState, type PublicGameState } from '../models/PublicGameState';
import type { Puzzle } from '../models/Puzzle';
import type { PuzzleState } from '../models/PuzzleState';
import { reduceGameState } from '../state/GameReducer';
import { createReadyGameState } from '../state/GameStateFactory';
import { assertValidPuzzle } from './PuzzleValidator';
import { calculateMinimumSwapDistance } from './SwapDistance';

export interface CompletedPuzzleScoringMetadata {
  readonly puzzleId: string;
  readonly difficulty: DifficultyId;
  readonly bottleCount: number;
  readonly minimumRequiredSwaps: number;
}

function cloneFrozenPuzzle(puzzle: Puzzle): Puzzle {
  return Object.freeze({
    id: puzzle.id,
    seed: puzzle.seed,
    generatorVersion: puzzle.generatorVersion,
    difficulty: puzzle.difficulty,
    bottleCount: puzzle.bottleCount,
    startingSequence: Object.freeze([...puzzle.startingSequence]),
    targetSequence: Object.freeze([...puzzle.targetSequence]),
  });
}

/**
 * Self-contained pure TypeScript session orchestrator for a single Bottle Shuffle puzzle.
 * Supports Classic, Timed, Limited Moves, and Combined challenges uniformly while retaining
 * the private Puzzle definition internally and exposing only PublicGameState.
 */
export class GameEngine {
  private readonly puzzle: Puzzle;
  private state: PuzzleState;

  public constructor(
    puzzle: Puzzle,
    objective: Partial<LevelChallengeObjective> = DEFAULT_CLASSIC_OBJECTIVE,
  ) {
    try {
      assertValidPuzzle(puzzle);
    } catch (error) {
      if (error instanceof PuzzleError) {
        throw new GameError('INVALID_PUZZLE', error.message, {
          causeCode: error.code,
          ...(error.details ?? {}),
        });
      }
      throw error;
    }

    const resolvedObjective = resolveChallengeObjective(objective);
    const minSwaps = calculateMinimumSwapDistance(puzzle.startingSequence, puzzle.targetSequence);
    const objectiveErrors = validateChallengeObjective(resolvedObjective, minSwaps);
    if (objectiveErrors.length > 0) {
      throw new GameError(
        'INVALID_PUZZLE',
        objectiveErrors[0] ?? 'Invalid challenge objective configuration.',
        { errors: objectiveErrors },
      );
    }

    this.puzzle = cloneFrozenPuzzle(puzzle);
    this.state = createReadyGameState(this.puzzle, resolvedObjective);
  }

  public getPublicState(): PublicGameState {
    return toPublicGameState(this.state);
  }

  /**
   * Returns original puzzle minimumRequiredSwaps and scoring metadata ONLY after
   * the puzzle reaches the 'completed' status, keeping swap distance private during play
   * and preventing failed attempts from producing scoring records.
   */
  public getCompletedScoringMetadata(): CompletedPuzzleScoringMetadata | null {
    if (this.state.status !== 'completed') {
      return null;
    }
    return Object.freeze({
      puzzleId: this.puzzle.id,
      difficulty: this.puzzle.difficulty,
      bottleCount: this.puzzle.bottleCount,
      minimumRequiredSwaps: calculateMinimumSwapDistance(
        this.puzzle.startingSequence,
        this.puzzle.targetSequence,
      ),
    });
  }

  public dispatch(action: GameAction): GameTransitionResult {
    const result = reduceGameState(this.puzzle, this.state, action);
    if (result.accepted) {
      this.state = result.state;
    }
    return result;
  }

  public start(): GameTransitionResult {
    return this.dispatch({ type: 'START_PUZZLE' });
  }

  public selectBottle(slotIndex: number): GameTransitionResult {
    return this.dispatch({ type: 'SELECT_BOTTLE', slotIndex });
  }

  public clearSelection(): GameTransitionResult {
    return this.dispatch({ type: 'CLEAR_SELECTION' });
  }

  public swapBottles(firstIndex: number, secondIndex: number): GameTransitionResult {
    return this.dispatch({ type: 'SWAP_BOTTLES', firstIndex, secondIndex });
  }

  public expireTimer(): GameTransitionResult {
    return this.dispatch({ type: 'EXPIRE_TIMER' });
  }

  public pause(): GameTransitionResult {
    return this.dispatch({ type: 'PAUSE_PUZZLE' });
  }

  public resume(): GameTransitionResult {
    return this.dispatch({ type: 'RESUME_PUZZLE' });
  }

  public restart(): GameTransitionResult {
    return this.dispatch({ type: 'RESTART_PUZZLE' });
  }
}
