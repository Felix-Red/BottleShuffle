import Phaser from 'phaser';
import type { AudioAssetKey } from '../../game/assets/AssetKeys';
import type { Unsubscribe } from '../../platform/contracts/GamePlatform';
import type {
  AudioBackend,
  BackendMusicHandle,
  BackendMusicPlayRequest,
  BackendSfxPlayRequest,
  BackendSoundHandle,
} from './AudioBackend';
import { clampVolume } from './AudioConfig';

interface PhaserSoundLike {
  readonly isPlaying: boolean;
  readonly isPaused: boolean;
  volume?: number;
  play(): boolean;
  stop(): boolean;
  pause(): boolean;
  resume(): boolean;
  destroy(): void;
  once(event: string | symbol, fn: () => void): unknown;
  setVolume?(value: number): unknown;
  setRate?(value: number): unknown;
}

interface WebAudioContextCarrier {
  readonly context?: AudioContext;
}

function applySoundVolume(sound: PhaserSoundLike, volume: number): void {
  const safe = clampVolume(volume);
  if (typeof sound.setVolume === 'function') {
    sound.setVolume(safe);
  } else if (typeof sound.volume === 'number') {
    sound.volume = safe;
  }
}

function readSoundVolume(sound: PhaserSoundLike): number {
  return typeof sound.volume === 'number' ? clampVolume(sound.volume) : 0;
}

function applySoundRate(sound: PhaserSoundLike, rate: number): void {
  const safeRate = Number.isFinite(rate) ? Math.max(0.5, Math.min(2, rate)) : 1;
  if (typeof sound.setRate === 'function') {
    sound.setRate(safeRate);
  }
}

function getWebAudioContext(soundManager: Phaser.Sound.BaseSoundManager): AudioContext | null {
  const candidate = soundManager as unknown as WebAudioContextCarrier;
  if (
    candidate.context !== undefined &&
    typeof candidate.context.resume === 'function' &&
    typeof candidate.context.state === 'string'
  ) {
    return candidate.context;
  }
  return null;
}

/**
 * Phaser 3 sound manager adapter implementing AudioBackend.
 * Uses a scene-independent fade timer so music crossfades survive scene transitions cleanly
 * and fails safely if assets are missing or audio playback is unavailable.
 */
export class PhaserAudioBackend implements AudioBackend {
  private game: Phaser.Game | null;
  private readonly unlockListeners = new Set<() => void>();
  private readonly activeTimers = new Set<ReturnType<typeof globalThis.setInterval>>();
  private pendingGlobalMute = false;
  private nextHandleId = 1;
  private disposed = false;

  private readonly handlePhaserUnlocked = (): void => {
    if (this.disposed) {
      return;
    }
    for (const listener of [...this.unlockListeners]) {
      listener();
    }
  };

  public constructor(game: Phaser.Game | null = null) {
    this.game = null;
    if (game !== null) {
      this.attachGame(game);
    }
  }

  /**
   * Attaches the live Phaser.Game instance immediately after construction so
   * scenes can receive the shared AudioService during bootstrap before create().
   */
  public attachGame(game: Phaser.Game): void {
    if (this.disposed || this.game === game) {
      return;
    }
    if (this.game !== null) {
      this.game.sound.off(Phaser.Sound.Events.UNLOCKED, this.handlePhaserUnlocked);
    }
    this.game = game;
    this.game.sound.on(Phaser.Sound.Events.UNLOCKED, this.handlePhaserUnlocked);
    this.setGlobalMute(this.pendingGlobalMute);
    if (this.isUnlocked()) {
      this.handlePhaserUnlocked();
    }
  }

  public isUnlocked(): boolean {
    if (this.disposed || this.game === null) {
      return false;
    }
    const ctx = getWebAudioContext(this.game.sound);
    if (ctx !== null && ctx.state === 'running') {
      return true;
    }
    return !this.game.sound.locked;
  }

  public async unlock(): Promise<boolean> {
    if (this.disposed || this.game === null) {
      return false;
    }
    if (this.isUnlocked()) {
      return true;
    }

    try {
      this.game.sound.unlock();
      const ctx = getWebAudioContext(this.game.sound);
      if (ctx !== null && ctx.state !== 'running') {
        await ctx.resume();
      }
    } catch {
      return false;
    }

    const unlocked = this.isUnlocked();
    if (unlocked) {
      this.handlePhaserUnlocked();
    }
    return unlocked;
  }

  public onUnlocked(listener: () => void): Unsubscribe {
    if (this.disposed) {
      return () => undefined;
    }
    this.unlockListeners.add(listener);
    return () => {
      this.unlockListeners.delete(listener);
    };
  }

  public hasAsset(key: AudioAssetKey): boolean {
    if (this.disposed || this.game === null) {
      return false;
    }
    try {
      return this.game.cache.audio.exists(key);
    } catch {
      return false;
    }
  }

