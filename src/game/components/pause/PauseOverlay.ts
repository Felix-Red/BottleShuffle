import type Phaser from 'phaser';
import { SETTINGS_CONFIG } from '../../../config/SettingsConfig';
import {
  Colors,
  createTextStyle,
  DefaultGameTheme,
  Dimens,
  drawElevatedSurface,
  drawIcon,
  hexToNumber,
  MotionEasings,
  MotionPresets,
  OutlineButton,
  PrimaryButton,
  resolveMotionDuration,
  SemanticShapes,
  TextButton,
  Typography,
  type GameTheme,
} from '../../../design-system';
import { computePauseLayout } from '../../layout/PauseLayout';
import type { PartialSafeAreaInsets } from '../../layout/ViewportMetrics';
import { PauseStatistics, type PauseStatisticsData } from './PauseStatistics';

export interface PauseOverlayCallbacks {
  readonly onResume: () => void;
  readonly onRestart: () => void;
  readonly onSettings: () => void;
  readonly onExit: () => void;
}

export interface PauseOverlayState {
  readonly subtitle: string;
  readonly stats: PauseStatisticsData;
  readonly exitLabel?: string;
}

export interface PauseOverlayConfig {
  readonly theme?: GameTheme;
  readonly callbacks: PauseOverlayCallbacks;
}

const PAUSE_OVERLAY_DEPTH = 940;

/**
 * Production pause menu overlay rendered over the dimmed gameplay board.
 * Features Pause icon badge, Game Paused heading, level/practice subtitle,
 * current move/match/time statistics, dominant Resume CTA, secondary Restart
 * and Settings controls, and restrained tertiary Exit to Home action.
 */
export class PauseOverlay {
  private readonly scene: Phaser.Scene;
  private theme: GameTheme;
  private readonly callbacks: PauseOverlayCallbacks;

  private root?: Phaser.GameObjects.Container;
  private scrim?: Phaser.GameObjects.Rectangle;
  private panelContainer?: Phaser.GameObjects.Container;
  private panelGraphics?: Phaser.GameObjects.Graphics;
  private iconGraphics?: Phaser.GameObjects.Graphics;
  private titleText?: Phaser.GameObjects.Text;
  private subtitleText?: Phaser.GameObjects.Text;
  private stats?: PauseStatistics;
  private resumeButton?: PrimaryButton;
  private restartButton?: OutlineButton;
  private settingsButton?: OutlineButton;
  private exitButton?: TextButton;

  private currentState: PauseOverlayState | null = null;
  private entranceTween?: Phaser.Tweens.Tween;
  private openState = false;
  private interactiveEnabled = true;

  public constructor(scene: Phaser.Scene, config: PauseOverlayConfig) {
    this.scene = scene;
    this.theme = config.theme ?? DefaultGameTheme;
    this.callbacks = config.callbacks;
  }

  public isOpen(): boolean {
    return this.openState;
  }

  public open(state: PauseOverlayState, animate = true): void {
    this.destroyVisuals();
    this.currentState = state;
    this.openState = true;
    this.interactiveEnabled = true;

    const width = this.scene.scale.width;
    const height = this.scene.scale.height;

    this.root = this.scene.add.container(0, 0).setDepth(PAUSE_OVERLAY_DEPTH);

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
    this.iconGraphics = this.scene.add.graphics();

    this.titleText = this.scene.add
      .text(
        0,
        0,
        SETTINGS_CONFIG.pause.title,
        createTextStyle(Typography.HeadlineMedium, {
          color: Colors.Text.Primary,
          align: 'center',
        }),
      )
      .setOrigin(0.5);

    this.subtitleText = this.scene.add
      .text(
        0,
        0,
        state.subtitle,
        createTextStyle(Typography.BodySmall, {
          color: Colors.Text.Secondary,
          align: 'center',
        }),
      )
      .setOrigin(0.5);

    this.stats = new PauseStatistics(this.scene);
    this.stats.setDataValues(state.stats);

    this.resumeButton = new PrimaryButton(this.scene, {
      label: SETTINGS_CONFIG.pause.resumeLabel,
      icon: 'play',
      theme: this.theme,
      onClick: () => {
        if (this.interactiveEnabled) {
          this.callbacks.onResume();
        }
      },
    });

    this.restartButton = new OutlineButton(this.scene, {
      label: SETTINGS_CONFIG.pause.restartLabel,
      icon: 'restart',
      theme: this.theme,
      onClick: () => {
        if (this.interactiveEnabled) {
          this.callbacks.onRestart();
        }
      },
    });

    this.settingsButton = new OutlineButton(this.scene, {
      label: SETTINGS_CONFIG.pause.settingsLabel,
      icon: 'settings',
      theme: this.theme,
      onClick: () => {
        if (this.interactiveEnabled) {
          this.callbacks.onSettings();
        }
      },
    });

    this.exitButton = new TextButton(this.scene, {
      label: state.exitLabel ?? SETTINGS_CONFIG.pause.exitLabel,
      theme: this.theme,
      onClick: () => {
        if (this.interactiveEnabled) {
          this.callbacks.onExit();
        }
      },
    });

    this.panelContainer.add([
      this.panelGraphics,
      this.iconGraphics,
      this.titleText,
      this.subtitleText,
      this.stats,
      this.resumeButton,
      this.restartButton,
      this.settingsButton,
      this.exitButton,
    ]);

    this.resize(width, height);

    const duration = animate
      ? resolveMotionDuration(MotionPresets.ModalEntrance.duration, this.theme.reducedMotion)
      : 0;

    if (duration > 0) {
      this.scrim.setAlpha(0);
      this.panelContainer.setAlpha(0);
      this.panelContainer.setScale(MotionPresets.ModalEntrance.scaleFrom);

      this.entranceTween = this.scene.tweens.add({
        targets: this.scrim,
        alpha: Colors.Surface.OverlayAlpha,
        duration,
        ease: MotionEasings.EaseOut,
      });

      this.scene.tweens.add({
        targets: this.panelContainer,
        alpha: 1,
        scaleX: 1,
        scaleY: 1,
        duration,
        ease: MotionEasings.EaseOut,
      });
    }
  }

