import { PLATFORM_CONFIG } from '../../config/PlatformConfig';
import { SaveError } from '../../core';
import type { SaveStorage } from '../contracts/SaveStorage';
import { mapYouTubeStorageError } from './YouTubeErrorMapper';
import type { YouTubeSdkClient } from './YouTubeSdkClient';

export type YouTubeStorageLoadState =
  'not_initialised' | 'loading' | 'loaded' | 'load_failed' | 'disposed';

/**
 * Verifies that a string is well-formed UTF-16 (no lone surrogates), as required by
 * `ytgame.game.saveData(data)`. Uses native `String.prototype.isWellFormed()` when
 * available and falls back to an exact UTF-16 surrogate pair scan.
 */
export function isWellFormedUtf16(value: string): boolean {
  const candidate = value as string & { isWellFormed?: () => boolean };
  if (typeof candidate.isWellFormed === 'function') {
    return candidate.isWellFormed();
  }

  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      if (i + 1 >= value.length) {
        return false;
      }
      const next = value.charCodeAt(i + 1);
      if (next < 0xdc00 || next > 0xdfff) {
        return false;
      }
      i += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return false;
    }
  }
  return true;
}

/**
 * Measures the encoded byte size of a JavaScript UTF-16 string (2 bytes per UTF-16 code unit).
 * Also compares against UTF-8 encoding so oversized payloads are always caught conservatively.
 */
export function measureYouTubeSavePayloadBytes(value: string): {
  readonly utf16Bytes: number;
  readonly utf8Bytes: number;
} {
  const utf16Bytes = value.length * 2;
  let utf8Bytes = utf16Bytes;
  if (typeof globalThis.TextEncoder !== 'undefined') {
    utf8Bytes = new globalThis.TextEncoder().encode(value).byteLength;
  }
  return Object.freeze({ utf16Bytes, utf8Bytes });
}

export interface YouTubeSaveStorageOptions {
  readonly maxPayloadBytes?: number;
}

/**
 * Exclusive YouTube Playables cloud SaveStorage adapter backed by `ytgame.game.loadData()`
 * and `ytgame.game.saveData(data)`.
 *
 * Enforces mandatory load-before-save protection: `save()` is strictly rejected until
 * `load()` has resolved successfully, ensuring failed loads can never overwrite existing
 * cloud progress. Never touches LocalStorage, SessionStorage, IndexedDB, or cookies.
 */
export class YouTubeSaveStorage implements SaveStorage {
  public readonly name = 'youtube-cloud-storage';
  public readonly requiresLoadBeforeSave = true;

  private readonly sdkClient: YouTubeSdkClient;
  private readonly maxPayloadBytes: number;
  private loadState: YouTubeStorageLoadState = 'not_initialised';

  public constructor(sdkClient: YouTubeSdkClient, options: YouTubeSaveStorageOptions = {}) {
    this.sdkClient = sdkClient;
    this.maxPayloadBytes =
      options.maxPayloadBytes ?? PLATFORM_CONFIG.youtube.sdkMaxSavePayloadBytes;
  }

  public getLoadState(): YouTubeStorageLoadState {
    return this.loadState;
  }

  public isAvailable(): boolean {
    if (this.loadState === 'disposed') {
      return false;
    }
    return this.sdkClient.isInPlayablesEnv() && this.sdkClient.hasRequiredCoreApis();
  }

  public async load(): Promise<string | null> {
    if (this.loadState === 'disposed') {
      throw new SaveError('STORAGE_UNAVAILABLE', 'YouTube cloud storage has been disposed.');
    }

    if (!this.isAvailable()) {
      this.loadState = 'load_failed';
      throw new SaveError('STORAGE_UNAVAILABLE', 'YouTube cloud storage is not available.');
    }

    this.loadState = 'loading';
    try {
      const raw = await this.sdkClient.loadData();
      if (this.isDisposed()) {
        throw new SaveError('STORAGE_UNAVAILABLE', 'YouTube cloud storage has been disposed.');
      }

      if (typeof raw !== 'string') {
        this.loadState = 'load_failed';
        throw new SaveError(
          'STORAGE_READ_FAILED',
          'YouTube cloud storage returned a non-string save payload.',
        );
      }

      this.loadState = 'loaded';
      // Official SDK returns empty string "" when no cloud save exists yet.
      if (raw.trim().length === 0) {
        return null;
      }
      return raw;
    } catch (error) {
      if (!this.isDisposed()) {
        this.loadState = 'load_failed';
      }
      throw mapYouTubeStorageError(error, 'load');
    }
  }

  public async save(serializedData: string): Promise<void> {
    if (this.loadState === 'disposed') {
      throw new SaveError('STORAGE_UNAVAILABLE', 'YouTube cloud storage has been disposed.');
    }

    // Mandatory YouTube Playables integration invariant: never save before loadData succeeds.
    if (this.loadState !== 'loaded') {
      throw new SaveError(
        'STORAGE_WRITE_FAILED',
        'Cloud save is blocked until initial cloud load completes successfully.',
        { loadState: this.loadState },
      );
    }

    if (typeof serializedData !== 'string' || !isWellFormedUtf16(serializedData)) {
      throw new SaveError(
        'SERIALIZATION_FAILED',
        'Serialized save payload must be a well-formed UTF-16 string.',
      );
    }

    const { utf16Bytes, utf8Bytes } = measureYouTubeSavePayloadBytes(serializedData);
    if (utf16Bytes > this.maxPayloadBytes || utf8Bytes > this.maxPayloadBytes) {
      throw new SaveError(
        'STORAGE_QUOTA_EXCEEDED',
        'Serialized save payload exceeds the YouTube Playables 3 MiB limit.',
        { utf16Bytes, utf8Bytes, maxPayloadBytes: this.maxPayloadBytes },
      );
    }

    if (!this.isAvailable()) {
      throw new SaveError('STORAGE_UNAVAILABLE', 'YouTube cloud storage is not available.');
    }

    try {
      await this.sdkClient.saveData(serializedData);
    } catch (error) {
      throw mapYouTubeStorageError(error, 'save');
    }
  }

  public dispose(): void {
    this.loadState = 'disposed';
  }

  private isDisposed(): boolean {
    return this.loadState === 'disposed';
  }
}
