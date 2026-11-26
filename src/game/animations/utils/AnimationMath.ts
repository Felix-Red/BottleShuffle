export interface Point2D {
  readonly x: number;
  readonly y: number;
}

export interface RelativeDeformation {
  readonly scaleX: number;
  readonly scaleY: number;
}

export interface ShadowElevationState {
  readonly scaleX: number;
  readonly scaleY: number;
  readonly alpha: number;
}

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}

export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * clamp(t, 0, 1);
}

export function distanceBetween(a: Point2D, b: Point2D): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Evaluates a quadratic Bezier curve at parameter t in [0, 1]:
 * B(t) = (1 - t)^2 * P0 + 2 * (1 - t) * t * P1 + t^2 * P2
 */
export function evaluateQuadraticBezier(p0: Point2D, p1: Point2D, p2: Point2D, t: number): Point2D {
  const clamped = clamp(t, 0, 1);
  const inv = 1 - clamped;
  const invSq = inv * inv;
  const mid = 2 * inv * clamped;
  const tSq = clamped * clamped;

  return {
    x: invSq * p0.x + mid * p1.x + tSq * p2.x,
    y: invSq * p0.y + mid * p1.y + tSq * p2.y,
  };
}

/**
 * Applies squash-and-stretch multipliers relative to a sprite's existing responsive base scale.
 */
export function calculateRelativeDeformation(
  baseScaleX: number,
  baseScaleY: number,
  factorX: number,
  factorY: number,
): RelativeDeformation {
  const safeBaseX = Number.isFinite(baseScaleX) && baseScaleX > 0 ? baseScaleX : 1;
  const safeBaseY = Number.isFinite(baseScaleY) && baseScaleY > 0 ? baseScaleY : 1;
  const safeFactorX = Number.isFinite(factorX) && factorX > 0 ? factorX : 1;
  const safeFactorY = Number.isFinite(factorY) && factorY > 0 ? factorY : 1;

  return {
    scaleX: safeBaseX * safeFactorX,
    scaleY: safeBaseY * safeFactorY,
  };
}

/**
 * Maps bottle visual elevation above the shelf to grounded contact shadow scaling and opacity.
 */
export function calculateShadowForElevation(
  elevationPx: number,
  maxElevationPx: number,
  baseAlpha: number,
): ShadowElevationState {
  const safeMax = Math.max(1, Number.isFinite(maxElevationPx) ? maxElevationPx : 24);
  const normalized = clamp(elevationPx / safeMax, 0, 1);

  return {
    scaleX: 1 - normalized * 0.28,
    scaleY: 1 - normalized * 0.22,
    alpha: clamp(baseAlpha, 0, 1) * (1 - normalized * 0.56),
  };
}

/**
 * Computes subtle bottle tilt in radians based on horizontal travel direction and progress.
 * Peaks smoothly mid-flight (sin(pi * t)) and returns cleanly to 0 at endpoints.
 */
export function computeFlightTilt(deltaX: number, t: number, maxTiltRad: number): number {
  if (Math.abs(deltaX) < 1 || !Number.isFinite(maxTiltRad)) {
    return 0;
  }
  const clampedT = clamp(t, 0, 1);
  const direction = deltaX > 0 ? 1 : -1;
  return direction * Math.sin(Math.PI * clampedT) * Math.abs(maxTiltRad);
}
