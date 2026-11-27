import type Phaser from 'phaser';
import { VICTORY_CONFIG } from '../../../config/VictoryConfig';
import {
  Colors,
  createTextStyle,
  DefaultGameTheme,
  Dimens,
  drawElevatedSurface,
  hexToNumber,
  MotionEasings,
  OutlineButton,
  PrimaryButton,
  resolveMotionDuration,
  SemanticShapes,
  Shapes,
  StarRating,
  Typography,
  type GameTheme,
} from '../../../design-system';
import { StarRevealAnimator } from '../../animations/victory/StarRevealAnimator';
import { computeVictoryLayout, type VictoryLayoutMetrics } from '../../layout/VictoryLayout';
import type { PartialSafeAreaInsets } from '../../layout/ViewportMetrics';
import type { VictoryViewState } from '../../victory/VictoryViewState';
import { AttemptStatistics } from './AttemptStatistics';
import { PersonalBestIndicator } from './PersonalBestIndicator';
import { ScoreDisplay } from './ScoreDisplay';
import { VictoryMilestoneBanner } from './VictoryMilestoneBanner';

export interface VictoryOverlayCallbacks {
  readonly onPrimaryAction: (viewState: VictoryViewState) => void;
  readonly onReplay: (viewState: VictoryViewState) => void;
  readonly onLevels: (viewState: VictoryViewState) => void;
  readonly onHome: (viewState: VictoryViewState) => void;
  readonly onStarRevealed?: (starIndex: number) => void;
  readonly onReducedMotionStarsPresented?: (earnedStars: number) => void;
}

export interface VictoryOverlayConfig {
  readonly theme?: GameTheme;
  readonly callbacks: VictoryOverlayCallbacks;
}

interface SecondaryActionSpec {
  readonly key: 'replay' | 'levels' | 'home';
  readonly label: string;
  readonly onClick: (viewState: VictoryViewState) => void;
}

/**
 * Production Victory overlay presented over the dimmed completed gameplay board.
 * Coordinates sequential star reveal, score count-up, attempt statistics,
 * personal-best indicator, progression milestones, and immediate navigation actions.
 */
export class VictoryOverlay {
  private readonly scene: Phaser.Scene;
  private theme: GameTheme;
  private readonly callbacks: VictoryOverlayCallbacks;

  private root?: Phaser.GameObjects.Container;
  private scrim?: Phaser.GameObjects.Rectangle;
  private panelContainer?: Phaser.GameObjects.Container;
  private panelGraphics?: Phaser.GameObjects.Graphics;
  private optimalPillGraphics?: Phaser.GameObjects.Graphics;
  private completionLabelText?: Phaser.GameObjects.Text;
  private starRating?: StarRating;
  private starAnimator?: StarRevealAnimator;
  private titleText?: Phaser.GameObjects.Text;
  private optimalBadgeText?: Phaser.GameObjects.Text;
  private scoreDisplay?: ScoreDisplay;
  private personalBestIndicator?: PersonalBestIndicator;
  private attemptStatistics?: AttemptStatistics;
  private milestoneBanner?: VictoryMilestoneBanner;
  private primaryButton?: PrimaryButton;
  private secondaryButtons: OutlineButton[] = [];

  private activeViewState: VictoryViewState | null = null;
  private entranceTween?: Phaser.Tweens.Tween;
  private openState = false;
  private actionDispatched = false;
  private transitionPending = false;

  public constructor(scene: Phaser.Scene, config: VictoryOverlayConfig) {
    this.scene = scene;
    this.theme = config.theme ?? DefaultGameTheme;
    this.callbacks = config.callbacks;
  }

  public isOpen(): boolean {
    return this.openState;
  }

