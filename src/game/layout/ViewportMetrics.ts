import { RESPONSIVE_CONFIG } from '../../config/ResponsiveConfig';

export type LayoutOrientation = 'landscape' | 'portrait';

export interface SafeAreaInsets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

export interface PartialSafeAreaInsets {
  readonly top?: number;
  readonly right?: number;
  readonly bottom?: number;
  readonly left?: number;
}

export interface ContentBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly right: number;
  readonly bottom: number;
  readonly centerX: number;
  readonly centerY: number;
}

export interface ViewportMetrics {
  readonly width: number;
  readonly height: number;
  readonly aspectRatio: number;
  readonly orientation: LayoutOrientation;
  readonly devicePixelRatio: number;
  readonly effectiveDpr: number;
  readonly safeArea: SafeAreaInsets;
  readonly effectiveWidth: number;
  readonly effectiveHeight: number;
  readonly contentBounds: ContentBounds;
}

export interface ViewportMeasurementInput {
  readonly width: number;
  readonly height: number;
  readonly devicePixelRatio?: number;
  readonly safeArea?: PartialSafeAreaInsets;
}

export const ZERO_SAFE_AREA: SafeAreaInsets = Object.freeze({
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
});

function sanitizeDimension(value: number, fallback: number, minVal: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.max(minVal, Math.round(value));
}

function sanitizeInset(value: number | undefined, maxAllowed: number): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.min(Math.max(0, Math.round(value)), maxAllowed);
}

export function clampEffectiveDpr(rawDpr: number | undefined): number {
  if (rawDpr === undefined || !Number.isFinite(rawDpr) || rawDpr <= 0) {
    return RESPONSIVE_CONFIG.minEffectiveDpr;
  }
  return Math.min(
    RESPONSIVE_CONFIG.maxEffectiveDpr,
    Math.max(RESPONSIVE_CONFIG.minEffectiveDpr, rawDpr),
  );
}

export function normalizeSafeArea(
  insets: PartialSafeAreaInsets | undefined,
  viewportWidth: number,
  viewportHeight: number,
): SafeAreaInsets {
  if (insets === undefined) {
    return ZERO_SAFE_AREA;
  }
  // Never allow safe-area insets to collapse usable content below 200px
  const maxHorizontal = Math.max(0, Math.floor((viewportWidth - 200) / 2));
  const maxVertical = Math.max(0, Math.floor((viewportHeight - 200) / 2));
  return Object.freeze({
    top: sanitizeInset(insets.top, maxVertical),
    right: sanitizeInset(insets.right, maxHorizontal),
    bottom: sanitizeInset(insets.bottom, maxVertical),
    left: sanitizeInset(insets.left, maxHorizontal),
  });
}

export function createViewportMetrics(input: ViewportMeasurementInput): ViewportMetrics {
  const width = sanitizeDimension(
    input.width,
    RESPONSIVE_CONFIG.referenceLandscape.width,
    RESPONSIVE_CONFIG.minViewportWidth,
  );
  const height = sanitizeDimension(
    input.height,
    RESPONSIVE_CONFIG.referenceLandscape.height,
    RESPONSIVE_CONFIG.minViewportHeight,
  );
  const safeArea = normalizeSafeArea(input.safeArea, width, height);
  const effectiveWidth = Math.max(200, width - safeArea.left - safeArea.right);
  const effectiveHeight = Math.max(200, height - safeArea.top - safeArea.bottom);
  const orientation: LayoutOrientation = height > width ? 'portrait' : 'landscape';
  const rawDpr =
    input.devicePixelRatio !== undefined &&
    Number.isFinite(input.devicePixelRatio) &&
    input.devicePixelRatio > 0
      ? input.devicePixelRatio
      : 1;
  const effectiveDpr = clampEffectiveDpr(rawDpr);

  const contentBounds: ContentBounds = Object.freeze({
    x: safeArea.left,
    y: safeArea.top,
    width: effectiveWidth,
    height: effectiveHeight,
    right: safeArea.left + effectiveWidth,
    bottom: safeArea.top + effectiveHeight,
    centerX: Math.round(safeArea.left + effectiveWidth / 2),
    centerY: Math.round(safeArea.top + effectiveHeight / 2),
  });

  return Object.freeze({
    width,
    height,
    aspectRatio: width / height,
    orientation,
    devicePixelRatio: rawDpr,
    effectiveDpr,
    safeArea,
    effectiveWidth,
    effectiveHeight,
    contentBounds,
  });
}

export function areViewportMetricsEqual(a: ViewportMetrics, b: ViewportMetrics): boolean {
  return (
    a.width === b.width &&
    a.height === b.height &&
    a.effectiveDpr === b.effectiveDpr &&
    a.safeArea.top === b.safeArea.top &&
    a.safeArea.right === b.safeArea.right &&
    a.safeArea.bottom === b.safeArea.bottom &&
    a.safeArea.left === b.safeArea.left
  );
}
