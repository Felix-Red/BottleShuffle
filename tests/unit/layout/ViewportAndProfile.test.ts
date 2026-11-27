import { describe, expect, it, vi } from 'vitest';
import { RESPONSIVE_CONFIG } from '../../../src/config/ResponsiveConfig';
import { computeModalBounds } from '../../../src/design-system/layout/LayoutConstraints';
import { getResponsiveTokens } from '../../../src/design-system/layout/ResponsiveTokens';
import {
  isCompactProfile,
  isPortraitProfile,
  resolveLayoutProfile,
} from '../../../src/game/layout/LayoutProfileResolver';
import {
  areViewportMetricsEqual,
  clampEffectiveDpr,
  createViewportMetrics,
  normalizeSafeArea,
} from '../../../src/game/layout/ViewportMetrics';
import type { Unsubscribe } from '../../../src/platform/contracts/GamePlatform';
import type {
  ViewportChangeListener,
  ViewportProvider,
} from '../../../src/platform/contracts/ViewportProvider';
import { ResponsiveLayoutService } from '../../../src/services/ResponsiveLayoutService';

const VERIFICATION_VIEWPORTS = [
  { label: 'Compact portrait (SE)', width: 320, height: 568, expectedProfile: 'compact-portrait' },
  {
    label: 'Standard Android portrait',
    width: 360,
    height: 640,
    expectedProfile: 'compact-portrait',
  },
  { label: 'Modern iPhone portrait', width: 390, height: 844, expectedProfile: 'compact-portrait' },
  { label: 'Large phone portrait', width: 430, height: 932, expectedProfile: 'standard-portrait' },
  {
    label: 'Compact phone landscape',
    width: 568,
    height: 320,
    expectedProfile: 'compact-landscape',
  },
  {
    label: 'Standard Android landscape',
    width: 640,
    height: 360,
    expectedProfile: 'compact-landscape',
  },
  {
    label: 'Modern iPhone landscape',
    width: 844,
    height: 390,
    expectedProfile: 'compact-landscape',
  },
  { label: 'Large phone landscape', width: 932, height: 430, expectedProfile: 'compact-landscape' },
  { label: 'Tablet portrait', width: 768, height: 1024, expectedProfile: 'standard-portrait' },
  { label: 'Tablet landscape', width: 1024, height: 768, expectedProfile: 'standard-landscape' },
  { label: 'Standard desktop HD', width: 1280, height: 720, expectedProfile: 'expanded-landscape' },
  {
    label: 'Large desktop Full HD',
    width: 1920,
    height: 1080,
    expectedProfile: 'expanded-landscape',
  },
  {
    label: 'Embedded compact WebView',
    width: 600,
    height: 340,
    expectedProfile: 'compact-landscape',
  },
  {
    label: 'Embedded portrait WebView',
    width: 320,
    height: 480,
    expectedProfile: 'compact-portrait',
  },
] as const;

class FakeViewportProvider implements ViewportProvider {
  private current = createViewportMetrics({ width: 1280, height: 720 });
  private readonly listeners = new Set<ViewportChangeListener>();
  public disposed = false;

  public measure(): ReturnType<typeof createViewportMetrics> {
    return this.current;
  }

  public emit(
    width: number,
    height: number,
    safeArea?: { top?: number; right?: number; bottom?: number; left?: number },
  ): void {
    this.current = createViewportMetrics({
      width,
      height,
      ...(safeArea !== undefined ? { safeArea } : {}),
    });
    for (const listener of [...this.listeners]) {
      listener(this.current);
    }
  }

  public subscribe(listener: ViewportChangeListener): Unsubscribe {
    this.listeners.add(listener);
    return (): void => {
      this.listeners.delete(listener);
    };
  }

  public dispose(): void {
    this.disposed = true;
    this.listeners.clear();
  }
}

