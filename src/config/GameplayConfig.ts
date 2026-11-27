import type { ChallengeIntroMode, DifficultyId, SeedProvider } from '../core';
import { MotionDurations } from '../design-system/tokens/Motion';

export const GAMEPLAY_CONFIG = {
  defaultDifficulty: 'normal' as DifficultyId,
  swapTransitionDurationMs: MotionDurations.SwapTotal,
  matchFeedbackDurationMs: MotionDurations.FloatingMatchFeedback,
  timerPollIntervalMs: 100,
  countdownWarningRatio: 0.35,
  countdownWarningMs: 15_000,
  countdownCriticalRatio: 0.15,
  countdownCriticalMs: 12_000,
  countdownCriticalFloorMs: 5_000,
  lowMovesWarningThreshold: 3,
  lowMovesCriticalThreshold: 1,
} as const;

export const GAMEPLAY_COPY = {
  hud: {
    movesUsedLabel: 'MOVES',
    movesLeftLabel: 'MOVES LEFT',
    timeElapsedLabel: 'TIME',
    timeRemainingLabel: 'TIME LEFT',
  },
  instructions: {
    noSelection: 'Select two bottles to swap.',
    bottleSelected: 'Select another bottle to swap.',
    swapping: 'Swapping bottles...',
    completed: 'Perfect match!',
    failedTime: "Time's up! Try again.",
    failedMoves: 'Out of moves! Try again.',
  },
  pauseModal: {
    title: 'Game paused',
    message: 'Take a breather. Your puzzle progress and timer are safely held.',
    resumeLabel: 'Resume',
    restartLabel: 'Restart',
    homeLabel: 'Return to Home',
  },
  restartModal: {
    title: 'Restart puzzle?',
    message: 'Your moves and timer will reset to the starting bottle arrangement.',
    confirmLabel: 'Restart',
    cancelLabel: 'Cancel',
  },
  completionModal: {
    title: 'Puzzle complete!',
    playAgainLabel: 'Play Again',
    homeLabel: 'Return to Home',
  },
  failureModal: {
    timeExpiredTitle: "Time's Up!",
    movesExhaustedTitle: 'Out of Moves!',
    timeExpiredHint: 'The countdown reached zero before every bottle matched.',
    movesExhaustedHint: 'You used every permitted swap before matching all bottles.',
    retryLabel: 'Retry',
    levelsLabel: 'Levels',
    homeLabel: 'Home',
  },
  challengeIntros: {
    timed: {
      badge: 'NEW CHALLENGE',
      title: 'Timed Challenge',
      description:
        'Match every bottle before the countdown bar runs out. The timer starts as soon as you begin and pauses whenever you pause the game.',
      ctaLabel: 'Start Level',
    },
    limited_moves: {
      badge: 'NEW CHALLENGE',
      title: 'Limited Moves',
      description:
        'Each bottle swap uses one move — selecting or deselecting bottles is free. Solve the hidden order before your remaining moves reach zero.',
      ctaLabel: 'Start Level',
    },
    combined: {
      badge: 'NEW CHALLENGE',
      title: 'Timed + Limited Moves',
      description:
        'Race the clock while managing a fixed swap budget. Plan each swap carefully — solve the puzzle before time or moves run out.',
      ctaLabel: 'Start Level',
    },
  } as Readonly<
    Record<
      ChallengeIntroMode,
      {
        readonly badge: string;
        readonly title: string;
        readonly description: string;
        readonly ctaLabel: string;
      }
    >
  >,
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
