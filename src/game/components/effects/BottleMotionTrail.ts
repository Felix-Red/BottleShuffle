import type Phaser from 'phaser';
import { hexToNumber } from '../../../design-system/tokens/Colors';
import { MotionEasings } from '../../../design-system/tokens/Motion';
import type { AnimationPolicy } from '../../animations/core/AnimationPolicy';
import { EFFECT_TEXTURE_KEYS } from '../../assets/AssetKeys';

const MAX_TRAIL_DOTS = 5;
const TRAIL_DOT_LIFETIME_MS = 180;

/**
 * Lightweight, bounded motion trail spawned sparingly during longer bottle swaps.
 * Uses the locally bundled particle texture, fades rapidly, leaves zero persistent
 * objects, and is disabled automatically in reduced-motion mode.
 */
export class BottleMotionTrail {
  private readonly scene: Phaser.Scene;
  private readonly colorTint: number;
  private readonly policy: AnimationPolicy;
  private readonly depth: number;
  private readonly baseRadiusScale: number;

  private readonly activeDots = new Set<Phaser.GameObjects.Image>();
  private readonly activeTweens = new Set<Phaser.Tweens.Tween>();
  private emittedCount = 0;
  private disposed = false;

  public constructor(
    scene: Phaser.Scene,
    options: {
      readonly colorHex: string;
      readonly bottleWidth: number;
      readonly policy: AnimationPolicy;
      readonly depth?: number;
    },
  ) {
    this.scene = scene;
    this.colorTint = hexToNumber(options.colorHex);
    this.policy = options.policy;
    this.depth = options.depth ?? 15;
    this.baseRadiusScale = Math.min(0.65, Math.max(0.32, options.bottleWidth / 150));
  }

  public emitDot(x: number, y: number): void {
    if (this.disposed || !this.policy.allowMotionTrails || this.emittedCount >= MAX_TRAIL_DOTS) {
      return;
    }

    this.emittedCount += 1;
    const dot = this.scene.add
      .image(x, y, EFFECT_TEXTURE_KEYS.PARTICLE)
      .setDepth(this.depth)
      .setTint(this.colorTint)
      .setScale(this.baseRadiusScale)
      .setAlpha(0.32);

    this.activeDots.add(dot);

    const duration = Math.max(60, Math.round(TRAIL_DOT_LIFETIME_MS / this.policy.timeScale));
    const tween = this.scene.tweens.add({
      targets: dot,
      alpha: 0,
      scaleX: this.baseRadiusScale * 0.4,
      scaleY: this.baseRadiusScale * 0.4,
      duration,
      ease: MotionEasings.EaseOut,
      onComplete: () => {
        this.activeTweens.delete(tween);
        this.activeDots.delete(dot);
        if (dot.active) {
          dot.destroy();
        }
      },
    });
    this.activeTweens.add(tween);
  }

  public cancel(): void {
    this.disposed = true;
    for (const tween of this.activeTweens) {
      tween.stop();
    }
    this.activeTweens.clear();
    for (const dot of this.activeDots) {
      if (dot.active) {
        dot.destroy();
      }
    }
    this.activeDots.clear();
  }
}
