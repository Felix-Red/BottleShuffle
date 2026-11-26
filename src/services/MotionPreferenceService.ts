import type { Unsubscribe } from '../platform/contracts/GamePlatform';

export type ReducedMotionListener = (reducedMotion: boolean) => void;

export interface MediaQueryLike {
  readonly matches: boolean;
  addEventListener?: (
    type: 'change',
    listener: (event: { readonly matches: boolean }) => void,
  ) => void;
  removeEventListener?: (
    type: 'change',
    listener: (event: { readonly matches: boolean }) => void,
  ) => void;
}

export type MatchMediaProvider = (query: string) => MediaQueryLike | null;

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function getDefaultMatchMedia(): MatchMediaProvider | null {
  if (
    typeof globalThis.window !== 'undefined' &&
    typeof globalThis.window.matchMedia === 'function'
  ) {
    return (query: string) => globalThis.window.matchMedia(query);
  }
  return null;
}

/**
 * Centralised runtime motion preference service.
 * Tracks browser prefers-reduced-motion media queries and allows programmatic
 * overrides (e.g. showcase or future settings screen) without persisting state.
 */
export class MotionPreferenceService {
  private mediaQuery: MediaQueryLike | null = null;
  private systemReducedMotion = false;
  private manualOverride: boolean | null = null;
  private readonly listeners = new Set<ReducedMotionListener>();
  private disposed = false;

  public constructor(matchMediaProvider?: MatchMediaProvider | null) {
    const provider = matchMediaProvider === undefined ? getDefaultMatchMedia() : matchMediaProvider;
    if (provider !== null) {
      this.mediaQuery = provider(REDUCED_MOTION_QUERY);
      if (this.mediaQuery !== null) {
        this.systemReducedMotion = this.mediaQuery.matches;
        this.mediaQuery.addEventListener?.('change', this.handleMediaChange);
      }
    }
  }

  public isReducedMotion(): boolean {
    return this.manualOverride ?? this.systemReducedMotion;
  }

  public getSystemReducedMotion(): boolean {
    return this.systemReducedMotion;
  }

  public getOverride(): boolean | null {
    return this.manualOverride;
  }

  /**
   * Programmatically forces reduced motion on/off, or clears override with null
   * to follow the system preference again.
   */
  public setOverride(override: boolean | null): void {
    if (this.disposed) {
      return;
    }
    const previous = this.isReducedMotion();
    this.manualOverride = override;
    const next = this.isReducedMotion();
    if (next !== previous) {
      this.notify(next);
    }
  }

  public onChange(listener: ReducedMotionListener): Unsubscribe {
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
    this.mediaQuery?.removeEventListener?.('change', this.handleMediaChange);
    this.mediaQuery = null;
    this.listeners.clear();
  }

  private readonly handleMediaChange = (event: { readonly matches: boolean }): void => {
    if (this.disposed) {
      return;
    }
    const previous = this.isReducedMotion();
    this.systemReducedMotion = event.matches;
    const next = this.isReducedMotion();
    if (next !== previous) {
      this.notify(next);
    }
  };

  private notify(reducedMotion: boolean): void {
    for (const listener of [...this.listeners]) {
      listener(reducedMotion);
    }
  }
}
