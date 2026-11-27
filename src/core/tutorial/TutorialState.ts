import type { TutorialPuzzleId, TutorialStageId } from './TutorialStep';

export type CounterDemoPhase =
  'decrease_ready' | 'decrease_shown' | 'unchanged_ready' | 'unchanged_shown';

/**
 * Pure, immutable state for the interactive tutorial state machine.
 */
export interface TutorialState {
  readonly stage: TutorialStageId;
  readonly activePuzzleId: TutorialPuzzleId;
  readonly selectedSlotIndex: number | null;
  readonly awaitingSwapAnimation: boolean;
  readonly counterDemoPhase: CounterDemoPhase;
  readonly completedOnce: boolean;
  readonly skipped: boolean;
}

export function createInitialTutorialState(): TutorialState {
  return Object.freeze({
    stage: 'not_started',
    activePuzzleId: 'tutorial-guided-01',
    selectedSlotIndex: null,
    awaitingSwapAnimation: false,
    counterDemoPhase: 'decrease_ready',
    completedOnce: false,
    skipped: false,
  });
}
