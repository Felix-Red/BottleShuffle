import type Phaser from 'phaser';
import { SETTINGS_CONFIG } from '../../../config/SettingsConfig';
import { ConfirmDialog, type GameTheme } from '../../../design-system';

export interface ExitConfirmationConfig {
  readonly theme?: GameTheme;
  readonly title?: string;
  readonly message?: string;
  readonly confirmLabel?: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

const CONFIRM_DEPTH = 1020;

/**
 * Confirmation dialog displayed before abandoning an incomplete puzzle attempt
 * to return to Home (or start the tutorial from gameplay settings).
 * Uses destructive emphasis on the confirmed exit button while keeping the
 * ordinary Exit to Home navigation button inside PauseOverlay restrained.
 */
export class ExitConfirmation {
  private readonly dialog: ConfirmDialog;

  public constructor(scene: Phaser.Scene, config: ExitConfirmationConfig) {
    this.dialog = new ConfirmDialog(scene, {
      title: config.title ?? SETTINGS_CONFIG.exitConfirm.title,
      message: config.message ?? SETTINGS_CONFIG.exitConfirm.message,
      confirmLabel: config.confirmLabel ?? SETTINGS_CONFIG.exitConfirm.confirmLabel,
      cancelLabel: SETTINGS_CONFIG.exitConfirm.cancelLabel,
      destructive: true,
      depth: CONFIRM_DEPTH,
      dismissible: true,
      ...(config.theme !== undefined ? { theme: config.theme } : {}),
      onConfirm: config.onConfirm,
      onCancel: config.onCancel,
    });
  }

  public isOpen(): boolean {
    return this.dialog.isOpen();
  }

  public open(): void {
    this.dialog.open();
  }

  public close(): void {
    this.dialog.close();
  }

  public resize(width: number, height: number): void {
    this.dialog.resize(width, height);
  }

  public setTheme(theme: GameTheme): void {
    this.dialog.setTheme(theme);
  }

  public destroy(): void {
    this.dialog.destroy();
  }
}
