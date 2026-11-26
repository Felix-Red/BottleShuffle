import Phaser from 'phaser';
import { DefaultGameTheme, type GameTheme } from '../../../design-system/theme/GameTheme';
import { Colors, hexToNumber } from '../../../design-system/tokens/Colors';
import {
  MotionDurations,
  MotionEasings,
  resolveMotionDuration,
} from '../../../design-system/tokens/Motion';
import { EFFECT_TEXTURE_KEYS } from '../../assets/AssetKeys';

export interface BottleSelectionIndicatorConfig {
  readonly x?: number;
  readonly y?: number;
  readonly bottleWidth?: number;
  readonly bottleHeight?: number;
  /** Neutral highlight colour (gold or purple). Never use green, which could imply a match. */
  readonly color?: string;
  readonly visible?: boolean;
  readonly theme?: GameTheme;
}

const FRAME_PADDING_X_RATIO = 1.24;
const FRAME_PADDING_Y_RATIO = 1.12;

export class BottleSelectionIndicator extends Phaser.GameObjects.Container {
  private theme: GameTheme;
  private indicatorColor: string;
  private frameWidth: number;
  private frameHeight: number;
  private shown = false;

  private readonly glowImage: Phaser.GameObjects.Image;
  private readonly outlineGraphics: Phaser.GameObjects.Graphics;
  private transitionTween?: Phaser.Tweens.Tween;
  private pulseTween?: Phaser.Tweens.Tween;

  public constructor(scene: Phaser.Scene, config: BottleSelectionIndicatorConfig = {}) {
    super(scene, config.x ?? 0, config.y ?? 0);

    this.theme = config.theme ?? DefaultGameTheme;
    this.indicatorColor = config.color ?? Colors.Brand.Secondary;

    const bottleW = Math.max(36, config.bottleWidth ?? 88);
    const bottleH = Math.max(72, config.bottleHeight ?? 176);
    this.frameWidth = Math.round(bottleW * FRAME_PADDING_X_RATIO);
    this.frameHeight = Math.round(bottleH * FRAME_PADDING_Y_RATIO);

    this.glowImage = scene.add
      .image(0, 0, EFFECT_TEXTURE_KEYS.SELECTION_GLOW)
      .setOrigin(0.5, 0.5)
      .setDisplaySize(this.frameWidth, this.frameHeight)
      .setAlpha(0.55)
      .setTint(hexToNumber(this.indicatorColor));

    this.outlineGraphics = scene.add.graphics();
    this.redrawOutline();

    this.add([this.glowImage, this.outlineGraphics]);
    this.setSize(this.frameWidth, this.frameHeight);

    const initialVisible = config.visible ?? false;
    this.shown = initialVisible;
    this.setVisible(initialVisible);
    this.setAlpha(initialVisible ? 1 : 0);

    if (initialVisible) {
      this.startSubtlePulse();
    }

    scene.add.existing(this);
  }

  public isShown(): boolean {
    return this.shown;
  }

  public setSelectedVisible(visible: boolean, animate = true): this {
    if (this.shown === visible) {
      return this;
    }

    this.shown = visible;
    this.stopAllTweens();

    const duration = animate
      ? resolveMotionDuration(MotionDurations.Short, this.theme.reducedMotion)
      : 0;

    if (visible) {
      this.setVisible(true);
      if (duration === 0) {
        this.setAlpha(1);
        this.setScale(1);
        return this;
      }

      this.setAlpha(0);
      this.setScale(0.92);
      this.transitionTween = this.scene.tweens.add({
        targets: this,
        alpha: 1,
        scaleX: 1,
        scaleY: 1,
        duration,
        ease: MotionEasings.EaseOutBack,
        onComplete: () => {
          this.transitionTween = undefined;
          this.startSubtlePulse();
        },
      });
      return this;
    }

    if (duration === 0) {
      this.setAlpha(0);
      this.setVisible(false);
      return this;
    }

    this.transitionTween = this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scaleX: 0.94,
      scaleY: 0.94,
      duration: Math.round(duration * 0.8),
      ease: MotionEasings.EaseInCubic,
      onComplete: () => {
        this.transitionTween = undefined;
        this.setVisible(false);
      },
    });

    return this;
  }

  public setIndicatorColor(colorHex: string): this {
    this.indicatorColor = colorHex;
    this.glowImage.setTint(hexToNumber(colorHex));
    this.redrawOutline();
    return this;
  }

  public setBottleDimensions(bottleWidth: number, bottleHeight: number): this {
    this.frameWidth = Math.round(Math.max(36, bottleWidth) * FRAME_PADDING_X_RATIO);
    this.frameHeight = Math.round(Math.max(72, bottleHeight) * FRAME_PADDING_Y_RATIO);
    this.glowImage.setDisplaySize(this.frameWidth, this.frameHeight);
    this.redrawOutline();
    this.setSize(this.frameWidth, this.frameHeight);
    return this;
  }

  private redrawOutline(): void {
    const color = hexToNumber(this.indicatorColor);
    const w = this.frameWidth - 8;
    const h = this.frameHeight - 8;
    const r = Math.min(24, Math.round(w * 0.22));

    this.outlineGraphics.clear();
    // Soft translucent halo tint (works identically in Canvas 2D and WebGL)
    this.outlineGraphics.fillStyle(color, 0.12);
    this.outlineGraphics.fillRoundedRect(-w / 2, -h / 2, w, h, r);
    this.outlineGraphics.lineStyle(6, color, 0.26);
    this.outlineGraphics.strokeRoundedRect(-w / 2, -h / 2, w, h, r);
    this.outlineGraphics.lineStyle(2.5, color, 0.96);
    this.outlineGraphics.strokeRoundedRect(-w / 2, -h / 2, w, h, r);
  }

  public setTheme(theme: GameTheme): this {
    this.theme = theme;
    if (this.shown) {
      this.stopPulseTween();
      this.startSubtlePulse();
    }
    return this;
  }

  private startSubtlePulse(): void {
    this.stopPulseTween();
    if (!this.shown || this.theme.reducedMotion) {
      this.glowImage.setAlpha(1);
      return;
    }

    this.pulseTween = this.scene.tweens.add({
      targets: this.glowImage,
      alpha: { from: 1, to: 0.78 },
      duration: MotionDurations.Celebration,
      ease: MotionEasings.EaseInOutCubic,
      yoyo: true,
      repeat: -1,
    });
  }

  private stopPulseTween(): void {
    if (this.pulseTween !== undefined) {
      this.pulseTween.stop();
      this.pulseTween = undefined;
    }
    this.glowImage.setAlpha(1);
  }

  private stopAllTweens(): void {
    if (this.transitionTween !== undefined) {
      this.transitionTween.stop();
      this.transitionTween = undefined;
    }
    this.stopPulseTween();
  }

  public override destroy(fromScene?: boolean): void {
    this.stopAllTweens();
    super.destroy(fromScene);
  }
}