  public open(viewState: VictoryViewState, animate = true): void {
    this.destroyVisuals();
    this.activeViewState = viewState;
    this.openState = true;
    this.actionDispatched = false;
    this.transitionPending = false;

    const width = this.scene.scale.width;
    const height = this.scene.scale.height;

    this.root = this.scene.add.container(0, 0).setDepth(920);

    // Full-screen interactive scrim prevents gameplay board input behind the overlay
    this.scrim = this.scene.add
      .rectangle(
        width / 2,
        height / 2,
        width,
        height,
        hexToNumber(Colors.Surface.Overlay),
        Colors.Surface.OverlayAlpha,
      )
      .setInteractive();
    this.root.add(this.scrim);

    this.panelContainer = this.scene.add.container(width / 2, height / 2);
    this.root.add(this.panelContainer);

    this.panelGraphics = this.scene.add.graphics();
    this.optimalPillGraphics = this.scene.add.graphics();
    this.panelContainer.add([this.panelGraphics, this.optimalPillGraphics]);

    this.completionLabelText = this.scene.add
      .text(
        0,
        0,
        viewState.completionLabel.toUpperCase(),
        createTextStyle(Typography.LabelSmall, {
          color: Colors.Text.Secondary,
          align: 'center',
        }),
      )
      .setOrigin(0.5);

    this.starRating = new StarRating(this.scene, {
      rating: animate && !this.theme.reducedMotion ? 0 : viewState.earnedStars,
      maxStars: 3,
      starSize: 44,
      spacing: 12,
      theme: this.theme,
    });
    this.starAnimator = new StarRevealAnimator(this.scene, this.starRating, this.panelContainer);

    this.titleText = this.scene.add
      .text(
        0,
        0,
        viewState.title,
        createTextStyle(Typography.HeadlineMedium, {
          color:
            viewState.campaignCompletion !== null ? Colors.Brand.Secondary : Colors.Text.Primary,
          align: 'center',
        }),
      )
      .setOrigin(0.5);

    this.optimalBadgeText = this.scene.add
      .text(
        0,
        0,
        VICTORY_CONFIG.copy.optimalBadge,
        createTextStyle(Typography.LabelSmall, {
          color: Colors.Semantic.Success,
          align: 'center',
          scale: 0.88,
          minFontSize: 11,
        }),
      )
      .setOrigin(0.5);
    this.optimalBadgeText.setVisible(viewState.isOptimalSolution);

    this.scoreDisplay = new ScoreDisplay(this.scene, { theme: this.theme });
    this.personalBestIndicator = new PersonalBestIndicator(this.scene);
    this.attemptStatistics = new AttemptStatistics(this.scene);
    this.milestoneBanner = new VictoryMilestoneBanner(this.scene);

    this.primaryButton = new PrimaryButton(this.scene, {
      label: viewState.primaryActionLabel,
      icon: viewState.primaryActionKind === 'next_level' ? 'next' : 'play',
      iconPosition: viewState.primaryActionKind === 'next_level' ? 'right' : 'left',
      theme: this.theme,
      onClick: () => {
        this.dispatchAction(() => {
          this.callbacks.onPrimaryAction(viewState);
        });
      },
    });

    const secondarySpecs = this.buildSecondaryActions(viewState);
    this.secondaryButtons = secondarySpecs.map(
      (spec) =>
        new OutlineButton(this.scene, {
          label: spec.label,
          theme: this.theme,
          onClick: () => {
            this.dispatchAction(() => {
              spec.onClick(viewState);
            });
          },
        }),
    );

    this.panelContainer.add([
      this.completionLabelText,
      this.starRating,
      this.titleText,
      this.optimalBadgeText,
      this.scoreDisplay,
      this.personalBestIndicator,
      this.attemptStatistics,
      this.milestoneBanner,
      this.primaryButton,
      ...this.secondaryButtons,
    ]);

    this.applyContent(viewState);
    this.resize(width, height);

    const effectiveEntranceMs = animate
      ? resolveMotionDuration(VICTORY_CONFIG.motion.overlayEntranceMs, this.theme.reducedMotion)
      : 0;

    if (effectiveEntranceMs > 0) {
      this.scrim.setAlpha(0);
      this.panelContainer.setAlpha(0);
      this.panelContainer.setScale(0.95);

      this.entranceTween = this.scene.tweens.add({
        targets: this.scrim,
        alpha: Colors.Surface.OverlayAlpha,
        duration: effectiveEntranceMs,
        ease: MotionEasings.EaseOut,
      });

      this.scene.tweens.add({
        targets: this.panelContainer,
        alpha: 1,
        scaleX: 1,
        scaleY: 1,
        duration: effectiveEntranceMs,
        ease: MotionEasings.EaseOut,
      });

      this.starAnimator.play(viewState.earnedStars, {
        reducedMotion: this.theme.reducedMotion,
        ...(this.callbacks.onStarRevealed !== undefined
          ? { onStarRevealed: this.callbacks.onStarRevealed }
          : {}),
      });
      this.scoreDisplay.revealScore(viewState.totalScore, true);
    } else {
      this.starRating.setRating(viewState.earnedStars, false);
      this.scoreDisplay.setScoreImmediate(viewState.totalScore);
      this.callbacks.onReducedMotionStarsPresented?.(viewState.earnedStars);
    }
  }

