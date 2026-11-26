import { describe, expect, it } from 'vitest';
import { formatMatchDeltaFeedback } from '../../../src/config/GameplayConfig';
import { MotionDurations, MotionParams } from '../../../src/design-system/tokens/Motion';

describe('Aggregate match feedback & motion tokens', () => {
  it('formats singular, plural, negative, and unchanged aggregate feedback without revealing bottle positions', () => {
    expect(formatMatchDeltaFeedback(2)).toEqual({ text: '+2 matches', tone: 'positive' });
    expect(formatMatchDeltaFeedback(1)).toEqual({ text: '+1 match', tone: 'positive' });
    expect(formatMatchDeltaFeedback(0)).toEqual({ text: 'No change', tone: 'neutral' });
    expect(formatMatchDeltaFeedback(-1)).toEqual({ text: '-1 match', tone: 'negative' });
    expect(formatMatchDeltaFeedback(-2)).toEqual({ text: '-2 matches', tone: 'negative' });

    // Confirm no bottle color or slot index leaks into feedback labels
    for (const delta of [-2, -1, 0, 1, 2]) {
      const label = formatMatchDeltaFeedback(delta).text.toLowerCase();
      expect(label).not.toMatch(/slot|red|blue|green|yellow|purple/);
    }
  });

  it('defines semantic motion durations and relative deformation parameters', () => {
    expect(MotionDurations.ButtonPress).toBe(100);
    expect(MotionDurations.BottleHover).toBe(120);
    expect(MotionDurations.BottleSelection).toBe(150);
    expect(MotionDurations.BottleDeselection).toBe(150);
    expect(MotionDurations.SwapAnticipation).toBe(70);
    expect(MotionDurations.SwapMovement).toBe(300);
    expect(MotionDurations.BottleLanding).toBe(100);
    expect(MotionDurations.SwapTotal).toBe(470);
    expect(MotionDurations.MatchCounterFeedback).toBe(250);
    expect(MotionDurations.MoveCounterFeedback).toBe(150);
    expect(MotionDurations.FloatingMatchFeedback).toBe(650);
    expect(MotionDurations.ModalEntrance).toBe(250);
    expect(MotionDurations.ModalDismissal).toBe(150);
    expect(MotionDurations.VictoryCelebration).toBe(800);

    expect(MotionParams.landingSquashX).toBeCloseTo(1.05, 2);
    expect(MotionParams.landingSquashY).toBeCloseTo(0.94, 2);
    expect(MotionParams.modalEntranceScaleFrom).toBeCloseTo(0.96, 2);
  });
});
