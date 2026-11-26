export const MotionDurations = {
  Instant: 0,
  Fast: 100,
  Short: 150,
  Normal: 250,
  Medium: 350,
  Long: 500,
  Celebration: 800,

  // Semantic gameplay & UI durations (Task 07)
  ButtonPress: 100,
  BottleHover: 120,
  BottleSelection: 150,
  BottleDeselection: 150,
  SwapAnticipation: 70,
  SwapMovement: 300,
  BottleLanding: 100,
  SwapTotal: 470,
  ReducedSwapMovement: 110,
  MatchCounterFeedback: 250,
  MoveCounterFeedback: 150,
  FloatingMatchFeedback: 650,
  ModalEntrance: 250,
  ModalDismissal: 150,
  VictoryCelebration: 800,
} as const;

/**
 * Reusable easing identifiers supported natively by Phaser 3's TweenManager.
 */
export const MotionEasings = {
  Linear: 'Linear',
  EaseOut: 'Cubic.easeOut',
  EaseInOut: 'Cubic.easeInOut',
  SoftOvershoot: 'Back.easeOut',
  GentleSettle: 'Sine.easeOut',
  EaseOutQuad: 'Quad.easeOut',
  EaseInQuad: 'Quad.easeIn',
  EaseOutCubic: 'Cubic.easeOut',
  EaseInCubic: 'Cubic.easeIn',
  EaseInOutCubic: 'Cubic.easeInOut',
  EaseOutBack: 'Back.easeOut',
  EaseInBack: 'Back.easeIn',
} as const;

/**
 * Reusable semantic motion parameters expressed as proportions of bottle or slot
 * dimensions wherever practical so motion adapts cleanly across responsive viewports.
 */
export const MotionParams = {
  /** Hover elevation as a ratio of bottle display height. */
  hoverElevationRatio: 0.045,
  /** Selection elevation as a ratio of bottle display height. */
  selectionElevationRatio: 0.095,
  /** Swap anticipation lift as a ratio of bottle display height. */
  swapAnticipationLiftRatio: 0.06,
  /** Maximum temporary bottle tilt in radians (~6.3 deg). */
  maxBottleTiltRad: 0.11,
  /** Subtle anticipation tilt in radians (~4.3 deg). */
  swapAnticipationTiltRad: 0.075,
  /** Baseline quadratic Bezier arc height ratio relative to bottle height. */
  swapArcHeightRatio: 0.36,
  /** Minimum arc height ratio relative to bottle height for adjacent swaps. */
  swapArcMinHeightRatio: 0.24,
  /** Maximum arc height ratio relative to bottle height for long-distance swaps. */
  swapArcMaxHeightRatio: 0.72,
  /** Press interaction scale deformation (applied relative to responsive scale). */
  pressScaleX: 1.03,
  pressScaleY: 0.95,
  /** Subtle hover scale emphasis. */
  hoverScale: 1.025,
  /** Subtle selection scale emphasis. */
  selectionScale: 1.045,
  /** Restrained landing squash deformation (applied relative to responsive scale). */
  landingSquashX: 1.05,
  landingSquashY: 0.94,
  /** Brief pre-settle stretch deformation. */
  landingStretchX: 0.985,
  landingStretchY: 1.02,
  /** Selection glow base and low-frequency pulse floor opacities. */
  selectionGlowOpacity: 0.65,
  selectionGlowPulseMin: 0.45,
  /** Conservative particle lifetimes (ms). */
  particleLifetimeMs: 520,
  celebrationParticleLifetimeMs: 760,
  /** Vertical float travel distance for aggregate match feedback (px). */
  floatingFeedbackDisplacementPx: 26,
  /** Modal scale transition endpoints. */
  modalEntranceScaleFrom: 0.96,
  modalDismissalScaleTo: 0.96,
} as const;

export interface MotionSpec {
  readonly duration: number;
  readonly ease: string;
  readonly scaleFrom?: number;
  readonly scaleTo?: number;
  readonly alphaFrom?: number;
  readonly alphaTo?: number;
  readonly offsetY?: number;
}

export const MotionPresets = {
  ButtonPress: {
    duration: MotionDurations.ButtonPress,
    ease: MotionEasings.EaseOutQuad,
    scaleTo: 0.96,
    offsetY: 2,
  },
  ButtonRelease: {
    duration: MotionDurations.Short,
    ease: MotionEasings.SoftOvershoot,
    scaleTo: 1,
    offsetY: 0,
  },
  Hover: {
    duration: MotionDurations.BottleHover,
    ease: MotionEasings.EaseOutQuad,
    scaleTo: MotionParams.hoverScale,
  },
  Selection: {
    duration: MotionDurations.BottleSelection,
    ease: MotionEasings.SoftOvershoot,
    scaleTo: MotionParams.selectionScale,
  },
  FadeIn: {
    duration: MotionDurations.Normal,
    ease: MotionEasings.EaseOut,
    alphaFrom: 0,
    alphaTo: 1,
  },
  FadeOut: {
    duration: MotionDurations.Short,
    ease: MotionEasings.EaseInCubic,
    alphaFrom: 1,
    alphaTo: 0,
  },
  ScaleIn: {
    duration: MotionDurations.Normal,
    ease: MotionEasings.SoftOvershoot,
    scaleFrom: 0.92,
    scaleTo: 1,
    alphaFrom: 0,
    alphaTo: 1,
  },
  ModalEntrance: {
    duration: MotionDurations.ModalEntrance,
    ease: MotionEasings.EaseOut,
    scaleFrom: MotionParams.modalEntranceScaleFrom,
    scaleTo: 1,
    alphaFrom: 0,
    alphaTo: 1,
  },
  ModalDismissal: {
    duration: MotionDurations.ModalDismissal,
    ease: MotionEasings.EaseInCubic,
    scaleFrom: 1,
    scaleTo: MotionParams.modalDismissalScaleTo,
    alphaFrom: 1,
    alphaTo: 0,
  },
  SuccessFeedback: {
    duration: MotionDurations.MatchCounterFeedback,
    ease: MotionEasings.SoftOvershoot,
    scaleFrom: 1,
    scaleTo: 1.1,
  },
  ErrorFeedback: {
    duration: MotionDurations.MatchCounterFeedback,
    ease: MotionEasings.EaseInOut,
    offsetY: 0,
  },
} as const satisfies Record<string, MotionSpec>;

export const Motion = {
  Durations: MotionDurations,
  Easings: MotionEasings,
  Params: MotionParams,
  Presets: MotionPresets,
} as const;

export function resolveMotionDuration(durationMs: number, reducedMotion: boolean): number {
  if (reducedMotion || durationMs <= 0) {
    return MotionDurations.Instant;
  }

  return durationMs;
}
