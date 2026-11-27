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
import { createBrowserCapabilities } from '../youtube/YouTubeCapabilities';
import { BrowserSaveStorage } from './BrowserSaveStorage';
import { NoOpAdvertisingProvider } from './NoOpAdvertisingProvider';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface VisibilityDocumentLike {
  readonly hidden: boolean;
  addEventListener(type: 'visibilitychange', listener: () => void): void;
  removeEventListener(type: 'visibilitychange', listener: () => void): void;
}

export interface BrowserGamePlatformOptions {
  readonly storage?: StorageLike | null;
  readonly storageKey?: string;
  readonly documentRef?: VisibilityDocumentLike | null;
  readonly initialAudioEnabled?: boolean;
  readonly vibrationSupported?: boolean;
  readonly vibrateFn?: ((pattern: number | number[]) => boolean) | null;
}

const DEFAULT_STORAGE_KEY = 'bottle-shuffle:save-data:v1';

function resolveDefaultStorage(): StorageLike | null {
  try {
    return typeof globalThis.localStorage !== 'undefined' ? globalThis.localStorage : null;
  } catch {
    return null;
  }
}

function resolveDefaultDocument(): VisibilityDocumentLike | null {
  return typeof globalThis.document !== 'undefined' ? globalThis.document : null;
}

function detectBrowserVibrationSupport(): boolean {
  try {
    return (
      typeof globalThis.navigator !== 'undefined' &&
      typeof globalThis.navigator.vibrate === 'function'
    );
  } catch {
    return false;
  }
}

export class BrowserGamePlatform implements GamePlatform {
  public readonly name = 'browser';

  private readonly storage: StorageLike | null;
  private readonly storageKey: string;
  private readonly documentRef: VisibilityDocumentLike | null;
  private readonly vibrationSupported: boolean;
  private readonly vibrateFn: ((pattern: number | number[]) => boolean) | null;

  private readonly pauseListeners = new Set<LifecycleCallback>();
  private readonly resumeListeners = new Set<LifecycleCallback>();
  private readonly audioListeners = new Set<AudioChangeCallback>();

  private initialized = false;
  private firstFrameReadyNotified = false;
  private gameReadyNotified = false;
  private audioEnabled: boolean;
  private memoryFallback: string | null = null;
  private saveStorage?: BrowserSaveStorage;
  private readonly advertisingProvider = new NoOpAdvertisingProvider();
  private hostPaused = false;

  private readonly handleVisibilityChange = (): void => {
    if (this.documentRef === null) {
      return;
    }

    if (this.documentRef.hidden) {
      this.hostPaused = true;
      for (const listener of this.pauseListeners) {
        listener();
      }
    } else {
      this.hostPaused = false;
      for (const listener of this.resumeListeners) {
        listener();
      }
    }
  };

  public constructor(options: BrowserGamePlatformOptions = {}) {
    this.storage = options.storage === undefined ? resolveDefaultStorage() : options.storage;
    this.storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY;
    this.documentRef =
      options.documentRef === undefined ? resolveDefaultDocument() : options.documentRef;
    this.audioEnabled = options.initialAudioEnabled ?? true;
    this.vibrationSupported = options.vibrationSupported ?? detectBrowserVibrationSupport();
    this.vibrateFn =
      options.vibrateFn !== undefined
        ? options.vibrateFn
        : detectBrowserVibrationSupport()
          ? (pattern) => globalThis.navigator.vibrate(pattern)
          : null;
  }

  public initialize(): Promise<void> {
    if (this.initialized) {
      return Promise.resolve();
    }

    this.initialized = true;
    this.documentRef?.addEventListener('visibilitychange', this.handleVisibilityChange);
    return Promise.resolve();
  }

  public notifyFirstFrameReady(): void {
    if (this.firstFrameReadyNotified) {
      return;
    }

    this.firstFrameReadyNotified = true;
  }

  public notifyGameReady(): void {
    if (this.gameReadyNotified) {
      return;
    }

    this.gameReadyNotified = true;
  }

  public loadData(): Promise<string | null> {
    if (this.storage !== null) {
      try {
        return Promise.resolve(this.storage.getItem(this.storageKey));
      } catch {
        return Promise.resolve(this.memoryFallback);
      }
    }

    return Promise.resolve(this.memoryFallback);
  }

  public saveData(data: string): Promise<void> {
    this.memoryFallback = data;

    if (this.storage !== null) {
      try {
        this.storage.setItem(this.storageKey, data);
      } catch {
        // Ignore storage write errors (e.g. private browsing quota restrictions)
        // and retain the in-memory copy for the active session.
      }
    }

    return Promise.resolve();
  }

  public getSaveStorage(): SaveStorage {
    this.saveStorage ??= new BrowserSaveStorage();
    return this.saveStorage;
  }

  public getAdvertisingProvider(): AdvertisingProvider {
    return this.advertisingProvider;
  }

  public isHostPaused(): boolean {
    return this.hostPaused;
  }

  public getCapabilities(): PlatformCapabilities {
    return createBrowserCapabilities({
      localStorageAvailable: this.storage !== null,
      vibrationSupported: this.vibrationSupported,
    });
  }

  public getLanguage(): Promise<string> {
    return Promise.resolve(PLATFORM_CONFIG.browser.defaultLanguage);
  }

  public logHealthError(): void {
    // No external telemetry in standalone browser mode.
  }

  public isAudioEnabled(): boolean {
    return this.audioEnabled;
  }

  public isVibrationSupported(): boolean {
    return this.vibrationSupported;
  }

  public vibrate(pattern: number | readonly number[]): boolean {
    if (!this.vibrationSupported || this.vibrateFn === null) {
      return false;
    }

    try {
      const normalized = typeof pattern === 'number' ? pattern : [...pattern];
      return this.vibrateFn(normalized);
    } catch {
      return false;
    }
  }

  public cancelVibration(): void {
    if (!this.vibrationSupported || this.vibrateFn === null) {
      return;
    }

    try {
      this.vibrateFn(0);
    } catch {
      // Ignore host vibration cancellation errors.
    }
  }

  public setAudioEnabled(enabled: boolean): void {
    if (this.audioEnabled === enabled) {
      return;
    }

    this.audioEnabled = enabled;
    for (const listener of this.audioListeners) {
      listener(enabled);
    }
  }

  public onAudioEnabledChange(callback: AudioChangeCallback): Unsubscribe {
    this.audioListeners.add(callback);
    return () => {
      this.audioListeners.delete(callback);
    };
  }

  public onPause(callback: LifecycleCallback): Unsubscribe {
    this.pauseListeners.add(callback);
    return () => {
      this.pauseListeners.delete(callback);
    };
  }

  public onResume(callback: LifecycleCallback): Unsubscribe {
    this.resumeListeners.add(callback);
    return () => {
      this.resumeListeners.delete(callback);
    };
  }

  public dispose(): void {
    if (this.initialized) {
      this.documentRef?.removeEventListener('visibilitychange', this.handleVisibilityChange);
      this.initialized = false;
    }

    this.advertisingProvider.dispose();
    this.saveStorage?.dispose();
    this.saveStorage = undefined;
    this.pauseListeners.clear();
    this.resumeListeners.clear();
    this.audioListeners.clear();
  }
}