  public playSfx(request: BackendSfxPlayRequest): BackendSoundHandle | null {
    if (this.disposed || this.game === null || !this.hasAsset(request.key)) {
      return null;
    }

    let sound: PhaserSoundLike;
    try {
      sound = this.game.sound.add(request.key, {
        volume: clampVolume(request.volume),
        rate: request.rate,
        loop: false,
      });
    } catch {
      return null;
    }

    applySoundVolume(sound, request.volume);
    applySoundRate(sound, request.rate);

    const id = this.nextHandleId;
    this.nextHandleId += 1;
    let stopped = false;

    const cleanup = (): void => {
      if (stopped) {
        return;
      }
      stopped = true;
      try {
        sound.destroy();
      } catch {
        // Ignore sound destruction errors during shutdown.
      }
      request.onEnded?.();
    };

    sound.once(Phaser.Sound.Events.COMPLETE, cleanup);
    sound.once(Phaser.Sound.Events.STOP, cleanup);

    try {
      const started = sound.play();
      if (!started) {
        cleanup();
        return null;
      }
    } catch {
      cleanup();
      return null;
    }

    return {
      id,
      key: request.key,
      channel: request.channel,
      priority: request.priority,
      stop: (): void => {
        if (stopped) {
          return;
        }
        try {
          sound.stop();
        } catch {
          cleanup();
        }
      },
      setVolume: (volume: number): void => {
        if (!stopped) {
          applySoundVolume(sound, volume);
        }
      },
      isPlaying: (): boolean => !stopped && sound.isPlaying,
    };
  }

  public playMusic(request: BackendMusicPlayRequest): BackendMusicHandle | null {
    if (this.disposed || this.game === null || !this.hasAsset(request.key)) {
      return null;
    }

    let sound: PhaserSoundLike;
    try {
      sound = this.game.sound.add(request.key, {
        volume: clampVolume(request.volume),
        loop: request.loop,
      });
    } catch {
      return null;
    }

    applySoundVolume(sound, request.volume);

    let activeFadeTimer: ReturnType<typeof globalThis.setInterval> | null = null;
    let stopped = false;

    const clearFade = (): void => {
      if (activeFadeTimer !== null) {
        globalThis.clearInterval(activeFadeTimer);
        this.activeTimers.delete(activeFadeTimer);
        activeFadeTimer = null;
      }
    };

    try {
      const started = sound.play();
      if (!started) {
        sound.destroy();
        return null;
      }
    } catch {
      try {
        sound.destroy();
      } catch {
        // Ignore cleanup errors.
      }
      return null;
    }

    return {
      key: request.key,
      stop: (): void => {
        if (stopped) {
          return;
        }
        stopped = true;
        clearFade();
        try {
          sound.stop();
          sound.destroy();
        } catch {
          // Ignore teardown errors.
        }
      },
      pause: (): void => {
        if (stopped) {
          return;
        }
        clearFade();
        try {
          if (sound.isPlaying) {
            sound.pause();
          }
        } catch {
          // Ignore pause errors.
        }
      },
      resume: (): void => {
        if (stopped) {
          return;
        }
        try {
          if (sound.isPaused) {
            sound.resume();
          }
        } catch {
          // Ignore resume errors.
        }
      },
      setVolume: (volume: number): void => {
        if (stopped) {
          return;
        }
        clearFade();
        applySoundVolume(sound, volume);
      },
      fadeTo: (targetVolume: number, durationMs: number, onComplete?: () => void): void => {
        if (stopped) {
          return;
        }
        clearFade();
        const clampedTarget = clampVolume(targetVolume);
        if (durationMs <= 0) {
          applySoundVolume(sound, clampedTarget);
          onComplete?.();
          return;
        }

        const startVolume = readSoundVolume(sound);
        const startTime = Date.now();
        activeFadeTimer = globalThis.setInterval(() => {
          if (stopped || this.disposed) {
            clearFade();
            return;
          }
          const progress = Math.min(1, (Date.now() - startTime) / durationMs);
          applySoundVolume(sound, startVolume + (clampedTarget - startVolume) * progress);
          if (progress >= 1) {
            clearFade();
            onComplete?.();
          }
        }, 16);
        this.activeTimers.add(activeFadeTimer);
      },
      isPlaying: (): boolean => !stopped && sound.isPlaying,
      isPaused: (): boolean => !stopped && sound.isPaused,
    };
  }

  public setGlobalMute(muted: boolean): void {
    this.pendingGlobalMute = muted;
    if (this.disposed || this.game === null) {
      return;
    }
    try {
      this.game.sound.mute = muted;
    } catch {
      // Ignore mute errors on no-audio backends.
    }
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    for (const timer of this.activeTimers) {
      globalThis.clearInterval(timer);
    }
    this.activeTimers.clear();
    if (this.game !== null) {
      this.game.sound.off(Phaser.Sound.Events.UNLOCKED, this.handlePhaserUnlocked);
      this.game = null;
    }
    this.unlockListeners.clear();
  }
}