  public updateStats(state: PauseOverlayState): void {
    this.currentState = state;
    if (!this.openState) {
      return;
    }
    this.subtitleText?.setText(state.subtitle);
    this.stats?.setDataValues(state.stats);
  }

  public setControlsInteractive(interactive: boolean): void {
    this.interactiveEnabled = interactive;
    this.resumeButton?.setEnabled(interactive);
    this.restartButton?.setEnabled(interactive);
    this.settingsButton?.setEnabled(interactive);
    this.exitButton?.setEnabled(interactive);
  }

  public resize(width: number, height: number, safeArea?: PartialSafeAreaInsets): void {
    if (!this.openState || this.panelContainer === undefined) {
      return;
    }

    const layout = computePauseLayout(width, height, safeArea);

    if (this.scrim?.active) {
      this.scrim.setPosition(width / 2, height / 2);
      this.scrim.setSize(width, height);
    }

    this.panelContainer.setPosition(layout.panelRect.x, layout.panelRect.y);

    if (this.panelGraphics?.active) {
      drawElevatedSurface(this.panelGraphics, {
        width: layout.panelRect.width,
        height: layout.panelRect.height,
        radius: SemanticShapes.Modal,
        fillColor: Colors.Surface.ElevatedSurface,
        borderColor: Colors.Surface.Border,
        borderWidth: Dimens.BorderMedium,
        elevation: 'high',
      });
    }

    if (this.iconGraphics?.active) {
      this.iconGraphics.clear();
      this.iconGraphics.fillStyle(hexToNumber(Colors.Brand.Primary), 0.18);
      this.iconGraphics.fillCircle(layout.iconPosition.x, layout.iconPosition.y, layout.iconRadius);
      this.iconGraphics.lineStyle(1.5, hexToNumber(Colors.Brand.PrimaryLight), 0.72);
      this.iconGraphics.strokeCircle(
        layout.iconPosition.x,
        layout.iconPosition.y,
        layout.iconRadius,
      );
      drawIcon(
        this.iconGraphics,
        'pause',
        layout.iconPosition.x,
        layout.iconPosition.y,
        Math.round(layout.iconRadius * 0.95),
        Colors.Brand.PrimaryLight,
      );
    }

    this.titleText?.setPosition(layout.titlePosition.x, layout.titlePosition.y);
    this.subtitleText?.setPosition(layout.subtitlePosition.x, layout.subtitlePosition.y);

    this.stats?.setPosition(layout.statsRect.x, layout.statsRect.y);
    this.stats?.setDimensions(layout.statsRect.width, layout.statsRect.height);

    this.resumeButton?.setPosition(layout.resumeButtonRect.x, layout.resumeButtonRect.y);
    this.resumeButton?.setButtonSize(layout.resumeButtonRect.width, layout.resumeButtonRect.height);

    this.restartButton?.setPosition(layout.restartButtonRect.x, layout.restartButtonRect.y);
    this.restartButton?.setButtonSize(
      layout.restartButtonRect.width,
      layout.restartButtonRect.height,
    );

    this.settingsButton?.setPosition(layout.settingsButtonRect.x, layout.settingsButtonRect.y);
    this.settingsButton?.setButtonSize(
      layout.settingsButtonRect.width,
      layout.settingsButtonRect.height,
    );

    this.exitButton?.setPosition(layout.exitButtonRect.x, layout.exitButtonRect.y);
    this.exitButton?.setButtonSize(layout.exitButtonRect.width, layout.exitButtonRect.height);
  }

  public setTheme(theme: GameTheme): void {
    this.theme = theme;
    this.resumeButton?.setTheme(theme);
    this.restartButton?.setTheme(theme);
    this.settingsButton?.setTheme(theme);
    this.exitButton?.setTheme(theme);
  }

  public close(): void {
    this.destroyVisuals();
    this.openState = false;
    this.currentState = null;
  }

  public destroy(): void {
    this.close();
  }

  public getCurrentState(): PauseOverlayState | null {
    return this.currentState;
  }

  private destroyVisuals(): void {
    if (this.entranceTween !== undefined) {
      this.entranceTween.stop();
      this.entranceTween = undefined;
    }
    this.root?.destroy(true);
    this.root = undefined;
    this.scrim = undefined;
    this.panelContainer = undefined;
    this.panelGraphics = undefined;
    this.iconGraphics = undefined;
    this.titleText = undefined;
    this.subtitleText = undefined;
    this.stats = undefined;
    this.resumeButton = undefined;
    this.restartButton = undefined;
    this.settingsButton = undefined;
    this.exitButton = undefined;
  }
}
