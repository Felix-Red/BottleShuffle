import type { ViewportMetrics } from '../../game/layout/ViewportMetrics';
import type { Unsubscribe } from './GamePlatform';

export type ViewportChangeListener = (metrics: ViewportMetrics) => void;

/**
 * Platform-independent contract for measuring and observing the game container viewport.
 * Keeps DOM ResizeObserver and CSS safe-area measurement outside pure layout calculators.
 */
export interface ViewportProvider {
  measure(): ViewportMetrics;
  subscribe(listener: ViewportChangeListener): Unsubscribe;
  dispose(): void;
}
