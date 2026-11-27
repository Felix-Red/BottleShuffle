import Phaser from 'phaser';
import { LEVEL_SELECTION_COPY } from '../../../config/ChapterVisualConfig';
import {
  Colors,
  createTextStyle,
  DefaultGameTheme,
  IconButton,
  Typography,
  type GameTheme,
} from '../../../design-system';
import type { LevelSelectionLayout } from '../../layout/LevelSelectionLayout';
import { CampaignProgressSummary } from './CampaignProgressSummary';

export interface LevelSelectionHeaderConfig {
  readonly theme?: GameTheme;
  readonly onBack: () => void;
}

/**
 * Top bar for LevelSelectionScene composing Back button, Select Level title,
 * and live aggregate CampaignProgressSummary.
 */
export class LevelSelectionHeader extends Phaser.GameObjects.Container {
  private readonly backButton: IconButton;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly progressSummary: CampaignProgressSummary;

  public constructor(scene: Phaser.Scene, config: LevelSelectionHeaderConfig) {
    super(scene, 0, 0);

    const theme = config.theme ?? DefaultGameTheme;

    this.backButton = new IconButton(scene, {
      icon: 'back',
      variant: 'surface',
      theme,
      onClick: config.onBack,
    });

    this.titleText = scene.add
      .text(
        0,
        0,
        LEVEL_SELECTION_COPY.screenTitle,
        createTextStyle(Typography.HeadlineSmall, {
          color: Colors.Text.Primary,
        }),
      )
      .setOrigin(0, 0.5);

    this.progressSummary = new CampaignProgressSummary(scene, { theme });

    this.add([this.backButton, this.titleText, this.progressSummary]);
    scene.add.existing(this);
  }

  public applyLayout(layout: LevelSelectionLayout): this {
    const { header, isCompact } = layout;

    this.backButton.setPosition(header.backX, header.backY);

    this.titleText.setOrigin(0, 0.5);
    this.titleText.setScale(isCompact ? 0.82 : layout.orientation === 'portrait' ? 0.9 : 1);
    this.titleText.setPosition(header.titleX, header.titleY);

    this.progressSummary.setLayoutSize(
      header.summaryWidth,
      isCompact ? 38 : 44,
      header.showSummaryBar,
    );
    this.progressSummary.setPosition(header.summaryX, header.summaryY);
    return this;
  }

  public setCampaignProgress(
    completed: number,
    total: number,
    isComplete: boolean,
    animate = false,
    earnedStars?: number,
    maxStars?: number,
  ): this {
    this.progressSummary.setProgress(completed, total, isComplete, animate, earnedStars, maxStars);
    return this;
  }

  public setBackEnabled(enabled: boolean): this {
    this.backButton.setEnabled(enabled);
    return this;
  }

  public setTheme(theme: GameTheme): this {
    this.backButton.setTheme(theme);
    this.progressSummary.setTheme(theme);
    return this;
  }
}
