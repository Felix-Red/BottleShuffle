import Phaser from 'phaser';
import {
  Colors,
  createTextStyle,
  Dimens,
  drawIcon,
  hexToNumber,
  Shapes,
  Typography,
} from '../../../design-system';
import type { VictoryPersonalBestBadge } from '../../victory/VictoryViewState';

export interface PersonalBestIndicatorConfig {
  readonly x?: number;
  readonly y?: number;
  readonly maxWidth?: number;
}

/**
 * Restrained personal-best pill badge displaying improvement or first completion.
 * Hidden automatically when no personal-best badge applies.
 */
export class PersonalBestIndicator extends Phaser.GameObjects.Container {
  private maxWidth: number;
  private badge: VictoryPersonalBestBadge | null = null;
  private readonly pillGraphics: Phaser.GameObjects.Graphics;
  private readonly iconGraphics: Phaser.GameObjects.Graphics;
  private readonly labelText: Phaser.GameObjects.Text;

  public constructor(scene: Phaser.Scene, config: PersonalBestIndicatorConfig = {}) {
    super(scene, config.x ?? 0, config.y ?? 0);

    this.maxWidth = config.maxWidth ?? 340;
    this.pillGraphics = scene.add.graphics();
    this.iconGraphics = scene.add.graphics();
    this.labelText = scene.add
      .text(
        0,
        0,
        '',
        createTextStyle(Typography.LabelSmall, {
          color: Colors.Brand.Secondary,
          align: 'center',
          scale: 0.92,
          minFontSize: 11,
        }),
      )
      .setOrigin(0.5);

    this.add([this.pillGraphics, this.iconGraphics, this.labelText]);
    this.setVisible(false);
    scene.add.existing(this);
  }

  public setBadge(badge: VictoryPersonalBestBadge | null, maxWidth?: number): this {
    this.badge = badge;
    if (maxWidth !== undefined) {
      this.maxWidth = Math.max(160, Math.round(maxWidth));
    }
    this.renderVisuals();
    return this;
  }

  public setMaxWidth(maxWidth: number): this {
    this.maxWidth = Math.max(160, Math.round(maxWidth));
    this.renderVisuals();
    return this;
  }

  private renderVisuals(): void {
    this.pillGraphics.clear();
    this.iconGraphics.clear();

    if (this.badge === null) {
      this.setVisible(false);
      return;
    }

    this.setVisible(true);
    const combined =
      this.badge.details !== null
        ? `${this.badge.headline}  •  ${this.badge.details}`
        : this.badge.headline;

    const isFirstCompletion = this.badge.headline === 'First Completion';
    const accent = isFirstCompletion ? Colors.Semantic.Info : Colors.Brand.Secondary;

    this.labelText.setColor(accent);
    this.labelText.setText(combined);

    const iconSize = 14;
    const gap = Dimens.Space6;
    const padX = Dimens.Space12;
    const pillHeight = 26;
    const desiredWidth = Math.min(
      this.maxWidth,
      Math.max(120, Math.ceil(this.labelText.width + iconSize + gap + padX * 2)),
    );

    const maxTextWidth = desiredWidth - iconSize - gap - padX * 2;
    if (this.labelText.width > maxTextWidth && maxTextWidth > 60) {
      this.labelText.setText(this.badge.headline);
    }

    const finalWidth = Math.min(
      this.maxWidth,
      Math.max(116, Math.ceil(this.labelText.width + iconSize + gap + padX * 2)),
    );

    const pillRadius = Math.min(Shapes.Rounded, pillHeight / 2);

    this.pillGraphics.fillStyle(hexToNumber(accent), 0.14);
    this.pillGraphics.fillRoundedRect(
      -finalWidth / 2,
      -pillHeight / 2,
      finalWidth,
      pillHeight,
      pillRadius,
    );
    this.pillGraphics.lineStyle(1.2, hexToNumber(accent), 0.65);
    this.pillGraphics.strokeRoundedRect(
      -finalWidth / 2,
      -pillHeight / 2,
      finalWidth,
      pillHeight,
      pillRadius,
    );

    const contentWidth = iconSize + gap + this.labelText.width;
    const iconX = -contentWidth / 2 + iconSize / 2;
    const textX = iconX + iconSize / 2 + gap + this.labelText.width / 2;

    drawIcon(
      this.iconGraphics,
      isFirstCompletion ? 'sparkles' : 'trophy',
      iconX,
      0,
      iconSize,
      accent,
    );
    this.labelText.setPosition(Math.round(textX), 0);
  }
}
