import { PERSISTENCE_CONFIG } from '../../config/PersistenceConfig';
import {
  createDefaultSaveData,
  CURRENT_SAVE_SCHEMA_VERSION,
  freezeSaveData,
  SaveError,
  validateSaveData,
  type SaveData,
  type SaveErrorCode,
} from '../../core';
import type { Unsubscribe } from '../../platform/contracts/GamePlatform';
import type { SaveStorage } from '../../platform/contracts/SaveStorage';
import {
  createDefaultMigrationRegistry,
  type SaveMigrationRegistry,
} from './SaveMigrationRegistry';
import {
  computeSaveContentSignature,
  measureUtf8ByteSize,
  parseRawSaveJson,
  serializeSaveData,
} from './SaveSerializer';
import { captureSaveData, restoreSaveData, type SaveStateTargets } from './SaveStateMapper';
import type {
  SaveLifecycleStatus,
  SavePriority,
  SaveReason,
  SaveStatusSnapshot,
} from './SaveStatus';

export type SaveStatusListener = (snapshot: SaveStatusSnapshot) => void;

export interface SaveServiceOptions {
  readonly storage: SaveStorage;
  readonly targets: SaveStateTargets;
  readonly migrationRegistry?: SaveMigrationRegistry;
  readonly normalDebounceMs?: number;
  readonly startupLoadTimeoutMs?: number;
  readonly maxAutomaticRetries?: number;
  readonly retryBackoffMs?: readonly number[];
  readonly nowIso?: () => string;
}

export interface SaveInitOutcome {
  readonly outcome:
    | 'missing'
    | 'restored'
    | 'repaired'
    | 'corrupted'
    | 'unsupported_version'
    | 'timeout'
    | 'unavailable'
    | 'read_failed';
  readonly data: SaveData;
  readonly repairs: readonly string[];
  readonly errorCode: SaveErrorCode | null;
}

function extractErrorCode(error: unknown, fallback: SaveErrorCode): SaveErrorCode {
  if (error instanceof SaveError) {
    return error.code;
  }
  return fallback;
}

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  return fallback;
}

/**
 * Shared application-level persistence service.
 * Owns startup restoration, schema migration, validation, automatic debounced & high-priority
 * saving, single-writer serialized write queueing, concurrent-write revision coalescing,
 * multi-tab external conflict detection, and bounded failure retries.
 */
export class SaveService {
  private readonly storage: SaveStorage;
  private readonly targets: SaveStateTargets;
  private readonly migrationRegistry: SaveMigrationRegistry;
  private readonly normalDebounceMs: number;
  private readonly startupLoadTimeoutMs: number;
  private readonly maxAutomaticRetries: number;
  private readonly retryBackoffMs: readonly number[];
  private readonly nowIso: () => string;

  private readonly listeners = new Set<SaveStatusListener>();
  private unsubscribeExternalChange?: Unsubscribe;

  private status: SaveLifecycleStatus = 'initialising';
  private currentRevision = 0;
  private lastSavedRevision = 0;
  private hasUnsavedChanges = false;
  private lastSavedAt: string | null = null;
  private lastSerializedBytes = 0;
  private autoWriteBlocked = false;
  private isDurable = false;
  private lastErrorCode: SaveErrorCode | null = null;
  private lastErrorMessage: string | null = null;
  private repairs: readonly string[] = Object.freeze([]);
  private detectedExternalRevision: number | null = null;

  private lastSuccessfulSave: SaveData | null = null;
  private lastSavedContentSignature = '';
  private pendingCandidate: SaveData | null = null;
  private pendingContentSignature = '';

  private debounceTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
  private retryTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
  private retryAttemptCount = 0;
  private writeInFlight: Promise<void> | null = null;
  private restoring = false;
  private initEpoch = 0;
  private disposed = false;

