import type Phaser from 'phaser';
import { HOME_CONFIG } from '../../../config/HomeConfig';
import { ALL_DIFFICULTY_DEFINITIONS, type DifficultyId } from '../../../core';
import {
  DefaultGameTheme,
  Dimens,
  Modal,
  OutlineButton,
  SecondaryButton,
  type GameTheme,
} from '../../../design-system';

export interface PracticeModeDialogConfig {
  readonly defaultDifficulty?: DifficultyId;
  readonly theme?: GameTheme;
  readonly onPlayPractice: (difficulty: DifficultyId) => void;
  readonly onClose: () => void;
}

/**
 * Lightweight reusable Practice Mode difficulty selector modal.
 * Reuses ALL_DIFFICULTY_DEFINITIONS and highlights the selected option using both
 * visual style and an explicit check icon so selection never relies solely on colour.
 */
export class PracticeModeDialog {
  private readonly scene: Phaser.Scene;
  private theme: GameTheme;
  private selectedDifficulty: DifficultyId;
  private readonly onPlayPractice: (difficulty: DifficultyId) => void;
  private readonly onClose: () => void;

  private readonly contentContainer: Phaser.GameObjects.Container;
  private readonly modal: Modal;
  private buttons: (SecondaryButton | OutlineButton)[] = [];

  public constructor(scene: Phaser.Scene, config: PracticeModeDialogConfig) {
    this.scene = scene;
    this.theme = config.theme ?? DefaultGameTheme;
    this.selectedDifficulty = config.defaultDifficulty ?? 'normal';
    this.onPlayPractice = config.onPlayPractice;
    this.onClose = config.onClose;

    this.contentContainer = scene.add.container(0, 0);
    this.rebuildOptions();

    this.modal = new Modal(scene, {
      title: HOME_CONFIG.copy.practiceDialogTitle,
      message: HOME_CONFIG.copy.practiceDialogMessage,
      content: this.contentContainer,
      contentHeight: 196,
      width: 440,
      dismissible: true,
      theme: this.theme,
      primaryAction: {
        label: HOME_CONFIG.copy.practicePlayLabel,
        closeOnClick: false,
        onClick: () => {
          this.onPlayPractice(this.selectedDifficulty);
        },
      },
      secondaryAction: {
        label: HOME_CONFIG.copy.cancelLabel,
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

  public isOpen(): boolean {
    return this.modal.isOpen();
  }

  public open(): void {
    this.rebuildOptions();
    this.modal.resize(this.scene.scale.width, this.scene.scale.height);
    this.modal.open();
  }

  public close(): void {
    this.modal.close(false);
  }

  public resize(width: number, height: number): void {
    this.rebuildOptions(width);
    this.modal.resize(width, height);
  }

  public setTheme(theme: GameTheme): void {
    this.theme = theme;
    this.modal.setTheme(theme);
    this.rebuildOptions();
  }

  public destroy(): void {
    this.modal.destroy();
  }

  private rebuildOptions(viewportWidth = this.scene.scale.width): void {
    this.contentContainer.removeAll(true);
    this.buttons = [];

    const innerW = Math.min(392, Math.max(248, viewportWidth - Dimens.Space64 - Dimens.Space24));
    const cols = 2;
    const gapX = Dimens.Space10;
    const gapY = Dimens.Space10;
    const btnW = Math.floor((innerW - gapX) / cols);
    const btnH = 54;
    const rows = Math.ceil(ALL_DIFFICULTY_DEFINITIONS.length / cols);
    const gridW = cols * btnW + (cols - 1) * gapX;
    const gridH = rows * btnH + (rows - 1) * gapY;
    const startX = -gridW / 2 + btnW / 2;
    const startY = -gridH / 2 + btnH / 2;

    ALL_DIFFICULTY_DEFINITIONS.forEach((def, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = Math.round(startX + col * (btnW + gapX));
      const y = Math.round(startY + row * (btnH + gapY));
      const isSelected = def.id === this.selectedDifficulty;
      const label = `${def.displayName} (${String(def.bottleCount)})`;

      const btn = isSelected
        ? new SecondaryButton(this.scene, {
            x,
            y,
            width: btnW,
            height: btnH,
            label,
            icon: 'check',
            theme: this.theme,
            onClick: () => {
              this.selectDifficulty(def.id);
            },
          })
        : new OutlineButton(this.scene, {
            x,
            y,
            width: btnW,
            height: btnH,
            label,
            theme: this.theme,
            onClick: () => {
              this.selectDifficulty(def.id);
            },
          });

      this.buttons.push(btn);
      this.contentContainer.add(btn);
    });
  }

  private selectDifficulty(difficulty: DifficultyId): void {
    if (this.selectedDifficulty === difficulty) {
      return;
    }
    this.selectedDifficulty = difficulty;
    this.rebuildOptions();
  }
}
