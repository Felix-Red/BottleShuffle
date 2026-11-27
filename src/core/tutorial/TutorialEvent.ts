import type { TutorialPuzzleId, TutorialStageId } from './TutorialStep';
import type { TutorialState } from './TutorialState';

export type TutorialRejectionReason =
  'INVALID_STAGE' | 'AWAITING_ANIMATION' | 'WRONG_BOTTLE_TARGET' | 'ALREADY_TERMINATED';

export type TutorialEvent =
  | { readonly type: 'TUTORIAL_STARTED'; readonly stage: TutorialStageId }
  | {
      readonly type: 'STAGE_CHANGED';
      readonly previousStage: TutorialStageId;
      readonly nextStage: TutorialStageId;
    }
  | { readonly type: 'PUZZLE_CHANGED'; readonly puzzleId: TutorialPuzzleId }
  | {
      readonly type: 'COUNTER_DEMO_SWAP_REQUESTED';
      readonly puzzleId: TutorialPuzzleId;
      readonly firstIndex: number;
      readonly secondIndex: number;
    }
  | { readonly type: 'TUTORIAL_COMPLETED' }
  | { readonly type: 'TUTORIAL_SKIPPED'; readonly fromStage: TutorialStageId }
  | {
      readonly type: 'TUTORIAL_ACTION_REJECTED';
      readonly reason: TutorialRejectionReason;
    };

export interface TutorialTransitionResult {
  readonly accepted: boolean;
  readonly state: TutorialState;
  readonly events: readonly TutorialEvent[];
  readonly rejectionReason?: TutorialRejectionReason;
}
