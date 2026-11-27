import {
  getCounterDemoExamples,
  getTutorialStepDefinition,
  TOTAL_INSTRUCTIONAL_STEPS,
  type CounterDemoExample,
  type LevelId,
  type PublicGameState,
  type TutorialState,
} from '../../core';
import { TUTORIAL_CONFIG } from '../../config/TutorialConfig';
import type { GameplayReturnDestination } from '../gameplay/GameplaySceneData';
import type { GameplayOverlayMode, MatchFeedbackView } from '../gameplay/GameplayViewState';
import type { TutorialOrigin, TutorialViewState } from './TutorialViewState';

export interface MapTutorialViewStateInput {
  readonly tutorialState: TutorialState;
  readonly gameState: PublicGameState;
  readonly origin: TutorialOrigin;
  readonly returnTo: GameplayReturnDestination;
  readonly nextCampaignLevelId: LevelId | null;
  readonly nextCampaignLevelNumber: number | null;
  readonly attemptId: number;
  readonly displayedMatchCount: number;
  readonly displayedMoveCount: number;
  readonly formattedTime: string;
  readonly focusedSlotIndex: number | null;
  readonly isSwapping: boolean;
  readonly guidanceHint: string | null;
  readonly matchFeedback: MatchFeedbackView | null;
  readonly overlayMode: GameplayOverlayMode;
  readonly errorMessage: string | null;
}

/**
 * Pure mapper producing immutable TutorialViewState from TutorialState + PublicGameState.
 * Never exposes private puzzle target sequences or hardcodes step counts/counter values.
 */
export function mapTutorialViewState(input: MapTutorialViewStateInput): TutorialViewState {
  const { tutorialState, gameState } = input;
  const step = getTutorialStepDefinition(tutorialState.stage);
  const counterExamples = getCounterDemoExamples();

  const stepNumber =
    step !== undefined
      ? step.stepNumber
      : tutorialState.stage === 'completed'
        ? TOTAL_INSTRUCTIONAL_STEPS
        : 1;

  const showPointer =
    !input.isSwapping &&
    input.overlayMode === 'none' &&
    step?.highlight.kind === 'bottle_slot' &&
    step.highlight.slotIndex !== undefined;

  const pointerSlotIndex = showPointer ? (step.highlight.slotIndex ?? null) : null;

  let secondaryActionLabel: string | null = step?.secondaryActionLabel ?? null;
  let activeCounterExampleId: CounterDemoExample['id'] | null = null;
  if (tutorialState.stage === 'counter_explanation') {
    if (tutorialState.counterDemoPhase === 'decrease_ready') {
      secondaryActionLabel = step?.secondaryActionLabel ?? 'Demo swap';
      activeCounterExampleId = 'increase';
    } else if (tutorialState.counterDemoPhase === 'decrease_shown') {
      secondaryActionLabel = TUTORIAL_CONFIG.copy.counterDemoNextLabel;
      activeCounterExampleId = 'decrease';
    } else {
      secondaryActionLabel = TUTORIAL_CONFIG.copy.counterDemoReplayLabel;
      activeCounterExampleId = 'unchanged';
    }
  }

  let completionActionLabel: string;
  if (input.origin === 'first_time' && input.nextCampaignLevelNumber !== null) {
    completionActionLabel = `${TUTORIAL_CONFIG.copy.playLevelPrefix} ${String(input.nextCampaignLevelNumber)}`;
  } else if (input.returnTo === 'level_selection') {
    completionActionLabel = TUTORIAL_CONFIG.copy.replayDoneLevelsLabel;
  } else {
    completionActionLabel = TUTORIAL_CONFIG.copy.replayDoneHomeLabel;
  }

  const inputEnabled =
    gameState.status === 'playing' &&
    !input.isSwapping &&
    input.overlayMode === 'none' &&
    step !== undefined &&
    step.inputPolicy !== 'none';

  const canSkip =
    tutorialState.stage !== 'completed' &&
    tutorialState.stage !== 'skipped' &&
    input.overlayMode === 'none';

  const canRestart = tutorialState.stage === 'independent_puzzle' && input.overlayMode !== 'error';

  return Object.freeze({
    origin: input.origin,
    returnTo: input.returnTo,
    nextCampaignLevelId: input.nextCampaignLevelId,
    nextCampaignLevelNumber: input.nextCampaignLevelNumber,
    stage: tutorialState.stage,
    stepNumber,
    totalSteps: TOTAL_INSTRUCTIONAL_STEPS,
    activePuzzleId: tutorialState.activePuzzleId,
    attemptId: input.attemptId,
    title: step?.title ?? TUTORIAL_CONFIG.copy.completionTitle,
    description: step?.description ?? TUTORIAL_CONFIG.copy.completionDescription,
    primaryActionLabel: step?.primaryActionLabel ?? null,
    secondaryActionLabel,
    highlight:
      input.isSwapping || input.overlayMode !== 'none'
        ? Object.freeze({ kind: 'none' })
        : (step?.highlight ?? Object.freeze({ kind: 'none' })),
    showPointer,
    pointerSlotIndex,
    showCounterExamples: tutorialState.stage === 'counter_explanation',
    counterExamples,
    activeCounterExampleId,
    guidanceHint: input.guidanceHint,
    currentSequence: gameState.currentSequence,
    selectedSlotIndex: gameState.selectedSlotIndex,
    focusedSlotIndex: input.focusedSlotIndex,
    displayedMatchCount: input.displayedMatchCount,
    displayedMoveCount: input.displayedMoveCount,
    totalBottleCount: gameState.totalBottleCount,
    formattedTime: input.formattedTime,
    puzzleStatus: gameState.status,
    inputEnabled,
    isSwapping: input.isSwapping,
    canSkip,
    canRestart,
    matchFeedback: input.matchFeedback,
    overlayMode: input.overlayMode,
    completionActionLabel,
    errorMessage: input.errorMessage,
  });
}
