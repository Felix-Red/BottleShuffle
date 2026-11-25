export type ElevationLevel = 'flat' | 'low' | 'medium' | 'high' | 'floating';

export interface ElevationStyle {
  readonly level: ElevationLevel;
  readonly shadowOffsetY: number;
  readonly shadowAlpha: number;
  readonly shadowExpand: number;
  readonly bottomDepth: number;
  readonly borderAlpha: number;
  readonly highlightAlpha: number;
}

export const Elevation: Record<Capitalize<ElevationLevel>, ElevationStyle> = {
  Flat: {
    level: 'flat',
    shadowOffsetY: 0,
    shadowAlpha: 0,
    shadowExpand: 0,
    bottomDepth: 0,
    borderAlpha: 0.35,
    highlightAlpha: 0,
  },
  Low: {
    level: 'low',
    shadowOffsetY: 3,
    shadowAlpha: 0.24,
    shadowExpand: 0,
    bottomDepth: 2,
    borderAlpha: 0.5,
    highlightAlpha: 0.06,
  },
  Medium: {
    level: 'medium',
    shadowOffsetY: 5,
    shadowAlpha: 0.32,
    shadowExpand: 1,
    bottomDepth: 4,
    borderAlpha: 0.65,
    highlightAlpha: 0.1,
  },
  High: {
    level: 'high',
    shadowOffsetY: 8,
    shadowAlpha: 0.42,
    shadowExpand: 2,
    bottomDepth: 5,
    borderAlpha: 0.8,
    highlightAlpha: 0.14,
  },
  Floating: {
    level: 'floating',
    shadowOffsetY: 12,
    shadowAlpha: 0.52,
    shadowExpand: 3,
    bottomDepth: 0,
    borderAlpha: 0.9,
    highlightAlpha: 0.16,
  },
} as const;

export function getElevationStyle(level: ElevationLevel): ElevationStyle {
  switch (level) {
    case 'flat':
      return Elevation.Flat;
    case 'low':
      return Elevation.Low;
    case 'medium':
      return Elevation.Medium;
    case 'high':
      return Elevation.High;
    case 'floating':
      return Elevation.Floating;
  }
}
