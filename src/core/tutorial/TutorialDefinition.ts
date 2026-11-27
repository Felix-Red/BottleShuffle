import type {
  TutorialInstructionalStageId,
  TutorialStageId,
  TutorialStepDefinition,
} from './TutorialStep';

export const TUTORIAL_STEPS: readonly TutorialStepDefinition[] = Object.freeze([
  Object.freeze({
    id: 'introduction',
    stepNumber: 1,
    title: 'Find the secret order',
    description: 'Rearrange the bottles until every position matches the hidden sequence.',
    puzzleId: 'tutorial-guided-01',
    highlight: Object.freeze({ kind: 'hidden_rack' }),
    inputPolicy: 'none',
    primaryActionLabel: "Let's try",
  }),
  Object.freeze({
    id: 'guided_selection',
    stepNumber: 2,
    title: 'Select a bottle',
    description: 'Tap the highlighted bottle to select it.',
    puzzleId: 'tutorial-guided-01',
    highlight: Object.freeze({ kind: 'bottle_slot', slotIndex: 0 }),
    inputPolicy: 'specific_slot',
    requiredSlotIndex: 0,
  }),
  Object.freeze({
    id: 'guided_swap',
    stepNumber: 3,
    title: 'Now swap it!',
    description: 'Tap the second highlighted bottle to swap their positions.',
    puzzleId: 'tutorial-guided-01',
    highlight: Object.freeze({ kind: 'bottle_slot', slotIndex: 1 }),
    inputPolicy: 'specific_or_deselect',
    requiredSlotIndex: 1,
  }),
  Object.freeze({
    id: 'counter_explanation',
    stepNumber: 4,
    title: 'Watch the counter',
    description:
      'The counter tells you how many bottles are in the correct position, but not which ones.',
    puzzleId: 'tutorial-counter-decrease',
    highlight: Object.freeze({ kind: 'match_counter' }),
    inputPolicy: 'none',
    primaryActionLabel: 'Got it, my turn!',
    secondaryActionLabel: 'Demo swap',
  }),
  Object.freeze({
    id: 'independent_puzzle',
    stepNumber: 5,
    title: 'Your turn!',
    description: 'Swap the bottles until all three positions match.',
    puzzleId: 'tutorial-independent-01',
    highlight: Object.freeze({ kind: 'none' }),
    inputPolicy: 'free_play',
  }),
]);

export const TOTAL_INSTRUCTIONAL_STEPS = TUTORIAL_STEPS.length;

const STEPS_BY_ID = new Map<TutorialInstructionalStageId, TutorialStepDefinition>(
  TUTORIAL_STEPS.map((step) => [step.id, step]),
);

export function isInstructionalStage(
  stage: TutorialStageId,
): stage is TutorialInstructionalStageId {
  return STEPS_BY_ID.has(stage as TutorialInstructionalStageId);
}

export function getTutorialStepDefinition(
  stage: TutorialStageId,
): TutorialStepDefinition | undefined {
  if (!isInstructionalStage(stage)) {
    return undefined;
  }
  return STEPS_BY_ID.get(stage);
}
