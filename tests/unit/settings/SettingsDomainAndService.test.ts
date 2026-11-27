import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_GAME_SETTINGS,
  deserializeGameSettings,
  isValidGameSettings,
  reduceGameSettings,
  resolveEffectiveReducedMotion,
  serializeGameSettings,
  SETTINGS_SCHEMA_VERSION,
  type MotionPreference,
} from '../../../src/core';
import { BrowserGamePlatform } from '../../../src/platform/browser/BrowserGamePlatform';
import {
  MotionPreferenceService,
  type MediaQueryLike,
} from '../../../src/services/MotionPreferenceService';
import { SettingsService } from '../../../src/services/SettingsService';

describe('Settings domain model, reducer, and serialisation', () => {
  it('exposes expected immutable defaults with vibration disabled and schemaVersion 1', () => {
    expect(DEFAULT_GAME_SETTINGS).toEqual({
      musicEnabled: true,
      soundEffectsEnabled: true,
      vibrationEnabled: false,
      motionPreference: 'system',
      schemaVersion: SETTINGS_SCHEMA_VERSION,
    });
    expect(Object.isFrozen(DEFAULT_GAME_SETTINGS)).toBe(true);
    expect(isValidGameSettings(DEFAULT_GAME_SETTINGS)).toBe(true);
  });

  it('rejects invalid preference updates without mutating state', () => {
    const badBool = reduceGameSettings(DEFAULT_GAME_SETTINGS, {
      type: 'SET_MUSIC_ENABLED',
      enabled: 'yes' as unknown as boolean,
    });
    expect(badBool.accepted).toBe(false);
    expect(badBool.changed).toBe(false);
    expect(badBool.state).toBe(DEFAULT_GAME_SETTINGS);

    const badMotion = reduceGameSettings(DEFAULT_GAME_SETTINGS, {
      type: 'SET_MOTION_PREFERENCE',
      preference: 'full' as unknown as MotionPreference,
    });
    expect(badMotion.accepted).toBe(false);
    expect(badMotion.rejectionReason).toBe('INVALID_MOTION_PREFERENCE');
    expect(badMotion.state).toBe(DEFAULT_GAME_SETTINGS);
  });

  it('serialises and deserialises cleanly and rejects malformed payloads', () => {
    const updated = reduceGameSettings(DEFAULT_GAME_SETTINGS, {
      type: 'SET_MOTION_PREFERENCE',
      preference: 'reduced',
    }).state;
    const json = serializeGameSettings(updated);
    const restored = deserializeGameSettings(json);

    expect(restored).toEqual(updated);
    expect(Object.isFrozen(restored)).toBe(true);
    expect(deserializeGameSettings('{bad-json')).toBeNull();
    expect(deserializeGameSettings(JSON.stringify({ schemaVersion: 99 }))).toBeNull();
  });
});

describe('SettingsService shared ownership and subscriptions', () => {
  it('notifies subscribers only on actual changes, supports unsubscribe, and resets cleanly', () => {
    const service = new SettingsService();
    const listener = vi.fn();
    const unsubscribe = service.subscribe(listener);

    // Unchanged value produces zero notifications
    const unchanged = service.setMusicEnabled(true);
    expect(unchanged.accepted).toBe(true);
    expect(unchanged.changed).toBe(false);
    expect(listener).not.toHaveBeenCalled();

    // Valid changes notify once each with immutable snapshots
    service.setMusicEnabled(false);
    service.setSoundEffectsEnabled(false);
    service.setVibrationEnabled(true);
    service.setMotionPreference('reduced');
    expect(listener).toHaveBeenCalledTimes(4);
    expect(Object.isFrozen(service.getSettings())).toBe(true);
    expect(service.getSettings()).toEqual({
      musicEnabled: false,
      soundEffectsEnabled: false,
      vibrationEnabled: true,
      motionPreference: 'reduced',
      schemaVersion: 1,
    });

    // Reset restores defaults and notifies once
    const resetRes = service.resetToDefaults();
    expect(resetRes.changed).toBe(true);
    expect(service.getSettings()).toEqual(DEFAULT_GAME_SETTINGS);
    expect(listener).toHaveBeenCalledTimes(5);

    // Second reset is a no-op with zero notification
    expect(service.resetToDefaults().changed).toBe(false);
    expect(listener).toHaveBeenCalledTimes(5);

    unsubscribe();
    service.setMusicEnabled(false);
    expect(listener).toHaveBeenCalledTimes(5);

    service.dispose();
  });
});

describe('MotionPreferenceService system accessibility & SettingsService integration', () => {
  function createControllableMediaQuery(initialMatches: boolean): {
    readonly query: MediaQueryLike;
    readonly emit: (matches: boolean) => void;
    readonly listenerCount: () => number;
  } {
    let matches = initialMatches;
    const listeners = new Set<(event: { readonly matches: boolean }) => void>();
    return {
      query: {
        get matches(): boolean {
          return matches;
        },
        addEventListener: (_type, cb) => {
          listeners.add(cb);
        },
        removeEventListener: (_type, cb) => {
          listeners.delete(cb);
        },
      },
      emit: (next: boolean) => {
        matches = next;
        for (const cb of [...listeners]) {
          cb({ matches: next });
        }
      },
      listenerCount: () => listeners.size,
    };
  }

  it('always respects system reduced-motion even when in-game preference is "system"', () => {
    expect(resolveEffectiveReducedMotion('system', false)).toBe(false);
    expect(resolveEffectiveReducedMotion('system', true)).toBe(true);
    expect(resolveEffectiveReducedMotion('reduced', false)).toBe(true);
    expect(resolveEffectiveReducedMotion('reduced', true)).toBe(true);

    const mq = createControllableMediaQuery(true);
    const settings = new SettingsService();
    const motion = new MotionPreferenceService(() => mq.query, settings);

    expect(mq.listenerCount()).toBe(1);
    expect(motion.isReducedMotion()).toBe(true);

    // Even attempting setOverride(false) when bound to SettingsService keeps system accessibility intact
    motion.setOverride(false);
    expect(motion.isReducedMotion()).toBe(true);

    // When OS turns reduced motion off, effective state reflects 'system' (false)
    const onChange = vi.fn();
    motion.onChange(onChange);
    mq.emit(false);
    expect(motion.isReducedMotion()).toBe(false);
    expect(onChange).toHaveBeenCalledWith(false);

    // Explicit player reduced preference activates reduced motion
    settings.setMotionPreference('reduced');
    expect(motion.isReducedMotion()).toBe(true);
    expect(onChange).toHaveBeenCalledWith(true);

    // Switching OS while explicit reduced is active does not emit duplicate notification
    mq.emit(true);
    mq.emit(false);
    expect(motion.isReducedMotion()).toBe(true);
    expect(onChange).toHaveBeenCalledTimes(2);

    motion.dispose();
    expect(mq.listenerCount()).toBe(0);
    settings.dispose();
  });

  it('exposes capability-aware vibration detection on BrowserGamePlatform without invoking vibrate()', () => {
    const supported = new BrowserGamePlatform({
      documentRef: null,
      storage: null,
      vibrationSupported: true,
    });
    const unsupported = new BrowserGamePlatform({
      documentRef: null,
      storage: null,
      vibrationSupported: false,
    });
    expect(supported.isVibrationSupported()).toBe(true);
    expect(unsupported.isVibrationSupported()).toBe(false);
    supported.dispose();
    unsupported.dispose();
  });
});
