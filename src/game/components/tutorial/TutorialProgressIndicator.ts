import Phaser from 'phaser';
import {
  Colors,
  createTextStyle,
  DefaultGameTheme,
  ProgressBar,
  Typography,
  type GameTheme,
} from '../../../design-system';

export interface TutorialProgressIndicatorConfig {
  readonly totalSteps: number;
  readonly currentStep?: number;
  readonly width?: number;
  readonly theme?: GameTheme;
}

/**
 * Compact segmented progress indicator + step counter ("Step 2 of 5")
 * derived strictly from the tutorial definition's total instructional step count.
 */
export class TutorialProgressIndicator extends Phaser.GameObjects.Container {
  private readonly labelText: Phaser.GameObjects.Text;
  private readonly progressBar: ProgressBar;
  private currentStep: number;
  private totalSteps: number;

  public constructor(scene: Phaser.Scene, config: TutorialProgressIndicatorConfig) {
    super(scene, 0, 0);

    const theme = config.theme ?? DefaultGameTheme;
    this.totalSteps = Math.max(1, config.totalSteps);
    this.currentStep = Math.max(1, Math.min(this.totalSteps, config.currentStep ?? 1));
    const barWidth = Math.max(96, config.width ?? 150);

    this.labelText = scene.add
      .text(
        0,
        -9,
        `Step ${String(this.currentStep)} of ${String(this.totalSteps)}`,
        createTextStyle(Typography.LabelSmall, {
          color: Colors.Text.Secondary,
          align: 'center',
          scale: 0.84,
          minFontSize: 11,
        }),
      )
      .setOrigin(0.5);

    this.progressBar = new ProgressBar(scene, {
      x: 0,
      y: 9,
      width: barWidth,
      height: 8,
      value: this.currentStep,
      max: this.totalSteps,
      variant: 'segmented',
      segments: this.totalSteps,
      fillColor: Colors.Brand.Secondary,
      trackColor: Colors.Surface.Background,
      theme,
    });

    this.add([this.labelText, this.progressBar]);
    scene.add.existing(this);
  }

  public setStep(stepNumber: number, totalSteps: number, animate = true): this {
    this.totalSteps = Math.max(1, totalSteps);
    this.currentStep = Math.max(1, Math.min(this.totalSteps, stepNumber));
    this.labelText.setText(`Step ${String(this.currentStep)} of ${String(this.totalSteps)}`);
    this.progressBar.setProgress(this.currentStep, this.totalSteps, animate);
    return this;
  }

  public setIndicatorWidth(width: number): this {
    this.progressBar.setBarSize(Math.max(84, width), 8);
    return this;
  }

  public setTheme(theme: GameTheme): this {
    this.progressBar.setTheme(theme);
    return this;
  }
}