  public resize(width: number, height: number, safeArea?: PartialSafeAreaInsets): void {
    if (!this.openState || this.activeViewState === null || this.panelContainer === undefined) {
      return;
    }

    const viewState = this.activeViewState;
    const hasMilestone =
      viewState.campaignCompletion !== null ||
      viewState.chapterCompletion !== null ||
      viewState.unlockedLevel !== null;

    const layout = computeVictoryLayout(width, height, {
      hasOptimalBadge: viewState.isOptimalSolution,
      hasPersonalBest: viewState.personalBestBadge !== null,
      hasMilestoneBanner: hasMilestone,
      isCampaignComplete: viewState.campaignCompletion !== null,
      secondaryActionCount: this.secondaryButtons.length,
      ...(safeArea !== undefined ? { safeArea } : {}),
    });

    if (this.scrim?.active) {
      this.scrim.setPosition(width / 2, height / 2);
      this.scrim.setSize(width, height);
    }

    this.panelContainer.setPosition(layout.panelRect.x, layout.panelRect.y);
    this.drawPanelSurface(layout, viewState);

    this.completionLabelText?.setPosition(layout.labelPosition.x, layout.labelPosition.y);

    if (this.starRating !== undefined) {
      this.starRating.setPosition(layout.starsPosition.x, layout.starsPosition.y);
      this.starRating.setStarSize(layout.starSize, layout.starSpacing);
    }

    if (this.titleText !== undefined) {
      this.titleText.setPosition(layout.titlePosition.x, layout.titlePosition.y);
      this.titleText.setStyle(
        createTextStyle(Typography.HeadlineMedium, {
          color:
            viewState.campaignCompletion !== null ? Colors.Brand.Secondary : Colors.Text.Primary,
          align: 'center',
          scale: layout.titleFontScale,
          minFontSize: 22,
        }),
      );
    }

    this.drawOptimalBadge(layout, viewState.isOptimalSolution);

    if (this.scoreDisplay !== undefined) {
      this.scoreDisplay.setPosition(layout.scorePosition.x, layout.scorePosition.y);
      this.scoreDisplay.setFontScale(layout.scoreFontScale);
    }

    if (this.personalBestIndicator !== undefined) {
      this.personalBestIndicator.setPosition(
        layout.personalBestPosition.x,
        layout.personalBestPosition.y,
      );
      this.personalBestIndicator.setMaxWidth(layout.personalBestMaxWidth);
    }

    if (this.attemptStatistics !== undefined) {
      this.attemptStatistics.setPosition(layout.statsRect.x, layout.statsRect.y);
      this.attemptStatistics.setLayout(
        layout.statsRect.width,
        layout.statsRect.height,
        layout.statsColumns,
      );
    }

    if (this.milestoneBanner !== undefined) {
      if (layout.milestoneRect !== null) {
        this.milestoneBanner.setPosition(layout.milestoneRect.x, layout.milestoneRect.y);
        this.milestoneBanner.setDimensions(layout.milestoneRect.width, layout.milestoneRect.height);
      } else {
        this.milestoneBanner.setVisible(false);
      }
    }

    if (this.primaryButton !== undefined) {
      this.primaryButton.setPosition(layout.primaryButtonRect.x, layout.primaryButtonRect.y);
      this.primaryButton.setButtonSize(
        layout.primaryButtonRect.width,
        layout.primaryButtonRect.height,
      );
    }

    for (let i = 0; i < this.secondaryButtons.length; i += 1) {
      const btn = this.secondaryButtons[i];
      const rect = layout.secondaryButtonRects[i];
      if (btn !== undefined && rect !== undefined) {
        btn.setPosition(rect.x, rect.y);
        btn.setButtonSize(rect.width, rect.height);
      }
    }
  }

