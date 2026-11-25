import { Dimens } from './Dimens';

export const ReferenceViewport = {
  LandscapeWidth: 1280,
  LandscapeHeight: 720,
  PortraitWidth: 720,
  PortraitHeight: 1280,
} as const;

export const BreakpointThresholds = {
  CompactMaxWidth: 640,
  MediumMaxWidth: 1024,
  CompactMaxHeight: 480,
} as const;

export type ViewportOrientation = 'landscape' | 'portrait';
export type BreakpointSize = 'compact' | 'medium' | 'expanded';
export type AspectCategory = 'portrait' | 'square' | 'standard' | 'wide';

export interface ResponsiveLayoutContext {
  readonly width: number;
  readonly height: number;
  readonly aspectRatio: number;
  readonly orientation: ViewportOrientation;
  readonly breakpoint: BreakpointSize;
  readonly aspectCategory: AspectCategory;
  readonly scale: number;
  readonly screenPadding: number;
  readonly contentWidth: number;
  readonly maxContentWidth: number;
  readonly columns: number;
  readonly isCompact: boolean;
}

const MIN_VIEWPORT_SIZE = 1;
const MIN_SCALE = 0.5;
const MAX_SCALE = 1.45;
const MAX_CONTENT_WIDTH_EXPANDED = 1120;
const MAX_CONTENT_WIDTH_MEDIUM = 860;

export function resolveBreakpoint(width: number, height: number): BreakpointSize {
  const safeWidth = Math.max(MIN_VIEWPORT_SIZE, width);
  const safeHeight = Math.max(MIN_VIEWPORT_SIZE, height);

  if (
    safeWidth < BreakpointThresholds.CompactMaxWidth ||
    safeHeight < BreakpointThresholds.CompactMaxHeight
  ) {
    return 'compact';
  }

  if (safeWidth < BreakpointThresholds.MediumMaxWidth) {
    return 'medium';
  }

  return 'expanded';
}

export function resolveAspectCategory(width: number, height: number): AspectCategory {
  const safeWidth = Math.max(MIN_VIEWPORT_SIZE, width);
  const safeHeight = Math.max(MIN_VIEWPORT_SIZE, height);
  const ratio = safeWidth / safeHeight;

  if (ratio < 0.85) {
    return 'portrait';
  }
  if (ratio <= 1.2) {
    return 'square';
  }
  if (ratio <= 1.9) {
    return 'standard';
  }
  return 'wide';
}

export function resolveLayoutContext(width: number, height: number): ResponsiveLayoutContext {
  const safeWidth = Math.max(MIN_VIEWPORT_SIZE, width);
  const safeHeight = Math.max(MIN_VIEWPORT_SIZE, height);
  const aspectRatio = safeWidth / safeHeight;
  const orientation: ViewportOrientation = safeWidth >= safeHeight ? 'landscape' : 'portrait';
  const breakpoint = resolveBreakpoint(safeWidth, safeHeight);
  const aspectCategory = resolveAspectCategory(safeWidth, safeHeight);

  const refWidth =
    orientation === 'landscape'
      ? ReferenceViewport.LandscapeWidth
      : ReferenceViewport.PortraitWidth;
  const refHeight =
    orientation === 'landscape'
      ? ReferenceViewport.LandscapeHeight
      : ReferenceViewport.PortraitHeight;

  const rawScale = Math.min(safeWidth / refWidth, safeHeight / refHeight);
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, rawScale));

  const isCompact = breakpoint === 'compact';
  const screenPadding = isCompact ? Dimens.ScreenPaddingCompact : Dimens.ScreenPadding;
  const maxContentWidth =
    breakpoint === 'expanded'
      ? MAX_CONTENT_WIDTH_EXPANDED
      : breakpoint === 'medium'
        ? MAX_CONTENT_WIDTH_MEDIUM
        : safeWidth - screenPadding * 2;
  const contentWidth = Math.max(
    MIN_VIEWPORT_SIZE,
    Math.min(safeWidth - screenPadding * 2, maxContentWidth),
  );

  const columns =
    orientation === 'portrait'
      ? breakpoint === 'compact'
        ? 1
        : 2
      : breakpoint === 'compact'
        ? 2
        : 3;

  return {
    width: safeWidth,
    height: safeHeight,
    aspectRatio,
    orientation,
    breakpoint,
    aspectCategory,
    scale,
    screenPadding,
    contentWidth,
    maxContentWidth,
    columns,
    isCompact,
  };
}

export function ensureMinimumTouchTarget(
  logicalSize: number,
  currentScale = 1,
  minTargetPx: number = Dimens.MinTouchTarget,
): number {
  const safeScale = Math.max(0.1, currentScale);
  const requiredLogicalSize = Math.ceil(minTargetPx / safeScale);
  return Math.max(logicalSize, requiredLogicalSize);
}
