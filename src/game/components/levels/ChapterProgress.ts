import Phaser from 'phaser';
import { getChapterVisualTheme, LEVEL_SELECTION_COPY } from '../../../config/ChapterVisualConfig';
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
import type { RectBounds } from '../../layout/LevelSelectionLayout';
import type { ChapterViewState } from '../../levels/ChapterViewState';

/**
 * Displays completion progress for the currently viewed chapter using the shared
 * ProgressBar component and restrained chapter-complete success styling.
 */
export class ChapterProgress extends Phaser.GameObjects.Container {
  private theme: GameTheme;
  private cardWidth = 320;
  private cardHeight = 68;
  private isCompleted = false;
  private accentHex: string = Colors.Brand.Primary;
  private currentChapter?: ChapterViewState;

  private readonly surfaceGraphics: Phaser.GameObjects.Graphics;
  private readonly iconGraphics: Phaser.GameObjects.Graphics;
  private readonly labelText: Phaser.GameObjects.Text;
  private readonly countText: Phaser.GameObjects.Text;
  private readonly progressBar: ProgressBar;

  public constructor(scene: Phaser.Scene, theme: GameTheme = DefaultGameTheme) {
    super(scene, 0, 0);
    this.theme = theme;

    this.surfaceGraphics = scene.add.graphics();
    this.iconGraphics = scene.add.graphics();

    this.labelText = scene.add
      .text(
        0,
        0,
        LEVEL_SELECTION_COPY.chapterProgressLabel,
        createTextStyle(Typography.LabelSmall, {
          color: Colors.Text.Secondary,
          scale: 0.86,
        }),
      )
      .setOrigin(0, 0.5);

    this.countText = scene.add
      .text(
        0,
        0,
        '0 / 5',
        createTextStyle(Typography.LabelMedium, {
          color: Colors.Text.Primary,
          align: 'right',
        }),
      )
      .setOrigin(1, 0.5);

    this.progressBar = new ProgressBar(scene, {
      x: 0,
      y: 12,
      width: 280,
      height: 10,
      value: 0,
      max: 1,
      fillColor: Colors.Brand.Primary,
      trackColor: Colors.Surface.Background,
      theme: this.theme,
    });

    this.add([
      this.surfaceGraphics,
      this.iconGraphics,
      this.labelText,
      this.countText,
      this.progressBar,
    ]);

    scene.add.existing(this);
  }

  public applyBounds(bounds: RectBounds): this {
    this.cardWidth = Math.max(180, bounds.width);
    this.cardHeight = Math.max(48, bounds.height);
    this.setPosition(
      Math.round(bounds.x + bounds.width / 2),
      Math.round(bounds.y + bounds.height / 2),
    );
    this.redraw();
    return this;
  }

  public setChapter(chapter: ChapterViewState, animate = false): this {
    const visual = getChapterVisualTheme(
      chapter.chapterId,
      chapter.bottleCount,
      chapter.chapterNumber,
    );
    this.isCompleted = chapter.isCompleted;
    this.accentHex = visual.accentHex;
    this.currentChapter = chapter;

    this.progressBar.setFillColor(chapter.isCompleted ? Colors.Semantic.Success : visual.accentHex);
    this.progressBar.setProgress(chapter.completedLevels, chapter.totalLevels, animate);
    this.redraw();
    return this;
  }

  public setTheme(theme: GameTheme): this {
    this.theme = theme;
    this.progressBar.setTheme(theme);
    return this;
  }

  private redraw(): void {
    const narrow = this.cardWidth < 250;
    const padX = narrow ? Dimens.Space10 : Dimens.Space16;
    const compact = this.cardHeight <= 56;
    const topY = compact ? -11 : -14;
    const barY = compact ? 11 : 14;

    if (this.currentChapter !== undefined) {
      const ch = this.currentChapter;
      this.labelText.setText(
        ch.isCompleted
          ? narrow
            ? 'COMPLETE'
            : LEVEL_SELECTION_COPY.chapterCompleteLabel.toUpperCase()
          : narrow
            ? 'PROGRESS'
            : LEVEL_SELECTION_COPY.chapterProgressLabel,
      );
      this.labelText.setStyle(
        createTextStyle(Typography.LabelSmall, {
          color: ch.isCompleted ? Colors.Semantic.Success : Colors.Text.Secondary,
          scale: narrow ? 0.78 : 0.86,
        }),
      );

      const starSuffix =
        ch.maxStars > 0
          ? narrow
            ? ` ★${String(ch.earnedStars)}/${String(ch.maxStars)}`
            : `  ·  ★ ${String(ch.earnedStars)}/${String(ch.maxStars)}`
          : '';
      this.countText.setText(
        narrow
          ? `${String(ch.completedLevels)}/${String(ch.totalLevels)}${starSuffix}`
          : `${String(ch.completedLevels)} / ${String(ch.totalLevels)}${starSuffix}`,
      );
      this.countText.setStyle(
        createTextStyle(Typography.LabelMedium, {
          color: ch.isCompleted ? Colors.Semantic.Success : Colors.Text.Primary,
          align: 'right',
          scale: narrow ? 0.82 : 1,
        }),
      );
    }

    drawElevatedSurface(this.surfaceGraphics, {
      width: this.cardWidth,
      height: this.cardHeight,
      radius: SemanticShapes.Card,
      fillColor: Colors.Surface.Surface,
      borderColor: this.isCompleted ? Colors.Semantic.Success : Colors.Surface.Border,
      borderWidth: this.isCompleted ? Dimens.BorderMedium : Dimens.BorderThin,
      elevation: 'low',
    });

    this.iconGraphics.clear();
    let labelLeft = -this.cardWidth / 2 + padX;
    if (this.isCompleted) {
      drawIcon(this.iconGraphics, 'check', labelLeft + 6, topY, 13, Colors.Semantic.Success);
      labelLeft += 18;
    }

    this.labelText.setPosition(labelLeft, topY);
    this.countText.setPosition(this.cardWidth / 2 - padX, topY);

    const barW = Math.max(80, this.cardWidth - padX * 2);
    this.progressBar.setBarSize(barW, compact ? 9 : 11);
    this.progressBar.setPosition(0, barY);
    this.progressBar.setFillColor(this.isCompleted ? Colors.Semantic.Success : this.accentHex);
  }
}
