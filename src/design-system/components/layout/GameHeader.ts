import Phaser from 'phaser';
import { DefaultGameTheme, type GameTheme } from '../../theme/GameTheme';
import { Colors, hexToNumber } from '../../tokens/Colors';
import { Dimens } from '../../tokens/Dimens';
import { createTextStyle, Typography } from '../../tokens/Typography';
import { IconButton } from '../buttons/IconButton';
import type { DesignIconName } from '../common/IconGraphic';

export interface HeaderActionConfig {
  readonly icon: DesignIconName;
  readonly onClick: () => void;
}

export interface GameHeaderConfig {
  readonly width?: number;
  readonly height?: number;
  readonly title: string;
  readonly subtitle?: string;
  readonly onBack?: () => void;
  readonly trailingAction?: HeaderActionConfig;
  readonly showDivider?: boolean;
  readonly theme?: GameTheme;
}

export class GameHeader extends Phaser.GameObjects.Container {
  private theme: GameTheme;
  private headerWidth: number;
  private headerHeight: number;
  private readonly showDivider: boolean;

  private readonly backgroundGraphics: Phaser.GameObjects.Graphics;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly subtitleText?: Phaser.GameObjects.Text;
  private readonly backButton?: IconButton;
  private readonly trailingButton?: IconButton;

  public constructor(scene: Phaser.Scene, config: GameHeaderConfig) {
    super(scene, 0, 0);

    this.theme = config.theme ?? DefaultGameTheme;
    this.headerWidth = Math.max(300, config.width ?? scene.scale.width);
    this.headerHeight = config.height ?? Dimens.HeaderHeight;
    this.showDivider = config.showDivider ?? true;

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

    if (config.onBack !== undefined) {
      this.backButton = new IconButton(scene, {
        icon: 'back',
        size: Dimens.MinTouchTarget,
        variant: 'surface',
        theme: this.theme,
        onClick: config.onBack,
      });
      this.add(this.backButton);
    }

    if (config.trailingAction !== undefined) {
      this.trailingButton = new IconButton(scene, {
        icon: config.trailingAction.icon,
        size: Dimens.MinTouchTarget,
        variant: 'surface',
        theme: this.theme,
        onClick: config.trailingAction.onClick,
      });
      this.add(this.trailingButton);
    }

    this.resize(this.headerWidth, this.headerHeight);
    scene.add.existing(this);
  }

  public setTitle(title: string): this {
    this.titleText.setText(title);
    return this;
  }

  public setSubtitle(subtitle: string): this {
    this.subtitleText?.setText(subtitle);
    return this;
  }

  public getHeaderHeight(): number {
    return this.headerHeight;
  }

  public resize(width: number, height?: number): this {
    this.headerWidth = Math.max(280, width);
    if (height !== undefined) {
      this.headerHeight = height;
    }

    const compact = this.headerWidth < 600;
    const horizontalPad = compact ? Dimens.ScreenPaddingCompact : Dimens.ScreenPadding;
    const centerY = this.headerHeight / 2;

    this.backgroundGraphics.clear();
    this.backgroundGraphics.fillStyle(hexToNumber(Colors.Surface.Surface), 0.94);
    this.backgroundGraphics.fillRect(0, 0, this.headerWidth, this.headerHeight);

    if (this.showDivider) {
      this.backgroundGraphics.lineStyle(Dimens.BorderThin, hexToNumber(Colors.Surface.Border), 0.7);
      this.backgroundGraphics.beginPath();
      this.backgroundGraphics.moveTo(0, this.headerHeight);
      this.backgroundGraphics.lineTo(this.headerWidth, this.headerHeight);
      this.backgroundGraphics.strokePath();
    }

    const sideReserved =
      this.backButton !== undefined || this.trailingButton !== undefined
        ? Dimens.MinTouchTarget + horizontalPad + Dimens.Space12
        : horizontalPad;

    const maxTextWidth = Math.max(120, this.headerWidth - sideReserved * 2);

    this.titleText.setStyle(
      createTextStyle(compact ? Typography.TitleMedium : Typography.TitleLarge, {
        color: Colors.Text.Primary,
        align: 'center',
        wordWrapWidth: maxTextWidth,
      }),
    );

    if (this.subtitleText !== undefined) {
      this.titleText.setPosition(this.headerWidth / 2, centerY - 10);
      this.subtitleText.setPosition(this.headerWidth / 2, centerY + 14);
    } else {
      this.titleText.setPosition(this.headerWidth / 2, centerY);
    }

    if (this.backButton !== undefined) {
      this.backButton.setPosition(horizontalPad + Dimens.MinTouchTarget / 2, centerY);
    }

    if (this.trailingButton !== undefined) {
      this.trailingButton.setPosition(
        this.headerWidth - horizontalPad - Dimens.MinTouchTarget / 2,
        centerY,
      );
    }

    this.setSize(this.headerWidth, this.headerHeight);
    return this;
  }

  public setTheme(theme: GameTheme): this {
    this.theme = theme;
    this.backButton?.setTheme(theme);
    this.trailingButton?.setTheme(theme);
    return this;
  }
}
