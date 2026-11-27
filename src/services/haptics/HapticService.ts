import type { Unsubscribe } from '../../platform/contracts/GamePlatform';
import type { SettingsService } from '../SettingsService';
import type { HapticBackend } from './HapticBackend';
import { HAPTIC_CONFIG, type HapticMixConfig } from './HapticConfig';
import type { HapticEvent, HapticSuspensionReason } from './HapticPattern';

export interface HapticServiceOptions {
  readonly backend: HapticBackend;
  readonly settingsService: SettingsService;
  readonly config?: HapticMixConfig;
  readonly now?: () => number;
}

export interface HapticStateSnapshot {
  readonly supported: boolean;
  readonly enabled: boolean;
  readonly isSuspended: boolean;
  readonly activeSuspensionReasons: readonly HapticSuspensionReason[];
}

/**
 * Capability-aware haptic feedback service bound to SettingsService.vibrationEnabled.
 * Remains strictly optional, disabled by default, silent on unsupported devices,
 * cancels active vibration on disable/suspend, and isolates host vibration failures.
 */
export class HapticService {
  private readonly backend: HapticBackend;
  private readonly settingsService: SettingsService;
  private readonly config: HapticMixConfig;
  private readonly now: () => number;

  private readonly suspensionReasons = new Set<HapticSuspensionReason>();
  private readonly unsubscribeSettings: Unsubscribe;

  private lastTriggeredAt = Number.NEGATIVE_INFINITY;
  private lastPriority = 0;
  private disposed = false;

  public constructor(options: HapticServiceOptions) {
    this.backend = options.backend;
    this.settingsService = options.settingsService;
    this.config = options.config ?? HAPTIC_CONFIG;
    this.now = options.now ?? (() => Date.now());

    this.unsubscribeSettings = this.settingsService.subscribe((settings) => {
      if (!settings.vibrationEnabled) {
        this.cancel();
      }
    });
  }

  public isSupported(): boolean {
    if (this.disposed) {
      return false;
    }
    try {
      return this.backend.isSupported();
    } catch {
      return false;
    }
  }

  public getState(): HapticStateSnapshot {
    const reasons = Object.freeze([...this.suspensionReasons]);
    return Object.freeze({
      supported: this.isSupported(),
      enabled: this.settingsService.getSettings().vibrationEnabled,
      isSuspended: reasons.length > 0,
      activeSuspensionReasons: reasons,
    });
  }

  public suspend(reason: HapticSuspensionReason): void {
    if (this.disposed || this.suspensionReasons.has(reason)) {
      return;
    }
    this.suspensionReasons.add(reason);
    this.cancel();
  }

  public resume(reason: HapticSuspensionReason): void {
    if (this.disposed) {
      return;
    }
    this.suspensionReasons.delete(reason);
  }

  public trigger(event: HapticEvent): boolean {
    if (this.disposed || this.suspensionReasons.size > 0) {
      return false;
    }
    if (!this.settingsService.getSettings().vibrationEnabled) {
      return false;
    }
    if (!this.isSupported()) {
      return false;
    }

    const spec = this.config.patterns[event];
    const currentTime = this.now();
    const withinCooldown = currentTime - this.lastTriggeredAt < this.config.minCooldownMs;

    // Higher-priority cues (e.g. victory) take precedence over weaker overlapping cues.
    if (withinCooldown && spec.priority <= this.lastPriority) {
      return false;
    }

    try {
      if (withinCooldown && spec.priority > this.lastPriority) {
        this.backend.cancel();
      }
      const fired = this.backend.vibrate(spec.pattern);
      if (fired) {
        this.lastTriggeredAt = currentTime;
        this.lastPriority = spec.priority;
      }
      return fired;
    } catch {
      return false;
    }
  }

  public cancel(): void {
    if (this.disposed) {
      return;
    }
    try {
      this.backend.cancel();
    } catch {
      // Ignore host vibration cancellation errors.
    }
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.cancel();
    this.disposed = true;
    this.unsubscribeSettings();
    this.suspensionReasons.clear();
  }
}
