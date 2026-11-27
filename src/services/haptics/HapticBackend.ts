import type { GamePlatform } from '../../platform/contracts/GamePlatform';

export interface HapticBackend {
  isSupported(): boolean;
  vibrate(pattern: number | readonly number[]): boolean;
  cancel(): void;
}

/**
 * Haptic backend adapter delegating exclusively through GamePlatform so gameplay
 * components never touch browser navigator.vibrate APIs directly.
 */
export class PlatformHapticBackend implements HapticBackend {
  private readonly platform: GamePlatform;

  public constructor(platform: GamePlatform) {
    this.platform = platform;
  }

  public isSupported(): boolean {
    try {
      return this.platform.isVibrationSupported?.() ?? false;
    } catch {
      return false;
    }
  }

  public vibrate(pattern: number | readonly number[]): boolean {
    if (!this.isSupported() || this.platform.vibrate === undefined) {
      return false;
    }
    try {
      return this.platform.vibrate(pattern);
    } catch {
      return false;
    }
  }

  public cancel(): void {
    if (!this.isSupported() || this.platform.cancelVibration === undefined) {
      return;
    }
    try {
      this.platform.cancelVibration();
    } catch {
      // Ignore host cancellation errors.
    }
  }
}
