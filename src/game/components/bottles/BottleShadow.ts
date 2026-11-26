import Phaser from 'phaser';
import { DefaultGameTheme, type GameTheme } from '../../../design-system/theme/GameTheme';
import {
  MotionDurations,
  MotionEasings,
  resolveMotionDuration,
} from '../../../design-system/tokens/Motion';
import { calculateShadowForElevation } from '../../animations/utils/AnimationMath';
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
const DEFAULT_MAX_LIFT_PX = 36;

export class BottleShadow extends Phaser.GameObjects.Container {
  private theme: GameTheme;
  private baseWidth: number;
  private baseHeight: number;
  private readonly baseAlpha: number;
  private readonly restX: number;
  private readonly restY: number;
  private readonly shadowImage: Phaser.GameObjects.Image;
  private activeTween?: Phaser.Tweens.Tween;

  public constructor(scene: Phaser.Scene, config: BottleShadowConfig = {}) {
    super(scene, config.x ?? 0, config.y ?? 0);

    this.theme = config.theme ?? DefaultGameTheme;
    this.restX = config.x ?? 0;
    this.restY = config.y ?? 0;
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
  public setElevation(liftPx: number, animate = true, maxLiftPx = DEFAULT_MAX_LIFT_PX): this {
    const state = calculateShadowForElevation(liftPx, maxLiftPx, this.baseAlpha);
    this.stopTween();

    const duration = animate
      ? resolveMotionDuration(MotionDurations.BottleSelection, this.theme.reducedMotion)
      : 0;

    const baseScaleX = this.baseWidth / Math.max(1, this.shadowImage.width);
    const baseScaleY = this.baseHeight / Math.max(1, this.shadowImage.height);

    if (duration === 0) {
      this.shadowImage.setScale(baseScaleX * state.scaleX, baseScaleY * state.scaleY);
      this.shadowImage.setAlpha(state.alpha);
      return this;
    }

    this.activeTween = this.scene.tweens.add({
      targets: this.shadowImage,
      scaleX: baseScaleX * state.scaleX,
      scaleY: baseScaleY * state.scaleY,
      alpha: state.alpha,
      duration,
      ease: MotionEasings.EaseOut,
      onComplete: () => {
        this.activeTween = undefined;
      },
    });

    return this;
  }

  /**
   * Per-frame shadow update used during curved swaps without spawning tweens.
   */
  public setElevationImmediate(liftPx: number, maxLiftPx = DEFAULT_MAX_LIFT_PX): this {
    this.stopTween();
    const state = calculateShadowForElevation(liftPx, maxLiftPx, this.baseAlpha);
    const baseScaleX = this.baseWidth / Math.max(1, this.shadowImage.width);
    const baseScaleY = this.baseHeight / Math.max(1, this.shadowImage.height);
    this.shadowImage.setScale(baseScaleX * state.scaleX, baseScaleY * state.scaleY);
    this.shadowImage.setAlpha(state.alpha);
    return this;
  }

  /**
   * Offsets the shadow relative to the bottle container so the shadow remains
   * grounded along the shelf chord while the bottle arcs vertically.
   */
  public setGroundOffset(offsetX: number, offsetY: number): this {
    this.setPosition(this.restX + offsetX, this.restY + offsetY);
    return this;
  }

  /**
   * Brief grounded compression when a bottle lands on the shelf.
   */
  public playLandingCompression(durationMs: number): this {
    this.stopTween();
    this.setPosition(this.restX, this.restY);

    const baseScaleX = this.baseWidth / Math.max(1, this.shadowImage.width);
    const baseScaleY = this.baseHeight / Math.max(1, this.shadowImage.height);

    const effectiveDuration = resolveMotionDuration(durationMs, this.theme.reducedMotion);
    if (effectiveDuration === 0) {
      this.shadowImage.setScale(baseScaleX, baseScaleY);
      this.shadowImage.setAlpha(this.baseAlpha);
      return this;
    }

    this.shadowImage.setScale(baseScaleX * 1.07, baseScaleY * 1.04);
    this.shadowImage.setAlpha(Math.min(0.82, this.baseAlpha * 1.12));

    this.activeTween = this.scene.tweens.add({
      targets: this.shadowImage,
      scaleX: baseScaleX,
      scaleY: baseScaleY,
      alpha: this.baseAlpha,
      duration: effectiveDuration,
      ease: MotionEasings.GentleSettle,
      onComplete: () => {
        this.activeTween = undefined;
      },
    });

    return this;
  }

  public resetShadow(): this {
    this.stopTween();
    this.setPosition(this.restX, this.restY);
    this.shadowImage.setDisplaySize(this.baseWidth, this.baseHeight);
    this.shadowImage.setAlpha(this.baseAlpha);
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
