import type {
  AudioChangeCallback,
  GamePlatform,
  LifecycleCallback,
  Unsubscribe,
} from '../contracts/GamePlatform';

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

export class BrowserGamePlatform implements GamePlatform {
  public readonly name = 'browser';

  private readonly storage: StorageLike | null;
  private readonly storageKey: string;
  private readonly documentRef: VisibilityDocumentLike | null;

  private readonly pauseListeners = new Set<LifecycleCallback>();
  private readonly resumeListeners = new Set<LifecycleCallback>();
  private readonly audioListeners = new Set<AudioChangeCallback>();

  private initialized = false;
  private firstFrameReadyNotified = false;
  private gameReadyNotified = false;
  private audioEnabled: boolean;
  private memoryFallback: string | null = null;

  private readonly handleVisibilityChange = (): void => {
    if (this.documentRef === null) {
      return;
    }

    if (this.documentRef.hidden) {
      for (const listener of this.pauseListeners) {
        listener();
      }
    } else {
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

  public isAudioEnabled(): boolean {
    return this.audioEnabled;
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

    this.pauseListeners.clear();
    this.resumeListeners.clear();
    this.audioListeners.clear();
  }
}
