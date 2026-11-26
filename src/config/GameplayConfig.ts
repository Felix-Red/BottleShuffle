import type { DifficultyId, SeedProvider } from '../core';
import { MotionDurations } from '../design-system/tokens/Motion';

export const GAMEPLAY_CONFIG = {
  defaultDifficulty: 'normal' as DifficultyId,
  swapTransitionDurationMs: MotionDurations.SwapTotal,
  matchFeedbackDurationMs: MotionDurations.FloatingMatchFeedback,
  timerPollIntervalMs: 250,
} as const;

export const GAMEPLAY_COPY = {
  instructions: {
    noSelection: 'Select two bottles to swap.',
    bottleSelected: 'Select another bottle to swap.',
    swapping: 'Swapping bottles...',
    completed: 'Perfect match!',
  },
  pauseModal: {
    title: 'Game paused',
    message: 'Take a breather. Your puzzle progress and elapsed time are safely held.',
    resumeLabel: 'Resume',
    restartLabel: 'Restart',
    homeLabel: 'Return to Home',
  },
  restartModal: {
    title: 'Restart puzzle?',
    message: 'Your moves and elapsed time will reset to the starting bottle arrangement.',
    confirmLabel: 'Restart',
    cancelLabel: 'Cancel',
  },
  completionModal: {
    title: 'Puzzle complete!',
    playAgainLabel: 'Play Again',
    homeLabel: 'Return to Home',
  },
  errorRecovery: {
    title: 'Unable to load puzzle',
    fallbackMessage: 'Something went wrong while preparing this puzzle.',
    homeLabel: 'Return to Home',
  },
} as const;

export type MatchFeedbackTone = 'positive' | 'negative' | 'neutral';

export interface FormattedMatchFeedback {
  readonly text: string;
  readonly tone: MatchFeedbackTone;
}

export function formatMatchDeltaFeedback(delta: number): FormattedMatchFeedback {
  if (delta > 0) {
    return {
      text: `+${String(delta)} ${delta === 1 ? 'match' : 'matches'}`,
      tone: 'positive',
    };
  }
  if (delta < 0) {
    const abs = Math.abs(delta);
    return {
      text: `-${String(abs)} ${abs === 1 ? 'match' : 'matches'}`,
      tone: 'negative',
    };
  }
  return {
    text: 'No change',
    tone: 'neutral',
  };
}

let boundarySeedCounter = 0;

/**
 * Application-boundary seed generator used when no deterministic seed is supplied.
 * Keeps uncontrolled randomness strictly outside src/core/.
 */
export function createBoundarySeedProvider(): SeedProvider {
  return () => {
    boundarySeedCounter += 1;
    if (
      typeof globalThis.crypto !== 'undefined' &&
      typeof globalThis.crypto.getRandomValues === 'function'
    ) {
      const bytes = new Uint32Array(2);
      globalThis.crypto.getRandomValues(bytes);
      const partA = (bytes[0] ?? 0).toString(36);
      const partB = (bytes[1] ?? 0).toString(36);
      return `pzl-${partA}-${partB}-${String(boundarySeedCounter)}`;
    }
    return `pzl-${Date.now().toString(36)}-${String(boundarySeedCounter)}`;
  };
}
