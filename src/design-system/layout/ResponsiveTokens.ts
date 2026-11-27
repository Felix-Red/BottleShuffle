import type { LayoutProfile } from '../../game/layout/LayoutProfile';
import { Dimens } from '../tokens/Dimens';

export interface ResponsiveTypographyScale {
  readonly displayScale: number;
  readonly screenHeadingScale: number;
  readonly sectionHeadingScale: number;
  readonly matchCounterScale: number;
  readonly statisticsScale: number;
  readonly bodyScale: number;
  readonly buttonLabelScale: number;
  readonly captionScale: number;
}

export interface ResponsiveDesignTokens {
  readonly profile: LayoutProfile;
  readonly screenPaddingX: number;
  readonly screenPaddingY: number;
  readonly sectionSpacing: number;
  readonly headerHeight: number;
  readonly headerSpacing: number;
  readonly hudSpacing: number;
  readonly minTouchTarget: number;
  readonly primaryButtonHeight: number;
  readonly secondaryButtonHeight: number;
  readonly modalPadding: number;
  readonly modalMaxWidth: number;
  readonly bottleSlotSpacing: number;
  readonly rackVerticalSpacing: number;
  readonly maxContentWidth: number;
  readonly typography: ResponsiveTypographyScale;
}

const PROFILE_TOKENS: Readonly<Record<LayoutProfile, ResponsiveDesignTokens>> = Object.freeze({
  'compact-portrait': Object.freeze({
    profile: 'compact-portrait',
    screenPaddingX: Dimens.Space12,
    screenPaddingY: Dimens.Space12,
    sectionSpacing: Dimens.Space12,
    headerHeight: Dimens.HeaderHeightCompact,
    headerSpacing: Dimens.Space8,
    hudSpacing: Dimens.Space8,
    minTouchTarget: Dimens.MinTouchTarget,
    primaryButtonHeight: 48,
    secondaryButtonHeight: 44,
    modalPadding: Dimens.Space16,
    modalMaxWidth: 420,
    bottleSlotSpacing: Dimens.Space8,
    rackVerticalSpacing: Dimens.Space20,
    maxContentWidth: 460,
    typography: Object.freeze({
      displayScale: 0.78,
      screenHeadingScale: 0.86,
      sectionHeadingScale: 0.9,
      matchCounterScale: 0.92,
      statisticsScale: 0.9,
      bodyScale: 0.92,
      buttonLabelScale: 0.94,
      captionScale: 0.88,
    }),
  }),
  'standard-portrait': Object.freeze({
    profile: 'standard-portrait',
    screenPaddingX: Dimens.Space20,
    screenPaddingY: Dimens.Space20,
    sectionSpacing: Dimens.Space16,
    headerHeight: Dimens.HeaderHeight,
    headerSpacing: Dimens.Space12,
    hudSpacing: Dimens.Space12,
    minTouchTarget: Dimens.MinTouchTarget,
    primaryButtonHeight: 52,
    secondaryButtonHeight: 48,
    modalPadding: Dimens.Space24,
    modalMaxWidth: 460,
    bottleSlotSpacing: Dimens.Space12,
    rackVerticalSpacing: Dimens.Space32,
    maxContentWidth: 680,
    typography: Object.freeze({
      displayScale: 0.92,
      screenHeadingScale: 0.96,
      sectionHeadingScale: 1,
      matchCounterScale: 1,
      statisticsScale: 1,
      bodyScale: 1,
      buttonLabelScale: 1,
      captionScale: 0.95,
    }),
  }),
  'compact-landscape': Object.freeze({
    profile: 'compact-landscape',
    screenPaddingX: Dimens.Space12,
    screenPaddingY: Dimens.Space8,
    sectionSpacing: Dimens.Space10,
    headerHeight: 48,
    headerSpacing: Dimens.Space8,
    hudSpacing: Dimens.Space8,
    minTouchTarget: Dimens.MinTouchTarget,
    primaryButtonHeight: 46,
    secondaryButtonHeight: 44,
    modalPadding: Dimens.Space16,
    modalMaxWidth: 740,
    bottleSlotSpacing: Dimens.Space8,
    rackVerticalSpacing: Dimens.Space16,
    maxContentWidth: 880,
    typography: Object.freeze({
      displayScale: 0.72,
      screenHeadingScale: 0.84,
      sectionHeadingScale: 0.88,
      matchCounterScale: 0.86,
      statisticsScale: 0.86,
      bodyScale: 0.88,
      buttonLabelScale: 0.92,
      captionScale: 0.85,
    }),
  }),
  'standard-landscape': Object.freeze({
    profile: 'standard-landscape',
    screenPaddingX: Dimens.Space24,
    screenPaddingY: Dimens.Space16,
    sectionSpacing: Dimens.Space20,
    headerHeight: Dimens.HeaderHeight,
    headerSpacing: Dimens.Space12,
    hudSpacing: Dimens.Space16,
    minTouchTarget: Dimens.MinTouchTarget,
    primaryButtonHeight: 52,
    secondaryButtonHeight: 48,
    modalPadding: Dimens.Space24,
    modalMaxWidth: 540,
    bottleSlotSpacing: Dimens.Space12,
    rackVerticalSpacing: Dimens.Space24,
    maxContentWidth: 1080,
    typography: Object.freeze({
      displayScale: 0.96,
      screenHeadingScale: 1,
      sectionHeadingScale: 1,
      matchCounterScale: 1,
      statisticsScale: 1,
      bodyScale: 1,
      buttonLabelScale: 1,
      captionScale: 1,
    }),
  }),
  'expanded-landscape': Object.freeze({
    profile: 'expanded-landscape',
    screenPaddingX: Dimens.Space32,
    screenPaddingY: Dimens.Space24,
    sectionSpacing: Dimens.Space24,
    headerHeight: Dimens.HeaderHeight,
    headerSpacing: Dimens.Space16,
    hudSpacing: Dimens.Space20,
    minTouchTarget: Dimens.MinTouchTarget,
    primaryButtonHeight: 56,
    secondaryButtonHeight: 52,
    modalPadding: Dimens.Space32,
    modalMaxWidth: 580,
    bottleSlotSpacing: Dimens.Space16,
    rackVerticalSpacing: Dimens.Space32,
    maxContentWidth: 1220,
    typography: Object.freeze({
      displayScale: 1.05,
      screenHeadingScale: 1.04,
      sectionHeadingScale: 1.04,
      matchCounterScale: 1.04,
      statisticsScale: 1.02,
      bodyScale: 1.02,
      buttonLabelScale: 1.02,
      captionScale: 1,
    }),
  }),
});

export function getResponsiveTokens(profile: LayoutProfile): ResponsiveDesignTokens {
  return PROFILE_TOKENS[profile];
}
