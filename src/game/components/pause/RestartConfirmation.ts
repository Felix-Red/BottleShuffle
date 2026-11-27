import type Phaser from 'phaser';
import { SETTINGS_CONFIG } from '../../../config/SettingsConfig';
import { ConfirmDialog, type GameTheme } from '../../../design-system';

export interface RestartConfirmationConfig {
  readonly theme?: GameTheme;
  readonly message?: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

const CONFIRM_DEPTH = 1020;

/**
 * Confirmation dialog displayed before resetting the current puzzle attempt.
 * Reuses the shared ConfirmDialog above PauseOverlay / SettingsOverlay.
 */
export class RestartConfirmation {
  private readonly dialog: ConfirmDialog;

  public constructor(scene: Phaser.Scene, config: RestartConfirmationConfig) {
    this.dialog = new ConfirmDialog(scene, {
      title: SETTINGS_CONFIG.restartConfirm.title,
      message: config.message ?? SETTINGS_CONFIG.restartConfirm.message,
      confirmLabel: SETTINGS_CONFIG.restartConfirm.confirmLabel,
      cancelLabel: SETTINGS_CONFIG.restartConfirm.cancelLabel,
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
