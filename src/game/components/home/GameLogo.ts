import Phaser from 'phaser';
import { HOME_CONFIG } from '../../../config/HomeConfig';
import {
  Colors,
  createTextStyle,
  DefaultGameTheme,
  darkenHex,
  MotionEasings,
  resolveMotionDuration,
  Typography,
  type GameTheme,
} from '../../../design-system';

export interface GameLogoConfig {
  readonly x?: number;
  readonly y?: number;
  readonly scale?: number;
  readonly theme?: GameTheme;
}

/**
 * Playful dimensional Bottle Shuffle wordmark rendered using locally bundled Fredoka typography.
 * Line 1 ("BOTTLE") uses warm gold with deep dimensional stroke; Line 2 ("SHUFFLE") uses crisp
 * white with soft violet-indigo outline and drop shadow. Scales cleanly without runtime textures.
 */
export class GameLogo extends Phaser.GameObjects.Container {
  private theme: GameTheme;
  private targetScale: number;

  private readonly lineOneShadow: Phaser.GameObjects.Text;
  private readonly lineOneText: Phaser.GameObjects.Text;
  private readonly lineTwoShadow: Phaser.GameObjects.Text;
  private readonly lineTwoText: Phaser.GameObjects.Text;
  private entranceTween?: Phaser.Tweens.Tween;

  public constructor(scene: Phaser.Scene, config: GameLogoConfig = {}) {
    super(scene, config.x ?? 0, config.y ?? 0);

    this.theme = config.theme ?? DefaultGameTheme;
    this.targetScale = config.scale ?? 1;

    const lineOneBase = createTextStyle(Typography.Display, {
      color: Colors.Brand.Secondary,
      align: 'center',
      scale: 0.96,
    });
    const lineTwoBase = createTextStyle(Typography.Display, {
      color: Colors.Text.Primary,
      align: 'center',
      scale: 0.86,
    });
    const strokePadding = { left: 10, right: 10, top: 10, bottom: 10 };

    this.lineOneShadow = scene.add
      .text(0, -25, HOME_CONFIG.logoLineOne, {
        ...lineOneBase,
        padding: strokePadding,
        color: darkenHex(Colors.Brand.SecondaryDark, 0.52),
        stroke: darkenHex(Colors.Brand.SecondaryDark, 0.65),
        strokeThickness: 10,
      })
      .setOrigin(0.5);

    this.lineOneText = scene.add
      .text(0, -30, HOME_CONFIG.logoLineOne, {
        ...lineOneBase,
        padding: strokePadding,
        color: Colors.Brand.Secondary,
        stroke: darkenHex(Colors.Brand.SecondaryDark, 0.38),
        strokeThickness: 7,
      })
      .setOrigin(0.5);

    this.lineTwoShadow = scene.add
      .text(0, 32, HOME_CONFIG.logoLineTwo, {
        ...lineTwoBase,
        padding: strokePadding,
        color: darkenHex(Colors.Brand.PrimaryDark, 0.55),
        stroke: darkenHex(Colors.Brand.PrimaryDark, 0.7),
        strokeThickness: 10,
      })
      .setOrigin(0.5);

    this.lineTwoText = scene.add
      .text(0, 27, HOME_CONFIG.logoLineTwo, {
        ...lineTwoBase,
        padding: strokePadding,
        color: Colors.Text.Primary,
        stroke: Colors.Brand.PrimaryDark,
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    this.add([this.lineOneShadow, this.lineOneText, this.lineTwoShadow, this.lineTwoText]);
    this.setSize(380, 108);
    this.setScale(this.targetScale);

    scene.add.existing(this);
  }

  public setTargetScale(scale: number): this {
    this.targetScale = scale;
    if (this.entranceTween === undefined) {
      this.setScale(scale);
    }
    return this;
  }

  public setTheme(theme: GameTheme): this {
    this.theme = theme;
    return this;
  }

  /**
   * Restrained one-shot entrance reveal (~360ms overshoot settle; instant in reduced motion).
   * Never loops continuously so the wordmark stays crisp and readable.
   */
  public playEntrance(): this {
    this.stopEntrance();
    const duration = resolveMotionDuration(
      HOME_CONFIG.motion.logoEntranceDurationMs,
      this.theme.reducedMotion,
    );

    if (duration === 0) {
      this.setAlpha(1);
      this.setScale(this.targetScale);
      return this;
    }

    this.setAlpha(0);
    this.setScale(this.targetScale * 0.9);
    this.entranceTween = this.scene.tweens.add({
      targets: this,
      alpha: 1,
      scaleX: this.targetScale,
      scaleY: this.targetScale,
      duration,
      ease: MotionEasings.SoftOvershoot,
      onComplete: () => {
        this.entranceTween = undefined;
        this.setScale(this.targetScale);
      },
    });
    return this;
  }

  private stopEntrance(): void {
    if (this.entranceTween !== undefined) {
      this.entranceTween.stop();
      this.entranceTween = undefined;
    }
  }

  public override destroy(fromScene?: boolean): void {
    this.stopEntrance();
    super.destroy(fromScene);
  }
}
