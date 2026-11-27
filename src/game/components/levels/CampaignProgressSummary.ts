import Phaser from 'phaser';
import {
  Colors,
  createTextStyle,
  DefaultGameTheme,
  Dimens,
  drawElevatedSurface,
  drawIcon,
  ProgressBar,
  Shapes,
  Typography,
  type GameTheme,
} from '../../../design-system';

export interface CampaignProgressSummaryConfig {
  readonly x?: number;
  readonly y?: number;
  readonly width?: number;
  readonly height?: number;
  readonly showBar?: boolean;
  readonly theme?: GameTheme;
}

/**
 * Compact header pill showing aggregate campaign progress (trophy icon + completed / total
 * + optional progress bar). Never displays unimplemented star or score totals.
 */
export class CampaignProgressSummary extends Phaser.GameObjects.Container {
  private theme: GameTheme;
  private pillWidth: number;
  private pillHeight: number;
  private showBar: boolean;

  private completed = 0;
  private total = 1;
  private earnedStars = 0;
  private maxStars = 0;
  private isComplete = false;

  private readonly surfaceGraphics: Phaser.GameObjects.Graphics;
  private readonly iconGraphics: Phaser.GameObjects.Graphics;
  private readonly countText: Phaser.GameObjects.Text;
  private readonly progressBar: ProgressBar;

  public constructor(scene: Phaser.Scene, config: CampaignProgressSummaryConfig = {}) {
    super(scene, config.x ?? 0, config.y ?? 0);

    this.theme = config.theme ?? DefaultGameTheme;
    this.pillWidth = Math.max(96, config.width ?? 180);
    this.pillHeight = Math.max(40, config.height ?? 46);
    this.showBar = config.showBar ?? true;

    this.surfaceGraphics = scene.add.graphics();
    this.iconGraphics = scene.add.graphics();

    this.countText = scene.add
      .text(
        0,
        0,
        '0 / 50',
        createTextStyle(Typography.LabelMedium, {
          color: Colors.Text.Primary,
        }),
      )
      .setOrigin(0, 0.5);

    this.progressBar = new ProgressBar(scene, {
      x: 0,
      y: 0,
      width: 68,
      height: 8,
      value: 0,
      max: 1,
      fillColor: Colors.Brand.Primary,
      trackColor: Colors.Surface.Background,
      theme: this.theme,
    });

    this.add([this.surfaceGraphics, this.iconGraphics, this.countText, this.progressBar]);
    this.setSize(this.pillWidth, this.pillHeight);
    this.redraw();

    scene.add.existing(this);
  }

  public setProgress(
    completed: number,
    total: number,
    isComplete: boolean,
    animate = false,
    earnedStars?: number,
    maxStars?: number,
  ): this {
    this.completed = Math.max(0, completed);
    this.total = Math.max(1, total);
    this.isComplete = isComplete;
    if (earnedStars !== undefined) {
      this.earnedStars = Math.max(0, earnedStars);
    }
    if (maxStars !== undefined) {
      this.maxStars = Math.max(0, maxStars);
    }
    this.countText.setColor(isComplete ? Colors.Semantic.Success : Colors.Text.Primary);
    this.progressBar.setFillColor(isComplete ? Colors.Semantic.Success : Colors.Brand.Primary);
    this.progressBar.setProgress(this.completed, this.total, animate);
    this.redraw();
    return this;
  }

  public setLayoutSize(width: number, height: number, showBar: boolean): this {
    this.pillWidth = Math.max(92, Math.round(width));
    this.pillHeight = Math.max(38, Math.round(height));
    this.showBar = showBar;
    this.setSize(this.pillWidth, this.pillHeight);
    this.redraw();
    return this;
  }

  public setTheme(theme: GameTheme): this {
    this.theme = theme;
    this.progressBar.setTheme(theme);
    return this;
  }

  private redraw(): void {
    const borderColor = this.isComplete ? Colors.Semantic.Success : Colors.Surface.Border;
    drawElevatedSurface(this.surfaceGraphics, {
      width: this.pillWidth,
      height: this.pillHeight,
      radius: Shapes.Rounded,
      fillColor: Colors.Surface.Surface,
      borderColor,
      borderWidth: this.isComplete ? Dimens.BorderMedium : Dimens.BorderThin,
      elevation: 'low',
    });

    const leftX = -this.pillWidth / 2 + Dimens.Space20;
    const iconColor = this.isComplete ? Colors.Semantic.Success : Colors.Brand.Secondary;

    this.iconGraphics.clear();
    drawIcon(this.iconGraphics, 'trophy', leftX, 0, 18, iconColor);

    const showStarsText = this.maxStars > 0 && this.pillWidth >= 142;
    const baseText = `${String(this.completed)}/${String(this.total)}`;
    this.countText.setText(showStarsText ? `${baseText}  ★ ${String(this.earnedStars)}` : baseText);
    this.countText.setPosition(leftX + 16, 0);

    const textRightEdge = leftX + 16 + this.countText.width;
    const availableForBar = this.pillWidth / 2 - Dimens.Space16 - textRightEdge - Dimens.Space10;

    if (this.showBar && availableForBar >= 40) {
      const barW = Math.min(68, Math.floor(availableForBar));
      this.progressBar.setVisible(true);
      this.progressBar.setBarSize(barW, 8);
      this.progressBar.setPosition(this.pillWidth / 2 - Dimens.Space16 - barW / 2, 0);
    } else {
      this.progressBar.setVisible(false);
    }
  }
}
