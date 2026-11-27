import type Phaser from 'phaser';
import { GAMEPLAY_COPY } from '../../../config/GameplayConfig';
import {
  Colors,
  createTextStyle,
  DefaultGameTheme,
  Dimens,
  drawElevatedSurface,
  drawIcon,
  Modal,
  OutlineButton,
  SemanticShapes,
  TextButton,
  Typography,
  type GameTheme,
} from '../../../design-system';
import type { FailureViewState } from '../../gameplay/GameplayViewState';
import type { PartialSafeAreaInsets } from '../../layout/ViewportMetrics';

export interface FailureOverlayConfig {
  readonly theme?: GameTheme;
  readonly onRetry: () => void;
  readonly onLevels: () => void;
  readonly onHome: () => void;
}

/**
 * Reusable failed-attempt overlay for timer expiration ("Time's Up!") and move exhaustion
 * ("Out of Moves!"). Supports immediate Retry without lives, energy, or mandatory ads,
 * plus clean navigation to Level Selection and Home.
 */
export class FailureOverlay {
  private readonly scene: Phaser.Scene;
  private theme: GameTheme;
  private readonly onRetry: () => void;
  private readonly onLevels: () => void;
  private readonly onHome: () => void;

  private modal?: Modal;
  private currentState: FailureViewState | null = null;
  private lastWidth = 1280;
  private lastHeight = 720;
  private lastSafeArea?: PartialSafeAreaInsets;

  public constructor(scene: Phaser.Scene, config: FailureOverlayConfig) {
    this.scene = scene;
    this.theme = config.theme ?? DefaultGameTheme;
    this.onRetry = config.onRetry;
    this.onLevels = config.onLevels;
    this.onHome = config.onHome;
  }

  public isOpen(): boolean {
    return this.modal?.isOpen() ?? false;
  }

  public open(state: FailureViewState, animate = true): void {
    this.currentState = state;
    this.lastWidth = this.scene.scale.width;
    this.lastHeight = this.scene.scale.height;
    this.rebuildModal(state);
    this.modal?.resize(this.lastWidth, this.lastHeight, this.lastSafeArea);
    this.modal?.open(animate && !this.theme.reducedMotion);
  }

  public close(): void {
    this.currentState = null;
    if (this.modal?.isOpen() === true) {
      this.modal.close(false);
    }
  }

  public resize(width: number, height: number, safeArea?: PartialSafeAreaInsets): void {
    this.lastWidth = width;
    this.lastHeight = height;
    this.lastSafeArea = safeArea;
    this.modal?.resize(width, height, safeArea);
  }

  public setTheme(theme: GameTheme): void {
    this.theme = theme;
    this.modal?.setTheme(theme);
  }

  public getCurrentState(): FailureViewState | null {
    return this.currentState;
  }

  public destroy(): void {
    this.modal?.destroy();
    this.modal = undefined;
    this.currentState = null;
  }

  private rebuildModal(state: FailureViewState): void {
    this.modal?.destroy();

    const content = this.scene.add.container(0, 0);
    const panelW = 340;
    const accentHex =
      state.reason === 'time_expired' ? Colors.Semantic.Error : Colors.Semantic.Warning;

    // Concise failure explanation
    const hintText = this.scene.add
      .text(
        0,
        -76,
        state.hint,
        createTextStyle(Typography.BodySmall, {
          color: Colors.Text.Secondary,
          align: 'center',
          wordWrapWidth: panelW,
        }),
      )
      .setOrigin(0.5);
    content.add(hintText);

    // Attempt summary statistics card
    const statsPanelY = -8;
    const statsPanelH = 88;
    const statsGfx = this.scene.add.graphics();
    statsGfx.setPosition(0, statsPanelY);
    drawElevatedSurface(statsGfx, {
      width: panelW,
      height: statsPanelH,
      radius: SemanticShapes.Card,
      fillColor: Colors.Surface.Background,
      borderColor: accentHex,
      borderWidth: Dimens.BorderThin,
      elevation: 'flat',
    });
    content.add(statsGfx);

    const iconGfx = this.scene.add.graphics();
    drawIcon(
      iconGfx,
      state.reason === 'time_expired' ? 'clock' : 'moves',
      -panelW / 2 + 24,
      statsPanelY - 22,
      14,
      accentHex,
    );
    content.add(iconGfx);

    const levelTag =
      state.levelNumber !== null ? `LEVEL ${String(state.levelNumber)} SUMMARY` : 'ATTEMPT SUMMARY';
    const headingText = this.scene.add
      .text(
        -panelW / 2 + 38,
        statsPanelY - 22,
        levelTag,
        createTextStyle(Typography.LabelSmall, {
          color: accentHex,
          scale: 0.85,
        }),
      )
      .setOrigin(0, 0.5);
    content.add(headingText);

    const colOffset = Math.round(panelW / 3);
    const statItems = [
      {
        label: 'MATCHES',
        value: `${String(state.finalMatchCount)} / ${String(state.totalBottleCount)}`,
        x: -colOffset,
      },
      {
        label: 'MOVES',
        value:
          state.moveLimit !== null
            ? `${String(state.movesUsed)} / ${String(state.moveLimit)}`
            : String(state.movesUsed),
        x: 0,
      },
      {
        label: 'TIME',
        value: state.formattedTimeUsed,
        x: colOffset,
      },
    ];

    for (const item of statItems) {
      const valText = this.scene.add
        .text(
          item.x,
          statsPanelY + 8,
          item.value,
          createTextStyle(Typography.TitleMedium, {
            color: Colors.Text.Primary,
            align: 'center',
          }),
        )
        .setOrigin(0.5);

      const lblText = this.scene.add
        .text(
          item.x,
          statsPanelY + 28,
          item.label,
          createTextStyle(Typography.LabelSmall, {
            color: Colors.Text.Secondary,
            align: 'center',
            scale: 0.78,
            minFontSize: 10,
          }),
        )
        .setOrigin(0.5);

      content.add([valText, lblText]);
    }

    // Secondary navigation row: Levels + Home (Retry uses Modal's PrimaryButton)
    const secondaryGap = Dimens.Space12;
    const secondaryW = Math.floor((panelW - secondaryGap) / 2);

    const levelsBtn = new OutlineButton(this.scene, {
      x: -Math.round((secondaryW + secondaryGap) / 2),
      y: 66,
      width: secondaryW,
      height: 46,
      label: GAMEPLAY_COPY.failureModal.levelsLabel,
      theme: this.theme,
      onClick: () => {
        this.onLevels();
      },
    });

    const homeBtn = new TextButton(this.scene, {
      x: Math.round((secondaryW + secondaryGap) / 2),
      y: 66,
      width: secondaryW,
      height: 46,
      label: GAMEPLAY_COPY.failureModal.homeLabel,
      theme: this.theme,
      onClick: () => {
        this.onHome();
      },
    });

    content.add([levelsBtn, homeBtn]);

    this.modal = new Modal(this.scene, {
      title: state.title,
      message: state.subtitle,
      content,
      contentHeight: 196,
      width: 420,
      dismissible: false,
      theme: this.theme,
      primaryAction: {
        label: GAMEPLAY_COPY.failureModal.retryLabel,
        closeOnClick: false,
        onClick: () => {
          this.onRetry();
        },
      },
    });
  }
}
