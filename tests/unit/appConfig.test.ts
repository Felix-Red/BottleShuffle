import { describe, expect, it } from 'vitest';
import {
  APP_METADATA,
  computeViewportMetrics,
  REFERENCE_RESOLUTION,
} from '../../src/config/appConfig';
import { Colors } from '../../src/design-system/tokens/Colors';

describe('appConfig and viewport metrics', () => {
  it('defines a landscape-first 1280x720 reference resolution', () => {
    expect(REFERENCE_RESOLUTION).toEqual({ width: 1280, height: 720 });
    expect(APP_METADATA.containerId).toBe('game-container');
    expect(Colors.Surface.Background).toBe('#171126');
  });

  it('returns scale 1.0 at the exact landscape reference resolution', () => {
    const metrics = computeViewportMetrics(1280, 720);

    expect(metrics).toEqual({
      width: 1280,
      height: 720,
      orientation: 'landscape',
      scale: 1,
    });
  });

  it('adapts cleanly to portrait viewports without forcing landscape', () => {
    const metrics = computeViewportMetrics(390, 844);

    expect(metrics.orientation).toBe('portrait');
    expect(metrics.scale).toBeCloseTo(390 / 720, 4);
  });

  it('handles square and zero-size initial viewports safely', () => {
    const square = computeViewportMetrics(600, 600);
    expect(square.orientation).toBe('landscape');
    expect(square.scale).toBeGreaterThan(0);

    const zeroViewport = computeViewportMetrics(0, 0);
    expect(zeroViewport.width).toBe(1);
    expect(zeroViewport.height).toBe(1);
    expect(zeroViewport.scale).toBeGreaterThan(0);
  });
});
