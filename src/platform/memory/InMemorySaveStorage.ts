import { SaveError, type SaveErrorCode } from '../../core';
import type { Unsubscribe } from '../contracts/GamePlatform';
import type { SaveStorage } from '../contracts/SaveStorage';

export interface InMemorySaveStorageOptions {
  readonly initialPayload?: string | null;
  readonly available?: boolean;
  readonly loadDelayMs?: number;
  readonly saveDelayMs?: number;
  readonly failNextLoad?: SaveErrorCode | null;
  readonly failNextSave?: SaveErrorCode | null;
}

export interface PendingWriteControl {
  readonly payload: string;
  readonly resolve: () => void;
  readonly reject: (error: SaveError) => void;
}

/**
 * Deterministic in-memory SaveStorage implementation for unit/integration tests,
 * isolated development diagnostics, and temporary non-durable fallback sessions.
 */
export class InMemorySaveStorage implements SaveStorage {
  public readonly name = 'in-memory';

  private payload: string | null;
  private available: boolean;
  private loadDelayMs: number;
  private saveDelayMs: number;
  private failAllLoads: SaveErrorCode | null = null;
  private failAllSaves: SaveErrorCode | null = null;
  private failNextLoad: SaveErrorCode | null;
  private failNextSave: SaveErrorCode | null;
  private manualWriteQueue = false;
  private readonly pendingManualWrites: PendingWriteControl[] = [];
  private readonly externalListeners = new Set<(serializedData: string | null) => void>();

  private readCount = 0;
  private writeCount = 0;
  private lastSavedPayload: string | null = null;
  private readonly writeHistory: string[] = [];

  public constructor(options: InMemorySaveStorageOptions = {}) {
    this.payload = options.initialPayload ?? null;
    this.available = options.available ?? true;
    this.loadDelayMs = options.loadDelayMs ?? 0;
    this.saveDelayMs = options.saveDelayMs ?? 0;
    this.failNextLoad = options.failNextLoad ?? null;
    this.failNextSave = options.failNextSave ?? null;
  }

  public isAvailable(): boolean {
    return this.available;
  }

  public setAvailable(available: boolean): void {
    this.available = available;
  }

  public setLoadDelayMs(delayMs: number): void {
    this.loadDelayMs = Math.max(0, delayMs);
  }

  public setSaveDelayMs(delayMs: number): void {
    this.saveDelayMs = Math.max(0, delayMs);
  }

  public setFailAllLoads(code: SaveErrorCode | null): void {
    this.failAllLoads = code;
  }

  public setFailAllSaves(code: SaveErrorCode | null): void {
    this.failAllSaves = code;
  }

  public setFailNextLoad(code: SaveErrorCode | null): void {
    this.failNextLoad = code;
  }

  public setFailNextSave(code: SaveErrorCode | null): void {
    this.failNextSave = code;
  }

  /** Enables deterministic manual resolution of queued save() promises in concurrency tests. */
  public setManualWriteControl(enabled: boolean): void {
    this.manualWriteQueue = enabled;
  }

  public getPendingManualWrites(): readonly PendingWriteControl[] {
    return this.pendingManualWrites;
  }

  public getReadCount(): number {
    return this.readCount;
  }

  public getWriteCount(): number {
    return this.writeCount;
  }

  public getCurrentPayload(): string | null {
    return this.payload;
  }

  public getLastSavedPayload(): string | null {
    return this.lastSavedPayload;
  }

  public getWriteHistory(): readonly string[] {
    return this.writeHistory;
  }

  public seedPayload(payload: string | null, notifyExternal = false): void {
    this.payload = payload;
    if (notifyExternal) {
      for (const listener of [...this.externalListeners]) {
        listener(payload);
      }
    }
  }

  public async load(): Promise<string | null> {
    this.readCount += 1;

    if (this.loadDelayMs > 0) {
      await new Promise<void>((resolve) => {
        globalThis.setTimeout(resolve, this.loadDelayMs);
      });
    }

    if (!this.available) {
      throw new SaveError('STORAGE_UNAVAILABLE', 'Simulated storage unavailable.');
    }

    const failure = this.failNextLoad ?? this.failAllLoads;
    this.failNextLoad = null;
    if (failure !== null) {
      throw new SaveError(failure, `Simulated load failure (${failure}).`);
    }

    return this.payload;
  }

  public async save(serializedData: string): Promise<void> {
    if (this.manualWriteQueue) {
      return new Promise<void>((resolve, reject) => {
        this.pendingManualWrites.push({
          payload: serializedData,
          resolve: () => {
            this.payload = serializedData;
            this.lastSavedPayload = serializedData;
            this.writeCount += 1;
            this.writeHistory.push(serializedData);
            resolve();
          },
          reject: (error: SaveError) => {
            reject(error);
          },
        });
      });
    }

    if (this.saveDelayMs > 0) {
      await new Promise<void>((resolve) => {
        globalThis.setTimeout(resolve, this.saveDelayMs);
      });
    }

    if (!this.available) {
      throw new SaveError('STORAGE_UNAVAILABLE', 'Simulated storage unavailable.');
    }

    const failure = this.failNextSave ?? this.failAllSaves;
    this.failNextSave = null;
    if (failure !== null) {
      throw new SaveError(failure, `Simulated write failure (${failure}).`);
    }

    this.payload = serializedData;
    this.lastSavedPayload = serializedData;
    this.writeCount += 1;
    this.writeHistory.push(serializedData);
  }

  public remove(): Promise<void> {
    this.payload = null;
    return Promise.resolve();
  }

  public onExternalChange(listener: (serializedData: string | null) => void): Unsubscribe {
    this.externalListeners.add(listener);
    return () => {
      this.externalListeners.delete(listener);
    };
  }

  public dispose(): void {
    this.externalListeners.clear();
  }
}
