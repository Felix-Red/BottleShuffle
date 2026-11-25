import { describe, expect, it } from 'vitest';
import {
  canTriggerButtonAction,
  resolveButtonState,
} from '../../src/design-system/components/buttons/buttonState';
import {
  normalizeMatchState,
  normalizeProgress,
  normalizeStarCount,
} from '../../src/design-system/components/indicators/indicatorMath';

describe('Indicator validation helpers', () => {
  it('validates and clamps progress values safely', () => {
    expect(normalizeProgress(50, 100)).toEqual({
      value: 50,
      max: 100,
      ratio: 0.5,
      percentage: 50,
    });

    expect(normalizeProgress(-25, 100)).toEqual({
      value: 0,
      max: 100,
      ratio: 0,
      percentage: 0,
    });

    expect(normalizeProgress(180, 100)).toEqual({
      value: 100,
      max: 100,
      ratio: 1,
      percentage: 100,
    });

    expect(normalizeProgress(Number.NaN, 0)).toEqual({
      value: 0,
      max: 1,
      ratio: 0,
      percentage: 0,
    });

    expect(normalizeProgress(Number.POSITIVE_INFINITY, -10)).toEqual({
      value: 0,
      max: 1,
      ratio: 0,
      percentage: 0,
    });
  });

  it('validates match counter states for zero, partial, decreasing, and complete values', () => {
    expect(normalizeMatchState(0, 10)).toEqual({
      matched: 0,
      total: 10,
      ratio: 0,
      isComplete: false,
      formatted: '0/10',
    });

    const increased = normalizeMatchState(7, 10);
    expect(increased.formatted).toBe('7/10');
    expect(increased.isComplete).toBe(false);

    const decreased = normalizeMatchState(4, 10);
    expect(decreased.formatted).toBe('4/10');
    expect(decreased.ratio).toBeCloseTo(0.4, 5);

    const complete = normalizeMatchState(10, 10);
    expect(complete.formatted).toBe('10/10');
    expect(complete.isComplete).toBe(true);

    expect(normalizeMatchState(99, 10)).toEqual({
      matched: 10,
      total: 10,
      ratio: 1,
      isComplete: true,
      formatted: '10/10',
    });

    expect(normalizeMatchState(-3, 0)).toEqual({
      matched: 0,
      total: 1,
      ratio: 0,
      isComplete: false,
      formatted: '0/1',
    });
  });

  it('clamps star ratings to 0..maxStars', () => {
    expect(normalizeStarCount(0)).toBe(0);
    expect(normalizeStarCount(2)).toBe(2);
    expect(normalizeStarCount(5)).toBe(3);
    expect(normalizeStarCount(-2)).toBe(0);
    expect(normalizeStarCount(Number.NaN)).toBe(0);
  });
});

describe('Button interaction state machine', () => {
  it('resolves interaction states with deterministic precedence', () => {
    expect(
      resolveButtonState({
        enabled: true,
        loading: true,
        hovered: true,
        pressed: true,
        focused: true,
      }),
    ).toBe('loading');

    expect(
      resolveButtonState({
        enabled: false,
        loading: false,
        hovered: true,
        pressed: true,
        focused: true,
      }),
    ).toBe('disabled');

    expect(
      resolveButtonState({
        enabled: true,
        loading: false,
        hovered: true,
        pressed: true,
        focused: false,
      }),
    ).toBe('pressed');

    expect(
      resolveButtonState({
        enabled: true,
        loading: false,
        hovered: true,
        pressed: false,
        focused: true,
      }),
    ).toBe('hovered');

    expect(
      resolveButtonState({
        enabled: true,
        loading: false,
        hovered: false,
        pressed: false,
        focused: true,
      }),
    ).toBe('focused');

    expect(
      resolveButtonState({
        enabled: true,
        loading: false,
        hovered: false,
        pressed: false,
        focused: false,
      }),
    ).toBe('default');
  });

  it('blocks activation when disabled, loading, or within duplicate-click cooldown', () => {
    expect(canTriggerButtonAction({ enabled: false, loading: false }, 1000, 0, 180)).toBe(false);
    expect(canTriggerButtonAction({ enabled: true, loading: true }, 1000, 0, 180)).toBe(false);
    expect(canTriggerButtonAction({ enabled: true, loading: false }, 1050, 1000, 180)).toBe(false);
    expect(canTriggerButtonAction({ enabled: true, loading: false }, 1180, 1000, 180)).toBe(true);
  });
});
