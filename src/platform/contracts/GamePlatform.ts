import type { AdvertisingProvider } from './AdvertisingProvider';
import type { PlatformCapabilities } from './PlatformCapabilities';
import type { SaveStorage } from './SaveStorage';

export type Unsubscribe = () => void;
export type LifecycleCallback = () => void;
export type AudioChangeCallback = (isAudioEnabled: boolean) => void;

export interface GamePlatform {
  readonly name: string;

  /** Performs any required platform setup before the game starts. */
  initialize(): Promise<void>;

  /** Notifies the host platform that the first visual frame has been rendered. */
  notifyFirstFrameReady(): void;

  /** Notifies the host platform that the game is fully loaded and ready for interaction. */
  notifyGameReady(): void;

  /** Loads the serialized player save payload, or null when no saved state exists. */
  loadData(): Promise<string | null>;

  /** Persists a serialized player save payload to platform storage. */
  saveData(data: string): Promise<void>;

  /** Returns the authoritative platform-owned SaveStorage adapter when provided. */
  getSaveStorage?(): SaveStorage;

  /** Returns the authoritative platform-owned AdvertisingProvider adapter when provided. */
  getAdvertisingProvider?(): AdvertisingProvider;

  /** Returns whether the host platform currently has the game suspended. */
  isHostPaused?(): boolean;

  /** Returns explicit capability flags for the active runtime environment. */
  getCapabilities?(): PlatformCapabilities;

  /** Resolves the active BCP-47 language tag (falling back cleanly to "en"). */
  getLanguage?(): Promise<string>;

  /** Optional rate-limited platform health error reporting (never transmits PII or secrets). */
  logHealthError?(): void;

  /** Returns whether platform-level audio output is currently enabled. */
  isAudioEnabled(): boolean;

  /**
   * Returns whether the host device/platform may support tactile vibration.
   * Capability check only — never invokes vibration APIs.
   */
  isVibrationSupported?(): boolean;

  /**
   * Triggers a brief tactile vibration pattern when supported by the host platform.
   * Must fail safely and return false when unavailable or blocked.
   */
  vibrate?(pattern: number | readonly number[]): boolean;

  /** Cancels any currently active vibration pattern on the host platform. */
  cancelVibration?(): void;

  /** Subscribes to changes in platform-level audio availability. */
  onAudioEnabledChange(callback: AudioChangeCallback): Unsubscribe;

  /** Subscribes to platform pause events (e.g. tab hidden or host overlay). */
  onPause(callback: LifecycleCallback): Unsubscribe;

  /** Subscribes to platform resume events. */
  onResume(callback: LifecycleCallback): Unsubscribe;

  /** Releases event listeners and internal resources held by the platform adapter. */
  dispose(): void;
}
