import Phaser from 'phaser';
import { DefaultGameTheme, type GameTheme } from '../../../design-system/theme/GameTheme';
import {
  MotionDurations,
  MotionEasings,
  resolveMotionDuration,
} from '../../../design-system/tokens/Motion';
import { ENVIRONMENT_TEXTURE_KEYS, ICON_TEXTURE_KEYS } from '../../assets/AssetKeys';

export interface HiddenSequenceSlotConfig {
  readonly slotIndex: number;
  readonly x?: number;
  readonly y?: number;
  readonly width: number;
  readonly height: number;
  readonly theme?: GameTheme;
}

/**
 * Concealed visual marker representing one hidden target slot.
 * Never holds or evaluates puzzle state; all concealed slots remain visually identical.
 */
export class HiddenSequenceSlot extends Phaser.GameObjects.Container {
  public readonly slotIndex: number;
  private theme: GameTheme;
  private slotWidth: number;
  private slotHeight: number;
  private revealed = false;

  private readonly slotBackground: Phaser.GameObjects.Image;
  private readonly lockIcon: Phaser.GameObjects.Image;
  private revealSprite?: Phaser.GameObjects.Image;
  private activeTween?: Phaser.Tweens.Tween;

  public constructor(scene: Phaser.Scene, config: HiddenSequenceSlotConfig) {
    super(scene, config.x ?? 0, config.y ?? 0);

    this.slotIndex = config.slotIndex;
    this.theme = config.theme ?? DefaultGameTheme;
    this.slotWidth = Math.max(36, config.width);
    this.slotHeight = Math.max(36, config.height);

    this.slotBackground = scene.add
      .image(0, 0, ENVIRONMENT_TEXTURE_KEYS.HIDDEN_SLOT)
      .setOrigin(0.5)
      .setDisplaySize(this.slotWidth, this.slotHeight);

    const iconSize = Math.round(Math.min(this.slotWidth, this.slotHeight) * 0.44);
    this.lockIcon = scene.add
      .image(0, 0, ICON_TEXTURE_KEYS.LOCK)
      .setOrigin(0.5)
      .setDisplaySize(iconSize, iconSize)
      .setAlpha(0.85);

    this.add([this.slotBackground, this.lockIcon]);
    this.setSize(this.slotWidth, this.slotHeight);

    scene.add.existing(this);
  }

  public isRevealed(): boolean {
    return this.revealed;
  }

  /**
   * Future win-screen reveal hook.
   * Accepts an externally supplied texture key without storing puzzle answers internally.
   */
  public reveal(textureKey: string, animate = true): this {
    this.stopTween();
    this.revealed = true;
    this.lockIcon.setVisible(false);

    if (this.revealSprite !== undefined) {
      this.revealSprite.destroy();
    }

    const bottleH = Math.round(this.slotHeight * 0.78);
    const bottleW = Math.round(bottleH * 0.5);
    this.revealSprite = this.scene.add
      .image(0, 0, textureKey)
      .setOrigin(0.5)
      .setDisplaySize(bottleW, bottleH);
    this.add(this.revealSprite);

    const duration = animate
      ? resolveMotionDuration(MotionDurations.Normal, this.theme.reducedMotion)
      : 0;

    if (duration > 0) {
      this.revealSprite.setAlpha(0).setScale(0.7);
      this.activeTween = this.scene.tweens.add({
        targets: this.revealSprite,
        alpha: 1,
        scaleX: bottleW / this.revealSprite.width,
        scaleY: bottleH / this.revealSprite.height,
        duration,
        ease: MotionEasings.EaseOutBack,
        onComplete: () => {
          this.activeTween = undefined;
        },
      });
    }

    return this;
  }

  public conceal(): this {
    this.stopTween();
    this.revealed = false;
    if (this.revealSprite !== undefined) {
      this.revealSprite.destroy();
      this.revealSprite = undefined;
    }
    this.lockIcon.setVisible(true);
    return this;
  }

  public setSlotSize(width: number, height: number): this {
    this.slotWidth = Math.max(36, width);
    this.slotHeight = Math.max(36, height);
    this.slotBackground.setDisplaySize(this.slotWidth, this.slotHeight);

    const iconSize = Math.round(Math.min(this.slotWidth, this.slotHeight) * 0.44);
    this.lockIcon.setDisplaySize(iconSize, iconSize);
    this.setSize(this.slotWidth, this.slotHeight);
    return this;
  }

  public setTheme(theme: GameTheme): this {
    this.theme = theme;
    return this;
  }

  private stopTween(): void {
    if (this.activeTween !== undefined) {
      this.activeTween.stop();
      this.activeTween = undefined;
    }
  }

  public override destroy(fromScene?: boolean): void {
    this.stopTween();
    super.destroy(fromScene);
  }
}
