import type { Unsubscribe } from './GamePlatform';

/**
 * Platform-independent asynchronous persistence storage contract.
 * Completely decoupled from Phaser, LocalStorage, and future YouTube Playables SDKs.
 */
export interface SaveStorage {
  readonly name: string;

  /**
   * When true (e.g. YouTube Playables cloud storage), writes must never be attempted
   * unless an initial load() has completed successfully.
   */
  readonly requiresLoadBeforeSave?: boolean;

  /** Returns whether durable storage appears available in the active host environment. */
  isAvailable(): boolean;

  /** Loads the raw serialized save payload, or null when no save exists yet. */
  load(): Promise<string | null>;

  /** Writes the serialized save payload durably. Rejects with SaveError on failure. */
  save(serializedData: string): Promise<void>;

  /** Optional controlled removal for isolated development diagnostics or confirmed resets. */
  remove?(): Promise<void>;

  /** Optional notification when another tab/context modifies the underlying storage key. */
  onExternalChange?(listener: (serializedData: string | null) => void): Unsubscribe;

  /** Releases any event listeners held by the storage adapter. */
  dispose?(): void;
}
