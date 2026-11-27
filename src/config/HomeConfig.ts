import type { BottleId } from '../core';
import { APP_METADATA } from './appConfig';

export interface HeroBottlePlacement {
  readonly bottleId: BottleId;
  /** Offset as fraction of hero width (-0.5..0.5). */
  readonly offsetXRatio: number;
  /** Vertical baseline offset as fraction of hero height (-0.5..0.5). */
  readonly offsetYRatio: number;
  /** Relative scale multiplier around the hero bottle base size. */
  readonly scale: number;
  /** Resting angle in degrees. */
  readonly angleDeg: number;
  /** Depth order (higher renders in front). */
  readonly zOrder: number;
  /** Ambient float phase offset in ms so bottles drift organically. */
  readonly phaseOffsetMs: number;
  /** Ambient float amplitude multiplier. */
  readonly floatAmplitude: number;
}

export const HOME_CONFIG = {
  publisherLabel: APP_METADATA.studioLabel,
  logoLineOne: 'BOTTLE',
  logoLineTwo: 'SHUFFLE',
  tagline: 'Swap. Match. Master.',
  copy: {
    playLabel: 'PLAY',
    continueLabel: 'CONTINUE',
    playAgainLabel: 'PLAY AGAIN',
    chooseLevelSupport: 'Choose a level',
    levelsLabel: 'LEVELS',
    practiceLabel: 'PRACTICE',
    campaignProgressTitle: 'CAMPAIGN PROGRESS',
    campaignCompletedLabel: 'Campaign Complete!',
    practiceDialogTitle: 'Practice Mode',
    practiceDialogMessage:
      'Practise any bottle count freely. Practice puzzles never affect your campaign progress.',
    practicePlayLabel: 'Play Practice',
    settingsDialogTitle: 'Settings',
    settingsDialogMessage: 'Adjust available display and motion preferences for this session.',
    reducedMotionLabel: 'Reduced Motion',
    cancelLabel: 'Close',
    errorTitle: 'Unable to open level',
  },
  motion: {
    logoEntranceDurationMs: 360,
    staggerDelayMs: 65,
    transitionFadeMs: 140,
    ambientFloatDurationMs: 2200,
    ambientFloatPx: 7,
    ambientTiltDeg: 1.8,
  },
  heroBottles: Object.freeze<readonly HeroBottlePlacement[]>([
    {
      bottleId: 'red',
      offsetXRatio: -0.34,
      offsetYRatio: 0.09,
      scale: 0.86,
      angleDeg: -10,
      zOrder: 1,
      phaseOffsetMs: 0,
      floatAmplitude: 0.85,
    },
    {
      bottleId: 'purple',
      offsetXRatio: 0.34,
      offsetYRatio: 0.09,
      scale: 0.86,
      angleDeg: 10,
      zOrder: 1,
      phaseOffsetMs: 700,
      floatAmplitude: 0.85,
    },
    {
      bottleId: 'blue',
      offsetXRatio: -0.17,
      offsetYRatio: 0.02,
      scale: 0.96,
      angleDeg: -5,
      zOrder: 2,
      phaseOffsetMs: 350,
      floatAmplitude: 1.0,
    },
    {
      bottleId: 'yellow',
      offsetXRatio: 0.17,
      offsetYRatio: 0.02,
      scale: 0.96,
      angleDeg: 5,
      zOrder: 2,
      phaseOffsetMs: 1050,
      floatAmplitude: 1.0,
    },
    {
      bottleId: 'green',
      offsetXRatio: 0,
      offsetYRatio: -0.05,
      scale: 1.08,
      angleDeg: 0,
      zOrder: 3,
      phaseOffsetMs: 520,
      floatAmplitude: 1.15,
    },
  ]),
} as const;
