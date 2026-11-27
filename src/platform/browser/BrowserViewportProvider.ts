import { APP_METADATA } from '../../config/appConfig';
import {
  areViewportMetricsEqual,
  createViewportMetrics,
  ZERO_SAFE_AREA,
  type SafeAreaInsets,
  type ViewportMetrics,
} from '../../game/layout/ViewportMetrics';
import type { Unsubscribe } from '../contracts/GamePlatform';
import type { ViewportChangeListener, ViewportProvider } from '../contracts/ViewportProvider';

export interface BrowserViewportProviderOptions {
  readonly container?: HTMLElement | null;
  readonly containerId?: string;
}

function parseCssPixelValue(raw: string): number {
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
}

function readSafeAreaInsetsFromCss(): SafeAreaInsets {
  if (
    typeof globalThis.document === 'undefined' ||
    typeof globalThis.getComputedStyle !== 'function'
  ) {
    return ZERO_SAFE_AREA;
  }

  try {
    const style = globalThis.getComputedStyle(globalThis.document.documentElement);
    return Object.freeze({
      top: parseCssPixelValue(style.getPropertyValue('--sat')),
      right: parseCssPixelValue(style.getPropertyValue('--sar')),
      bottom: parseCssPixelValue(style.getPropertyValue('--sab')),
      left: parseCssPixelValue(style.getPropertyValue('--sal')),
    });
  } catch {
    return ZERO_SAFE_AREA;
  }
}

/**
 * Browser viewport provider measuring the actual game container via ResizeObserver
 * (with window resize + orientationchange fallback), reading CSS env(safe-area-inset-*)
 * custom properties, and coalescing rapid resize bursts per animation frame.
 */
export class BrowserViewportProvider implements ViewportProvider {
  private readonly container: HTMLElement | null;
  private readonly listeners = new Set<ViewportChangeListener>();
  private resizeObserver: ResizeObserver | null = null;
  private rafId: number | null = null;
  private lastMetrics: ViewportMetrics;
  private observing = false;
  private disposed = false;

  private readonly scheduleCoalescedEmit = (): void => {
    if (this.disposed || this.rafId !== null) {
      return;
    }

    if (typeof globalThis.requestAnimationFrame === 'function') {
      this.rafId = globalThis.requestAnimationFrame(() => {
        this.rafId = null;
        this.emitIfChanged();
      });
    } else {
      this.emitIfChanged();
    }
  };

  public constructor(options: BrowserViewportProviderOptions = {}) {
    if (options.container !== undefined) {
      this.container = options.container;
    } else if (typeof globalThis.document !== 'undefined') {
      this.container = globalThis.document.getElementById(
        options.containerId ?? APP_METADATA.containerId,
      );
    } else {
      this.container = null;
    }

    this.lastMetrics = this.measure();
  }

  public measure(): ViewportMetrics {
    let width = 1280;
    let height = 720;

    if (this.container !== null) {
      const rect = this.container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        width = rect.width;
        height = rect.height;
      } else if (this.container.clientWidth > 0 && this.container.clientHeight > 0) {
        width = this.container.clientWidth;
        height = this.container.clientHeight;
      }
    } else if (typeof globalThis.window !== 'undefined') {
      width = globalThis.window.innerWidth;
      height = globalThis.window.innerHeight;
    }

    const dpr =
      typeof globalThis.window !== 'undefined' &&
      Number.isFinite(globalThis.window.devicePixelRatio)
        ? globalThis.window.devicePixelRatio
        : 1;

    return createViewportMetrics({
      width,
      height,
      devicePixelRatio: dpr,
      safeArea: readSafeAreaInsetsFromCss(),
    });
  }

  public subscribe(listener: ViewportChangeListener): Unsubscribe {
    if (this.disposed) {
      return () => undefined;
    }
    this.listeners.add(listener);
    this.ensureObserving();
    return () => {
      this.listeners.delete(listener);
    };
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;

    if (this.rafId !== null && typeof globalThis.cancelAnimationFrame === 'function') {
      globalThis.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (this.resizeObserver !== null) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    if (this.observing && typeof globalThis.window !== 'undefined') {
      globalThis.window.removeEventListener('resize', this.scheduleCoalescedEmit);
      globalThis.window.removeEventListener('orientationchange', this.scheduleCoalescedEmit);
      this.observing = false;
    }

    this.listeners.clear();
  }

  private ensureObserving(): void {
    if (this.observing || this.disposed) {
      return;
    }
    this.observing = true;

    if (typeof globalThis.ResizeObserver === 'function' && this.container !== null) {
      this.resizeObserver = new globalThis.ResizeObserver(() => {
        this.scheduleCoalescedEmit();
      });
      this.resizeObserver.observe(this.container);
    }

    if (typeof globalThis.window !== 'undefined') {
      globalThis.window.addEventListener('resize', this.scheduleCoalescedEmit);
      globalThis.window.addEventListener('orientationchange', this.scheduleCoalescedEmit);
    }
  }

  private emitIfChanged(): void {
    if (this.disposed) {
      return;
    }
    const next = this.measure();
    if (areViewportMetricsEqual(this.lastMetrics, next)) {
      return;
    }
    this.lastMetrics = next;
    for (const listener of [...this.listeners]) {
      listener(next);
    }
  }
}
