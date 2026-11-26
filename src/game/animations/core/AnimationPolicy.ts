import { MotionDurations } from '../../../design-system/tokens/Motion';

export interface AnimationPolicy {
  readonly reducedMotion: boolean;
  readonly timeScale: number;
  readonly allowLift: boolean;
  readonly allowTilt: boolean;
  readonly allowCurvedSwap: boolean;
  readonly allowSquashStretch: boolean;
  readonly allowMotionTrails: boolean;
  readonly allowSelectionPulse: boolean;
  readonly allowParticles: boolean;
  readonly allowCounterPop: boolean;
  readonly hoverDurationMs: number;
  readonly pressDurationMs: number;
  readonly selectionDurationMs: number;
  readonly deselectionDurationMs: number;
  readonly swapAnticipationMs: number;
  readonly swapMovementMs: number;
  readonly bottleLandingMs: number;
  readonly matchCounterDurationMs: number;
  readonly moveCounterDurationMs: number;
  readonly floatingFeedbackDurationMs: number;
  readonly modalEntranceMs: number;
  readonly modalDismissalMs: number;
  readonly victoryCelebrationMs: number;
}

function scaleDuration(baseMs: number, timeScale: number): number {
  if (baseMs <= 0) {
    return 0;
  }
  const safeScale = Number.isFinite(timeScale) && timeScale > 0 ? timeScale : 1;
  return Math.max(1, Math.round(baseMs / safeScale));
}

/**
 * Resolves the effective animation durations and feature flags for the current
 * reduced-motion preference and optional playback timeScale (e.g. 0.35 for slow-motion showcase).
 */
export function resolveAnimationPolicy(reducedMotion: boolean, timeScale = 1): AnimationPolicy {
  const safeTimeScale = Number.isFinite(timeScale) && timeScale > 0 ? timeScale : 1;

  if (reducedMotion) {
    return Object.freeze({
      reducedMotion: true,
      timeScale: safeTimeScale,
      allowLift: false,
      allowTilt: false,
      allowCurvedSwap: false,
      allowSquashStretch: false,
      allowMotionTrails: false,
      allowSelectionPulse: false,
      allowParticles: false,
      allowCounterPop: false,
      hoverDurationMs: 0,
      pressDurationMs: 0,
      selectionDurationMs: 0,
      deselectionDurationMs: 0,
      swapAnticipationMs: 0,
      swapMovementMs: scaleDuration(MotionDurations.ReducedSwapMovement, safeTimeScale),
      bottleLandingMs: 0,
      matchCounterDurationMs: 0,
      moveCounterDurationMs: 0,
      floatingFeedbackDurationMs: scaleDuration(420, safeTimeScale),
      modalEntranceMs: 0,
      modalDismissalMs: 0,
      victoryCelebrationMs: scaleDuration(220, safeTimeScale),
    });
  }

  return Object.freeze({
    reducedMotion: false,
    timeScale: safeTimeScale,
    allowLift: true,
    allowTilt: true,
    allowCurvedSwap: true,
    allowSquashStretch: true,
    allowMotionTrails: true,
    allowSelectionPulse: true,
    allowParticles: true,
    allowCounterPop: true,
    hoverDurationMs: scaleDuration(MotionDurations.BottleHover, safeTimeScale),
    pressDurationMs: scaleDuration(MotionDurations.ButtonPress, safeTimeScale),
    selectionDurationMs: scaleDuration(MotionDurations.BottleSelection, safeTimeScale),
    deselectionDurationMs: scaleDuration(MotionDurations.BottleDeselection, safeTimeScale),
    swapAnticipationMs: scaleDuration(MotionDurations.SwapAnticipation, safeTimeScale),
    swapMovementMs: scaleDuration(MotionDurations.SwapMovement, safeTimeScale),
    bottleLandingMs: scaleDuration(MotionDurations.BottleLanding, safeTimeScale),
    matchCounterDurationMs: scaleDuration(MotionDurations.MatchCounterFeedback, safeTimeScale),
    moveCounterDurationMs: scaleDuration(MotionDurations.MoveCounterFeedback, safeTimeScale),
    floatingFeedbackDurationMs: scaleDuration(MotionDurations.FloatingMatchFeedback, safeTimeScale),
    modalEntranceMs: scaleDuration(MotionDurations.ModalEntrance, safeTimeScale),
    modalDismissalMs: scaleDuration(MotionDurations.ModalDismissal, safeTimeScale),
    victoryCelebrationMs: scaleDuration(MotionDurations.VictoryCelebration, safeTimeScale),
  });
}
