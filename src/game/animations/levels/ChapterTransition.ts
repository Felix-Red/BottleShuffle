import type Phaser from 'phaser';
import { LEVEL_SELECTION_MOTION } from '../../../config/ChapterVisualConfig';
import { MotionEasings, resolveMotionDuration } from '../../../design-system';
import type { ChapterTransitionDirection } from '../../levels/LevelSelectionController';

export interface ChapterTransitionOptions {
  readonly scene: Phaser.Scene;
  readonly targets: readonly Phaser.GameObjects.Container[];
  readonly direction: ChapterTransitionDirection;
  readonly reducedMotion: boolean;
  readonly token: number;
  readonly isTokenValid: (token: number) => boolean;
  readonly onComplete?: () => void;
}

/**
 * Coordinates restrained horizontal slide + crossfade transitions when switching chapters.
 * Supports safe cancellation on rapid chapter clicks or scene shutdown so stale callbacks
 * never overwrite newer state.
 */
export class ChapterTransition {
  private activeTweens: Phaser.Tweens.Tween[] = [];
  private basePositions = new Map<
    Phaser.GameObjects.Container,
    { readonly x: number; readonly y: number }
  >();

  public play(options: ChapterTransitionOptions): void {
    this.cancel();

    const duration = resolveMotionDuration(
      LEVEL_SELECTION_MOTION.chapterTransitionMs,
      options.reducedMotion,
    );

    if (duration === 0 || options.direction === 0) {
      for (const target of options.targets) {
        target.setAlpha(1);
      }
      if (options.isTokenValid(options.token)) {
        options.onComplete?.();
      }
      return;
    }

    const offsetX = options.direction * LEVEL_SELECTION_MOTION.chapterSlideOffsetPx;
    let remaining = options.targets.length;

    for (const target of options.targets) {
      const restX = target.x;
      const restY = target.y;
      this.basePositions.set(target, { x: restX, y: restY });

      target.setPosition(restX + offsetX, restY);
      target.setAlpha(0);

      const tween = options.scene.tweens.add({
        targets: target,
        x: restX,
        alpha: 1,
        duration,
        ease: MotionEasings.EaseOutCubic,
        onComplete: () => {
          this.basePositions.delete(target);
          remaining -= 1;
          if (remaining <= 0) {
            this.activeTweens = [];
            if (options.isTokenValid(options.token)) {
              options.onComplete?.();
            }
          }
        },
      });
      this.activeTweens.push(tween);
    }
  }

  public cancel(): void {
    for (const tween of this.activeTweens) {
      tween.stop();
    }
    this.activeTweens = [];

    for (const [target, pos] of this.basePositions.entries()) {
      if (target.active) {
        target.setPosition(pos.x, pos.y);
        target.setAlpha(1);
      }
    }
    this.basePositions.clear();
  }
}
