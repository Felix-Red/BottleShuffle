import { describe, expect, it } from 'vitest';
import {
  ensureMinimumTouchTarget,
  resolveAspectCategory,
  resolveBreakpoint,
  resolveLayoutContext,
} from '../../src/design-system/tokens/Breakpoints';
import { Dimens } from '../../src/design-system/tokens/Dimens';
import { MotionDurations, resolveMotionDuration } from '../../src/design-system/tokens/Motion';
import {
  createTextStyle,
  getResponsiveFontSize,
  Typography,
} from '../../src/design-system/tokens/Typography';

describe('Responsive breakpoints, typography, and motion tokens', () => {
  it('classifies breakpoints and aspect categories across desktop, tablet, mobile, and square viewports', () => {
    expect(resolveBreakpoint(1280, 720)).toBe('expanded');
    expect(resolveBreakpoint(820, 640)).toBe('medium');
    expect(resolveBreakpoint(390, 844)).toBe('compact');
    expect(resolveBreakpoint(844, 390)).toBe('compact');

    expect(resolveAspectCategory(390, 844)).toBe('portrait');
    expect(resolveAspectCategory(600, 600)).toBe('square');
    expect(resolveAspectCategory(1280, 720)).toBe('standard');
    expect(resolveAspectCategory(2560, 1080)).toBe('wide');
  });

  it('computes safe layout contexts for landscape, portrait, and zero-size viewports', () => {
    const landscape = resolveLayoutContext(1280, 720);
    expect(landscape.orientation).toBe('landscape');
    expect(landscape.breakpoint).toBe('expanded');
    expect(landscape.scale).toBe(1);
    expect(landscape.columns).toBe(3);

    const portrait = resolveLayoutContext(390, 844);
    expect(portrait.orientation).toBe('portrait');
    expect(portrait.breakpoint).toBe('compact');
    expect(portrait.isCompact).toBe(true);
    expect(portrait.columns).toBe(1);
    expect(portrait.contentWidth).toBe(390 - Dimens.ScreenPaddingCompact * 2);

    const zero = resolveLayoutContext(0, 0);
    expect(zero.width).toBe(1);
    expect(zero.height).toBe(1);
    expect(zero.scale).toBeGreaterThanOrEqual(0.5);
  });

  it('preserves comfortable minimum touch targets after canvas scaling', () => {
    expect(ensureMinimumTouchTarget(40, 1)).toBe(Dimens.MinTouchTarget);
    expect(ensureMinimumTouchTarget(48, 0.5)).toBe(96);
    expect(ensureMinimumTouchTarget(64, 1.2)).toBe(64);
  });

  it('scales typography safely and includes anti-clipping padding', () => {
    expect(getResponsiveFontSize(Typography.Display, 1)).toBe(64);
    expect(getResponsiveFontSize(Typography.LabelSmall, 0.4, 12)).toBe(12);

    const style = createTextStyle(Typography.HeadlineLarge, { wordWrapWidth: 320 });
    expect(style.fontSize).toBe('48px');
    expect(style.padding.top).toBeGreaterThanOrEqual(4);
    expect(style.padding.bottom).toBeGreaterThanOrEqual(4);
    expect(style.wordWrap?.width).toBe(320);
  });

  it('respects reduced-motion configuration when resolving durations', () => {
    expect(resolveMotionDuration(MotionDurations.Normal, false)).toBe(250);
    expect(resolveMotionDuration(MotionDurations.Normal, true)).toBe(0);
    expect(resolveMotionDuration(-50, false)).toBe(0);
  });
});
