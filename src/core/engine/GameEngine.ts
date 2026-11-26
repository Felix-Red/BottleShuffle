import { GameError } from '../errors/GameError';
import { PuzzleError } from '../errors/PuzzleError';
import type { GameAction } from '../models/GameAction';
import type { GameTransitionResult } from '../models/GameEvent';
import { toPublicGameState, type PublicGameState } from '../models/PublicGameState';
import type { Puzzle } from '../models/Puzzle';
import type { PuzzleState } from '../models/PuzzleState';
import { reduceGameState } from '../state/GameReducer';
import { createReadyGameState } from '../state/GameStateFactory';
import { assertValidPuzzle } from './PuzzleValidator';

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
 * Retains the private Puzzle definition internally and exposes only PublicGameState
 * and typed GameTransitionResult objects to callers.
 */
export class GameEngine {
  private readonly puzzle: Puzzle;
  private state: PuzzleState;

  public constructor(puzzle: Puzzle) {
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

    this.puzzle = cloneFrozenPuzzle(puzzle);
    this.state = createReadyGameState(this.puzzle);
  }

  public getPublicState(): PublicGameState {
    return toPublicGameState(this.state);
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
