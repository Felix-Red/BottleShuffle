import { PLATFORM_CONFIG } from '../../config/PlatformConfig';
import type { AdvertisingProvider } from '../contracts/AdvertisingProvider';
import type {
  AudioChangeCallback,
  GamePlatform,
  LifecycleCallback,
  Unsubscribe,
} from '../contracts/GamePlatform';
import type { PlatformCapabilities } from '../contracts/PlatformCapabilities';
import type { SaveStorage } from '../contracts/SaveStorage';
import { YouTubeAdvertisingProvider } from './YouTubeAdvertisingProvider';
import { createYouTubeCapabilities } from './YouTubeCapabilities';
import { YouTubeSaveStorage } from './YouTubeSaveStorage';
import type { YouTubeSdkClient } from './YouTubeSdkClient';

export interface YouTubePlatformOptions {
  readonly now?: () => number;
}

/**
 * Production GamePlatform adapter for YouTube Playables.
 *
 * Isolates all `ytgame` interactions behind `YouTubeSdkClient` and `YouTubeSaveStorage`:
 * - Authoritative host audio permission (`isAudioEnabled` / `onAudioEnabledChange`).
 * - Authoritative host suspension (`onPause` / `onResume`) with single-registration cleanup.
 * - Exclusive cloud persistence (`YouTubeSaveStorage` with mandatory load-before-save guard).
 * - Idempotent, ordered `firstFrameReady()` -> `gameReady()` notifications.
 * - Strict capability restrictions (no LocalStorage, no haptics, no score reporting, no ads).
 */
export class YouTubePlatform implements GamePlatform {
  public readonly name = 'youtube';

  private readonly sdkClient: YouTubeSdkClient;
  private readonly saveStorage: YouTubeSaveStorage;
  private readonly advertisingProvider: YouTubeAdvertisingProvider;
  private readonly now: () => number;

  private readonly pauseListeners = new Set<LifecycleCallback>();
  private readonly resumeListeners = new Set<LifecycleCallback>();
  private readonly audioListeners = new Set<AudioChangeCallback>();

  private unsetAudioListener?: () => void;
  private unsetPauseListener?: () => void;
  private unsetResumeListener?: () => void;

  private initialized = false;
  private disposed = false;
  private firstFrameReadyNotified = false;
  private gameReadyNotified = false;
  private audioEnabled = false;
  private hostPaused = false;
  private lastHealthErrorAt = Number.NEGATIVE_INFINITY;

  public constructor(sdkClient: YouTubeSdkClient, options: YouTubePlatformOptions = {}) {
    this.sdkClient = sdkClient;
    this.saveStorage = new YouTubeSaveStorage(sdkClient);
    this.advertisingProvider = new YouTubeAdvertisingProvider(sdkClient);
    this.now = options.now ?? (() => Date.now());
  }

  public initialize(): Promise<void> {
    if (this.disposed || this.initialized) {
      return Promise.resolve();
    }

    this.initialized = true;
    this.audioEnabled = this.sdkClient.isAudioEnabled();

    this.unsetAudioListener = this.sdkClient.onAudioEnabledChange((enabled) => {
      if (this.disposed) {
        return;
      }
      if (this.audioEnabled === enabled) {
        return;
      }
      this.audioEnabled = enabled;
      for (const listener of [...this.audioListeners]) {
        listener(enabled);
      }
    });

    this.unsetPauseListener = this.sdkClient.onPause(() => {
      if (this.disposed || this.hostPaused) {
        return;
      }
      this.hostPaused = true;
      for (const listener of [...this.pauseListeners]) {
        listener();
      }
    });

    this.unsetResumeListener = this.sdkClient.onResume(() => {
      if (this.disposed || !this.hostPaused) {
        return;
      }
      this.hostPaused = false;
      for (const listener of [...this.resumeListeners]) {
        listener();
      }
    });

    return Promise.resolve();
  }

  public getSdkVersion(): string | null {
    return this.sdkClient.getSdkVersion();
  }

  public isHostPaused(): boolean {
    return this.hostPaused;
  }

  public notifyFirstFrameReady(): void {
    if (this.disposed || this.firstFrameReadyNotified) {
      return;
    }
    this.firstFrameReadyNotified = true;
    this.sdkClient.firstFrameReady();
  }

  public notifyGameReady(): void {
    if (this.disposed || this.gameReadyNotified) {
      return;
    }
    // Enforce official ordering invariant: firstFrameReady must precede gameReady.
    if (!this.firstFrameReadyNotified) {
      this.notifyFirstFrameReady();
    }
    this.gameReadyNotified = true;
    this.sdkClient.gameReady();
  }

  public getSaveStorage(): SaveStorage {
    return this.saveStorage;
  }

  public getAdvertisingProvider(): AdvertisingProvider {
    return this.advertisingProvider;
  }

  public loadData(): Promise<string | null> {
    return this.saveStorage.load();
  }

  public saveData(data: string): Promise<void> {
    return this.saveStorage.save(data);
  }

  public getCapabilities(): PlatformCapabilities {
    return createYouTubeCapabilities({
      cloudSaveAvailable: this.saveStorage.isAvailable(),
      advertisingCapabilities: this.advertisingProvider.getCapabilities(),
    });
  }

  public async getLanguage(): Promise<string> {
    const raw = await this.sdkClient.getLanguage();
    if (raw === null) {
      return PLATFORM_CONFIG.youtube.defaultLanguage;
    }
    const base = raw.toLowerCase().split('-')[0] ?? '';
    const supported = PLATFORM_CONFIG.youtube.supportedLanguages.find((lang) => lang === base);
    return supported ?? PLATFORM_CONFIG.youtube.defaultLanguage;
  }

  public logHealthError(): void {
    if (this.disposed) {
      return;
    }
    const current = this.now();
    if (current - this.lastHealthErrorAt < PLATFORM_CONFIG.youtube.healthErrorCooldownMs) {
      return;
    }
    this.lastHealthErrorAt = current;
    this.sdkClient.logHealthError();
  }

  public isAudioEnabled(): boolean {
    return this.audioEnabled;
  }

  /**
   * Haptic vibration is intentionally disabled on YouTube Playables until platform
   * compatibility and permission are verified.
   */
  public isVibrationSupported(): boolean {
    return false;
  }

  public vibrate(): boolean {
    return false;
  }

  public cancelVibration(): void {
    // Vibration is disabled on YouTube Playables.
  }

  public onAudioEnabledChange(callback: AudioChangeCallback): Unsubscribe {
    if (this.disposed) {
      return () => undefined;
    }
    this.audioListeners.add(callback);
    return () => {
      this.audioListeners.delete(callback);
    };
  }

  public onPause(callback: LifecycleCallback): Unsubscribe {
    if (this.disposed) {
      return () => undefined;
    }
    this.pauseListeners.add(callback);
    return () => {
      this.pauseListeners.delete(callback);
    };
  }

  public onResume(callback: LifecycleCallback): Unsubscribe {
    if (this.disposed) {
      return () => undefined;
    }
    this.resumeListeners.add(callback);
    return () => {
      this.resumeListeners.delete(callback);
    };
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.initialized = false;

    this.unsetAudioListener?.();
    this.unsetAudioListener = undefined;
    this.unsetPauseListener?.();
    this.unsetPauseListener = undefined;
    this.unsetResumeListener?.();
    this.unsetResumeListener = undefined;

    this.advertisingProvider.dispose();
    this.saveStorage.dispose();
    this.pauseListeners.clear();
    this.resumeListeners.clear();
    this.audioListeners.clear();
  }
}
