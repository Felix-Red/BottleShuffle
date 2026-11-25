import type Phaser from 'phaser';
import type { GameTheme } from '../../theme/GameTheme';
import { Modal } from './Modal';

export interface ConfirmDialogConfig {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly dismissible?: boolean;
  readonly onConfirm: () => void;
  readonly onCancel?: () => void;
  readonly theme?: GameTheme;
}

export class ConfirmDialog {
  private readonly modal: Modal;

  public constructor(scene: Phaser.Scene, config: ConfirmDialogConfig) {
    this.modal = new Modal(scene, {
      title: config.title,
      message: config.message,
      dismissible: config.dismissible ?? true,
      ...(config.theme !== undefined ? { theme: config.theme } : {}),
      ...(config.onCancel !== undefined ? { onDismiss: config.onCancel } : {}),
      primaryAction: {
        label: config.confirmLabel ?? 'Confirm',
        onClick: config.onConfirm,
      },
      secondaryAction: {
        label: config.cancelLabel ?? 'Cancel',
        onClick: () => {
          config.onCancel?.();
        },
      },
    });
  }

  public open(): this {
    this.modal.open();
    return this;
  }

  public close(): this {
    this.modal.close(false);
    return this;
  }

  public isOpen(): boolean {
    return this.modal.isOpen();
  }

  public resize(width: number, height: number): this {
    this.modal.resize(width, height);
    return this;
  }

  public setTheme(theme: GameTheme): this {
    this.modal.setTheme(theme);
    return this;
  }

  public destroy(): void {
    this.modal.destroy();
  }
}
