import type Phaser from 'phaser';
import { TUTORIAL_CONFIG } from '../../../config/TutorialConfig';
import { MotionEasings, resolveMotionDuration } from '../../../design-system';

/**
 * Restrained vertical bob + gentle scale pulse for TutorialPointer.
 * Remains completely static in reduced-motion mode and stops cleanly on hide/destroy.
 */
export class PointerAnimation {
  private activeTween?: Phaser.Tweens.Tween;

  public start(
    scene: Phaser.Scene,
    target: Phaser.GameObjects.Container,
    baseY: number,
    reducedMotion: boolean,
  ): void {
    this.stop();
    target.setY(baseY);
    target.setScale(1);

    const duration = resolveMotionDuration(TUTORIAL_CONFIG.motion.pointerBobMs, reducedMotion);
    if (duration === 0 || !target.active) {
      return;
    }

    this.activeTween = scene.tweens.add({
      targets: target,
      y: baseY - TUTORIAL_CONFIG.motion.pointerBobDistancePx,
      scaleX: 1.05,
      scaleY: 1.05,
      duration,
      ease: MotionEasings.EaseInOut,
      yoyo: true,
      repeat: -1,
    });
  }

  public setPaused(paused: boolean): void {
    if (paused) {
      this.activeTween?.pause();
    } else {
      this.activeTween?.resume();
    }
  }

  public stop(): void {
    if (this.activeTween !== undefined) {
      this.activeTween.stop();
      this.activeTween = undefined;
    }
  }
}
