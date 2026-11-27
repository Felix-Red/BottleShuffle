import Phaser from 'phaser';
import { DefaultGameTheme, type GameTheme } from '../../theme/GameTheme';
import { Colors, lightenHex } from '../../tokens/Colors';
import { Dimens } from '../../tokens/Dimens';
import { MotionEasings, MotionPresets, resolveMotionDuration } from '../../tokens/Motion';
import { drawIcon, drawStarOutline } from '../common/IconGraphic';
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

export interface StarSequentialRevealOptions {
  readonly staggerMs?: number;
  readonly durationMs?: number;
  readonly onStarRevealed?: (
    index: number,
    localPosition: { readonly x: number; readonly y: number },
  ) => void;
  readonly onComplete?: () => void;
}

export class StarRating extends Phaser.GameObjects.Container {
  private theme: GameTheme;
  private readonly maxStars: number;
  private starSize: number;
  private spacing: number;
  private readonly filledColor: string;
  private readonly emptyColor: string;
  private rating: number;
  private readonly starNodes: Phaser.GameObjects.Graphics[] = [];
  private activeTweens: Phaser.Tweens.Tween[] = [];
  private activeTimers: Phaser.Time.TimerEvent[] = [];

  public constructor(scene: Phaser.Scene, config: StarRatingConfig = {}) {
    super(scene, config.x ?? 0, config.y ?? 0);

    this.theme = config.theme ?? DefaultGameTheme;
    this.maxStars = Math.max(1, Math.floor(config.maxStars ?? 3));
    this.starSize = Math.max(12, config.starSize ?? Dimens.IconMedium);
    this.spacing = config.spacing ?? Dimens.Space6;
    this.filledColor = config.filledColor ?? Colors.Brand.Secondary;
    this.emptyColor = config.emptyColor ?? Colors.Surface.Border;
    this.rating = normalizeStarCount(config.rating ?? 0, this.maxStars);

    for (let i = 0; i < this.maxStars; i += 1) {
      const node = scene.add.graphics();
      this.starNodes.push(node);
      this.add(node);
    }

    this.layoutNodes();
    this.renderStars();

    scene.add.existing(this);
  }

  public getRating(): number {
    return this.rating;
  }

  public setRating(rating: number, animate = true): this {
    const nextRating = normalizeStarCount(rating, this.maxStars);
    const previous = this.rating;
    this.stopAnimations();
    this.rating = nextRating;
    this.renderStars();

    if (animate && nextRating > previous) {
      this.animateNewlyFilledStars(previous, nextRating);
    }

    return this;
  }

  public setStarSize(starSize: number, spacing?: number): this {
    const nextSize = Math.max(12, Math.round(starSize));
    const nextSpacing = spacing !== undefined ? Math.max(2, Math.round(spacing)) : this.spacing;
    if (nextSize === this.starSize && nextSpacing === this.spacing) {
      return this;
    }
    this.starSize = nextSize;
    this.spacing = nextSpacing;
    this.layoutNodes();
    this.renderStars();
    return this;
  }

  public getStarLocalPosition(index: number): { readonly x: number; readonly y: number } | null {
    const node = this.starNodes[index];
    if (node === undefined) {
      return null;
    }
    return { x: node.x, y: node.y };
  }

