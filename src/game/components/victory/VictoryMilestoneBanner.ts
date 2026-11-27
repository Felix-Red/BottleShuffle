import Phaser from 'phaser';
import { VICTORY_CONFIG } from '../../../config/VictoryConfig';
import {
  Colors,
  createTextStyle,
  Dimens,
  drawIcon,
  hexToNumber,
  Shapes,
  Typography,
} from '../../../design-system';
import type {
  VictoryCampaignCompletionInfo,
  VictoryChapterCompletionInfo,
  VictoryLevelUnlockInfo,
} from '../../victory/VictoryViewState';

export interface VictoryMilestoneData {
  readonly unlockedLevel: VictoryLevelUnlockInfo | null;
  readonly chapterCompletion: VictoryChapterCompletionInfo | null;
  readonly campaignCompletion: VictoryCampaignCompletionInfo | null;
}

/**
 * Renders the single highest-priority progression milestone on the Victory screen:
 *   1. Campaign Completion Panel (Shuffle Master! + full summary + optional Perfect Campaign)
 *   2. Chapter Completion Banner (Chapter stars + next chapter preview)
 *   3. Level Unlock Banner (Next level unlocked)
 * Prevents overlapping or competing banners.
 */
export class VictoryMilestoneBanner extends Phaser.GameObjects.Container {
  private boxWidth = 440;
  private boxHeight = 60;
  private dataModel: VictoryMilestoneData = {
    unlockedLevel: null,
    chapterCompletion: null,
    campaignCompletion: null,
  };

  private readonly bgGraphics: Phaser.GameObjects.Graphics;
  private readonly iconGraphics: Phaser.GameObjects.Graphics;
  private readonly headingText: Phaser.GameObjects.Text;
  private readonly subtitleText: Phaser.GameObjects.Text;
  private readonly badgeText: Phaser.GameObjects.Text;

  public constructor(scene: Phaser.Scene, x = 0, y = 0) {
    super(scene, x, y);

    this.bgGraphics = scene.add.graphics();
    this.iconGraphics = scene.add.graphics();

    this.headingText = scene.add
      .text(
        0,
        0,
        '',
        createTextStyle(Typography.LabelMedium, {
          color: Colors.Text.Primary,
          align: 'center',
        }),
      )
      .setOrigin(0.5);

    this.subtitleText = scene.add
      .text(
        0,
        0,
        '',
        createTextStyle(Typography.BodySmall, {
          color: Colors.Text.Secondary,
          align: 'center',
          scale: 0.9,
          minFontSize: 11,
        }),
      )
      .setOrigin(0.5);

    this.badgeText = scene.add
      .text(
        0,
        0,
        '',
        createTextStyle(Typography.LabelSmall, {
          color: Colors.Brand.Secondary,
          align: 'center',
          scale: 0.84,
          minFontSize: 10,
        }),
      )
      .setOrigin(0.5);

    this.add([
      this.bgGraphics,
      this.iconGraphics,
      this.headingText,
      this.subtitleText,
      this.badgeText,
    ]);
    this.setVisible(false);
    scene.add.existing(this);
  }

  public setMilestone(data: VictoryMilestoneData): this {
    this.dataModel = data;
    this.renderVisuals();
    return this;
  }

  public setDimensions(width: number, height: number): this {
    this.boxWidth = Math.max(180, Math.round(width));
    this.boxHeight = Math.max(44, Math.round(height));
    this.renderVisuals();
    return this;
  }

  private renderVisuals(): void {
    this.bgGraphics.clear();
    this.iconGraphics.clear();
    this.badgeText.setVisible(false);

    const { campaignCompletion, chapterCompletion, unlockedLevel } = this.dataModel;

    if (campaignCompletion !== null) {
      this.renderCampaignCompletion(campaignCompletion);
      return;
    }

    if (chapterCompletion !== null) {
      this.renderChapterCompletion(chapterCompletion);
      return;
    }

    if (unlockedLevel !== null) {
      this.renderLevelUnlock(unlockedLevel);
      return;
    }

    this.setVisible(false);
  }