describe('ViewportMetrics, LayoutProfileResolver, and ResponsiveLayoutService', () => {
  it('classifies all 14 verification matrix viewports into deterministic profiles', () => {
    for (const entry of VERIFICATION_VIEWPORTS) {
      const metrics = createViewportMetrics({ width: entry.width, height: entry.height });
      const profile = resolveLayoutProfile(metrics);
      const tokens = getResponsiveTokens(profile);

      expect(profile, entry.label).toBe(entry.expectedProfile);
      expect(tokens.profile).toBe(profile);
      expect(tokens.minTouchTarget).toBeGreaterThanOrEqual(44);
      expect(isPortraitProfile(profile)).toBe(entry.height > entry.width);
    }
  });

  it('sanitizes invalid, zero, negative, and NaN viewport dimensions safely', () => {
    const nanMetrics = createViewportMetrics({
      width: Number.NaN,
      height: Number.NEGATIVE_INFINITY,
      devicePixelRatio: Number.NaN,
    });
    expect(nanMetrics.width).toBe(RESPONSIVE_CONFIG.referenceLandscape.width);
    expect(nanMetrics.height).toBe(RESPONSIVE_CONFIG.referenceLandscape.height);
    expect(nanMetrics.effectiveDpr).toBe(1);

    const tinyMetrics = createViewportMetrics({ width: 40, height: 20, devicePixelRatio: 0 });
    expect(tinyMetrics.width).toBe(RESPONSIVE_CONFIG.minViewportWidth);
    expect(tinyMetrics.height).toBe(RESPONSIVE_CONFIG.minViewportHeight);
    expect(tinyMetrics.effectiveDpr).toBe(1);
  });

  it('clamps effective device pixel ratio safely between 1 and 2', () => {
    expect(clampEffectiveDpr(undefined)).toBe(1);
    expect(clampEffectiveDpr(0.5)).toBe(1);
    expect(clampEffectiveDpr(1)).toBe(1);
    expect(clampEffectiveDpr(1.5)).toBe(1.5);
    expect(clampEffectiveDpr(2)).toBe(2);
    expect(clampEffectiveDpr(3)).toBe(2);
    expect(clampEffectiveDpr(4)).toBe(2);
  });

  it('normalizes safe-area insets and never collapses content bounds below 200px', () => {
    const normal = normalizeSafeArea({ top: 44, bottom: 34, left: 0, right: 0 }, 390, 844);
    expect(normal).toEqual({ top: 44, right: 0, bottom: 34, left: 0 });

    const extreme = normalizeSafeArea({ top: 500, bottom: 500, left: 500, right: 500 }, 320, 480);
    const metrics = createViewportMetrics({ width: 320, height: 480, safeArea: extreme });
    expect(metrics.effectiveWidth).toBeGreaterThanOrEqual(200);
    expect(metrics.effectiveHeight).toBeGreaterThanOrEqual(200);
    expect(metrics.contentBounds.right).toBeLessThanOrEqual(metrics.width);
    expect(metrics.contentBounds.bottom).toBeLessThanOrEqual(metrics.height);
  });

  it('computes modal constraints strictly inside effective content bounds across all 14 viewports', () => {
    for (const entry of VERIFICATION_VIEWPORTS) {
      const safeArea =
        entry.height > entry.width
          ? { top: 24, bottom: 20, left: 0, right: 0 }
          : { top: 0, bottom: 12, left: 24, right: 24 };
      const viewport = createViewportMetrics({
        width: entry.width,
        height: entry.height,
        safeArea,
      });
      const bounds = computeModalBounds(viewport);
      expect(bounds.width).toBeLessThanOrEqual(viewport.effectiveWidth);
      expect(bounds.maxHeight).toBeLessThanOrEqual(viewport.effectiveHeight);
      expect(bounds.centerX - bounds.width / 2).toBeGreaterThanOrEqual(viewport.contentBounds.x);
      expect(bounds.centerX + bounds.width / 2).toBeLessThanOrEqual(viewport.contentBounds.right);
      expect(bounds.buttonHeight).toBeGreaterThanOrEqual(44);
    }
  });

  it('deduplicates unchanged viewport updates and cleans up listeners on dispose', () => {
    const provider = new FakeViewportProvider();
    const service = new ResponsiveLayoutService(provider);
    const listener = vi.fn();
    const unsubscribe = service.subscribe(listener);

    expect(service.getLayoutProfile()).toBe('expanded-landscape');
    expect(isCompactProfile(service.getLayoutProfile())).toBe(false);

    // Same dimensions -> suppressed
    provider.emit(1280, 720);
    expect(listener).not.toHaveBeenCalled();

    // Orientation switch -> notified once
    provider.emit(390, 844, { top: 44, bottom: 34 });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(service.getLayoutProfile()).toBe('compact-portrait');
    expect(isCompactProfile(service.getLayoutProfile())).toBe(true);
    expect(service.getViewport().safeArea.top).toBe(44);

    // Equality check helper
    expect(
      areViewportMetricsEqual(
        createViewportMetrics({ width: 390, height: 844, safeArea: { top: 44, bottom: 34 } }),
        service.getViewport(),
      ),
    ).toBe(true);

    unsubscribe();
    provider.emit(844, 390);
    expect(listener).toHaveBeenCalledTimes(1);

    service.dispose();
    expect(provider.disposed).toBe(true);
    expect(service.updateViewport({ width: 1024, height: 768 })).toBe(false);
  });
});
