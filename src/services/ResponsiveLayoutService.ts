import {
  getResponsiveTokens,
  type ResponsiveDesignTokens,
} from '../design-system/layout/ResponsiveTokens';
import type { LayoutProfile } from '../game/layout/LayoutProfile';
import { resolveLayoutProfile } from '../game/layout/LayoutProfileResolver';
import {
  areViewportMetricsEqual,
  createViewportMetrics,
  type ContentBounds,
  type ViewportMeasurementInput,
  type ViewportMetrics,
} from '../game/layout/ViewportMetrics';
import type { Unsubscribe } from '../platform/contracts/GamePlatform';
import type { ViewportProvider } from '../platform/contracts/ViewportProvider';

export interface ResponsiveSnapshot {
  readonly viewport: ViewportMetrics;
  readonly profile: LayoutProfile;
  readonly contentBounds: ContentBounds;
  readonly tokens: ResponsiveDesignTokens;
}

export type ResponsiveLayoutListener = (snapshot: ResponsiveSnapshot) => void;

/**
 * Shared application-level responsive layout coordinator.
 * Receives container viewport measurements from ViewportProvider (or manual overrides
 * in tests/dev showcase), resolves the canonical LayoutProfile and ResponsiveDesignTokens,
 * and broadcasts deduplicated immutable snapshots to subscribed scenes.
 */
export class ResponsiveLayoutService {
  private readonly provider?: ViewportProvider;
  private readonly listeners = new Set<ResponsiveLayoutListener>();
  private unsubscribeProvider?: Unsubscribe;
  private currentViewport: ViewportMetrics;
  private currentProfile: LayoutProfile;
  private currentTokens: ResponsiveDesignTokens;
  private disposed = false;

  public constructor(provider?: ViewportProvider, initialInput?: ViewportMeasurementInput) {
    this.provider = provider;
    this.currentViewport =
      initialInput !== undefined
        ? createViewportMetrics(initialInput)
        : provider !== undefined
          ? provider.measure()
          : createViewportMetrics({ width: 1280, height: 720 });
    this.currentProfile = resolveLayoutProfile(this.currentViewport);
    this.currentTokens = getResponsiveTokens(this.currentProfile);

    if (provider !== undefined) {
      this.unsubscribeProvider = provider.subscribe((metrics) => {
        this.applyViewport(metrics);
      });
    }
  }

  public getViewport(): ViewportMetrics {
    return this.currentViewport;
  }

  public getLayoutProfile(): LayoutProfile {
    return this.currentProfile;
  }

  public getContentBounds(): ContentBounds {
    return this.currentViewport.contentBounds;
  }

  public getResponsiveTokens(): ResponsiveDesignTokens {
    return this.currentTokens;
  }

  public getSnapshot(): ResponsiveSnapshot {
    return Object.freeze({
      viewport: this.currentViewport,
      profile: this.currentProfile,
      contentBounds: this.currentViewport.contentBounds,
      tokens: this.currentTokens,
    });
  }

  /**
   * Updates viewport metrics (e.g. from Phaser Scale RESIZE or test harnesses).
   * Suppresses duplicate notifications when dimensions, safe areas, and DPR are unchanged.
   */
  public updateViewport(input: ViewportMeasurementInput): boolean {
    if (this.disposed) {
      return false;
    }
    return this.applyViewport(createViewportMetrics(input));
  }

  public subscribe(listener: ResponsiveLayoutListener): Unsubscribe {
    if (this.disposed) {
      return () => undefined;
    }
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.unsubscribeProvider?.();
    this.unsubscribeProvider = undefined;
    this.provider?.dispose();
    this.listeners.clear();
  }

  private applyViewport(next: ViewportMetrics): boolean {
    if (this.disposed || areViewportMetricsEqual(this.currentViewport, next)) {
      return false;
    }
    this.currentViewport = next;
    this.currentProfile = resolveLayoutProfile(next);
    this.currentTokens = getResponsiveTokens(this.currentProfile);
    const snapshot = this.getSnapshot();
    for (const listener of [...this.listeners]) {
      listener(snapshot);
    }
    return true;
  }
}
