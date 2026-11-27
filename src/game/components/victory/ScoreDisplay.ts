import Phaser from 'phaser';
import { formatScoreNumber } from '../../../config/VictoryConfig';
import {
  Colors,
  createTextStyle,
  DefaultGameTheme,
  Typography,
  type GameTheme,
} from '../../../design-system';
import { ScoreRevealAnimator } from '../../animations/victory/ScoreRevealAnimator';

export interface ScoreDisplayConfig {
  readonly x?: number;
  readonly y?: number;
  readonly theme?: GameTheme;
}

/**
 * Prominent Victory score readout with subtle "SCORE" caption and smooth count-up reveal.
 */
export class ScoreDisplay extends Phaser.GameObjects.Container {
  private theme: GameTheme;
  private readonly captionText: Phaser.GameObjects.Text;
  private readonly valueText: Phaser.GameObjects.Text;
  private readonly animator: ScoreRevealAnimator;
  private currentScore = 0;
  private fontScale = 1;

  public constructor(scene: Phaser.Scene, config: ScoreDisplayConfig = {}) {
    super(scene, config.x ?? 0, config.y ?? 0);

    this.theme = config.theme ?? DefaultGameTheme;
    this.animator = new ScoreRevealAnimator(scene);

    this.captionText = scene.add
      .text(
        0,
        -22,
        'SCORE',
        createTextStyle(Typography.LabelSmall, {
          color: Colors.Text.Secondary,
          align: 'center',
        }),
      )
      .setOrigin(0.5);

    this.valueText = scene.add
      .text(
        0,
        8,
        '0',
        createTextStyle(Typography.HeadlineLarge, {
          color: Colors.Brand.Secondary,
          align: 'center',
        }),
      )
      .setOrigin(0.5);

    this.add([this.captionText, this.valueText]);
    scene.add.existing(this);
  }

  public revealScore(score: number, animate = true): this {
    this.currentScore = Math.max(0, Math.round(score));
    this.animator.play({
      targetScore: this.currentScore,
      reducedMotion: !animate || this.theme.reducedMotion,
      onUpdate: (formatted) => {
        if (this.valueText.active) {
          this.valueText.setText(formatted);
        }
      },
    });
    return this;
  }

  public setScoreImmediate(score: number): this {
    this.animator.cancel();
    this.currentScore = Math.max(0, Math.round(score));
    this.valueText.setText(formatScoreNumber(this.currentScore));
    return this;
  }

  public setFontScale(scale: number): this {
    const safeScale = Math.max(0.7, Math.min(1.2, scale));
    if (safeScale === this.fontScale) {
      return this;
    }
    this.fontScale = safeScale;
    this.captionText.setPosition(0, Math.round(-21 * safeScale));
    this.valueText.setPosition(0, Math.round(8 * safeScale));
    this.valueText.setStyle(
      createTextStyle(Typography.HeadlineLarge, {
        color: Colors.Brand.Secondary,
        align: 'center',
        scale: safeScale,
        minFontSize: 28,
      }),
    );
    return this;
  }

  public cancelAnimation(): void {
    this.animator.cancel();
  }

  public setTheme(theme: GameTheme): this {
    this.theme = theme;
    return this;
  }

  public override destroy(fromScene?: boolean): void {
    this.animator.destroy();
    super.destroy(fromScene);
  }
}
