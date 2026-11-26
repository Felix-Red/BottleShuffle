import Phaser from 'phaser';
import { DefaultGameTheme, type GameTheme } from '../../../design-system/theme/GameTheme';
import {
  MotionDurations,
  MotionEasings,
  resolveMotionDuration,
} from '../../../design-system/tokens/Motion';
import { EFFECT_TEXTURE_KEYS } from '../../assets/AssetKeys';

export interface BottleShadowConfig {
  readonly x?: number;
  readonly y?: number;
  readonly bottleWidth?: number;
  readonly baseAlpha?: number;
  readonly theme?: GameTheme;
}

const DEFAULT_BASE_ALPHA = 0.65;
const SHADOW_WIDTH_MULTIPLIER = 1.06;
const SHADOW_ASPECT_RATIO = 64 / 256;

export class BottleShadow extends Phaser.GameObjects.Container {
  private theme: GameTheme;
  private baseWidth: number;
  private baseHeight: number;
  private readonly baseAlpha: number;
  private readonly shadowImage: Phaser.GameObjects.Image;
  private activeTween?: Phaser.Tweens.Tween;

  public constructor(scene: Phaser.Scene, config: BottleShadowConfig = {}) {
    super(scene, config.x ?? 0, config.y ?? 0);

    this.theme = config.theme ?? DefaultGameTheme;
    this.baseAlpha = config.baseAlpha ?? DEFAULT_BASE_ALPHA;
    const bottleWidth = Math.max(32, config.bottleWidth ?? 88);
    this.baseWidth = bottleWidth * SHADOW_WIDTH_MULTIPLIER;
    this.baseHeight = Math.max(12, Math.round(this.baseWidth * SHADOW_ASPECT_RATIO));

    this.shadowImage = scene.add
      .image(0, 0, EFFECT_TEXTURE_KEYS.BOTTLE_SHADOW)
      .setOrigin(0.5, 0.5)
      .setDisplaySize(this.baseWidth, this.baseHeight)
      .setAlpha(this.baseAlpha);

    this.add(this.shadowImage);
    this.setSize(this.baseWidth, this.baseHeight);

    scene.add.existing(this);
  }

  public setBottleWidth(bottleWidth: number): this {
    const safeWidth = Math.max(32, bottleWidth);
    this.baseWidth = safeWidth * SHADOW_WIDTH_MULTIPLIER;
    this.baseHeight = Math.max(12, Math.round(this.baseWidth * SHADOW_ASPECT_RATIO));
    this.shadowImage.setDisplaySize(this.baseWidth, this.baseHeight);
    this.setSize(this.baseWidth, this.baseHeight);
    return this;
  }

  /**
   * Adjusts contact shadow prominence as the bottle lifts above the shelf.
   * Higher lift produces a slightly smaller, softer shadow anchored on the shelf.
   */
  public setElevation(liftPx: number, animate = true): this {
    const normalizedLift = Math.min(1, Math.max(0, liftPx / 24));
    const targetScaleX = 1 - normalizedLift * 0.24;
    const targetScaleY = 1 - normalizedLift * 0.18;
    const targetAlpha = this.baseAlpha * (1 - normalizedLift * 0.52);

    this.stopTween();

    const duration = animate
      ? resolveMotionDuration(MotionDurations.Short, this.theme.reducedMotion)
      : 0;

    if (duration === 0) {
      this.shadowImage.setScale(
        (this.baseWidth / this.shadowImage.width) * targetScaleX,
        (this.baseHeight / this.shadowImage.height) * targetScaleY,
      );
      this.shadowImage.setAlpha(targetAlpha);
      return this;
    }

    const baseScaleX = this.baseWidth / this.shadowImage.width;
    const baseScaleY = this.baseHeight / this.shadowImage.height;

    this.activeTween = this.scene.tweens.add({
      targets: this.shadowImage,
      scaleX: baseScaleX * targetScaleX,
      scaleY: baseScaleY * targetScaleY,
      alpha: targetAlpha,
      duration,
      ease: MotionEasings.EaseOutCubic,
      onComplete: () => {
        this.activeTween = undefined;
      },
    });

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
