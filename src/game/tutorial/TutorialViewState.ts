import type {
  BottleId,
  CounterDemoExample,
  LevelId,
  PuzzleStatus,
  TutorialHighlightTarget,
  TutorialPuzzleId,
  TutorialStageId,
} from '../../core';
import type { GameplayReturnDestination } from '../gameplay/GameplaySceneData';
import type { GameplayOverlayMode, MatchFeedbackView } from '../gameplay/GameplayViewState';

export type TutorialOrigin = 'first_time' | 'replay';

export interface TutorialViewState {
  readonly origin: TutorialOrigin;
  readonly returnTo: GameplayReturnDestination;
  readonly nextCampaignLevelId: LevelId | null;
  readonly nextCampaignLevelNumber: number | null;
  readonly stage: TutorialStageId;
  readonly stepNumber: number;
  readonly totalSteps: number;
  readonly activePuzzleId: TutorialPuzzleId;
  readonly attemptId: number;
  readonly title: string;
  readonly description: string;
  readonly primaryActionLabel: string | null;
  readonly secondaryActionLabel: string | null;
  readonly highlight: TutorialHighlightTarget;
  readonly showPointer: boolean;
  readonly pointerSlotIndex: number | null;
  readonly showCounterExamples: boolean;
  readonly counterExamples: readonly CounterDemoExample[];
  readonly activeCounterExampleId: CounterDemoExample['id'] | null;
  readonly guidanceHint: string | null;
  readonly currentSequence: readonly BottleId[];
  readonly selectedSlotIndex: number | null;
  readonly focusedSlotIndex: number | null;
  readonly displayedMatchCount: number;
  readonly displayedMoveCount: number;
  readonly totalBottleCount: number;
  readonly formattedTime: string;
  readonly puzzleStatus: PuzzleStatus;
  readonly inputEnabled: boolean;
  readonly isSwapping: boolean;
  readonly canSkip: boolean;
  readonly canRestart: boolean;
  readonly matchFeedback: MatchFeedbackView | null;
  readonly overlayMode: GameplayOverlayMode;
  readonly completionActionLabel: string;
  readonly errorMessage: string | null;
}