  public setTheme(theme: GameTheme): void {
    this.theme = theme;
    this.starRating?.setTheme(theme);
    this.scoreDisplay?.setTheme(theme);
    this.primaryButton?.setTheme(theme);
    for (const btn of this.secondaryButtons) {
      btn.setTheme(theme);
    }
  }

  public cancelAnimations(): void {
    if (this.entranceTween !== undefined) {
      this.entranceTween.stop();
      this.entranceTween = undefined;
    }
    this.starAnimator?.cancel();
    this.scoreDisplay?.cancelAnimation();
  }

  public isTransitionPending(): boolean {
    return this.transitionPending;
  }

  /**
   * Displays a restrained pending transition state while `LevelTransitionCoordinator`
   * awaits a bounded save flush or eligible platform advertising request.
   * Never renders a fake ad screen or countdown; preserves the victory panel intact.
   */
  public setTransitionPending(pending: boolean, statusLabel?: string): void {
    if (!this.openState || this.activeViewState === null) {
      return;
    }

    this.transitionPending = pending;

    if (pending) {
      this.actionDispatched = true;
      if (this.primaryButton !== undefined) {
        this.primaryButton.setEnabled(false);
        if (statusLabel !== undefined) {
          this.primaryButton.setIcon(undefined);
          this.primaryButton.setLabel(statusLabel);
        }
      }
      for (const btn of this.secondaryButtons) {
        btn.setEnabled(false);
      }
      return;
    }

    this.actionDispatched = false;
    if (this.primaryButton !== undefined) {
      this.primaryButton.setLabel(this.activeViewState.primaryActionLabel);
      this.primaryButton.setIcon(
        this.activeViewState.primaryActionKind === 'next_level' ? 'next' : 'play',
      );
      this.primaryButton.setEnabled(true);
    }
    for (const btn of this.secondaryButtons) {
      btn.setEnabled(true);
    }
  }

  public close(): void {
    this.cancelAnimations();
    this.destroyVisuals();
    this.openState = false;
    this.activeViewState = null;
    this.actionDispatched = false;
    this.transitionPending = false;
  }

  public destroy(): void {
    this.close();
  }

  private dispatchAction(action: () => void): void {
    if (this.actionDispatched) {
      return;
    }
    this.actionDispatched = true;
    this.cancelAnimations();
    action();
  }

  private applyContent(viewState: VictoryViewState): void {
    this.personalBestIndicator?.setBadge(viewState.personalBestBadge);

    this.attemptStatistics?.setStats([
      {
        label: 'Moves',
        value: String(viewState.actualMoves),
        highlight: viewState.isOptimalSolution,
      },
      {
        label: 'Optimal',
        value: String(viewState.minimumRequiredSwaps),
      },
      {
        label: 'Efficiency',
        value: viewState.formattedEfficiency,
        highlight: viewState.earnedStars === 3,
      },
      {
        label: 'Time',
        value: viewState.formattedTime,
      },
    ]);

    this.milestoneBanner?.setMilestone({
      unlockedLevel: viewState.unlockedLevel,
      chapterCompletion: viewState.chapterCompletion,
      campaignCompletion: viewState.campaignCompletion,
    });
  }