  private renderCampaignCompletion(info: VictoryCampaignCompletionInfo): void {
    this.setVisible(true);
    const halfW = this.boxWidth / 2;
    const halfH = this.boxHeight / 2;
    const isTight = this.boxHeight < 78;

    this.bgGraphics.fillStyle(hexToNumber(Colors.Brand.Secondary), 0.14);
    this.bgGraphics.fillRoundedRect(-halfW, -halfH, this.boxWidth, this.boxHeight, Shapes.Medium);
    this.bgGraphics.lineStyle(1.8, hexToNumber(Colors.Brand.Secondary), 0.85);
    this.bgGraphics.strokeRoundedRect(-halfW, -halfH, this.boxWidth, this.boxHeight, Shapes.Medium);

    const headingLine = info.isPerfectCampaign
      ? `${VICTORY_CONFIG.copy.perfectCampaignBadge}  •  ${String(info.completedLevels)}/${String(info.totalLevels)} Levels`
      : `All ${String(info.completedLevels)}/${String(info.totalLevels)} Campaign Levels Solved!`;

    const summaryLine = `★ ${String(info.totalEarnedStars)}/${String(info.maxAvailableStars)}  •  Score ${info.formattedTotalBestScore}  •  3★ ${String(info.threeStarCount)}/${String(info.totalLevels)}`;

    this.headingText.setColor(Colors.Brand.Secondary);
    this.headingText.setStyle(
      createTextStyle(Typography.LabelMedium, {
        color: Colors.Brand.Secondary,
        align: 'center',
        scale: isTight ? 0.86 : 0.96,
        minFontSize: 12,
        wordWrapWidth: this.boxWidth - Dimens.Space24,
      }),
    );
    this.headingText.setText(headingLine);
    this.headingText.setPosition(0, isTight ? -11 : -16);

    this.subtitleText.setColor(Colors.Text.Primary);
    this.subtitleText.setStyle(
      createTextStyle(Typography.BodySmall, {
        color: Colors.Text.Primary,
        align: 'center',
        scale: isTight ? 0.82 : 0.92,
        minFontSize: 11,
        wordWrapWidth: this.boxWidth - Dimens.Space20,
      }),
    );
    this.subtitleText.setText(summaryLine);
    this.subtitleText.setPosition(0, isTight ? 11 : 12);
    this.subtitleText.setVisible(true);

    if (!isTight && !info.isPerfectCampaign) {
      this.badgeText.setVisible(true);
      this.badgeText.setColor(Colors.Text.Secondary);
      this.badgeText.setText(VICTORY_CONFIG.copy.campaignCompleteMessage);
      this.badgeText.setPosition(0, 32);
    }
  }

  private renderChapterCompletion(info: VictoryChapterCompletionInfo): void {
    this.setVisible(true);
    const halfW = this.boxWidth / 2;
    const halfH = this.boxHeight / 2;
    const isTight = this.boxHeight < 56;

    this.bgGraphics.fillStyle(hexToNumber(Colors.Brand.Primary), 0.18);
    this.bgGraphics.fillRoundedRect(-halfW, -halfH, this.boxWidth, this.boxHeight, Shapes.Medium);
    this.bgGraphics.lineStyle(1.5, hexToNumber(Colors.Brand.PrimaryLight), 0.8);
    this.bgGraphics.strokeRoundedRect(-halfW, -halfH, this.boxWidth, this.boxHeight, Shapes.Medium);

    const heading = `${info.chapterName} Complete  •  ★ ${String(info.earnedStars)}/${String(info.maxStars)}`;
    const nextLine =
      info.nextChapterName !== null
        ? info.nextChapterBottleCount !== null
          ? `Unlocked: ${info.nextChapterName} (${String(info.nextChapterBottleCount)} bottles)`
          : `Unlocked: ${info.nextChapterName}`
        : VICTORY_CONFIG.copy.chapterCompleteHeading;

    this.headingText.setStyle(
      createTextStyle(Typography.LabelMedium, {
        color: Colors.Brand.PrimaryLight,
        align: 'center',
        scale: isTight ? 0.86 : 0.94,
        minFontSize: 12,
        wordWrapWidth: this.boxWidth - Dimens.Space24,
      }),
    );
    this.headingText.setText(heading);
    this.headingText.setPosition(0, isTight ? -9 : -11);

    this.subtitleText.setStyle(
      createTextStyle(Typography.BodySmall, {
        color: Colors.Text.Primary,
        align: 'center',
        scale: isTight ? 0.84 : 0.9,
        minFontSize: 11,
        wordWrapWidth: this.boxWidth - Dimens.Space24,
      }),
    );
    this.subtitleText.setText(nextLine);
    this.subtitleText.setPosition(0, isTight ? 9 : 11);
    this.subtitleText.setVisible(true);
  }

  private renderLevelUnlock(info: VictoryLevelUnlockInfo): void {
    this.setVisible(true);
    const halfW = this.boxWidth / 2;
    const halfH = this.boxHeight / 2;

    this.bgGraphics.fillStyle(hexToNumber(Colors.Semantic.Success), 0.14);
    this.bgGraphics.fillRoundedRect(-halfW, -halfH, this.boxWidth, this.boxHeight, Shapes.Medium);
    this.bgGraphics.lineStyle(1.4, hexToNumber(Colors.Semantic.Success), 0.72);
    this.bgGraphics.strokeRoundedRect(-halfW, -halfH, this.boxWidth, this.boxHeight, Shapes.Medium);

    this.headingText.setStyle(
      createTextStyle(Typography.LabelMedium, {
        color: Colors.Semantic.Success,
        align: 'center',
        scale: 0.95,
        minFontSize: 12,
      }),
    );
    this.headingText.setText(info.label);

    const iconSize = 16;
    const gap = Dimens.Space8;
    const totalW = iconSize + gap + this.headingText.width;
    const iconX = -totalW / 2 + iconSize / 2;
    const textX = iconX + iconSize / 2 + gap + this.headingText.width / 2;

    drawIcon(this.iconGraphics, 'sparkles', iconX, 0, iconSize, Colors.Semantic.Success);
    this.headingText.setPosition(Math.round(textX), 0);
    this.subtitleText.setVisible(false);
  }
}
