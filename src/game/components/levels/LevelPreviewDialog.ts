import type Phaser from 'phaser';
import { getChapterVisualTheme, LEVEL_SELECTION_COPY } from '../../../config/ChapterVisualConfig';
import {
  Colors,
  createTextStyle,
  DefaultGameTheme,
  Dimens,
  drawElevatedSurface,
  drawIcon,
  Modal,
  SemanticShapes,
  StarRating,
  Typography,
  type GameTheme,
} from '../../../design-system';
import { getBottleMetadata } from '../../assets/BottleCatalog';
import type { LevelPreviewViewState } from '../../levels/LevelSelectionViewState';

export interface LevelPreviewDialogConfig {
  readonly theme?: GameTheme;
  readonly onPlay: () => void;
  readonly onClose: () => void;
}

/**
 * Reusable modal previewing an unlocked or completed campaign level before launching.
 * Shows decorative bottle artwork matching the level's bottle count (never the hidden target),
 * difficulty summary, and ONLY actual recorded personal best stats for completed levels.
 */
export class LevelPreviewDialog {
  private readonly scene: Phaser.Scene;
  private theme: GameTheme;
  private readonly onPlay: () => void;
  private readonly onClose: () => void;

  private modal?: Modal;
  private currentPreview: LevelPreviewViewState | null = null;

  public constructor(scene: Phaser.Scene, config: LevelPreviewDialogConfig) {
    this.scene = scene;
    this.theme = config.theme ?? DefaultGameTheme;
    this.onPlay = config.onPlay;
    this.onClose = config.onClose;
  }

  public isOpen(): boolean {
    return this.modal?.isOpen() ?? false;
  }

  public open(preview: LevelPreviewViewState, animate = true): void {
    this.currentPreview = preview;
    this.rebuildModal(preview);
    this.modal?.resize(this.scene.scale.width, this.scene.scale.height);
    this.modal?.open(animate);
  }

  public close(): void {
    this.currentPreview = null;
    if (this.modal?.isOpen() === true) {
      this.modal.close(false);
    }
  }

  public resize(width: number, height: number): void {
    this.modal?.resize(width, height);
  }

  public setTheme(theme: GameTheme): void {
    this.theme = theme;
    this.modal?.setTheme(theme);
  }

  public getCurrentLevelId(): string | null {
    return this.currentPreview?.levelId ?? null;
  }

  public destroy(): void {
    this.modal?.destroy();
    this.modal = undefined;
    this.currentPreview = null;
  }

  private rebuildModal(preview: LevelPreviewViewState): void {
    this.modal?.destroy();

    const content = this.scene.add.container(0, 0);
    const visual = getChapterVisualTheme(
      preview.chapterId,
      preview.bottleCount,
      preview.chapterNumber,
    );

    const hasActualRecords =
      preview.isCompleted && preview.bestMoveCount !== null && preview.formattedBestTime !== null;

    const bottleRowY = hasActualRecords ? -58 : -32;
    const descY = hasActualRecords ? -6 : 24;

    // Decorative bottle preview strip (reuses bundled textures, never real puzzle order)
    const ids = visual.decorativeBottleIds;
    const count = ids.length;
    const maxRowW = 310;
    const baseH = count >= 8 ? 56 : 66;
    const baseW = baseH * 0.5;
    const gap = count >= 8 ? 3 : 6;
    const rawW = count * baseW + Math.max(0, count - 1) * gap;
    const scale = rawW > maxRowW ? maxRowW / rawW : 1;
    const drawW = Math.round(baseW * scale);
    const drawH = Math.round(baseH * scale);
    const drawGap = Math.max(2, Math.round(gap * scale));
    const totalW = count * drawW + Math.max(0, count - 1) * drawGap;
    const startX = -totalW / 2 + drawW / 2;

    ids.forEach((bottleId, idx) => {
      const meta = getBottleMetadata(bottleId);
      if (!this.scene.textures.exists(meta.textureKey)) {
        return;
      }
      const x = Math.round(startX + idx * (drawW + drawGap));
      const img = this.scene.add
        .image(x, bottleRowY, meta.textureKey)
        .setOrigin(0.5, 0.5)
        .setDisplaySize(drawW, drawH);
      content.add(img);
    });

    const descText = this.scene.add
      .text(
        0,
        descY,
        preview.description,
        createTextStyle(Typography.BodySmall, {
          color: Colors.Text.Secondary,
          align: 'center',
          wordWrapWidth: 332,
        }),
      )
      .setOrigin(0.5);
    content.add(descText);

    if (hasActualRecords) {
      const panelW = 344;
      const panelH = 82;
      const panelY = 58;

      const panelGfx = this.scene.add.graphics();
      panelGfx.setPosition(0, panelY);
      drawElevatedSurface(panelGfx, {
        width: panelW,
        height: panelH,
        radius: SemanticShapes.Card,
        fillColor: Colors.Surface.Background,
        borderColor: Colors.Semantic.Success,
        borderWidth: Dimens.BorderThin,
        elevation: 'flat',
      });
      content.add(panelGfx);

      const badgeGfx = this.scene.add.graphics();
      drawIcon(badgeGfx, 'check', -panelW / 2 + 20, panelY - 18, 13, Colors.Semantic.Success);
      content.add(badgeGfx);

      const heading = this.scene.add
        .text(
          -panelW / 2 + 32,
          panelY - 18,
          `${LEVEL_SELECTION_COPY.personalBestHeading}  ·  Cleared ${String(preview.completionCount)}×`,
          createTextStyle(Typography.LabelSmall, {
            color: Colors.Semantic.Success,
            scale: 0.8,
          }),
        )
        .setOrigin(0, 0.5);
      content.add(heading);

      if (preview.bestStarRating !== null) {
        const starRow = new StarRating(this.scene, {
          x: panelW / 2 - 44,
          y: panelY - 18,
          rating: preview.bestStarRating,
          maxStars: 3,
          starSize: 16,
          spacing: 4,
          theme: this.theme,
        });
        content.add(starRow);
      }

      const statsParts: string[] = [];
      if (preview.formattedBestScore !== null) {
        statsParts.push(`Score: ${preview.formattedBestScore}`);
      }
      statsParts.push(`Moves: ${String(preview.bestMoveCount)}`);
      statsParts.push(`Time: ${preview.formattedBestTime}`);

      const statsLine = this.scene.add
        .text(
          0,
          panelY + 16,
          statsParts.join('  ·  '),
          createTextStyle(Typography.LabelMedium, {
            color: Colors.Text.Primary,
            align: 'center',
            scale: 0.9,
          }),
        )
        .setOrigin(0.5);
      content.add(statsLine);
    }

    const subtitle = `${preview.chapterName}  ·  ${preview.difficultyDisplayName} · ${String(preview.bottleCount)} Bottles`;

    this.modal = new Modal(this.scene, {
      title: `Level ${String(preview.levelNumber)}`,
      message: subtitle,
      content,
      contentHeight: hasActualRecords ? 196 : 120,
      width: 430,
      dismissible: true,
      theme: this.theme,
      primaryAction: {
        label: preview.primaryActionLabel,
        closeOnClick: false,
        onClick: () => {
          this.onPlay();
        },
      },
      secondaryAction: {
        label: LEVEL_SELECTION_COPY.closeButton,
        closeOnClick: false,
        onClick: () => {
          this.onClose();
        },
      },
      onDismiss: () => {
        this.onClose();
      },
    });
  }
}
