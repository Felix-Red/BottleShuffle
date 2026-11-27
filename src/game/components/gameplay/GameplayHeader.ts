import Phaser from 'phaser';
import {
  Colors,
  createTextStyle,
  DefaultGameTheme,
  Dimens,
  hexToNumber,
  IconButton,
  Typography,
  type GameTheme,
} from '../../../design-system';
import type { GameplayHeaderLayout } from '../../layout/GameplayLayout';

export interface GameplayHeaderConfig {
  readonly title: string;
  readonly subtitle?: string;
  readonly onPause: () => void;
  readonly onRestart: () => void;
  readonly theme?: GameTheme;
}

export class GameplayHeader extends Phaser.GameObjects.Container {
  private readonly backgroundGraphics: Phaser.GameObjects.Graphics;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly subtitleText?: Phaser.GameObjects.Text;
  private readonly pauseButton: IconButton;
  private readonly restartButton: IconButton;

  public constructor(scene: Phaser.Scene, config: GameplayHeaderConfig) {
    super(scene, 0, 0);

    const theme = config.theme ?? DefaultGameTheme;

    this.backgroundGraphics = scene.add.graphics();
    this.add(this.backgroundGraphics);

    this.titleText = scene.add
      .text(
        0,
        0,
        config.title,
        createTextStyle(Typography.TitleLarge, {
          color: Colors.Text.Primary,
          align: 'center',
        }),
      )
      .setOrigin(0.5);
    this.add(this.titleText);

    if (config.subtitle !== undefined && config.subtitle.length > 0) {
      this.subtitleText = scene.add
        .text(
          0,
          0,
          config.subtitle,
          createTextStyle(Typography.LabelSmall, {
            color: Colors.Text.Secondary,
            align: 'center',
          }),
        )
        .setOrigin(0.5);
      this.add(this.subtitleText);
    }

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

    this.add([this.pauseButton, this.restartButton]);
    scene.add.existing(this);
  }

  public setControlsEnabled(pauseEnabled: boolean, restartEnabled: boolean): this {
    this.pauseButton.setEnabled(pauseEnabled);
    this.restartButton.setEnabled(restartEnabled);
    return this;
  }

  public applyLayout(layout: GameplayHeaderLayout): this {
    this.setPosition(0, layout.y);

    const leftInset = layout.leftInset ?? 0;
    const rightInset = layout.rightInset ?? 0;
    const effectiveW = Math.max(240, layout.width - leftInset - rightInset);
    const compact = effectiveW < 600 || layout.height <= 50;
    const padX = compact ? Dimens.ScreenPaddingCompact : Dimens.ScreenPadding;
    const centerY = layout.height / 2;
    const centerX = leftInset + effectiveW / 2;

    this.backgroundGraphics.clear();
    this.backgroundGraphics.fillStyle(hexToNumber(Colors.Surface.Surface), 0.9);
    this.backgroundGraphics.fillRect(0, 0, layout.width, layout.height);
    this.backgroundGraphics.lineStyle(Dimens.BorderThin, hexToNumber(Colors.Surface.Border), 0.65);
    this.backgroundGraphics.beginPath();
    this.backgroundGraphics.moveTo(0, layout.height);
    this.backgroundGraphics.lineTo(layout.width, layout.height);
    this.backgroundGraphics.strokePath();

    const maxTextW = Math.max(
      120,
      effectiveW - (padX + Dimens.MinTouchTarget + Dimens.Space16) * 2,
    );
    this.titleText.setStyle(
      createTextStyle(compact ? Typography.TitleMedium : Typography.TitleLarge, {
        color: Colors.Text.Primary,
        align: 'center',
        wordWrapWidth: maxTextW,
      }),
    );

    if (this.subtitleText !== undefined) {
      const titleOffset = layout.height <= 46 ? 8 : 10;
      const subtitleOffset = layout.height <= 46 ? 11 : 13;
      this.titleText.setPosition(centerX, centerY - titleOffset);
      this.subtitleText.setPosition(centerX, centerY + subtitleOffset);
    } else {
      this.titleText.setPosition(centerX, centerY);
    }

    this.pauseButton.setPosition(leftInset + padX + Dimens.MinTouchTarget / 2, centerY);
    this.restartButton.setPosition(
      layout.width - rightInset - padX - Dimens.MinTouchTarget / 2,
      centerY,
    );
    this.setSize(layout.width, layout.height);
    return this;
  }

  public setTheme(theme: GameTheme): this {
    this.pauseButton.setTheme(theme);
    this.restartButton.setTheme(theme);
    return this;
  }
}