  private buildSecondaryActions(viewState: VictoryViewState): readonly SecondaryActionSpec[] {
    const actions: SecondaryActionSpec[] = [
      {
        key: 'replay',
        label: VICTORY_CONFIG.copy.replayAction,
        onClick: (state) => {
          this.callbacks.onReplay(state);
        },
      },
    ];

    if (viewState.showLevelsAction) {
      actions.push({
        key: 'levels',
        label: VICTORY_CONFIG.copy.levelsAction,
        onClick: (state) => {
          this.callbacks.onLevels(state);
        },
      });
    }

    actions.push({
      key: 'home',
      label: VICTORY_CONFIG.copy.homeAction,
      onClick: (state) => {
        this.callbacks.onHome(state);
      },
    });

    return actions;
  }

  private drawPanelSurface(layout: VictoryLayoutMetrics, viewState: VictoryViewState): void {
    if (!this.panelGraphics?.active) {
      return;
    }

    const accentColor =
      viewState.campaignCompletion !== null || viewState.earnedStars === 3
        ? Colors.Brand.Secondary
        : viewState.earnedStars === 2
          ? Colors.Brand.PrimaryLight
          : Colors.Semantic.Success;

    drawElevatedSurface(this.panelGraphics, {
      width: layout.panelRect.width,
      height: layout.panelRect.height,
      radius: SemanticShapes.Modal,
      fillColor: Colors.Surface.ElevatedSurface,
      borderColor: accentColor,
      borderWidth: viewState.campaignCompletion !== null ? 2.5 : Dimens.BorderMedium,
      elevation: 'high',
    });

    // Subtle celebratory top accent strip
    const barW = Math.min(180, Math.round(layout.panelRect.width * 0.36));
    const barY = -layout.panelRect.height / 2 + 4;
    this.panelGraphics.fillStyle(hexToNumber(accentColor), 0.9);
    this.panelGraphics.fillRoundedRect(-barW / 2, barY, barW, 4, 2);
  }

  private drawOptimalBadge(layout: VictoryLayoutMetrics, show: boolean): void {
    if (this.optimalPillGraphics === undefined || this.optimalBadgeText === undefined) {
      return;
    }
    this.optimalPillGraphics.clear();
    this.optimalBadgeText.setVisible(show);

    if (!show) {
      return;
    }

    const pos = layout.optimalBadgePosition;
    this.optimalBadgeText.setPosition(pos.x, pos.y);
    const pillW = Math.ceil(this.optimalBadgeText.width + Dimens.Space20);
    const pillH = 22;
    const pillRadius = Math.min(Shapes.Rounded, pillH / 2);

    this.optimalPillGraphics.fillStyle(hexToNumber(Colors.Semantic.Success), 0.16);
    this.optimalPillGraphics.fillRoundedRect(
      pos.x - pillW / 2,
      pos.y - pillH / 2,
      pillW,
      pillH,
      pillRadius,
    );
    this.optimalPillGraphics.lineStyle(1, hexToNumber(Colors.Semantic.Success), 0.72);
    this.optimalPillGraphics.strokeRoundedRect(
      pos.x - pillW / 2,
      pos.y - pillH / 2,
      pillW,
      pillH,
      pillRadius,
    );
  }

  private destroyVisuals(): void {
    if (this.entranceTween !== undefined) {
      this.entranceTween.stop();
      this.entranceTween = undefined;
    }
    this.starAnimator?.destroy();
    this.starAnimator = undefined;
    this.scoreDisplay?.destroy();
    this.scoreDisplay = undefined;
    this.root?.destroy(true);
    this.root = undefined;
    this.scrim = undefined;
    this.panelContainer = undefined;
    this.panelGraphics = undefined;
    this.optimalPillGraphics = undefined;
    this.completionLabelText = undefined;
    this.starRating = undefined;
    this.titleText = undefined;
    this.optimalBadgeText = undefined;
    this.personalBestIndicator = undefined;
    this.attemptStatistics = undefined;
    this.milestoneBanner = undefined;
    this.primaryButton = undefined;
    this.secondaryButtons = [];
  }
}
