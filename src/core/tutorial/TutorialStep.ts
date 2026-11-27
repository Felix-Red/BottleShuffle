/**
 * Strongly typed identifiers for every stage in the interactive tutorial state machine.
 */
export type TutorialStageId =
  | 'not_started'
  | 'introduction'
  | 'guided_selection'
  | 'guided_swap'
  | 'counter_explanation'
  | 'independent_puzzle'
  | 'completed'
  | 'skipped';

export type TutorialInstructionalStageId =
  | 'introduction'
  | 'guided_selection'
  | 'guided_swap'
  | 'counter_explanation'
  | 'independent_puzzle';

export type TutorialPuzzleId =
  | 'tutorial-guided-01'
  | 'tutorial-counter-decrease'
  | 'tutorial-counter-unchanged'
  | 'tutorial-independent-01';

export type TutorialHighlightKind = 'none' | 'hidden_rack' | 'bottle_slot' | 'match_counter';

export interface TutorialHighlightTarget {
  readonly kind: TutorialHighlightKind;
  readonly slotIndex?: number;
}

export type TutorialInputPolicy = 'none' | 'specific_slot' | 'specific_or_deselect' | 'free_play';

export interface TutorialStepDefinition {
  readonly id: TutorialInstructionalStageId;
  readonly stepNumber: number;
  readonly title: string;
  readonly description: string;
  readonly puzzleId: TutorialPuzzleId;
  readonly highlight: TutorialHighlightTarget;
  readonly inputPolicy: TutorialInputPolicy;
  readonly requiredSlotIndex?: number;
  readonly primaryActionLabel?: string;
  readonly secondaryActionLabel?: string;
}
