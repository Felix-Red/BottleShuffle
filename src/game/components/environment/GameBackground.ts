import Phaser from 'phaser';
import { Colors, hexToNumber } from '../../../design-system/tokens/Colors';
import { ENVIRONMENT_TEXTURE_KEYS } from '../../assets/AssetKeys';

export interface GameBackgroundConfig {
  readonly width?: number;
  readonly height?: number;
  readonly depth?: number;
}

export class GameBackground extends Phaser.GameObjects.Container {
  private readonly fallbackGraphics: Phaser.GameObjects.Graphics;
  private readonly backdropImage: Phaser.GameObjects.Image;

  public constructor(scene: Phaser.Scene, config: GameBackgroundConfig = {}) {
    super(scene, 0, 0);

    this.fallbackGraphics = scene.add.graphics();
    this.backdropImage = scene.add
      .image(0, 0, ENVIRONMENT_TEXTURE_KEYS.BACKGROUND)
      .setOrigin(0.5, 0.5);

    this.add([this.fallbackGraphics, this.backdropImage]);

    if (config.depth !== undefined) {
      this.setDepth(config.depth);
    }

    this.resize(config.width ?? scene.scale.width, config.height ?? scene.scale.height);
    scene.add.existing(this);
  }

  public resize(viewportWidth: number, viewportHeight: number): this {
    const safeW = Math.max(1, viewportWidth);
    const safeH = Math.max(1, viewportHeight);

    this.fallbackGraphics.clear();
    this.fallbackGraphics.fillStyle(hexToNumber(Colors.Surface.Background), 1);
    this.fallbackGraphics.fillRect(0, 0, safeW, safeH);

    // Cover-scale without stretching or distorting aspect ratio
    const textureW = Math.max(1, this.backdropImage.width);
    const textureH = Math.max(1, this.backdropImage.height);
    const coverScale = Math.max(safeW / textureW, safeH / textureH);

    this.backdropImage.setPosition(safeW / 2, safeH / 2);
    this.backdropImage.setScale(coverScale);
    this.setSize(safeW, safeH);
    return this;
  }
}
