import Phaser from 'phaser';
import { HOME_CONFIG } from '../../../config/HomeConfig';
import {
  Colors,
  createTextStyle,
  DefaultGameTheme,
  Dimens,
  drawElevatedSurface,
  drawIcon,
  ProgressBar,
  SemanticShapes,
  Typography,
  type GameTheme,
} from '../../../design-system';
import type { HomeViewState } from '../../home/HomeViewState';

export interface CampaignProgressCardConfig {
  readonly x?: number;
  readonly y?: number;
  readonly width?: number;
  readonly height?: number;
  readonly theme?: GameTheme;
  readonly onSelect?: () => void;
}

/**
 * Reusable campaign progress indicator card rendered on the production Home screen.
 * Displays completed/total counts, animated ProgressBar, and recommended chapter metadata
 * derived strictly from HomeViewState (zero internal progression calculation).
 */
export class CampaignProgressCard extends Phaser.GameObjects.Container {
  private theme: GameTheme;
  private cardWidth: number;
  private cardHeight: number;
  private hovered = false;
  private isComplete = false;
  private completedCount = 0;
  private totalCount = 1;
  private readonly onSelectCallback?: () => void;

  private readonly surfaceGraphics: Phaser.GameObjects.Graphics;
  private readonly badgeGraphics: Phaser.GameObjects.Graphics;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly countText: Phaser.GameObjects.Text;
  private readonly chapterText: Phaser.GameObjects.Text;
  private readonly starText: Phaser.GameObjects.Text;
  private readonly progressBar: ProgressBar;
  private readonly hitZone?: Phaser.GameObjects.Zone;

