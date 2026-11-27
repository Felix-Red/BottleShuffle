import Phaser from 'phaser';
import type { ChapterId } from '../../../core';
import { getChapterVisualTheme } from '../../../config/ChapterVisualConfig';
import {
  Colors,
  createTextStyle,
  DefaultGameTheme,
  ensureMinimumTouchTarget,
  hexToNumber,
  IconButton,
  Typography,
  type GameTheme,
} from '../../../design-system';
import type { LevelSelectionLayout } from '../../layout/LevelSelectionLayout';
import type { ChapterViewState } from '../../levels/ChapterViewState';

export interface ChapterNavigationConfig {
  readonly theme?: GameTheme;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
  readonly onSelectChapter: (chapterId: ChapterId) => void;
}

/**
 * Reusable bottom chapter navigation bar with Previous/Next buttons,
 * Chapter K / N indicator, and clickable direct-jump pagination dots.
 * Adapts cleanly to arbitrary chapter counts without hardcoding six chapters.
 */
export class ChapterNavigation extends Phaser.GameObjects.Container {
  private readonly onSelectChapter: (chapterId: ChapterId) => void;

  private readonly prevButton: IconButton;
  private readonly nextButton: IconButton;
  private readonly counterText: Phaser.GameObjects.Text;
  private readonly dotsContainer: Phaser.GameObjects.Container;
  private readonly dotsGraphics: Phaser.GameObjects.Graphics;
  private readonly dotHitZones: Phaser.GameObjects.Zone[] = [];

  private chapters: readonly ChapterViewState[] = [];
  private selectedIndex = 0;
  private canGoPrevious = false;
  private canGoNext = false;
  private controlsEnabled = true;

  private centerX = 640;
  private centerY = 670;
  private dotRadius = 6;
  private dotSpacing = 22;
  private maxPaginationWidth = 360;

  public constructor(scene: Phaser.Scene, config: ChapterNavigationConfig) {
    super(scene, 0, 0);
    const theme = config.theme ?? DefaultGameTheme;
    this.onSelectChapter = config.onSelectChapter;

    this.prevButton = new IconButton(scene, {
      icon: 'back',
      variant: 'surface',
      theme,
      onClick: config.onPrevious,
    });

    this.nextButton = new IconButton(scene, {
      icon: 'next',
      variant: 'surface',
      theme,
      onClick: config.onNext,
    });

    this.counterText = scene.add
      .text(
        0,
        0,
        'Chapter 1 of 6',
        createTextStyle(Typography.LabelSmall, {
          color: Colors.Text.Secondary,
          align: 'center',
          scale: 0.9,
        }),
      )
      .setOrigin(0.5);

    this.dotsContainer = scene.add.container(0, 0);
    this.dotsGraphics = scene.add.graphics();
    this.dotsContainer.add(this.dotsGraphics);

    this.add([this.prevButton, this.nextButton, this.counterText, this.dotsContainer]);
    scene.add.existing(this);
  }

  public applyLayout(layout: LevelSelectionLayout): this {
    const { chapterNav, pagination } = layout;

    this.prevButton.setPosition(chapterNav.prevX, chapterNav.centerY);
    this.nextButton.setPosition(chapterNav.nextX, chapterNav.centerY);

    this.centerX = chapterNav.centerX;
    this.centerY = chapterNav.centerY;
    this.dotRadius = pagination.dotRadius;
    this.dotSpacing = pagination.dotSpacing;
    this.maxPaginationWidth = pagination.maxVisibleWidth;

    this.counterText.setPosition(this.centerX, this.centerY - 12);
    this.dotsContainer.setPosition(this.centerX, this.centerY + 10);

    this.rebuildDots();
    return this;
  }

  public updateNavigation(params: {
    readonly chapters: readonly ChapterViewState[];
    readonly selectedIndex: number;
    readonly canGoPrevious: boolean;
    readonly canGoNext: boolean;
    readonly enabled: boolean;
  }): this {
    this.chapters = params.chapters;
    this.selectedIndex = params.selectedIndex;
    this.canGoPrevious = params.canGoPrevious;
    this.canGoNext = params.canGoNext;
    this.controlsEnabled = params.enabled;

    this.prevButton.setEnabled(this.controlsEnabled && this.canGoPrevious);
    this.nextButton.setEnabled(this.controlsEnabled && this.canGoNext);

    const total = Math.max(1, this.chapters.length);
    this.counterText.setText(
      `Chapter ${String(Math.min(total, this.selectedIndex + 1))} of ${String(total)}`,
    );

    this.rebuildDots();
    return this;
  }

