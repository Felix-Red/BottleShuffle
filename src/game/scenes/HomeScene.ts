import Phaser from 'phaser';
import { APP_METADATA, computeViewportMetrics } from '../../config/appConfig';
import { Colors, createTextStyle, hexToNumber, lightenHex, Typography } from '../../design-system';
import type { GamePlatform } from '../../platform/contracts/GamePlatform';
import { SCENE_KEYS } from './sceneKeys';

interface BottleSpec {
  readonly offsetX: number;
  readonly offsetY: number;
  readonly angleDeg: number;
  readonly bodyColor: number;
  readonly labelColor: number;
}

const EMBLEM_BOTTLES: readonly BottleSpec[] = [
  {
    offsetX: -48,
    offsetY: 3,
    angleDeg: -11,
    bodyColor: hexToNumber(Colors.Bottle.Red),
    labelColor: hexToNumber(lightenHex(Colors.Bottle.Red, 0.2)),
  },
  {
    offsetX: 0,
    offsetY: 0,
    angleDeg: 0,
    bodyColor: hexToNumber(Colors.Brand.PrimaryLight),
    labelColor: hexToNumber(lightenHex(Colors.Brand.PrimaryLight, 0.2)),
  },
  {
    offsetX: 48,
    offsetY: 3,
    angleDeg: 11,
    bodyColor: hexToNumber(Colors.Bottle.Green),
    labelColor: hexToNumber(lightenHex(Colors.Bottle.Green, 0.2)),
  },
];

export class HomeScene extends Phaser.Scene {
  private readonly platform: GamePlatform;
  private heroContainer?: Phaser.GameObjects.Container;
  private footerText?: Phaser.GameObjects.Text;

  public constructor(platform: GamePlatform) {
    super({ key: SCENE_KEYS.HOME });
    this.platform = platform;
  }

  public create(): void {
    this.cameras.main.setBackgroundColor(hexToNumber(Colors.Surface.Background));

    this.heroContainer = this.buildHeroContent();
    this.footerText = this.add
      .text(
        0,
        0,
        APP_METADATA.studioLabel,
        createTextStyle(Typography.LabelSmall, {
          color: Colors.Text.Disabled,
          align: 'center',
        }),
      )
      .setOrigin(0.5, 1);

    this.layout(this.scale.width, this.scale.height);

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown);

    this.platform.notifyGameReady();
  }

  private buildHeroContent(): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);

    const emblem = this.buildEmblem();
    emblem.setPosition(0, -104);

    const titleText = this.add
      .text(
        0,
        22,
        APP_METADATA.title,
        createTextStyle(Typography.HeadlineLarge, {
          color: Colors.Text.Primary,
          align: 'center',
        }),
      )
      .setOrigin(0.5);

    const subtitleText = this.add
      .text(
        0,
        82,
        APP_METADATA.buildLabel,
        createTextStyle(Typography.BodyLarge, {
          color: Colors.Text.Secondary,
          align: 'center',
        }),
      )
      .setOrigin(0.5);

    const statusContainer = this.buildStatusBadge();
    statusContainer.setPosition(0, 146);

    container.add([emblem, titleText, subtitleText, statusContainer]);
    return container;
  }

  private buildEmblem(): Phaser.GameObjects.Container {
    const emblem = this.add.container(0, 0);

    const backdrop = this.add.graphics();
    backdrop.fillStyle(hexToNumber(Colors.Surface.Surface), 1);
    backdrop.fillCircle(0, 0, 86);
    emblem.add(backdrop);

    for (const spec of EMBLEM_BOTTLES) {
      const bottle = this.createBottleGraphic(spec);
      emblem.add(bottle);
    }

    return emblem;
  }

  private createBottleGraphic(spec: BottleSpec): Phaser.GameObjects.Graphics {
    const graphics = this.add.graphics({ x: spec.offsetX, y: spec.offsetY });
    graphics.setAngle(spec.angleDeg);

    // Bottle body
    graphics.fillStyle(spec.bodyColor, 1);
    graphics.fillRoundedRect(-20, -14, 40, 74, 10);

    // Bottle shoulder taper
    graphics.fillTriangle(-20, -10, 20, -10, 9, -30);
    graphics.fillTriangle(-20, -10, -9, -30, 9, -30);

    // Bottle neck
    graphics.fillRoundedRect(-8, -56, 16, 30, 4);

    // Bottle cap
    graphics.fillStyle(hexToNumber(Colors.Text.Primary), 1);
    graphics.fillRoundedRect(-9, -68, 18, 13, 3);

    // Subtle front label
    graphics.fillStyle(spec.labelColor, 0.9);
    graphics.fillRoundedRect(-12, 6, 24, 30, 4);

    return graphics;
  }

  private buildStatusBadge(): Phaser.GameObjects.Container {
    const badge = this.add.container(0, 0);

    const statusText = this.add
      .text(
        0,
        0,
        APP_METADATA.statusLabel,
        createTextStyle(Typography.BodyMedium, {
          color: Colors.Semantic.Success,
        }),
      )
      .setOrigin(0, 0.5);

    const dotRadius = 6;
    const gap = 12;
    const totalWidth = dotRadius * 2 + gap + statusText.width;
    const startX = -totalWidth / 2;

    const dot = this.add.graphics();
    dot.fillStyle(hexToNumber(Colors.Semantic.Success), 1);
    dot.fillCircle(startX + dotRadius, 0, dotRadius);

    statusText.setPosition(startX + dotRadius * 2 + gap, 0);

    badge.add([dot, statusText]);
    return badge;
  }

  private readonly handleResize = (gameSize: Phaser.Structs.Size): void => {
    this.layout(gameSize.width, gameSize.height);
  };

  private layout(width: number, height: number): void {
    const metrics = computeViewportMetrics(width, height);
    const centerX = metrics.width / 2;
    const centerY = metrics.height / 2;

    if (this.heroContainer !== undefined) {
      const verticalOffset =
        metrics.orientation === 'portrait' ? -24 * metrics.scale : -10 * metrics.scale;
      this.heroContainer.setPosition(centerX, centerY + verticalOffset);
      this.heroContainer.setScale(metrics.scale);
    }

    if (this.footerText !== undefined) {
      const bottomPadding = Math.max(20, 28 * metrics.scale);
      this.footerText.setPosition(centerX, metrics.height - bottomPadding);
      this.footerText.setScale(metrics.scale);
    }
  }

  private readonly handleShutdown = (): void => {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize);
  };
}
