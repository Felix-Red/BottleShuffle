export const APP_VERSION = '1.0.0-rc.1';
export const CAMPAIGN_CATALOG_VERSION = '2.0.0';

export const APP_METADATA = {
  title: 'BOTTLE SHUFFLE',
  version: APP_VERSION,
  campaignCatalogVersion: CAMPAIGN_CATALOG_VERSION,
  buildLabel: `Release Candidate · v${APP_VERSION}`,
  statusLabel: 'Engine initialised',
  studioLabel: 'CROWDARCADE',
  containerId: 'game-container',
} as const;

export const REFERENCE_RESOLUTION = {
  width: 1280,
  height: 720,
} as const;

export type ViewportOrientation = 'landscape' | 'portrait';

export interface ViewportMetrics {
  readonly width: number;
  readonly height: number;
  readonly orientation: ViewportOrientation;
  readonly scale: number;
}

const MIN_VIEWPORT_DIMENSION = 1;
const MIN_LAYOUT_SCALE = 0.35;
const MAX_LAYOUT_SCALE = 1.6;

export function computeViewportMetrics(width: number, height: number): ViewportMetrics {
  const safeWidth = Math.max(MIN_VIEWPORT_DIMENSION, width);
  const safeHeight = Math.max(MIN_VIEWPORT_DIMENSION, height);
  const orientation: ViewportOrientation = safeWidth >= safeHeight ? 'landscape' : 'portrait';

  const referenceWidth =
    orientation === 'landscape' ? REFERENCE_RESOLUTION.width : REFERENCE_RESOLUTION.height;
  const referenceHeight =
    orientation === 'landscape' ? REFERENCE_RESOLUTION.height : REFERENCE_RESOLUTION.width;

  const rawScale = Math.min(safeWidth / referenceWidth, safeHeight / referenceHeight);
  const scale = Math.min(MAX_LAYOUT_SCALE, Math.max(MIN_LAYOUT_SCALE, rawScale));

  return {
    width: safeWidth,
    height: safeHeight,
    orientation,
    scale,
  };
}
