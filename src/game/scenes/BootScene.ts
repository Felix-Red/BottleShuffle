import Phaser from 'phaser';
import { Colors, createTextStyle, hexToNumber, Typography } from '../../design-system';
import type { GamePlatform } from '../../platform/contracts/GamePlatform';
import type { GameReadinessService } from '../../services/platform/GameReadinessService';
import { queueAssetManifest, queueEssentialAudioAssets } from '../assets/AssetManifest';
import { SCENE_KEYS, type SceneKey } from './sceneKeys';

export interface BootSceneOptions {
  readonly readinessService?: GameReadinessService;
  /** Optional async startup barrier (e.g. cloud save load + fonts) awaited before launching the interactive scene. */
  readonly waitForStartupReady?: () => Promise<void>;
}

/**
 * Lightweight branded loading scene.
 * Renders a meaningful loading frame immediately, reports `firstFrameReady` on Phaser's
 * first POST_RENDER milestone, preloads essential assets concurrently with cloud save
 * restoration, and transitions straight to the initial interactive scene with zero delay.
 */
export class BootScene extends Phaser.Scene {
  private readonly platform: GamePlatform;
  private readonly initialSceneKey: SceneKey;
  private readonly readinessService?: GameReadinessService;
  private readonly waitForStartupReady?: () => Promise<void>;

  private titleText?: Phaser.GameObjects.Text;
  private statusText?: Phaser.GameObjects.Text;
  private trackGraphics?: Phaser.GameObjects.Graphics;
  private fillGraphics?: Phaser.GameObjects.Graphics;
  private currentProgress = 0;
  private transitionStarted = false;

  public constructor(
    platform: GamePlatform,
    initialSceneKey: SceneKey = SCENE_KEYS.HOME,
    options: BootSceneOptions = {},
  ) {
    super({ key: SCENE_KEYS.BOOT });
    this.platform = platform;
    this.initialSceneKey = initialSceneKey;
    this.readinessService = options.readinessService;
    this.waitForStartupReady = options.waitForStartupReady;
  }

  public preload(): void {
    this.transitionStarted = false;
    this.currentProgress = 0;
    this.cameras.main.setBackgroundColor(hexToNumber(Colors.Surface.Background));
    this.buildLoadingVisuals();
    this.layoutLoadingVisuals(this.scale.width, this.scale.height);

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown);

    // Report firstFrameReady once Phaser has actually painted the first meaningful frame.
    this.game.events.once(Phaser.Core.Events.POST_RENDER, this.handleFirstRenderedFrame);

    this.load.on(Phaser.Loader.Events.PROGRESS, this.handleLoadProgress);
    queueAssetManifest(this);
    queueEssentialAudioAssets(this);
  }

  public create(): void {
    this.currentProgress = 1;
    this.drawProgressFill();
    this.readinessService?.markAssetsLoaded();

    // Ensure firstFrameReady fires even in headless/test environments without POST_RENDER.
    this.handleFirstRenderedFrame();

    const finishBoot = async (): Promise<void> => {
      if (this.waitForStartupReady !== undefined) {
        try {
          await this.waitForStartupReady();
        } catch {
          // Startup error recovery is owned by SaveService / GameScene error modals.
        }
      }
      if (!this.transitionStarted && this.sys.isActive()) {
        this.transitionStarted = true;
        this.scene.start(this.initialSceneKey);
      }
    };

    void finishBoot();
  }

  private readonly handleFirstRenderedFrame = (): void => {
    if (this.readinessService !== undefined) {
      this.readinessService.markFirstFrameRendered();
    } else {
      this.platform.notifyFirstFrameReady();
    }
  };

  private readonly handleLoadProgress = (value: number): void => {
    this.currentProgress = Math.max(0, Math.min(1, value));
    this.drawProgressFill();
  };

  private readonly handleResize = (size: Phaser.Structs.Size): void => {
    this.layoutLoadingVisuals(size.width, size.height);
  };

  private buildLoadingVisuals(): void {
    this.titleText = this.add
      .text(
        0,
        0,
        'BOTTLE SHUFFLE',
        createTextStyle(Typography.HeadlineMedium, {
          color: Colors.Brand.Secondary,
          align: 'center',
        }),
      )
      .setOrigin(0.5);

    this.statusText = this.add
      .text(
        0,
        0,
        'Loading...',
        createTextStyle(Typography.LabelMedium, {
          color: Colors.Text.Secondary,
          align: 'center',
        }),
      )
      .setOrigin(0.5);

    this.trackGraphics = this.add.graphics();
    this.fillGraphics = this.add.graphics();
  }

  private layoutLoadingVisuals(width: number, height: number): void {
    const safeW = Math.max(240, width);
    const safeH = Math.max(240, height);
    const cx = Math.round(safeW / 2);
    const cy = Math.round(safeH / 2);

    this.titleText?.setPosition(cx, cy - 28);
    this.statusText?.setPosition(cx, cy + 34);
    this.drawProgressTrack(cx, cy + 6, Math.min(260, safeW - 64));
    this.drawProgressFill();
  }

  private drawProgressTrack(cx: number, cy: number, barW: number): void {
    if (this.trackGraphics === undefined) {
      return;
    }
    const barH = 10;
    this.trackGraphics.clear();
    this.trackGraphics.fillStyle(hexToNumber(Colors.Surface.ElevatedSurface), 1);
    this.trackGraphics.fillRoundedRect(cx - barW / 2, cy - barH / 2, barW, barH, 5);
    this.trackGraphics.lineStyle(1, hexToNumber(Colors.Surface.Border), 0.7);
    this.trackGraphics.strokeRoundedRect(cx - barW / 2, cy - barH / 2, barW, barH, 5);
  }

  private drawProgressFill(): void {
    if (this.fillGraphics === undefined) {
      return;
    }
    const safeW = Math.max(240, this.scale.width);
    const safeH = Math.max(240, this.scale.height);
    const cx = Math.round(safeW / 2);
    const cy = Math.round(safeH / 2) + 6;
    const barW = Math.min(260, safeW - 64);
    const barH = 10;
    const fillW = Math.max(10, Math.round(barW * Math.max(0.08, this.currentProgress)));

    this.fillGraphics.clear();
    this.fillGraphics.fillStyle(hexToNumber(Colors.Brand.Primary), 1);
    this.fillGraphics.fillRoundedRect(cx - barW / 2, cy - barH / 2, fillW, barH, 5);
  }

  private readonly handleShutdown = (): void => {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize);
    this.load.off(Phaser.Loader.Events.PROGRESS, this.handleLoadProgress);
    this.game.events.off(Phaser.Core.Events.POST_RENDER, this.handleFirstRenderedFrame);
    this.titleText = undefined;
    this.statusText = undefined;
    this.trackGraphics = undefined;
    this.fillGraphics = undefined;
  };
}
