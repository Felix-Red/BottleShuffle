import { describe, expect, it } from 'vitest';
import {
  computeSwapTrajectories,
  sampleSwapCurve,
  type SafeTrajectoryBounds,
} from '../../../src/game/animations/utils/AnimationCurves';
import {
  calculateRelativeDeformation,
  calculateShadowForElevation,
  computeFlightTilt,
  evaluateQuadraticBezier,
} from '../../../src/game/animations/utils/AnimationMath';

describe('AnimationMath & AnimationCurves', () => {
  it('evaluates quadratic Bezier exact endpoints and midpoint accurately', () => {
    const p0 = { x: 100, y: 300 };
    const p1 = { x: 200, y: 200 };
    const p2 = { x: 300, y: 300 };

    expect(evaluateQuadraticBezier(p0, p1, p2, 0)).toEqual(p0);
    expect(evaluateQuadraticBezier(p0, p1, p2, 1)).toEqual(p2);

    const mid = evaluateQuadraticBezier(p0, p1, p2, 0.5);
    expect(mid.x).toBeCloseTo(200, 5);
    expect(mid.y).toBeCloseTo(250, 5);
  });

  it('computes opposing arcs for horizontal adjacent and first-to-last swaps while staying within bounds', () => {
    const bounds: SafeTrajectoryBounds = { minX: 16, maxX: 1264, minY: 180, maxY: 660 };

    const adjacent = computeSwapTrajectories({
      fromA: { x: 400, y: 420 },
      fromB: { x: 500, y: 420 },
      bottleWidth: 80,
      bottleHeight: 160,
      bounds,
    });

    expect(adjacent.isCrossRow).toBe(false);
    expect(adjacent.isLongSwap).toBe(false);
    expect(sampleSwapCurve(adjacent.curveA, 0)).toEqual({ x: 400, y: 420 });
    expect(sampleSwapCurve(adjacent.curveA, 1)).toEqual({ x: 500, y: 420 });
    expect(sampleSwapCurve(adjacent.curveB, 0)).toEqual({ x: 500, y: 420 });
    expect(sampleSwapCurve(adjacent.curveB, 1)).toEqual({ x: 400, y: 420 });

    const midA = sampleSwapCurve(adjacent.curveA, 0.5);
    const midB = sampleSwapCurve(adjacent.curveB, 0.5);
    // Opposing vertical separation at crossing midpoint
    expect(midA.y).toBeLessThan(420);
    expect(midB.y).toBeGreaterThan(420);

    // First-to-last swap triggers longSwap flag and stays inside safe vertical bounds
    const longSwap = computeSwapTrajectories({
      fromA: { x: 100, y: 340 },
      fromB: { x: 1180, y: 340 },
      bottleWidth: 80,
      bottleHeight: 160,
      bounds,
    });
    expect(longSwap.isLongSwap).toBe(true);
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const ptA = sampleSwapCurve(longSwap.curveA, t);
      const ptB = sampleSwapCurve(longSwap.curveB, t);
      expect(Number.isFinite(ptA.x) && Number.isFinite(ptA.y)).toBe(true);
      expect(Number.isFinite(ptB.x) && Number.isFinite(ptB.y)).toBe(true);
      expect(ptA.y).toBeGreaterThanOrEqual(bounds.minY);
      expect(ptB.y).toBeLessThanOrEqual(bounds.maxY);
    }
  });

  it('computes opposing non-colliding trajectories for vertical, diagonal, and cross-row portrait swaps', () => {
    const portraitBounds: SafeTrajectoryBounds = { minX: 16, maxX: 374, minY: 200, maxY: 780 };

    // Pure vertical cross-row swap (slot 2 -> slot 7)
    const vertical = computeSwapTrajectories({
      fromA: { x: 195, y: 360 },
      fromB: { x: 195, y: 540 },
      bottleWidth: 56,
      bottleHeight: 112,
      bounds: portraitBounds,
    });
    expect(vertical.isCrossRow).toBe(true);
    const vMidA = sampleSwapCurve(vertical.curveA, 0.5);
    const vMidB = sampleSwapCurve(vertical.curveB, 0.5);
    expect(vMidA.x).not.toBeCloseTo(vMidB.x, 1);

    // Diagonal cross-row swap (slot 0 -> slot 9)
    const diagonal = computeSwapTrajectories({
      fromA: { x: 64, y: 360 },
      fromB: { x: 326, y: 540 },
      bottleWidth: 56,
      bottleHeight: 112,
      bounds: portraitBounds,
    });
    expect(diagonal.isCrossRow).toBe(true);
    expect(diagonal.isLongSwap).toBe(true);
    const dMidA = sampleSwapCurve(diagonal.curveA, 0.5);
    const dMidB = sampleSwapCurve(diagonal.curveB, 0.5);
    expect(Math.hypot(dMidA.x - dMidB.x, dMidA.y - dMidB.y)).toBeGreaterThan(20);
  });

  it('applies squash-and-stretch relative to responsive scale and calculates shadow & tilt cleanly', () => {
    const deformed = calculateRelativeDeformation(0.65, 0.65, 1.05, 0.94);
    expect(deformed.scaleX).toBeCloseTo(0.6825, 4);
    expect(deformed.scaleY).toBeCloseTo(0.611, 4);

    const restShadow = calculateShadowForElevation(0, 36, 0.65);
    const liftedShadow = calculateShadowForElevation(24, 36, 0.65);
    expect(restShadow.alpha).toBeCloseTo(0.65, 4);
    expect(liftedShadow.alpha).toBeLessThan(restShadow.alpha);
    expect(liftedShadow.scaleX).toBeLessThan(restShadow.scaleX);

    expect(computeFlightTilt(200, 0, 0.11)).toBeCloseTo(0, 5);
    expect(computeFlightTilt(200, 0.5, 0.11)).toBeCloseTo(0.11, 5);
    expect(computeFlightTilt(-200, 0.5, 0.11)).toBeCloseTo(-0.11, 5);
    expect(computeFlightTilt(200, 1, 0.11)).toBeCloseTo(0, 5);
  });
});