  public constructor(options: SaveServiceOptions) {
    this.storage = options.storage;
    this.targets = options.targets;
    this.migrationRegistry = options.migrationRegistry ?? createDefaultMigrationRegistry();
    this.normalDebounceMs = options.normalDebounceMs ?? PERSISTENCE_CONFIG.normalDebounceMs;
    this.startupLoadTimeoutMs =
      options.startupLoadTimeoutMs ?? PERSISTENCE_CONFIG.startupLoadTimeoutMs;
    this.maxAutomaticRetries =
      options.maxAutomaticRetries ?? PERSISTENCE_CONFIG.maxAutomaticRetries;
    this.retryBackoffMs = options.retryBackoffMs ?? PERSISTENCE_CONFIG.retryBackoffMs;
    this.nowIso = options.nowIso ?? (() => new Date().toISOString());

    if (this.storage.onExternalChange !== undefined) {
      this.unsubscribeExternalChange = this.storage.onExternalChange((raw) => {
        this.handleExternalStorageMutation(raw);
      });
    }
  }

  public isRestoring(): boolean {
    return this.restoring;
  }

  public getStatus(): SaveStatusSnapshot {
    return Object.freeze({
      status: this.status,
      schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
      currentRevision: this.currentRevision,
      lastSavedRevision: this.lastSavedRevision,
      hasUnsavedChanges: this.hasUnsavedChanges,
      lastSavedAt: this.lastSavedAt,
      lastSerializedBytes: this.lastSerializedBytes,
      autoWriteBlocked: this.autoWriteBlocked,
      isDurable: this.isDurable,
      storageName: this.storage.name,
      lastErrorCode: this.lastErrorCode,
      lastErrorMessage: this.lastErrorMessage,
      repairs: this.repairs,
      detectedExternalRevision: this.detectedExternalRevision,
    });
  }

  public getLastSuccessfulSave(): SaveData | null {
    return this.lastSuccessfulSave;
  }

  /** Produces a live serialized JSON preview of the current application state without writing. */
  public getSerializedPreview(): { readonly json: string; readonly bytes: number } {
    const snapshot = captureSaveData(this.targets, {
      revision: this.currentRevision,
      updatedAt: this.lastSavedAt ?? this.nowIso(),
    });
    const json = serializeSaveData(snapshot);
    return Object.freeze({ json, bytes: measureUtf8ByteSize(json) });
  }

