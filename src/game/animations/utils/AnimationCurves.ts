import { MotionParams } from '../../../design-system/tokens/Motion';
import { clamp, distanceBetween, evaluateQuadraticBezier, type Point2D } from './AnimationMath';

export interface SafeTrajectoryBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

export interface SwapTrajectoryInput {
  readonly fromA: Point2D;
  readonly fromB: Point2D;
  readonly bottleWidth: number;
  readonly bottleHeight: number;
  readonly bounds?: SafeTrajectoryBounds;
}

export interface QuadraticCurveSpec {
  readonly p0: Point2D;
  readonly p1: Point2D;
  readonly p2: Point2D;
  readonly distance: number;
  readonly arcMagnitude: number;
}

export interface SwapTrajectoryPair {
  readonly curveA: QuadraticCurveSpec;
  readonly curveB: QuadraticCurveSpec;
  readonly isLongSwap: boolean;
  readonly isCrossRow: boolean;
}

function clampPointToBounds(point: Point2D, bounds?: SafeTrajectoryBounds): Point2D {
  if (bounds === undefined) {
    return point;
  }
  const minX = Math.min(bounds.minX, bounds.maxX);
  const maxX = Math.max(bounds.minX, bounds.maxX);
  const minY = Math.min(bounds.minY, bounds.maxY);
  const maxY = Math.max(bounds.minY, bounds.maxY);
  return {
    x: clamp(point.x, minX, maxX),
    y: clamp(point.y, minY, maxY),
  };
}

/**
 * Computes opposing quadratic Bezier trajectories for two swapping bottles (A -> B and B -> A).
 *
 * - Same-row horizontal swaps: bottle A arcs upward while bottle B arcs gently downward
 *   (or through a shallower opposing curve), keeping both silhouettes distinct during crossing.
 * - Cross-row, vertical, or diagonal swaps: control points offset along opposing perpendicular
 *   normals so trajectories bow cleanly apart without colliding.
 * - Sublinear distance scaling prevents first-to-last swaps from arcing into the HUD, and
 *   optional safe bounds clamp control points strictly inside the visible gameplay playfield.
 */
export function computeSwapTrajectories(input: SwapTrajectoryInput): SwapTrajectoryPair {
  const bottleW = Math.max(32, Number.isFinite(input.bottleWidth) ? input.bottleWidth : 72);
  const bottleH = Math.max(64, Number.isFinite(input.bottleHeight) ? input.bottleHeight : 144);

  const p0A = input.fromA;
  const p2A = input.fromB;
  const p0B = input.fromB;
  const p2B = input.fromA;

  const dx = p2A.x - p0A.x;
  const dy = p2A.y - p0A.y;
  const distance = distanceBetween(p0A, p2A);
  const isCrossRow = Math.abs(dy) > bottleH * 0.25;
  const isLongSwap = distance > bottleW * 2.6;

  // Sublinear arc height scaling: enough clearance for adjacent swaps without soaring on distant swaps
  const normalizedSpan = distance / Math.max(1, bottleW * 2);
  const rawArcRatio =
    MotionParams.swapArcHeightRatio * (0.78 + 0.28 * Math.sqrt(Math.max(0.25, normalizedSpan)));
  const clampedRatio = clamp(
    rawArcRatio,
    MotionParams.swapArcMinHeightRatio,
    MotionParams.swapArcMaxHeightRatio,
  );
  const primaryArc = Math.round(bottleH * clampedRatio);
  const secondaryArc = Math.round(primaryArc * (isCrossRow ? 0.92 : 0.62));

  const midX = (p0A.x + p2A.x) / 2;
  const midY = (p0A.y + p2A.y) / 2;

  let rawControlA: Point2D;
  let rawControlB: Point2D;

  if (!isCrossRow) {
    // Horizontal swap: A takes the upper arc (negative Y), B takes a gentle opposing lower arc
    rawControlA = { x: midX, y: midY - primaryArc };
    rawControlB = { x: midX, y: midY + secondaryArc };
  } else if (distance > 1) {
    // Cross-row / vertical / diagonal swap: bow cleanly apart along opposing unit normals
    const nx = -dy / distance;
    const ny = dx / distance;
    const crossArc = Math.min(primaryArc, Math.round(bottleW * 1.15));
    rawControlA = { x: midX + nx * crossArc, y: midY + ny * crossArc };
    rawControlB = { x: midX - nx * crossArc, y: midY - ny * crossArc };
  } else {
    rawControlA = { x: midX, y: midY };
    rawControlB = { x: midX, y: midY };
  }

  // Clamp control points so the curve midpoint B(0.5) stays strictly inside safe bounds
  const controlBounds: SafeTrajectoryBounds | undefined =
    input.bounds !== undefined
      ? {
          minX: input.bounds.minX,
          maxX: input.bounds.maxX,
          // Keep top of bottle (y - bottleH) inside minY by reserving bottle height headroom
          minY: input.bounds.minY + bottleH * 0.55,
          maxY: input.bounds.maxY,
        }
      : undefined;

  const p1A = clampPointToBounds(rawControlA, controlBounds);
  const p1B = clampPointToBounds(rawControlB, controlBounds);

  return {
    curveA: {
      p0: p0A,
      p1: p1A,
      p2: p2A,
      distance,
      arcMagnitude: distanceBetween({ x: midX, y: midY }, p1A),
    },
    curveB: {
      p0: p0B,
      p1: p1B,
      p2: p2B,
      distance,
      arcMagnitude: distanceBetween({ x: midX, y: midY }, p1B),
    },
    isLongSwap,
    isCrossRow,
  };
}

export function sampleSwapCurve(curve: QuadraticCurveSpec, t: number): Point2D {
  return evaluateQuadraticBezier(curve.p0, curve.p1, curve.p2, t);
}
