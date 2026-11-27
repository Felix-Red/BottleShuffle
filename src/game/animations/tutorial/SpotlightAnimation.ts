import type Phaser from 'phaser';
import { TUTORIAL_CONFIG } from '../../../config/TutorialConfig';
import { MotionEasings, resolveMotionDuration } from '../../../design-system';

/**
 * Restrained outline pulse for TutorialSpotlight.
 * Automatically collapses to static emphasis in reduced-motion mode and supports suspend/resume.
 */
export class SpotlightAnimation {
  private activeTween?: Phaser.Tweens.Tween;

  public start(
    scene: Phaser.Scene,
    target: Phaser.GameObjects.Graphics,
    reducedMotion: boolean,
  ): void {
    this.stop();
    target.setAlpha(1);

    const duration = resolveMotionDuration(TUTORIAL_CONFIG.motion.spotlightPulseMs, reducedMotion);
    if (duration === 0 || !target.active) {
      return;
    }

    this.activeTween = scene.tweens.add({
      targets: target,
      alpha: { from: 0.55, to: 1 },
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
