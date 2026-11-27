import Phaser from 'phaser';
import { TUTORIAL_CONFIG } from '../../../config/TutorialConfig';
import {
  Colors,
  createTextStyle,
  DefaultGameTheme,
  Dimens,
  hexToNumber,
  IconButton,
  OutlineButton,
  Typography,
  type GameTheme,
} from '../../../design-system';
import type { GameplayHeaderLayout } from '../../layout/GameplayLayout';
import { TutorialProgressIndicator } from './TutorialProgressIndicator';

export interface TutorialHeaderConfig {
  readonly totalSteps: number;
  readonly theme?: GameTheme;
  readonly onPause: () => void;
  readonly onRestart: () => void;
  readonly onSkip: () => void;
}

/**
 * Top bar for Tutorial mode featuring Pause (left), Tutorial title + segmented
 * progress indicator (center), and Restart + always-visible Skip controls (right).
 */
export class TutorialHeader extends Phaser.GameObjects.Container {
  private readonly backgroundGraphics: Phaser.GameObjects.Graphics;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly progressIndicator: TutorialProgressIndicator;
  private readonly pauseButton: IconButton;
  private readonly restartButton: IconButton;
  private readonly skipButton: OutlineButton;

  public constructor(scene: Phaser.Scene, config: TutorialHeaderConfig) {
    super(scene, 0, 0);

    const theme = config.theme ?? DefaultGameTheme;

    this.backgroundGraphics = scene.add.graphics();

    this.titleText = scene.add
      .text(
        0,
        0,
        TUTORIAL_CONFIG.copy.headerTitle,
        createTextStyle(Typography.TitleMedium, {
          color: Colors.Text.Primary,
          align: 'left',
        }),
      )
      .setOrigin(0, 0.5);

    this.progressIndicator = new TutorialProgressIndicator(scene, {
      totalSteps: config.totalSteps,
      currentStep: 1,
      width: 164,
      theme,
    });

    this.pauseButton = new IconButton(scene, {
      icon: 'pause',
      size: Dimens.MinTouchTarget,
      variant: 'surface',
      theme,
      onClick: config.onPause,
    });

    this.restartButton = new IconButton(scene, {
      icon: 'restart',
      size: Dimens.MinTouchTarget,
      variant: 'surface',
      theme,
      onClick: config.onRestart,
    });

    this.skipButton = new OutlineButton(scene, {
      label: TUTORIAL_CONFIG.copy.skipLabel,
      width: 92,
      height: Dimens.ButtonHeightSmall,
      theme,
      onClick: config.onSkip,
    });

    this.add([
      this.backgroundGraphics,
      this.titleText,
      this.progressIndicator,
      this.pauseButton,
      this.restartButton,
      this.skipButton,
    ]);

    scene.add.existing(this);
  }

  public setStep(stepNumber: number, totalSteps: number, animate = true): this {
    this.progressIndicator.setStep(stepNumber, totalSteps, animate);
    return this;
  }

  public setControlsState(params: {
    readonly pauseEnabled: boolean;
    readonly restartVisible: boolean;
    readonly restartEnabled: boolean;
    readonly skipEnabled: boolean;
  }): this {
    this.pauseButton.setEnabled(params.pauseEnabled);
    this.restartButton.setVisible(params.restartVisible);
    this.restartButton.setEnabled(params.restartVisible && params.restartEnabled);
    this.skipButton.setEnabled(params.skipEnabled);
    return this;
  }

  public applyLayout(layout: GameplayHeaderLayout): this {
    this.setPosition(0, layout.y);
    const compact = layout.width < 600;
    const padX = compact ? Dimens.ScreenPaddingCompact : Dimens.ScreenPadding;
    const centerY = Math.round(layout.height / 2);

    this.backgroundGraphics.clear();
    this.backgroundGraphics.fillStyle(hexToNumber(Colors.Surface.Surface), 0.92);
    this.backgroundGraphics.fillRect(0, 0, layout.width, layout.height);
    this.backgroundGraphics.lineStyle(Dimens.BorderThin, hexToNumber(Colors.Surface.Border), 0.65);
    this.backgroundGraphics.beginPath();
    this.backgroundGraphics.moveTo(0, layout.height);
    this.backgroundGraphics.lineTo(layout.width, layout.height);
    this.backgroundGraphics.strokePath();

    const pauseX = Math.round(padX + Dimens.MinTouchTarget / 2);
    this.pauseButton.setPosition(pauseX, centerY);

    const skipW = compact ? 74 : 92;
    this.skipButton.setButtonSize(skipW, Dimens.ButtonHeightSmall);
    const skipX = Math.round(layout.width - padX - skipW / 2);
    this.skipButton.setPosition(skipX, centerY);

    const restartX = Math.round(skipX - skipW / 2 - Dimens.Space8 - Dimens.MinTouchTarget / 2);
    this.restartButton.setPosition(restartX, centerY);

    // Show How to Play title beside Pause on wider viewports; keep progress centered cleanly
    const showSideTitle = layout.width >= 680;
    this.titleText.setVisible(showSideTitle);
    if (showSideTitle) {
      this.titleText.setPosition(pauseX + Dimens.MinTouchTarget / 2 + Dimens.Space12, centerY);
    }

    const indicatorW = compact ? 116 : 168;
    this.progressIndicator.setIndicatorWidth(indicatorW);
    this.progressIndicator.setPosition(Math.round(layout.width / 2), centerY);

    this.setSize(layout.width, layout.height);
    return this;
  }

  public setTheme(theme: GameTheme): this {
    this.progressIndicator.setTheme(theme);
    this.pauseButton.setTheme(theme);
    this.restartButton.setTheme(theme);
    this.skipButton.setTheme(theme);
    return this;
  }
}
