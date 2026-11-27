import type Phaser from 'phaser';
import { formatScoreNumber, VICTORY_CONFIG } from '../../../config/VictoryConfig';
import { MotionEasings, resolveMotionDuration } from '../../../design-system/tokens/Motion';

export interface ScoreRevealOptions {
  readonly targetScore: number;
  readonly reducedMotion: boolean;
  readonly delayMs?: number;
  readonly onUpdate: (formattedScore: string) => void;
  readonly onComplete?: () => void;
}

/**
 * Purely presentational count-up animator for Victory scores.
 * Never alters the deterministic score value; cancelling immediately reconciles
 * the display to the exact final formatted score.
 */
export class ScoreRevealAnimator {
  private readonly scene: Phaser.Scene;
  private activeTween?: Phaser.Tweens.Tween;
  private finalFormattedScore = '0';
  private lastCallback?: (formattedScore: string) => void;

  public constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  public play(options: ScoreRevealOptions): void {
    this.cancel();

    const safeScore = Math.max(0, Math.round(options.targetScore));
    this.finalFormattedScore = formatScoreNumber(safeScore);
    this.lastCallback = options.onUpdate;

    const duration = resolveMotionDuration(
      VICTORY_CONFIG.motion.scoreCountDurationMs,
      options.reducedMotion,
    );

    if (duration === 0 || safeScore === 0) {
      options.onUpdate(this.finalFormattedScore);
      options.onComplete?.();
      return;
    }

    const counter = { value: 0 };
    options.onUpdate(formatScoreNumber(0));

    this.activeTween = this.scene.tweens.add({
      targets: counter,
      value: safeScore,
      duration,
      delay: Math.max(0, options.delayMs ?? 80),
      ease: MotionEasings.EaseOutCubic,
      onUpdate: () => {
        options.onUpdate(formatScoreNumber(Math.round(counter.value)));
      },
      onComplete: () => {
        this.activeTween = undefined;
        options.onUpdate(this.finalFormattedScore);
        options.onComplete?.();
      },
    });
  }

  public cancel(): void {
    if (this.activeTween !== undefined) {
      this.activeTween.stop();
      this.activeTween = undefined;
      this.lastCallback?.(this.finalFormattedScore);
    }
  }

  public destroy(): void {
    if (this.activeTween !== undefined) {
      this.activeTween.stop();
      this.activeTween = undefined;
    }
    this.lastCallback = undefined;
  }
}
