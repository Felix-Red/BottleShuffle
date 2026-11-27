import type { AudioAssetKey, MusicAssetKey, SfxAssetKey } from '../../game/assets/AssetKeys';
import type { Unsubscribe } from '../../platform/contracts/GamePlatform';
import type { AudioChannel } from './AudioChannel';

export interface BackendSfxPlayRequest {
  readonly key: SfxAssetKey;
  readonly channel: AudioChannel;
  readonly volume: number;
  readonly rate: number;
  readonly priority: number;
  readonly onEnded?: () => void;
}

export interface BackendSoundHandle {
  readonly id: number;
  readonly key: SfxAssetKey;
  readonly channel: AudioChannel;
  readonly priority: number;
  stop(): void;
  setVolume(volume: number): void;
  isPlaying(): boolean;
}

export interface BackendMusicPlayRequest {
  readonly key: MusicAssetKey;
  readonly volume: number;
  readonly loop: boolean;
}

export interface BackendMusicHandle {
  readonly key: MusicAssetKey;
  stop(): void;
  pause(): void;
  resume(): void;
  setVolume(volume: number): void;
  fadeTo(targetVolume: number, durationMs: number, onComplete?: () => void): void;
  isPlaying(): boolean;
  isPaused(): boolean;
}

/**
 * Minimal audio playback abstraction isolating Phaser sound manager details
 * so AudioService can be verified deterministically in Node unit tests.
 */
export interface AudioBackend {
  isUnlocked(): boolean;
  unlock(): Promise<boolean>;
  onUnlocked(listener: () => void): Unsubscribe;
  hasAsset(key: AudioAssetKey): boolean;
  playSfx(request: BackendSfxPlayRequest): BackendSoundHandle | null;
  playMusic(request: BackendMusicPlayRequest): BackendMusicHandle | null;
  setGlobalMute(muted: boolean): void;
  dispose(): void;
}