  public subscribe(listener: SaveStatusListener): Unsubscribe {
    if (this.disposed) {
      return () => undefined;
    }
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Loads, parses, migrates, validates, and restores saved state during application startup.
   * Bounded by `startupLoadTimeoutMs` so slow or broken storage never hangs startup, and
   * guarded by `initEpoch` so late responses never overwrite progress created after fallback.
   */
  public async initialise(): Promise<SaveInitOutcome> {
    if (this.disposed) {
      const defaults = createDefaultSaveData({ updatedAt: this.nowIso() });
      return {
        outcome: 'unavailable',
        data: defaults,
        repairs: [],
        errorCode: 'STORAGE_UNAVAILABLE',
      };
    }

    this.initEpoch += 1;
    const activeEpoch = this.initEpoch;
    this.clearTimers();
    this.pendingCandidate = null;
    this.pendingContentSignature = '';
    this.status = 'initialising';
    this.autoWriteBlocked = false;
    this.lastErrorCode = null;
    this.lastErrorMessage = null;
    this.repairs = Object.freeze([]);
    this.detectedExternalRevision = null;
    this.notify();

    const blockOnLoadFailure = this.storage.requiresLoadBeforeSave === true;

    if (!this.storage.isAvailable()) {
      return this.applyFallbackDefaults(
        'unavailable',
        'unavailable',
        'STORAGE_UNAVAILABLE',
        'Persistent storage is unavailable in this environment.',
        blockOnLoadFailure,
      );
    }

    let loadResult:
      { readonly timedOut: true } | { readonly timedOut: false; readonly raw: string | null };
    try {
      loadResult = await this.loadWithTimeout();
    } catch (error) {
      if (this.isDisposed() || activeEpoch !== this.initEpoch) {
        return {
          outcome: 'read_failed',
          data: createDefaultSaveData({ updatedAt: this.nowIso() }),
          repairs: [],
          errorCode: extractErrorCode(error, 'STORAGE_READ_FAILED'),
        };
      }
      const code = extractErrorCode(error, 'STORAGE_READ_FAILED');
      const status: SaveLifecycleStatus = code === 'STORAGE_UNAVAILABLE' ? 'unavailable' : 'failed';
      return this.applyFallbackDefaults(
        code === 'STORAGE_UNAVAILABLE' ? 'unavailable' : 'read_failed',
        status,
        code,
        extractErrorMessage(error, 'Unable to load saved progress.'),
        blockOnLoadFailure,
      );
    }

    if (this.isDisposed() || activeEpoch !== this.initEpoch) {
      return {
        outcome: 'timeout',
        data: createDefaultSaveData({ updatedAt: this.nowIso() }),
        repairs: [],
        errorCode: 'STORAGE_TIMEOUT',
      };
    }

    if (loadResult.timedOut) {
      // Increment epoch so the still-pending storage promise cannot affect future state.
      this.initEpoch += 1;
      return this.applyFallbackDefaults(
        'timeout',
        'unavailable',
        'STORAGE_TIMEOUT',
        'Storage load timed out; continuing in a temporary session.',
        blockOnLoadFailure,
      );
    }

    return this.processLoadedRawPayload(loadResult.raw);
  }

  /**
   * Requests persistence of the latest application state.
   * High-priority saves (e.g. level completion, tutorial completion) bypass normal debounce.
   * Unchanged persisted content is skipped automatically to avoid redundant storage writes.
   */
  public requestSave(_reason: SaveReason, priority: SavePriority = 'normal'): boolean {
    if (this.disposed || this.restoring || this.autoWriteBlocked) {
      return false;
    }

    const candidate = captureSaveData(this.targets, {
      revision: this.currentRevision + 1,
      updatedAt: this.nowIso(),
    });
    const contentSignature = computeSaveContentSignature(candidate);

    if (!this.hasUnsavedChanges && contentSignature === this.lastSavedContentSignature) {
      return false;
    }

    if (this.pendingCandidate !== null && contentSignature === this.pendingContentSignature) {
      if (priority === 'high' && this.debounceTimer !== null) {
        this.clearDebounceTimer();
        void this.pumpWriteQueue();
      }
      return true;
    }

    this.currentRevision += 1;
    const queuedSnapshot = freezeSaveData({
      ...candidate,
      revision: this.currentRevision,
    });

    this.pendingCandidate = queuedSnapshot;
    this.pendingContentSignature = contentSignature;
    this.hasUnsavedChanges = true;
    this.retryAttemptCount = 0;
    this.clearRetryTimer();

    if (this.writeInFlight === null) {
      this.status = 'dirty';
    }
    this.notify();

    if (priority === 'high') {
      this.clearDebounceTimer();
      void this.pumpWriteQueue();
    } else {
      this.scheduleDebouncedWrite();
    }

    return true;
  }

  /**
   * Immediately initiates any pending debounced save and awaits completion up to `timeoutMs`.
   * Safe to call on lifecycle suspension or before navigation.
   */
  public async flush(timeoutMs: number = PERSISTENCE_CONFIG.flushTimeoutMs): Promise<boolean> {
    if (this.disposed || this.autoWriteBlocked) {
      return false;
    }

    this.clearDebounceTimer();
    this.clearRetryTimer();

    if (this.pendingCandidate === null && this.hasUnsavedChanges) {
      const candidate = captureSaveData(this.targets, {
        revision: this.currentRevision,
        updatedAt: this.nowIso(),
      });
      this.pendingCandidate = candidate;
      this.pendingContentSignature = computeSaveContentSignature(candidate);
    }

    if (this.pendingCandidate !== null && this.writeInFlight === null) {
      void this.pumpWriteQueue();
    }

    if (this.writeInFlight === null) {
      return !this.hasUnsavedChanges;
    }

    const waitForAllWrites = async (): Promise<void> => {
      while (this.writeInFlight !== null) {
        await this.writeInFlight;
      }
    };

    if (timeoutMs <= 0) {
      await waitForAllWrites();
      return !this.hasUnsavedChanges;
    }

    const timerRef: { id: ReturnType<typeof globalThis.setTimeout> | null } = { id: null };
    try {
      await Promise.race([
        waitForAllWrites(),
        new Promise<void>((resolve) => {
          timerRef.id = globalThis.setTimeout(resolve, timeoutMs);
        }),
      ]);
    } finally {
      if (timerRef.id !== null) {
        globalThis.clearTimeout(timerRef.id);
      }
    }

    return !this.hasUnsavedChanges;
  }

  /** Retries eligible unsaved changes after storage becomes available or browser resumes. */
  public retryIfEligible(): void {
    if (this.disposed || this.autoWriteBlocked || !this.hasUnsavedChanges) {
      return;
    }
    this.retryAttemptCount = 0;
    this.clearRetryTimer();
    if (this.pendingCandidate === null) {
      const candidate = captureSaveData(this.targets, {
        revision: this.currentRevision,
        updatedAt: this.nowIso(),
      });
      this.pendingCandidate = candidate;
      this.pendingContentSignature = computeSaveContentSignature(candidate);
    }
    void this.pumpWriteQueue();
  }

  /**
   * Explicitly confirmed recovery/reset operation for isolated dev diagnostics or intentional
   * fresh-start recovery from a corrupted, unsupported, or conflicted save.
   */
  public async resetStorageForFreshStart(): Promise<void> {
    if (this.disposed) {
      return;
    }
    this.clearTimers();
    this.pendingCandidate = null;
    this.pendingContentSignature = '';
    this.autoWriteBlocked = false;
    this.detectedExternalRevision = null;
    this.lastErrorCode = null;
    this.lastErrorMessage = null;
    this.repairs = Object.freeze([]);

    if (this.storage.remove !== undefined) {
      try {
        await this.storage.remove();
      } catch {
        // Proceed with fresh in-memory state even if remove fails.
      }
    }

    const fresh = createDefaultSaveData({ updatedAt: this.nowIso() });
    this.applyRestoredSnapshot(fresh);
    this.currentRevision = 0;
    this.lastSavedRevision = 0;
    this.hasUnsavedChanges = false;
    this.lastSavedAt = null;
    this.lastSuccessfulSave = fresh;
    this.lastSavedContentSignature = computeSaveContentSignature(fresh);
    this.lastSerializedBytes = measureUtf8ByteSize(serializeSaveData(fresh));
    this.isDurable = this.storage.isAvailable();
    this.status = this.isDurable ? 'ready' : 'unavailable';
    this.notify();
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.initEpoch += 1;
    this.clearTimers();
    this.unsubscribeExternalChange?.();
    this.unsubscribeExternalChange = undefined;
    this.listeners.clear();
  }

  private isDisposed(): boolean {
    return this.disposed;
  }

  private async loadWithTimeout(): Promise<
    { readonly timedOut: true } | { readonly timedOut: false; readonly raw: string | null }
  > {
    if (this.startupLoadTimeoutMs <= 0) {
      const raw = await this.storage.load();
      return { timedOut: false, raw };
    }

    const timerRef: { id: ReturnType<typeof globalThis.setTimeout> | null } = { id: null };
    try {
      return await Promise.race([
        this.storage.load().then((raw) => ({ timedOut: false as const, raw })),
        new Promise<{ readonly timedOut: true }>((resolve) => {
          timerRef.id = globalThis.setTimeout(() => {
            resolve({ timedOut: true });
          }, this.startupLoadTimeoutMs);
        }),
      ]);
    } finally {
      if (timerRef.id !== null) {
        globalThis.clearTimeout(timerRef.id);
      }
    }
  }

  private processLoadedRawPayload(raw: string | null): SaveInitOutcome {
    if (raw === null) {
      const defaults = createDefaultSaveData({ updatedAt: this.nowIso() });
      this.applyRestoredSnapshot(defaults);
      this.currentRevision = 0;
      this.lastSavedRevision = 0;
      this.hasUnsavedChanges = false;
      this.lastSavedAt = null;
      this.lastSuccessfulSave = defaults;
      this.lastSavedContentSignature = computeSaveContentSignature(defaults);
      this.lastSerializedBytes = measureUtf8ByteSize(serializeSaveData(defaults));
      this.isDurable = this.storage.isAvailable();
      this.status = this.isDurable ? 'ready' : 'unavailable';
      this.notify();
      return { outcome: 'missing', data: defaults, repairs: [], errorCode: null };
    }

    const parsed = parseRawSaveJson(raw);
    if (!parsed.ok) {
      return this.applyFallbackDefaults(
        'corrupted',
        'recovery_required',
        parsed.error.code,
        parsed.error.message,
        true,
      );
    }

    let candidate: Record<string, unknown> = parsed.value;
    const rawVersion = candidate.schemaVersion;

    if (typeof rawVersion === 'number' && Number.isInteger(rawVersion)) {
      if (rawVersion > CURRENT_SAVE_SCHEMA_VERSION) {
        return this.applyFallbackDefaults(
          'unsupported_version',
          'unsupported_version',
          'UNSUPPORTED_SCHEMA_VERSION',
          `Saved data uses newer schema version ${String(rawVersion)}.`,
          true,
        );
      }

      if (rawVersion >= 1 && rawVersion < CURRENT_SAVE_SCHEMA_VERSION) {
        const migrated = this.migrationRegistry.migrate(
          candidate,
          rawVersion,
          CURRENT_SAVE_SCHEMA_VERSION,
        );
        if (!migrated.ok) {
          return this.applyFallbackDefaults(
            'corrupted',
            'recovery_required',
            migrated.errorCode,
            migrated.message,
            true,
          );
        }
        candidate = migrated.data;
      }
    }

    const catalog = this.targets.progressionController.getCatalog();
    const validation = validateSaveData(candidate, catalog);

    if (validation.disposition === 'unsupported_future_version') {
      return this.applyFallbackDefaults(
        'unsupported_version',
        'unsupported_version',
        'UNSUPPORTED_SCHEMA_VERSION',
        validation.errors[0] ?? 'Unsupported future save schema version.',
        true,
      );
    }

    if (
      validation.disposition === 'corrupted' ||
      validation.disposition === 'unsupported_legacy_version' ||
      validation.data === null
    ) {
      return this.applyFallbackDefaults(
        'corrupted',
        'recovery_required',
        'INVALID_SAVE_DATA',
        validation.errors[0] ?? 'Saved progress failed validation.',
        true,
      );
    }

    const restoredData = validation.data;
    this.applyRestoredSnapshot(restoredData);

    const serialized = serializeSaveData(restoredData);
    this.currentRevision = restoredData.revision;
    this.lastSavedRevision = restoredData.revision;
    this.lastSavedAt = restoredData.updatedAt;
    this.lastSuccessfulSave = restoredData;
    this.lastSerializedBytes = measureUtf8ByteSize(serialized);
    this.repairs = validation.repairs;
    this.isDurable = true;

    if (validation.disposition === 'repaired') {
      this.lastSavedContentSignature = '';
      this.hasUnsavedChanges = true;
      this.status = 'dirty';
      this.notify();
      return {
        outcome: 'repaired',
        data: restoredData,
        repairs: validation.repairs,
        errorCode: null,
      };
    }

    this.lastSavedContentSignature = computeSaveContentSignature(restoredData);
    this.hasUnsavedChanges = false;
    this.status = 'ready';
    this.notify();
    return { outcome: 'restored', data: restoredData, repairs: [], errorCode: null };
  }

  private applyFallbackDefaults(
    outcome: SaveInitOutcome['outcome'],
    status: SaveLifecycleStatus,
    errorCode: SaveErrorCode,
    errorMessage: string,
    blockAutoWrites: boolean,
  ): SaveInitOutcome {
    const defaults = createDefaultSaveData({ updatedAt: this.nowIso() });
    this.applyRestoredSnapshot(defaults);
    this.currentRevision = 0;
    this.lastSavedRevision = 0;
    this.hasUnsavedChanges = false;
    this.lastSavedAt = null;
    this.lastSuccessfulSave = null;
    this.lastSavedContentSignature = computeSaveContentSignature(defaults);
    this.lastSerializedBytes = measureUtf8ByteSize(serializeSaveData(defaults));
    this.autoWriteBlocked = blockAutoWrites;
    this.isDurable = false;
    this.lastErrorCode = errorCode;
    this.lastErrorMessage = errorMessage;
    this.status = status;
    this.notify();
    return { outcome, data: defaults, repairs: [], errorCode };
  }

  private applyRestoredSnapshot(data: SaveData): void {
    this.restoring = true;
    try {
      restoreSaveData(data, this.targets);
    } finally {
      this.restoring = false;
    }
  }

  private scheduleDebouncedWrite(): void {
    this.clearDebounceTimer();
    if (this.normalDebounceMs <= 0) {
      void this.pumpWriteQueue();
      return;
    }
    this.debounceTimer = globalThis.setTimeout(() => {
      this.debounceTimer = null;
      void this.pumpWriteQueue();
    }, this.normalDebounceMs);
  }

  private pumpWriteQueue(): Promise<void> {
    if (this.writeInFlight !== null) {
      return this.writeInFlight;
    }
    if (this.disposed || this.autoWriteBlocked || this.pendingCandidate === null) {
      return Promise.resolve();
    }

    const writePromise = this.executeSingleWrite().finally(() => {
      if (this.writeInFlight === writePromise) {
        this.writeInFlight = null;
      }
      // If newer revisions arrived while this write was active, persist the latest coalesced snapshot.
      if (!this.disposed && !this.autoWriteBlocked && this.pendingCandidate !== null) {
        if (this.status !== 'failed' && this.status !== 'unavailable') {
          void this.pumpWriteQueue();
        }
      }
    });

    this.writeInFlight = writePromise;
    return writePromise;
  }

  private async executeSingleWrite(): Promise<void> {
    const snapshot = this.pendingCandidate;
    const signature = this.pendingContentSignature;
    if (snapshot === null || this.disposed || this.autoWriteBlocked) {
      return;
    }

    this.pendingCandidate = null;
    this.pendingContentSignature = '';

    if (!this.storage.isAvailable()) {
      this.restorePendingAfterFailure(snapshot, signature);
      this.isDurable = false;
      this.lastErrorCode = 'STORAGE_UNAVAILABLE';
      this.lastErrorMessage = 'Persistent storage is currently unavailable.';
      this.status = 'unavailable';
      this.notify();
      return;
    }

    let serialized: string;
    try {
      serialized = serializeSaveData(snapshot);
    } catch (error) {
      this.restorePendingAfterFailure(snapshot, signature);
      this.isDurable = false;
      this.lastErrorCode = extractErrorCode(error, 'SERIALIZATION_FAILED');
      this.lastErrorMessage = extractErrorMessage(error, 'Save serialization failed.');
      this.status = 'failed';
      this.notify();
      return;
    }

    this.status = 'saving';
    this.notify();

    try {
      await this.storage.save(serialized);
    } catch (error) {
      if (this.isDisposed()) {
        return;
      }
      this.restorePendingAfterFailure(snapshot, signature);
      const code = extractErrorCode(error, 'STORAGE_WRITE_FAILED');
      this.isDurable = false;
      this.lastErrorCode = code;
      this.lastErrorMessage = extractErrorMessage(error, 'Failed to write progress to storage.');
      this.status = code === 'STORAGE_UNAVAILABLE' ? 'unavailable' : 'failed';
      this.scheduleBoundedRetry(code);
      this.notify();
      return;
    }

    if (this.isDisposed()) {
      return;
    }

    this.lastSavedRevision = snapshot.revision;
    this.lastSavedAt = snapshot.updatedAt;
    this.lastSuccessfulSave = snapshot;
    this.lastSavedContentSignature = signature;
    this.lastSerializedBytes = measureUtf8ByteSize(serialized);
    this.retryAttemptCount = 0;
    this.lastErrorCode = null;
    this.lastErrorMessage = null;
    this.isDurable = true;

    // Only transition to 'saved' if no newer revision was queued while this write was in flight.
    if (!this.hasPendingCandidate() && this.lastSavedRevision === this.currentRevision) {
      this.hasUnsavedChanges = false;
      this.status = 'saved';
    } else {
      this.hasUnsavedChanges = true;
      this.status = 'dirty';
    }
    this.notify();
  }

  private hasPendingCandidate(): boolean {
    return this.pendingCandidate !== null;
  }

  private restorePendingAfterFailure(snapshot: SaveData, signature: string): void {
    this.hasUnsavedChanges = true;
    if (this.pendingCandidate === null) {
      this.pendingCandidate = snapshot;
      this.pendingContentSignature = signature;
    }
  }

  private scheduleBoundedRetry(code: SaveErrorCode): void {
    if (
      this.disposed ||
      this.autoWriteBlocked ||
      code === 'STORAGE_UNAVAILABLE' ||
      code === 'STORAGE_QUOTA_EXCEEDED' ||
      code === 'SERIALIZATION_FAILED' ||
      this.retryAttemptCount >= this.maxAutomaticRetries
    ) {
      return;
    }

    const delayMs =
      this.retryBackoffMs[this.retryAttemptCount] ??
      this.retryBackoffMs[this.retryBackoffMs.length - 1] ??
      2000;
    this.retryAttemptCount += 1;

    this.clearRetryTimer();
    this.retryTimer = globalThis.setTimeout(() => {
      this.retryTimer = null;
      if (!this.disposed && !this.autoWriteBlocked && this.hasUnsavedChanges) {
        void this.pumpWriteQueue();
      }
    }, delayMs);
  }

  private handleExternalStorageMutation(raw: string | null): void {
    if (this.disposed || raw === null) {
      return;
    }
    const parsed = parseRawSaveJson(raw);
    if (!parsed.ok) {
      return;
    }
    const externalRev = parsed.value.revision;
    if (
      typeof externalRev === 'number' &&
      Number.isInteger(externalRev) &&
      externalRev > this.lastSavedRevision
    ) {
      this.clearTimers();
      this.autoWriteBlocked = true;
      this.detectedExternalRevision = externalRev;
      this.lastErrorCode = 'EXTERNAL_CONFLICT';
      this.lastErrorMessage = `Another tab saved newer revision ${String(externalRev)}.`;
      this.status = 'conflict';
      this.notify();
    }
  }

  private clearDebounceTimer(): void {
    if (this.debounceTimer !== null) {
      globalThis.clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  private clearRetryTimer(): void {
    if (this.retryTimer !== null) {
      globalThis.clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  private clearTimers(): void {
    this.clearDebounceTimer();
    this.clearRetryTimer();
  }

  private notify(): void {
    if (this.listeners.size === 0) {
      return;
    }
    const snapshot = this.getStatus();
    for (const listener of [...this.listeners]) {
      listener(snapshot);
    }
  }
}
