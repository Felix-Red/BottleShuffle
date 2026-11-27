import { RESPONSIVE_CONFIG } from '../../config/ResponsiveConfig';
import type { LayoutProfile } from './LayoutProfile';
import type { ViewportMetrics } from './ViewportMetrics';

/**
 * Single authoritative responsive layout profile classifier.
 * Decisions are strictly based on measured container dimensions (never UA sniffing).
 */
export function resolveLayoutProfile(
  viewport: Pick<ViewportMetrics, 'width' | 'height'>,
): LayoutProfile {
  const { width, height } = viewport;
  const { breakpoints } = RESPONSIVE_CONFIG;

  if (height > width) {
    return width < breakpoints.compactPortraitMaxWidth ? 'compact-portrait' : 'standard-portrait';
  }

  if (height < breakpoints.compactLandscapeMaxHeight) {
    return 'compact-landscape';
  }

  if (
    width >= breakpoints.expandedLandscapeMinWidth &&
    height >= breakpoints.expandedLandscapeMinHeight
  ) {
    return 'expanded-landscape';
  }

  return 'standard-landscape';
}

export function isPortraitProfile(profile: LayoutProfile): boolean {
  return profile === 'compact-portrait' || profile === 'standard-portrait';
}

export function isCompactProfile(profile: LayoutProfile): boolean {
  return profile === 'compact-portrait' || profile === 'compact-landscape';
}
