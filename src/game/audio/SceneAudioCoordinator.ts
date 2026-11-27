import type Phaser from 'phaser';
import type { MusicContext } from '../../services/audio/AudioChannel';
import type { AudioService } from '../../services/audio/AudioService';
import { AUDIO_ASSET_KEYS } from '../assets/AssetKeys';
import { queueDeferredMusicAssets } from '../assets/AssetManifest';

/**
 * Coordinates scene-level music contexts, global browser autoplay unlock on first user
 * gesture, non-blocking deferred music loading, and common UI feedback sounds across scenes.
 */
export class SceneAudioCoordinator {
  private readonly audioService: AudioService;
  private deferredMusicStarted = false;
  private gestureListenersBound = false;
  private disposed = false;

  private readonly handleUserGesture = (): void => {
    if (this.disposed) {
      this.unbindGestureListeners();
      return;
    }

    void this.audioService.unlock().then((unlocked) => {
      if (unlocked || this.disposed) {
        this.unbindGestureListeners();
      }
    });
  };

  public constructor(audioService: AudioService) {
    this.audioService = audioService;
    this.bindGestureListeners();
  }

  public getAudioService(): AudioService {
    return this.audioService;
  }

  /**
   * Transitions background music cleanly for the active scene and initiates
   * non-blocking deferred music loading once per session.
   */
  public enterScene(scene: Phaser.Scene, musicContext: MusicContext): void {
    if (this.disposed) {
      return;
    }

    this.ensureDeferredMusicLoaded(scene);
    this.audioService.setMusicContext(musicContext);
  }

  /**
   * Queues deferred background music tracks without blocking initial boot or rendering.
   * Safe to call multiple times; loads at most once.
   */
  public ensureDeferredMusicLoaded(scene: Phaser.Scene): void {
    if (this.disposed || this.deferredMusicStarted) {
      return;
    }
    this.deferredMusicStarted = true;

    const report = queueDeferredMusicAssets(scene);
    if (report.queuedCount === 0) {
      this.audioService.notifyAssetsLoaded();
      return;
    }

    scene.load.once('complete', () => {
      if (!this.disposed) {
        this.audioService.notifyAssetsLoaded();
      }
    });

    if (!scene.load.isLoading()) {
      scene.load.start();
    }
  }

  public playUiClick(): void {
    this.audioService.playSfx(AUDIO_ASSET_KEYS.SFX_UI_CLICK);
  }

  public playUiBack(): void {
    this.audioService.playSfx(AUDIO_ASSET_KEYS.SFX_UI_BACK);
  }

  public playLevelUnlock(): void {
    this.audioService.playSfx(AUDIO_ASSET_KEYS.SFX_LEVEL_UNLOCK);
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.unbindGestureListeners();
  }

  private bindGestureListeners(): void {
    if (this.gestureListenersBound || typeof globalThis.window === 'undefined') {
      return;
    }
    if (this.audioService.getState().unlocked) {
      return;
    }

    this.gestureListenersBound = true;
    globalThis.window.addEventListener('pointerdown', this.handleUserGesture, { capture: true });
    globalThis.window.addEventListener('keydown', this.handleUserGesture, { capture: true });
    globalThis.window.addEventListener('touchstart', this.handleUserGesture, {
      capture: true,
      passive: true,
    });
  }

  private unbindGestureListeners(): void {
    if (!this.gestureListenersBound || typeof globalThis.window === 'undefined') {
      return;
    }
    this.gestureListenersBound = false;
    globalThis.window.removeEventListener('pointerdown', this.handleUserGesture, { capture: true });
    globalThis.window.removeEventListener('keydown', this.handleUserGesture, { capture: true });
    globalThis.window.removeEventListener('touchstart', this.handleUserGesture, { capture: true });
  }
}
