export const MotionDurations = {
  Instant: 0,
  Fast: 100,
  Short: 150,
  Normal: 250,
  Medium: 350,
  Long: 500,
  Celebration: 800,
} as const;

export const MotionEasings = {
  Linear: 'Linear',
  EaseOutQuad: 'Quad.easeOut',
  EaseInQuad: 'Quad.easeIn',
  EaseOutCubic: 'Cubic.easeOut',
  EaseInCubic: 'Cubic.easeIn',
  EaseInOutCubic: 'Cubic.easeInOut',
  EaseOutBack: 'Back.easeOut',
  EaseInBack: 'Back.easeIn',
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
    duration: MotionDurations.Fast,
    ease: MotionEasings.EaseOutQuad,
    scaleTo: 0.96,
    offsetY: 2,
  },
  ButtonRelease: {
    duration: MotionDurations.Short,
    ease: MotionEasings.EaseOutBack,
    scaleTo: 1,
    offsetY: 0,
  },
  Hover: {
    duration: MotionDurations.Fast,
    ease: MotionEasings.EaseOutQuad,
    scaleTo: 1.02,
  },
  Selection: {
    duration: MotionDurations.Short,
    ease: MotionEasings.EaseOutBack,
    scaleTo: 1.05,
  },
  FadeIn: {
    duration: MotionDurations.Normal,
    ease: MotionEasings.EaseOutCubic,
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
    ease: MotionEasings.EaseOutBack,
    scaleFrom: 0.88,
    scaleTo: 1,
    alphaFrom: 0,
    alphaTo: 1,
  },
  ModalEntrance: {
    duration: MotionDurations.Normal,
    ease: MotionEasings.EaseOutBack,
    scaleFrom: 0.9,
    scaleTo: 1,
    alphaFrom: 0,
    alphaTo: 1,
  },
  ModalDismissal: {
    duration: MotionDurations.Short,
    ease: MotionEasings.EaseInCubic,
    scaleFrom: 1,
    scaleTo: 0.94,
    alphaFrom: 1,
    alphaTo: 0,
  },
  SuccessFeedback: {
    duration: MotionDurations.Medium,
    ease: MotionEasings.EaseOutBack,
    scaleFrom: 1,
    scaleTo: 1.08,
  },
  ErrorFeedback: {
    duration: MotionDurations.Normal,
    ease: MotionEasings.EaseInOutCubic,
    offsetY: 0,
  },
} as const satisfies Record<string, MotionSpec>;

export const Motion = {
  Durations: MotionDurations,
  Easings: MotionEasings,
  Presets: MotionPresets,
} as const;

export function resolveMotionDuration(durationMs: number, reducedMotion: boolean): number {
  if (reducedMotion || durationMs <= 0) {
    return MotionDurations.Instant;
  }

  return durationMs;
}
