import { resolveEffectiveReducedMotion, type MotionPreference } from '../core';
import type { Unsubscribe } from '../platform/contracts/GamePlatform';
import type { SettingsService } from './SettingsService';

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
 * Combines the host browser's `prefers-reduced-motion` media query with the shared
 * SettingsService's `motionPreference` (`'system' | 'reduced'`).
 *
 * Accessibility invariant: when the system requests reduced motion, effective reduced
 * motion is ALWAYS true regardless of the in-game preference.
 */
export class MotionPreferenceService {
  private mediaQuery: MediaQueryLike | null = null;
  private systemReducedMotion = false;
  private manualOverride: boolean | null = null;
  private readonly settingsService?: SettingsService;
  private unsubscribeSettings?: Unsubscribe;
  private readonly listeners = new Set<ReducedMotionListener>();
  private lastEffectiveReducedMotion = false;
  private disposed = false;

  public constructor(
    matchMediaProvider?: MatchMediaProvider | null,
    settingsService?: SettingsService,
  ) {
    this.settingsService = settingsService;
    const provider = matchMediaProvider === undefined ? getDefaultMatchMedia() : matchMediaProvider;

    if (provider !== null) {
      this.mediaQuery = provider(REDUCED_MOTION_QUERY);
      if (this.mediaQuery !== null) {
        this.systemReducedMotion = this.mediaQuery.matches;
        this.mediaQuery.addEventListener?.('change', this.handleMediaChange);
      }
    }

    if (this.settingsService !== undefined) {
      this.unsubscribeSettings = this.settingsService.subscribe(() => {
        this.syncAndNotifyIfChanged();
      });
    }

    this.lastEffectiveReducedMotion = this.computeEffectiveReducedMotion();
  }

  public isReducedMotion(): boolean {
    return this.computeEffectiveReducedMotion();
  }

  public getSystemReducedMotion(): boolean {
    return this.systemReducedMotion;
  }

  public getMotionPreference(): MotionPreference {
    if (this.settingsService !== undefined) {
      return this.settingsService.getSettings().motionPreference;
    }
    return this.manualOverride === true ? 'reduced' : 'system';
  }

  public getOverride(): boolean | null {
    return this.manualOverride;
  }

  /**
   * Programmatically sets a reduced-motion preference:
   * - When bound to SettingsService, maps `true` -> `'reduced'` and `false | null` -> `'system'`
   *   so system accessibility preferences are never weakened.
   * - When standalone (e.g. legacy tests or showcase), retains explicit override semantics.
   */
  public setOverride(override: boolean | null): void {
    if (this.disposed) {
      return;
    }

    if (this.settingsService !== undefined) {
      this.settingsService.setMotionPreference(override === true ? 'reduced' : 'system');
      this.syncAndNotifyIfChanged();
      return;
    }

    this.manualOverride = override;
    this.syncAndNotifyIfChanged();
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
    this.unsubscribeSettings?.();
    this.unsubscribeSettings = undefined;
    this.listeners.clear();
  }

  private computeEffectiveReducedMotion(): boolean {
    if (this.settingsService !== undefined) {
      const preference = this.settingsService.getSettings().motionPreference;
      return resolveEffectiveReducedMotion(preference, this.systemReducedMotion);
    }
    if (this.manualOverride === true) {
      return true;
    }
    if (this.manualOverride === false) {
      return false;
    }
    return this.systemReducedMotion;
  }

  private syncAndNotifyIfChanged(): void {
    if (this.disposed) {
      return;
    }
    const next = this.computeEffectiveReducedMotion();
    if (next !== this.lastEffectiveReducedMotion) {
      this.lastEffectiveReducedMotion = next;
      this.notify(next);
    }
  }

  private readonly handleMediaChange = (event: { readonly matches: boolean }): void => {
    if (this.disposed) {
      return;
    }
    this.systemReducedMotion = event.matches;
    this.syncAndNotifyIfChanged();
  };

  private notify(reducedMotion: boolean): void {
    for (const listener of [...this.listeners]) {
      listener(reducedMotion);
    }
  }
}
