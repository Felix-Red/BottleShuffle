import Phaser from 'phaser';
import { getChapterVisualTheme, LEVEL_SELECTION_COPY } from '../../../config/ChapterVisualConfig';
import {
  Colors,
  createTextStyle,
  Dimens,
  drawIcon,
  hexToNumber,
  Typography,
} from '../../../design-system';
import type { RectBounds } from '../../layout/LevelSelectionLayout';
import type { ChapterViewState } from '../../levels/ChapterViewState';

/**
 * Displays the active chapter's number badge, title, difficulty label, bottle count,
 * and subtle locked/completed indicator tinted with the chapter's visual accent.
 */
export class ChapterBanner extends Phaser.GameObjects.Container {
  private bannerWidth = 320;
  private bannerHeight = 84;
  private accentHex: string = Colors.Brand.Primary;
  private isLocked = false;
  private isCompleted = false;

  private readonly pillGraphics: Phaser.GameObjects.Graphics;
  private readonly statusIconGraphics: Phaser.GameObjects.Graphics;
  private readonly chapterTagText: Phaser.GameObjects.Text;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly metaText: Phaser.GameObjects.Text;

  public constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);

    this.pillGraphics = scene.add.graphics();
    this.statusIconGraphics = scene.add.graphics();

    this.chapterTagText = scene.add
      .text(
        0,
        0,
        'CHAPTER 1',
        createTextStyle(Typography.LabelSmall, {
          color: Colors.Text.OnPrimary,
          scale: 0.82,
          minFontSize: 11,
        }),
      )
      .setOrigin(0.5);

    this.titleText = scene.add
      .text(
        0,
        0,
        'First Steps',
        createTextStyle(Typography.HeadlineSmall, {
          color: Colors.Text.Primary,
          align: 'center',
        }),
      )
      .setOrigin(0.5);

    this.metaText = scene.add
      .text(
        0,
        0,
        'Beginner  ·  3 Bottles',
        createTextStyle(Typography.BodySmall, {
          color: Colors.Text.Secondary,
          align: 'center',
        }),
      )
      .setOrigin(0.5);

    this.add([
      this.pillGraphics,
      this.statusIconGraphics,
      this.chapterTagText,
      this.titleText,
      this.metaText,
    ]);

    scene.add.existing(this);
  }

  public applyBounds(bounds: RectBounds): this {
    this.bannerWidth = Math.max(180, bounds.width);
    this.bannerHeight = Math.max(54, bounds.height);
    this.setPosition(
      Math.round(bounds.x + bounds.width / 2),
      Math.round(bounds.y + bounds.height / 2),
    );
    this.layoutContent();
    return this;
  }

  public setChapter(chapter: ChapterViewState): this {
    const visual = getChapterVisualTheme(
      chapter.chapterId,
      chapter.bottleCount,
      chapter.chapterNumber,
    );
    this.accentHex = visual.accentHex;
    this.isLocked = chapter.isLocked;
    this.isCompleted = chapter.isCompleted;

    this.chapterTagText.setText(`CHAPTER ${String(chapter.chapterNumber)}`);
    this.titleText.setText(chapter.displayName);

    const statusSuffix = chapter.isLocked ? `  ·  ${LEVEL_SELECTION_COPY.lockedChapterLabel}` : '';
    this.metaText.setText(
      `${chapter.challengeModeLabel}  ·  ${chapter.bottleRangeLabel}${statusSuffix}`,
    );

    this.layoutContent();
    return this;
  }

  private layoutContent(): void {
    const compact = this.bannerHeight <= 68;
    const tagY = compact ? -20 : -28;
    const titleY = compact ? 1 : 0;
    const metaY = compact ? 22 : 29;

    this.chapterTagText.setPosition(0, tagY);
    this.chapterTagText.setScale(compact ? 0.9 : 1);

    const tagPadX = 12;
    const tagW = Math.max(88, Math.round(this.chapterTagText.width + tagPadX * 2));
    const tagH = compact ? 20 : 22;

    this.pillGraphics.clear();
    this.pillGraphics.fillStyle(hexToNumber(this.accentHex), this.isLocked ? 0.25 : 0.3);
    this.pillGraphics.fillRoundedRect(-tagW / 2, tagY - tagH / 2, tagW, tagH, tagH / 2);
    this.pillGraphics.lineStyle(
      Dimens.BorderThin,
      hexToNumber(this.accentHex),
      this.isLocked ? 0.5 : 0.9,
    );
    this.pillGraphics.strokeRoundedRect(-tagW / 2, tagY - tagH / 2, tagW, tagH, tagH / 2);

    this.titleText.setPosition(0, titleY);
    this.titleText.setScale(compact ? 0.84 : 1);
    const maxTitleW = this.bannerWidth - 36;
    if (this.titleText.width * this.titleText.scaleX > maxTitleW) {
      this.titleText.setScale(maxTitleW / Math.max(1, this.titleText.width));
    }

    this.metaText.setPosition(0, metaY);
    this.metaText.setScale(compact ? 0.88 : 1);

    this.statusIconGraphics.clear();
    if (this.isCompleted) {
      const iconX = Math.round(tagW / 2 + 12);
      drawIcon(this.statusIconGraphics, 'check', iconX, tagY, 13, Colors.Semantic.Success);
    } else if (this.isLocked) {
      const iconX = Math.round(tagW / 2 + 12);
      drawIcon(this.statusIconGraphics, 'lock', iconX, tagY, 13, Colors.Text.Disabled, 0.85);
    }
  }
}
