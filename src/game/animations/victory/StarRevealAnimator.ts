import type Phaser from 'phaser';
import { VICTORY_CONFIG } from '../../../config/VictoryConfig';
import { Colors, hexToNumber } from '../../../design-system/tokens/Colors';
import { MotionEasings } from '../../../design-system/tokens/Motion';
import type { StarRating } from '../../../design-system/components/indicators/StarRating';
import { EFFECT_TEXTURE_KEYS } from '../../assets/AssetKeys';

export interface StarRevealOptions {
  readonly reducedMotion: boolean;
  readonly onStarRevealed?: (starIndex: number) => void;
  readonly onComplete?: () => void;
}

const SPARKLES_PER_STAR = 4;

/**
 * Coordinates sequential Victory star reveal with bounded gold sparkle pops
 * around each earned star. Static and immediate when reducedMotion is enabled.
 */
export class StarRevealAnimator {
  private readonly scene: Phaser.Scene;
  private readonly starRating: StarRating;
  private readonly fxContainer: Phaser.GameObjects.Container;
  private cancelStarReveal?: () => void;
  private activeTweens: Phaser.Tweens.Tween[] = [];
  private activeSprites: Phaser.GameObjects.Image[] = [];

  public constructor(
    scene: Phaser.Scene,
    starRating: StarRating,
    fxParent: Phaser.GameObjects.Container,
  ) {
    this.scene = scene;
    this.starRating = starRating;
    this.fxContainer = scene.add.container(0, 0);
    fxParent.add(this.fxContainer);
  }

  public play(targetRating: number, options: StarRevealOptions): void {
    this.cancel();

    this.cancelStarReveal = this.starRating.playSequentialReveal(targetRating, {
      staggerMs: VICTORY_CONFIG.motion.starStaggerMs,
      durationMs: VICTORY_CONFIG.motion.starRevealDurationMs,
      onStarRevealed: (index, localPos) => {
        if (!options.reducedMotion) {
          this.spawnStarSparkles(this.starRating.x + localPos.x, this.starRating.y + localPos.y);
        }
        options.onStarRevealed?.(index);
      },
      ...(options.onComplete !== undefined ? { onComplete: options.onComplete } : {}),
    });
  }

  public cancel(): void {
    if (this.cancelStarReveal !== undefined) {
      this.cancelStarReveal();
      this.cancelStarReveal = undefined;
    }
    this.clearSparkles();
  }

  public destroy(): void {
    this.cancel();
    if (this.fxContainer.active) {
      this.fxContainer.destroy(true);
    }
  }

  private spawnStarSparkles(cx: number, cy: number): void {
    if (!this.scene.textures.exists(EFFECT_TEXTURE_KEYS.SPARKLE) || !this.fxContainer.active) {
      return;
    }

    for (let i = 0; i < SPARKLES_PER_STAR; i += 1) {
      const angle = (Math.PI * 2 * i) / SPARKLES_PER_STAR + Math.PI / 4;
      const dist = 24 + (i % 2) * 10;
      const tint = i % 2 === 0 ? Colors.Brand.Secondary : Colors.White;

      const sprite = this.scene.add
        .image(cx, cy, EFFECT_TEXTURE_KEYS.SPARKLE)
        .setTint(hexToNumber(tint))
        .setScale(0.45)
        .setAlpha(0.95);

      this.fxContainer.add(sprite);
      this.activeSprites.push(sprite);

      const tween = this.scene.tweens.add({
        targets: sprite,
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        angle: i % 2 === 0 ? 90 : -90,
        scaleX: 0.12,
        scaleY: 0.12,
        alpha: 0,
        duration: 360,
        ease: MotionEasings.EaseOut,
        onComplete: () => {
          if (sprite.active) {
            sprite.destroy();
          }
        },
      });
      this.activeTweens.push(tween);
    }
  }

  private clearSparkles(): void {
    for (const tween of this.activeTweens) {
      tween.stop();
    }
    this.activeTweens = [];

    for (const sprite of this.activeSprites) {
      if (sprite.active) {
        sprite.destroy();
      }
    }
    this.activeSprites = [];
  }
}
