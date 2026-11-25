import Phaser from 'phaser';
import { DefaultGameTheme, type GameTheme } from '../../theme/GameTheme';
import { Colors, hexToNumber } from '../../tokens/Colors';
import { Dimens } from '../../tokens/Dimens';
import { MotionPresets, resolveMotionDuration } from '../../tokens/Motion';
import { drawIcon } from '../common/IconGraphic';
import { normalizeStarCount } from './indicatorMath';

export interface StarRatingConfig {
  readonly x?: number;
  readonly y?: number;
  readonly rating?: number;
  readonly maxStars?: number;
  readonly starSize?: number;
  readonly spacing?: number;
  readonly filledColor?: string;
  readonly emptyColor?: string;
  readonly theme?: GameTheme;
}

export class StarRating extends Phaser.GameObjects.Container {
  private theme: GameTheme;
  private readonly maxStars: number;
  private readonly starSize: number;
  private readonly spacing: number;
  private readonly filledColor: string;
  private readonly emptyColor: string;
  private rating: number;
  private readonly starNodes: Phaser.GameObjects.Graphics[] = [];
  private activeTweens: Phaser.Tweens.Tween[] = [];

  public constructor(scene: Phaser.Scene, config: StarRatingConfig = {}) {
    super(scene, config.x ?? 0, config.y ?? 0);

    this.theme = config.theme ?? DefaultGameTheme;
    this.maxStars = Math.max(1, Math.floor(config.maxStars ?? 3));
    this.starSize = Math.max(12, config.starSize ?? Dimens.IconMedium);
    this.spacing = config.spacing ?? Dimens.Space6;
    this.filledColor = config.filledColor ?? Colors.Brand.Secondary;
    this.emptyColor = config.emptyColor ?? Colors.Surface.Border;
    this.rating = normalizeStarCount(config.rating ?? 0, this.maxStars);

    const totalWidth = this.maxStars * this.starSize + (this.maxStars - 1) * this.spacing;
    const startX = -totalWidth / 2 + this.starSize / 2;

    for (let i = 0; i < this.maxStars; i += 1) {
      const node = scene.add.graphics({ x: startX + i * (this.starSize + this.spacing), y: 0 });
      this.starNodes.push(node);
      this.add(node);
    }

    this.setSize(totalWidth, this.starSize);
    this.renderStars();

    scene.add.existing(this);
  }

  public getRating(): number {
    return this.rating;
  }

  public setRating(rating: number, animate = true): this {
    const nextRating = normalizeStarCount(rating, this.maxStars);
    const previous = this.rating;
    this.rating = nextRating;
    this.renderStars();

    if (animate && nextRating > previous) {
      this.animateNewlyFilledStars(previous, nextRating);
    }

    return this;
  }

  public setTheme(theme: GameTheme): this {
    this.theme = theme;
    return this;
  }

  private renderStars(): void {
    for (let i = 0; i < this.starNodes.length; i += 1) {
      const node = this.starNodes[i];
      if (node === undefined) {
        continue;
      }
      const isFilled = i < this.rating;
      node.clear();
      if (isFilled) {
        // Subtle shadow behind filled star
        drawIcon(node, 'star', 0, 2, this.starSize, Colors.Black, 0.3);
        drawIcon(node, 'star', 0, 0, this.starSize, this.filledColor, 1);
      } else {
        drawIcon(node, 'star', 0, 0, this.starSize, this.emptyColor, 0.45);
        node.lineStyle(1.5, hexToNumber(this.emptyColor), 0.75);
        node.strokeCircle(0, 0, this.starSize * 0.02);
      }
    }
  }

  private animateNewlyFilledStars(fromIndex: number, toIndex: number): void {
    this.stopTweens();
    const duration = resolveMotionDuration(
      MotionPresets.Selection.duration,
      this.theme.reducedMotion,
    );
    if (duration === 0) {
      return;
    }

    for (let i = fromIndex; i < toIndex; i += 1) {
      const node = this.starNodes[i];
      if (node === undefined) {
        continue;
      }
      node.setScale(0.6);
      const tween = this.scene.tweens.add({
        targets: node,
        scaleX: 1,
        scaleY: 1,
        duration,
        delay: (i - fromIndex) * 55,
        ease: MotionPresets.Selection.ease,
      });
      this.activeTweens.push(tween);
    }
  }

  private stopTweens(): void {
    for (const tween of this.activeTweens) {
      tween.stop();
    }
    this.activeTweens = [];
    for (const node of this.starNodes) {
      node.setScale(1);
    }
  }

  public override destroy(fromScene?: boolean): void {
    this.stopTweens();
    super.destroy(fromScene);
  }
}
