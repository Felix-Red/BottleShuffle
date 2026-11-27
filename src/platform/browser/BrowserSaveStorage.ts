import { PERSISTENCE_CONFIG } from '../../config/PersistenceConfig';
import { SaveError } from '../../core';
import type { Unsubscribe } from '../contracts/GamePlatform';
import type { SaveStorage } from '../contracts/SaveStorage';

export interface BrowserStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface StorageEventWindowLike {
  addEventListener(type: 'storage', listener: (event: StorageEvent) => void): void;
  removeEventListener(type: 'storage', listener: (event: StorageEvent) => void): void;
}

export interface BrowserSaveStorageOptions {
  readonly storageKey?: string;
  readonly storage?: BrowserStorageLike | null;
  readonly windowRef?: StorageEventWindowLike | null;
}

function resolveDefaultLocalStorage(): BrowserStorageLike | null {
  try {
    return typeof globalThis.localStorage !== 'undefined' ? globalThis.localStorage : null;
  } catch {
    return null;
  }
}

function resolveDefaultWindow(): StorageEventWindowLike | null {
  return typeof globalThis.window !== 'undefined' ? globalThis.window : null;
}

function isQuotaExceededError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const candidate = error as { name?: unknown; code?: unknown };
  return (
    candidate.name === 'QuotaExceededError' ||
    candidate.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    candidate.code === 22 ||
    candidate.code === 1014
  );
}

/**
 * Standalone browser SaveStorage adapter backed by LocalStorage.
 * All direct browser storage access is strictly confined to this class.
 * Never deletes unreadable save payloads automatically.
 *
 * Note: Intended for standalone web development only — YouTube Playables
 * persistence will use a dedicated verified platform adapter in Task 17.
 */
export class BrowserSaveStorage implements SaveStorage {
  public readonly name = 'browser-local-storage';

  private readonly storageKey: string;
  private readonly storage: BrowserStorageLike | null;
  private readonly windowRef: StorageEventWindowLike | null;
  private readonly externalListeners = new Set<(serializedData: string | null) => void>();
  private listenerAttached = false;
  private availableCache: boolean | null = null;

  private readonly handleStorageEvent = (event: StorageEvent): void => {
    if (event.key !== this.storageKey) {
      return;
    }
    for (const listener of [...this.externalListeners]) {
      listener(event.newValue);
    }
  };

  public constructor(options: BrowserSaveStorageOptions = {}) {
    this.storageKey = options.storageKey ?? PERSISTENCE_CONFIG.storageKey;
    this.storage = options.storage === undefined ? resolveDefaultLocalStorage() : options.storage;
    this.windowRef = options.windowRef === undefined ? resolveDefaultWindow() : options.windowRef;
  }

  public getStorageKey(): string {
    return this.storageKey;
  }

  public isAvailable(): boolean {
    if (this.storage === null) {
      return false;
    }
    if (this.availableCache !== null) {
      return this.availableCache;
    }
    const probeKey = `${this.storageKey}.__probe__`;
    try {
      this.storage.setItem(probeKey, '1');
      this.storage.removeItem(probeKey);
      this.availableCache = true;
      return true;
    } catch {
      this.availableCache = false;
      return false;
    }
  }

  public load(): Promise<string | null> {
    if (this.storage === null) {
      return Promise.reject(
        new SaveError('STORAGE_UNAVAILABLE', 'Browser local storage is not available.'),
      );
    }

    try {
      const raw = this.storage.getItem(this.storageKey);
      return Promise.resolve(raw);
    } catch (error) {
      this.availableCache = false;
      return Promise.reject(
        new SaveError('STORAGE_READ_FAILED', 'Unable to read saved data from browser storage.', {
          cause: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  public save(serializedData: string): Promise<void> {
    if (this.storage === null) {
      return Promise.reject(
        new SaveError('STORAGE_UNAVAILABLE', 'Browser local storage is not available.'),
      );
    }

    try {
      this.storage.setItem(this.storageKey, serializedData);
      this.availableCache = true;
      return Promise.resolve();
    } catch (error) {
      if (isQuotaExceededError(error)) {
        return Promise.reject(
          new SaveError('STORAGE_QUOTA_EXCEEDED', 'Browser storage quota exceeded.'),
        );
      }
      this.availableCache = false;
      return Promise.reject(
        new SaveError('STORAGE_WRITE_FAILED', 'Unable to write saved data to browser storage.', {
          cause: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  public remove(): Promise<void> {
    if (this.storage === null) {
      return Promise.resolve();
    }
    try {
      this.storage.removeItem(this.storageKey);
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(
        new SaveError('STORAGE_WRITE_FAILED', 'Unable to remove saved data from browser storage.', {
          cause: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  public onExternalChange(listener: (serializedData: string | null) => void): Unsubscribe {
    this.externalListeners.add(listener);
    if (!this.listenerAttached && this.windowRef !== null) {
      this.listenerAttached = true;
      this.windowRef.addEventListener('storage', this.handleStorageEvent);
    }

    return () => {
      this.externalListeners.delete(listener);
      if (this.externalListeners.size === 0 && this.listenerAttached && this.windowRef !== null) {
        this.listenerAttached = false;
        this.windowRef.removeEventListener('storage', this.handleStorageEvent);
      }
    };
  }

  public dispose(): void {
    if (this.listenerAttached && this.windowRef !== null) {
      this.listenerAttached = false;
      this.windowRef.removeEventListener('storage', this.handleStorageEvent);
    }
    this.externalListeners.clear();
  }
}