  public setTheme(theme: GameTheme): this {
    this.prevButton.setTheme(theme);
    this.nextButton.setTheme(theme);
    return this;
  }

  private rebuildDots(): void {
    this.dotsGraphics.clear();
    for (const zone of this.dotHitZones) {
      zone.removeAllListeners();
      zone.destroy();
    }
    this.dotHitZones.length = 0;

    const count = this.chapters.length;
    if (count === 0) {
      return;
    }

    // If a future catalogue has many chapters, compress dot spacing gracefully
    const maxSlots = Math.max(
      3,
      Math.floor(this.maxPaginationWidth / Math.max(14, this.dotSpacing)),
    );
    if (count > maxSlots) {
      // Render compact proportional indicator bar when chapters exceed direct-dot capacity
      const barW = Math.min(180, this.maxPaginationWidth - 24);
      const ratio = count > 1 ? this.selectedIndex / (count - 1) : 0;
      this.dotsGraphics.fillStyle(hexToNumber(Colors.Surface.Border), 0.55);
      this.dotsGraphics.fillRoundedRect(-barW / 2, -3, barW, 6, 3);
      const pillW = Math.max(24, barW / count);
      const pillX = -barW / 2 + ratio * (barW - pillW);
      this.dotsGraphics.fillStyle(hexToNumber(Colors.Brand.PrimaryLight), 1);
      this.dotsGraphics.fillRoundedRect(pillX, -4, pillW, 8, 4);
      return;
    }

    const effectiveSpacing = Math.min(
      this.dotSpacing,
      Math.max(16, Math.floor(this.maxPaginationWidth / Math.max(1, count))),
    );
    const spanW = (count - 1) * effectiveSpacing;
    const startX = -spanW / 2;

    this.chapters.forEach((chapter, idx) => {
      const x = Math.round(startX + idx * effectiveSpacing);
      const isSelected = idx === this.selectedIndex;
      const visual = getChapterVisualTheme(
        chapter.chapterId,
        chapter.bottleCount,
        chapter.chapterNumber,
      );

      if (isSelected) {
        const pillW = this.dotRadius * 3.4;
        const pillH = this.dotRadius * 2;
        this.dotsGraphics.fillStyle(hexToNumber(visual.accentHex), 1);
        this.dotsGraphics.fillRoundedRect(x - pillW / 2, -pillH / 2, pillW, pillH, pillH / 2);
      } else if (chapter.isCompleted) {
        this.dotsGraphics.fillStyle(hexToNumber(Colors.Semantic.Success), 0.9);
        this.dotsGraphics.fillCircle(x, 0, this.dotRadius * 0.85);
      } else if (chapter.hasPlayableLevels) {
        this.dotsGraphics.fillStyle(hexToNumber(Colors.Text.Secondary), 0.72);
        this.dotsGraphics.fillCircle(x, 0, this.dotRadius * 0.78);
      } else {
        this.dotsGraphics.fillStyle(hexToNumber(Colors.Surface.Border), 0.65);
        this.dotsGraphics.fillCircle(x, 0, this.dotRadius * 0.68);
      }

      const hitW = Math.min(effectiveSpacing, ensureMinimumTouchTarget(22));
      const zone = this.scene.add.zone(x, 0, Math.max(18, hitW), 32).setOrigin(0.5);
      if (this.controlsEnabled && !isSelected) {
        zone.setInteractive({ useHandCursor: true });
        zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
          this.onSelectChapter(chapter.chapterId);
        });
      }
      this.dotsContainer.add(zone);
      this.dotHitZones.push(zone);
    });
  }

  public override destroy(fromScene?: boolean): void {
    for (const zone of this.dotHitZones) {
      zone.removeAllListeners();
    }
    this.dotHitZones.length = 0;
    super.destroy(fromScene);
  }
}
