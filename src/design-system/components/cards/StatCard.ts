import Phaser from 'phaser';
import { DefaultGameTheme, type GameTheme } from '../../theme/GameTheme';
import { Colors, hexToNumber } from '../../tokens/Colors';
import { Dimens } from '../../tokens/Dimens';
import { SemanticShapes } from '../../tokens/Shapes';
import { createTextStyle, Typography } from '../../tokens/Typography';
import { drawIcon, type DesignIconName } from '../common/IconGraphic';
import { drawElevatedSurface } from '../common/SurfaceRenderer';

export interface StatCardConfig {
  readonly x?: number;
  readonly y?: number;
  readonly width?: number;
  readonly height?: number;
  readonly icon: DesignIconName;
  readonly label: string;
  readonly value: string;
  readonly accentColor?: string;
  readonly theme?: GameTheme;
}

export class StatCard extends Phaser.GameObjects.Container {
  private theme: GameTheme;
  private cardWidth: number;
  private cardHeight: number;
  private iconName: DesignIconName;
  private accentColor: string;

  private readonly surfaceGraphics: Phaser.GameObjects.Graphics;
  private readonly iconGraphics: Phaser.GameObjects.Graphics;
  private readonly valueText: Phaser.GameObjects.Text;
  private readonly labelText: Phaser.GameObjects.Text;

  public constructor(scene: Phaser.Scene, config: StatCardConfig) {
    super(scene, config.x ?? 0, config.y ?? 0);

    this.theme = config.theme ?? DefaultGameTheme;
    this.cardWidth = Math.max(148, config.width ?? 196);
    this.cardHeight = Math.max(76, config.height ?? 86);
    this.iconName = config.icon;
    this.accentColor = config.accentColor ?? Colors.Brand.PrimaryLight;

    this.surfaceGraphics = scene.add.graphics();
    this.iconGraphics = scene.add.graphics();

    this.valueText = scene.add
      .text(
        0,
        0,
        config.value,
        createTextStyle(Typography.TitleLarge, {
          color: Colors.Text.Primary,
        }),
      )
      .setOrigin(0, 0.5);

    this.labelText = scene.add
      .text(
        0,
        0,
        config.label,
        createTextStyle(Typography.LabelSmall, {
          color: Colors.Text.Secondary,
        }),
      )
      .setOrigin(0, 0.5);

    this.add([this.surfaceGraphics, this.iconGraphics, this.valueText, this.labelText]);

    this.setSize(this.cardWidth, this.cardHeight);
    this.layoutAndRedraw();

    scene.add.existing(this);
  }

  public setValue(value: string): this {
    this.valueText.setText(value);
    return this;
  }

  public setLabel(label: string): this {
    this.labelText.setText(label);
    return this;
  }

  public setAccentColor(accentColor: string): this {
    this.accentColor = accentColor;
    this.layoutAndRedraw();
    return this;
  }

  public setCardSize(width: number, height?: number): this {
    this.cardWidth = Math.max(148, width);
    if (height !== undefined) {
      this.cardHeight = Math.max(76, height);
    }
    this.setSize(this.cardWidth, this.cardHeight);
    this.layoutAndRedraw();
    return this;
  }

  public setTheme(theme: GameTheme): this {
    this.theme = theme;
    return this;
  }

  public getTheme(): GameTheme {
    return this.theme;
  }

  private layoutAndRedraw(): void {
    drawElevatedSurface(this.surfaceGraphics, {
      width: this.cardWidth,
      height: this.cardHeight,
      radius: SemanticShapes.Card,
      fillColor: Colors.Surface.Surface,
      borderColor: Colors.Surface.Border,
      borderWidth: Dimens.BorderThin,
      elevation: 'low',
    });

    const badgeRadius = 22;
    const badgeCenterX = -this.cardWidth / 2 + Dimens.Space16 + badgeRadius;

    this.iconGraphics.clear();
    this.iconGraphics.fillStyle(hexToNumber(this.accentColor), 0.16);
    this.iconGraphics.fillCircle(badgeCenterX, 0, badgeRadius);
    this.iconGraphics.lineStyle(Dimens.BorderThin, hexToNumber(this.accentColor), 0.45);
    this.iconGraphics.strokeCircle(badgeCenterX, 0, badgeRadius);
    drawIcon(
      this.iconGraphics,
      this.iconName,
      badgeCenterX,
      0,
      Dimens.IconMedium,
      this.accentColor,
    );

    const textStartX = badgeCenterX + badgeRadius + Dimens.Space12;
    this.valueText.setPosition(textStartX, -11);
    this.labelText.setPosition(textStartX, 14);
  }
}
