import type { ActionRejectionReason } from '../errors/GameError';
import type { BottleId } from './BottleId';
import type { AttemptFailureReason } from './ChallengeMode';
import type { GameActionType } from './GameAction';
import type { PublicGameState } from './PublicGameState';
import type { PuzzleState } from './PuzzleState';
import type { SwapResult } from './SwapResult';

export type GameEvent =
  | {
      readonly type: 'PUZZLE_STARTED';
      readonly puzzleId: string;
      readonly initialMatchCount: number;
      readonly totalBottleCount: number;
    }
  | {
      readonly type: 'BOTTLE_SELECTED';
      readonly slotIndex: number;
    }
  | {
      readonly type: 'SELECTION_CLEARED';
      readonly previousSlotIndex: number;
    }
  | {
      readonly type: 'BOTTLES_SWAPPED';
      readonly swap: SwapResult;
      readonly currentSequence: readonly BottleId[];
    }
  | {
      readonly type: 'PUZZLE_PAUSED';
      readonly puzzleId: string;
    }
  | {
      readonly type: 'PUZZLE_RESUMED';
      readonly puzzleId: string;
    }
  | {
      readonly type: 'PUZZLE_RESTARTED';
      readonly puzzleId: string;
      readonly initialMatchCount: number;
      readonly totalBottleCount: number;
    }
  | {
      readonly type: 'PUZZLE_COMPLETED';
      readonly puzzleId: string;
      readonly totalMoves: number;
      readonly totalBottleCount: number;
    }
  | {
      readonly type: 'PUZZLE_FAILED';
      readonly puzzleId: string;
      readonly reason: AttemptFailureReason;
      readonly totalMoves: number;
      readonly finalMatchCount: number;
      readonly totalBottleCount: number;
    }
  | {
      readonly type: 'ACTION_REJECTED';
      readonly actionType: GameActionType;
      readonly reason: ActionRejectionReason;
      readonly message: string;
    };

export interface GameTransitionResult {
  readonly state: PuzzleState;
  readonly publicState: PublicGameState;
  readonly accepted: boolean;
  readonly events: readonly GameEvent[];
  readonly rejectionReason?: ActionRejectionReason;
  readonly rejectionMessage?: string;
}
