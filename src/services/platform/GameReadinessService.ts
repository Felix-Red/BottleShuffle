import type { GamePlatform } from '../../platform/contracts/GamePlatform';

export interface ReadinessSnapshot {
  readonly firstFrameReadyNotified: boolean;
  readonly gameReadyNotified: boolean;
  readonly assetsLoaded: boolean;
  readonly saveRestored: boolean;
  readonly interactiveSceneReady: boolean;
  readonly firstFrameReadyAtMs: number | null;
  readonly gameReadyAtMs: number | null;
}

/**
 * Central application-level readiness coordinator guaranteeing official YouTube Playables
 * readiness invariants:
 * - `firstFrameReady()` fires once when the first meaningful visual frame renders.
 * - `gameReady()` fires once ONLY after assets are loaded, save restoration/fallback has
 *   completed, and the initial interactive screen is active with input ready.
 * - `firstFrameReady()` always precedes `gameReady()`.
 * - Scene changes, restarts, and viewport resizes never repeat either notification.
 */
export class GameReadinessService {
  private readonly platform: GamePlatform;
  private readonly now: () => number;

  private firstFrameReadyNotified = false;
  private gameReadyNotified = false;
  private assetsLoaded = false;
  private saveRestored = false;
  private interactiveSceneReady = false;
  private firstFrameReadyAtMs: number | null = null;
  private gameReadyAtMs: number | null = null;

  public constructor(platform: GamePlatform, now: () => number = () => performance.now()) {
    this.platform = platform;
    this.now = now;
  }

  public getSnapshot(): ReadinessSnapshot {
    return Object.freeze({
      firstFrameReadyNotified: this.firstFrameReadyNotified,
      gameReadyNotified: this.gameReadyNotified,
      assetsLoaded: this.assetsLoaded,
      saveRestored: this.saveRestored,
      interactiveSceneReady: this.interactiveSceneReady,
      firstFrameReadyAtMs: this.firstFrameReadyAtMs,
      gameReadyAtMs: this.gameReadyAtMs,
    });
  }

  public markFirstFrameRendered(): boolean {
    if (this.firstFrameReadyNotified) {
      return false;
    }
    this.firstFrameReadyNotified = true;
    this.firstFrameReadyAtMs = Math.round(this.now());
    this.platform.notifyFirstFrameReady();
    return true;
  }

  public markAssetsLoaded(): void {
    this.assetsLoaded = true;
    this.tryNotifyGameReady();
  }

  public markSaveRestored(): void {
    this.saveRestored = true;
    this.tryNotifyGameReady();
  }

  public markInteractiveSceneReady(): boolean {
    this.interactiveSceneReady = true;
    return this.tryNotifyGameReady();
  }

  private tryNotifyGameReady(): boolean {
    if (
      this.gameReadyNotified ||
      !this.assetsLoaded ||
      !this.saveRestored ||
      !this.interactiveSceneReady
    ) {
      return false;
    }

    if (!this.firstFrameReadyNotified) {
      this.markFirstFrameRendered();
    }

    this.gameReadyNotified = true;
    this.gameReadyAtMs = Math.round(this.now());
    this.platform.notifyGameReady();
    return true;
  }
}