  /**
   * Reveals earned stars sequentially with subtle scale pop.
   * Respects reduced motion by displaying the final rating immediately.
   * Returns an idempotent cancel handle that reconciles final visuals immediately.
   */
  public playSequentialReveal(
    targetRating: number,
    options: StarSequentialRevealOptions = {},
  ): () => void {
    const clampedTarget = normalizeStarCount(targetRating, this.maxStars);
    this.stopAnimations();

    const duration = resolveMotionDuration(options.durationMs ?? 260, this.theme.reducedMotion);
    const staggerMs = this.theme.reducedMotion ? 0 : Math.max(0, options.staggerMs ?? 170);

    if (duration === 0 || clampedTarget === 0) {
      this.rating = clampedTarget;
      this.renderStars();
      options.onComplete?.();
      return () => undefined;
    }

    let finished = false;
    this.rating = 0;
    this.renderStars();

    const finalize = (): void => {
      if (finished) {
        return;
      }
      finished = true;
      this.stopAnimations();
      this.rating = clampedTarget;
      this.renderStars();
    };

    for (let i = 0; i < clampedTarget; i += 1) {
      const revealDelay = i * staggerMs;
      const timer = this.scene.time.delayedCall(revealDelay, () => {
        if (finished || !this.active) {
          return;
        }
        const node = this.starNodes[i];
        if (node === undefined) {
          return;
        }
        this.rating = Math.max(this.rating, i + 1);
        this.drawSingleStar(node, true);
        node.setScale(0.38);

        const tween = this.scene.tweens.add({
          targets: node,
          scaleX: 1,
          scaleY: 1,
          duration,
          ease: MotionEasings.SoftOvershoot,
        });
        this.activeTweens.push(tween);
        options.onStarRevealed?.(i, { x: node.x, y: node.y });
      });
      this.activeTimers.push(timer);
    }

    const totalDuration = (clampedTarget - 1) * staggerMs + duration + 20;
    const completionTimer = this.scene.time.delayedCall(totalDuration, () => {
      if (finished) {
        return;
      }
      finished = true;
      this.rating = clampedTarget;
      options.onComplete?.();
    });
    this.activeTimers.push(completionTimer);

    return finalize;
  }

  public setTheme(theme: GameTheme): this {
    this.theme = theme;
    return this;
  }

  public stopAnimations(): void {
    for (const timer of this.activeTimers) {
      timer.remove(false);
    }
    this.activeTimers = [];

    for (const tween of this.activeTweens) {
      tween.stop();
    }
    this.activeTweens = [];

    for (const node of this.starNodes) {
      if (node.active) {
        node.setScale(1);
      }
    }
  }

  private layoutNodes(): void {
    const totalWidth = this.maxStars * this.starSize + (this.maxStars - 1) * this.spacing;
    const startX = -totalWidth / 2 + this.starSize / 2;

    for (let i = 0; i < this.starNodes.length; i += 1) {
      const node = this.starNodes[i];
      if (node !== undefined) {
        node.setPosition(startX + i * (this.starSize + this.spacing), 0);
      }
    }

    this.setSize(totalWidth, this.starSize);
  }

  private renderStars(): void {
    for (let i = 0; i < this.starNodes.length; i += 1) {
      const node = this.starNodes[i];
      if (node === undefined) {
        continue;
      }
      this.drawSingleStar(node, i < this.rating);
    }
  }

  private drawSingleStar(node: Phaser.GameObjects.Graphics, isFilled: boolean): void {
    node.clear();
    const outlineWidth = Math.max(1.5, Math.min(2.6, this.starSize * 0.065));

    if (isFilled) {
      // Subtle grounding shadow + solid gold fill + crisp bright rim
      drawIcon(
        node,
        'star',
        0,
        Math.max(1.5, this.starSize * 0.06),
        this.starSize,
        Colors.Black,
        0.34,
      );
      drawIcon(node, 'star', 0, 0, this.starSize, this.filledColor, 1);
      drawStarOutline(
        node,
        0,
        0,
        this.starSize,
        lightenHex(this.filledColor, 0.35),
        Math.max(1.2, outlineWidth * 0.72),
        0.9,
      );
    } else {
      // Hollow outlined star with faint recessed fill so unearned stars read clearly without colour alone
      drawIcon(node, 'star', 0, 0, this.starSize, this.emptyColor, 0.16);
      drawStarOutline(node, 0, 0, this.starSize, this.emptyColor, outlineWidth, 0.82);
    }
  }

  private animateNewlyFilledStars(fromIndex: number, toIndex: number): void {
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

  public override destroy(fromScene?: boolean): void {
    this.stopAnimations();
    super.destroy(fromScene);
  }
}
