import { describe, expect, it } from 'vitest';
import { BrowserGamePlatform } from '../../../src/platform/browser/BrowserGamePlatform';
import { SettingsService } from '../../../src/services/SettingsService';
import {
  PlatformHapticBackend,
  type HapticBackend,
} from '../../../src/services/haptics/HapticBackend';
import { HapticService } from '../../../src/services/haptics/HapticService';

class FakeHapticBackend implements HapticBackend {
  public supported: boolean;
  public shouldThrow = false;
  public readonly vibrated: (number | readonly number[])[] = [];
  public cancelCalls = 0;

  public constructor(supported = true) {
    this.supported = supported;
  }

  public isSupported(): boolean {
    return this.supported;
  }

  public vibrate(pattern: number | readonly number[]): boolean {
    if (this.shouldThrow) {
      throw new Error('Vibration API rejected');
    }
    if (!this.supported) {
      return false;
    }
    this.vibrated.push(pattern);
    return true;
  }

  public cancel(): void {
    if (this.shouldThrow) {
      throw new Error('Cancel rejected');
    }
    this.cancelCalls += 1;
  }
}

describe('HapticService', () => {
  it('defaults to disabled and remains a no-op when disabled or unsupported', () => {
    const settings = new SettingsService();
    const backend = new FakeHapticBackend(true);
    const service = new HapticService({ backend, settingsService: settings });

    expect(settings.getSettings().vibrationEnabled).toBe(false);
    expect(service.trigger('bottle_select')).toBe(false);
    expect(backend.vibrated).toHaveLength(0);

    // Enable vibration on an unsupported backend -> still no-op
    backend.supported = false;
    settings.setVibrationEnabled(true);
    expect(service.isSupported()).toBe(false);
    expect(service.trigger('bottle_land')).toBe(false);
    expect(backend.vibrated).toHaveLength(0);

    service.dispose();
    settings.dispose();
  });

  it('triggers restrained patterns when supported and enabled, prioritising victory', () => {
    let nowMs = 500;
    const settings = new SettingsService();
    settings.setVibrationEnabled(true);
    const backend = new FakeHapticBackend(true);
    const service = new HapticService({ backend, settingsService: settings, now: () => nowMs });

    expect(service.trigger('bottle_select')).toBe(true);
    // Within cooldown, equal/lower priority is skipped
    nowMs += 10;
    expect(service.trigger('bottle_select')).toBe(false);
    // Victory overrides active weaker pattern even inside cooldown
    expect(service.trigger('victory')).toBe(true);
    expect(backend.cancelCalls).toBeGreaterThanOrEqual(1);
    expect(backend.vibrated).toEqual([10, [30, 40, 30]]);

    nowMs += 100;
    expect(service.trigger('bottle_land')).toBe(true);
    nowMs += 100;
    expect(service.trigger('match_positive')).toBe(true);
    expect(backend.vibrated).toEqual([10, [30, 40, 30], 15, 20]);

    service.dispose();
    settings.dispose();
  });

  it('cancels active vibration when disabled or suspended and isolates backend failures', () => {
    const settings = new SettingsService();
    settings.setVibrationEnabled(true);
    const backend = new FakeHapticBackend(true);
    const service = new HapticService({ backend, settingsService: settings });

    service.suspend('platform_suspended');
    expect(backend.cancelCalls).toBe(1);
    expect(service.trigger('victory')).toBe(false);

    service.resume('platform_suspended');
    expect(service.trigger('bottle_select')).toBe(true);

    // Disabling vibration cancels active vibration immediately
    settings.setVibrationEnabled(false);
    expect(backend.cancelCalls).toBe(2);

    // Backend throws are safely swallowed
    settings.setVibrationEnabled(true);
    backend.shouldThrow = true;
    expect(() => service.trigger('victory')).not.toThrow();
    expect(service.trigger('victory')).toBe(false);
    expect(() => {
      service.cancel();
    }).not.toThrow();

    service.dispose();
    settings.dispose();
  });

  it('delegates browser vibration cleanly through BrowserGamePlatform', () => {
    const calls: (number | number[])[] = [];
    const platform = new BrowserGamePlatform({
      storage: null,
      documentRef: null,
      vibrationSupported: true,
      vibrateFn: (pattern) => {
        calls.push(pattern);
        return true;
      },
    });

    const backend = new PlatformHapticBackend(platform);
    const settings = new SettingsService();
    settings.setVibrationEnabled(true);
    const service = new HapticService({ backend, settingsService: settings });

    expect(service.isSupported()).toBe(true);
    expect(service.trigger('victory')).toBe(true);
    service.cancel();

    expect(calls).toEqual([[30, 40, 30], 0]);

    service.dispose();
    settings.dispose();
    platform.dispose();
  });
});
