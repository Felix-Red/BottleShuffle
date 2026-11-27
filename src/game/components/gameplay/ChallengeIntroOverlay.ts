import type Phaser from 'phaser';
import {
  Colors,
  createTextStyle,
  DefaultGameTheme,
  Dimens,
  drawElevatedSurface,
  drawIcon,
  hexToNumber,
  Modal,
  SemanticShapes,
  Typography,
  type GameTheme,
} from '../../../design-system';
import type { ChallengeIntroViewState } from '../../gameplay/GameplayViewState';
import type { PartialSafeAreaInsets } from '../../layout/ViewportMetrics';

export interface ChallengeIntroOverlayConfig {
  readonly theme?: GameTheme;
  readonly onStart: () => void;
}

/**
 * Short contextual introduction shown once when a player first encounters
 * Timed, Limited Moves, or Combined challenges. Holds the countdown timer paused
 * until dismissed.
 */
export class ChallengeIntroOverlay {
  private readonly scene: Phaser.Scene;
  private theme: GameTheme;
  private readonly onStart: () => void;

  private modal?: Modal;
  private currentState: ChallengeIntroViewState | null = null;
  private lastWidth = 1280;
  private lastHeight = 720;
  private lastSafeArea?: PartialSafeAreaInsets;

  public constructor(scene: Phaser.Scene, config: ChallengeIntroOverlayConfig) {
    this.scene = scene;
    this.theme = config.theme ?? DefaultGameTheme;
    this.onStart = config.onStart;
  }

  public isOpen(): boolean {
    return this.modal?.isOpen() ?? false;
  }

  public open(state: ChallengeIntroViewState, animate = true): void {
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

  public getCurrentState(): ChallengeIntroViewState | null {
    return this.currentState;
  }

  public destroy(): void {
    this.modal?.destroy();
    this.modal = undefined;
    this.currentState = null;
  }

  private rebuildModal(state: ChallengeIntroViewState): void {
    this.modal?.destroy();

    const content = this.scene.add.container(0, 0);
    const panelW = 340;
    const accentHex =
      state.mode === 'timed'
        ? Colors.Semantic.Info
        : state.mode === 'limited_moves'
          ? Colors.Brand.Secondary
          : Colors.Bottle.Orange;

    // Mode pill badge
    const pillW = 144;
    const pillH = 24;
    const pillY = -66;
    const pillGfx = this.scene.add.graphics();
    pillGfx.fillStyle(hexToNumber(accentHex), 0.24);
    pillGfx.fillRoundedRect(-pillW / 2, pillY - pillH / 2, pillW, pillH, pillH / 2);
    pillGfx.lineStyle(Dimens.BorderThin, hexToNumber(accentHex), 0.9);
    pillGfx.strokeRoundedRect(-pillW / 2, pillY - pillH / 2, pillW, pillH, pillH / 2);
    content.add(pillGfx);

    const badgeText = this.scene.add
      .text(
        0,
        pillY,
        state.badge,
        createTextStyle(Typography.LabelSmall, {
          color: accentHex,
          scale: 0.82,
          minFontSize: 10,
        }),
      )
      .setOrigin(0.5);
    content.add(badgeText);

    // Concise contextual explanation
    const descText = this.scene.add
      .text(
        0,
        -12,
        state.description,
        createTextStyle(Typography.BodySmall, {
          color: Colors.Text.Secondary,
          align: 'center',
          wordWrapWidth: panelW,
        }),
      )
      .setOrigin(0.5);
    content.add(descText);

    // Current level restriction summary pill
    const summaryY = 50;
    const summaryH = 44;
    const summaryGfx = this.scene.add.graphics();
    summaryGfx.setPosition(0, summaryY);
    drawElevatedSurface(summaryGfx, {
      width: panelW,
      height: summaryH,
      radius: SemanticShapes.Card,
      fillColor: Colors.Surface.Background,
      borderColor: accentHex,
      borderWidth: Dimens.BorderThin,
      elevation: 'flat',
    });
    content.add(summaryGfx);

    const iconGfx = this.scene.add.graphics();
    drawIcon(
      iconGfx,
      state.mode === 'limited_moves' ? 'moves' : 'clock',
      -panelW / 2 + 24,
      summaryY,
      15,
      accentHex,
    );
    content.add(iconGfx);

    const summaryText = this.scene.add
      .text(
        10,
        summaryY,
        state.restrictionSummary,
        createTextStyle(Typography.LabelMedium, {
          color: Colors.Text.Primary,
          align: 'center',
        }),
      )
      .setOrigin(0.5);
    content.add(summaryText);

    const levelSubtitle =
      state.levelNumber !== null
        ? `Level ${String(state.levelNumber)} · ${String(state.bottleCount)} Bottles`
        : `${String(state.bottleCount)} Bottles`;

    this.modal = new Modal(this.scene, {
      title: state.title,
      message: levelSubtitle,
      content,
      contentHeight: 162,
      width: 420,
      dismissible: false,
      theme: this.theme,
      primaryAction: {
        label: state.ctaLabel,
        closeOnClick: false,
        onClick: () => {
          this.onStart();
        },
      },
    });
  }
}
