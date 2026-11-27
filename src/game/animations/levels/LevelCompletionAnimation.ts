import type Phaser from 'phaser';
import { MotionDurations, MotionEasings, resolveMotionDuration } from '../../../design-system';

/**
 * Restrained non-blocking chapter-completion emphasis pulse applied to ChapterProgress
 * when a chapter has just been completed. Respects reduced-motion preferences.
 */
export class LevelCompletionAnimation {
  private activeTween?: Phaser.Tweens.Tween;

  public playChapterPulse(
    scene: Phaser.Scene,
    target: Phaser.GameObjects.Container,
    reducedMotion: boolean,
  ): void {
    this.cancel();

    const duration = resolveMotionDuration(MotionDurations.Normal, reducedMotion);
    if (duration === 0 || !target.active) {
      target.setScale(1);
      return;
    }

    this.activeTween = scene.tweens.add({
      targets: target,
      scaleX: 1.03,
      scaleY: 1.03,
      duration: Math.round(duration * 0.7),
      ease: MotionEasings.EaseOut,
      yoyo: true,
      onComplete: () => {
        if (target.active) {
          target.setScale(1);
        }
        this.activeTween = undefined;
      },
    });
  }

  public cancel(): void {
    if (this.activeTween !== undefined) {
      this.activeTween.stop();
      this.activeTween = undefined;
    }
  }
}