  public constructor(scene: Phaser.Scene, config: CampaignProgressCardConfig = {}) {
    super(scene, config.x ?? 0, config.y ?? 0);

    this.theme = config.theme ?? DefaultGameTheme;
    this.cardWidth = Math.max(240, config.width ?? 380);
    this.cardHeight = Math.max(76, config.height ?? 96);
    this.onSelectCallback = config.onSelect;

    this.surfaceGraphics = scene.add.graphics();
    this.badgeGraphics = scene.add.graphics();

    this.titleText = scene.add
      .text(
        0,
        0,
        HOME_CONFIG.copy.campaignProgressTitle,
        createTextStyle(Typography.LabelSmall, {
          color: Colors.Text.Secondary,
        }),
      )
      .setOrigin(0, 0.5);

    this.countText = scene.add
      .text(
        0,
        0,
        '0 / 0',
        createTextStyle(Typography.LabelLarge, {
          color: Colors.Text.Primary,
          align: 'right',
        }),
      )
      .setOrigin(1, 0.5);

    this.progressBar = new ProgressBar(scene, {
      x: 0,
      y: 2,
      width: this.cardWidth - Dimens.Space32,
      height: Dimens.ProgressBarHeight,
      value: 0,
      max: 1,
      variant: 'continuous',
      fillColor: Colors.Brand.Primary,
      trackColor: Colors.Surface.Background,
      borderColor: Colors.Surface.Border,
      theme: this.theme,
    });

    this.chapterText = scene.add
      .text(
        0,
        0,
        '',
        createTextStyle(Typography.LabelSmall, {
          color: Colors.Text.Secondary,
        }),
      )
      .setOrigin(0, 0.5);

    this.starText = scene.add
      .text(
        0,
        0,
        '',
        createTextStyle(Typography.LabelSmall, {
          color: Colors.Brand.Secondary,
          align: 'right',
        }),
      )
      .setOrigin(1, 0.5);

    this.add([
      this.surfaceGraphics,
      this.badgeGraphics,
      this.titleText,
      this.countText,
      this.progressBar,
      this.chapterText,
      this.starText,
    ]);

    if (this.onSelectCallback !== undefined) {
      this.hitZone = scene.add.zone(0, 0, this.cardWidth, this.cardHeight).setOrigin(0.5);
      this.hitZone.setInteractive({ useHandCursor: true });
      this.hitZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, this.handleOver);
      this.hitZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, this.handleOut);
      this.hitZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, this.handleUp);
      this.add(this.hitZone);
    }

    this.setSize(this.cardWidth, this.cardHeight);
    this.redraw();

    scene.add.existing(this);
  }

  public setCardSize(width: number, height: number): this {
    this.cardWidth = Math.max(240, width);
    this.cardHeight = Math.max(76, height);
    this.setSize(this.cardWidth, this.cardHeight);
    this.progressBar.setBarSize(this.cardWidth - Dimens.Space32, Dimens.ProgressBarHeight);
    this.hitZone?.setSize(this.cardWidth, this.cardHeight);
    this.redraw();
    return this;
  }

  public applyViewState(viewState: HomeViewState, animateProgress = false): this {
    this.isComplete = viewState.isCampaignComplete;
    this.completedCount = viewState.completedLevelCount;
    this.totalCount = Math.max(1, viewState.totalLevelCount);

    this.countText.setText(
      `${String(viewState.completedLevelCount)} / ${String(viewState.totalLevelCount)}`,
    );

    const chapterCaption = viewState.isCampaignComplete
      ? HOME_CONFIG.copy.campaignCompletedLabel
      : viewState.recommendedChapterOrder !== null
        ? `Chapter ${String(viewState.recommendedChapterOrder)} · ${viewState.recommendedChapterName}`
        : viewState.recommendedChapterName;

    this.chapterText.setText(chapterCaption);
    this.starText.setText(
      `★ ${String(viewState.totalEarnedStars)} / ${String(viewState.maxAvailableStars)}`,
    );
    this.progressBar.setFillColor(this.isComplete ? Colors.Semantic.Success : Colors.Brand.Primary);
    this.progressBar.setProgress(
      this.completedCount,
      this.totalCount,
      animateProgress && !this.theme.reducedMotion,
    );
    this.redraw();
    return this;
  }

  public setTheme(theme: GameTheme): this {
    this.theme = theme;
    this.progressBar.setTheme(theme);
    this.redraw();
    return this;
  }

  private readonly handleOver = (): void => {
    this.hovered = true;
    this.redraw();
  };

  private readonly handleOut = (): void => {
    this.hovered = false;
    this.redraw();
  };

  private readonly handleUp = (): void => {
    this.onSelectCallback?.();
  };

  private redraw(): void {
    const borderColor = this.isComplete
      ? Colors.Semantic.Success
      : this.hovered
        ? Colors.Brand.PrimaryLight
        : Colors.Surface.Border;

    drawElevatedSurface(this.surfaceGraphics, {
      width: this.cardWidth,
      height: this.cardHeight,
      radius: SemanticShapes.Card,
      fillColor: Colors.Surface.Surface,
      borderColor,
      borderWidth: this.isComplete || this.hovered ? Dimens.BorderMedium : Dimens.BorderThin,
      elevation: 'low',
    });

    const leftX = -this.cardWidth / 2 + Dimens.Space16;
    const rightX = this.cardWidth / 2 - Dimens.Space16;
    const topY = -this.cardHeight / 2 + (this.cardHeight < 84 ? 18 : 22);
    const barY = this.cardHeight < 84 ? 1 : 3;
    const bottomY = this.cardHeight / 2 - (this.cardHeight < 84 ? 16 : 20);

    this.badgeGraphics.clear();
    if (this.isComplete) {
      drawIcon(this.badgeGraphics, 'check', leftX + 8, topY, 16, Colors.Semantic.Success);
      this.titleText.setPosition(leftX + 22, topY);
      this.titleText.setColor(Colors.Semantic.Success);
      this.countText.setColor(Colors.Semantic.Success);
      this.chapterText.setColor(Colors.Semantic.Success);
    } else {
      this.titleText.setPosition(leftX, topY);
      this.titleText.setColor(Colors.Text.Secondary);
      this.countText.setColor(Colors.Text.Primary);
      this.chapterText.setColor(Colors.Text.Secondary);
    }

    this.countText.setPosition(rightX, topY);
    this.progressBar.setPosition(0, barY);
    this.chapterText.setPosition(leftX, bottomY);
    this.starText.setPosition(rightX, bottomY);
  }

  public override destroy(fromScene?: boolean): void {
    this.hitZone?.removeAllListeners();
    super.destroy(fromScene);
  }
}
