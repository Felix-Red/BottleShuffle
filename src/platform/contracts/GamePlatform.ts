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

  /** Returns whether platform-level audio output is currently enabled. */
  isAudioEnabled(): boolean;

  /** Subscribes to changes in platform-level audio availability. */
  onAudioEnabledChange(callback: AudioChangeCallback): Unsubscribe;

  /** Subscribes to platform pause events (e.g. tab hidden or host overlay). */
  onPause(callback: LifecycleCallback): Unsubscribe;

  /** Subscribes to platform resume events. */
  onResume(callback: LifecycleCallback): Unsubscribe;

  /** Releases event listeners and internal resources held by the platform adapter. */
  dispose(): void;
}
