import type Phaser from 'phaser';
import { TUTORIAL_CONFIG } from '../../../config/TutorialConfig';
import {
  Colors,
  createTextStyle,
  DefaultGameTheme,
  drawIcon,
  hexToNumber,
  Modal,
  Typography,
  type GameTheme,
} from '../../../design-system';

export interface TutorialCompletionOverlayConfig {
  readonly theme?: GameTheme;
  readonly onContinue: () => void;
}

/**
 * Lightweight celebratory completion modal displayed when the player completes
 * the independent tutorial puzzle. Launches the preserved campaign destination
 * or returns to the originating screen on manual replay.
 */
export class TutorialCompletionOverlay {
  private readonly scene: Phaser.Scene;
  private theme: GameTheme;
  private readonly onContinue: () => void;
  private modal?: Modal;

  public constructor(scene: Phaser.Scene, config: TutorialCompletionOverlayConfig) {
    this.scene = scene;
    this.theme = config.theme ?? DefaultGameTheme;
    this.onContinue = config.onContinue;
  }

  public isOpen(): boolean {
    return this.modal?.isOpen() ?? false;
  }

  public open(primaryLabel: string, animate = true): void {
    this.modal?.destroy();

    const content = this.scene.add.container(0, 0);

    const badgeGfx = this.scene.add.graphics();
    badgeGfx.fillStyle(hexToNumber(Colors.Semantic.Success), 0.2);
    badgeGfx.fillCircle(0, -24, 28);
    badgeGfx.lineStyle(2.5, hexToNumber(Colors.Semantic.Success), 0.95);
    badgeGfx.strokeCircle(0, -24, 28);
    drawIcon(badgeGfx, 'check', 0, -24, 28, Colors.Semantic.Success);
    content.add(badgeGfx);

    const recapText = this.scene.add
      .text(
        0,
        24,
        TUTORIAL_CONFIG.copy.completionRecap,
        createTextStyle(Typography.BodySmall, {
          color: Colors.Text.Secondary,
          align: 'center',
          wordWrapWidth: 320,
        }),
      )
      .setOrigin(0.5);
    content.add(recapText);

    this.modal = new Modal(this.scene, {
      title: TUTORIAL_CONFIG.copy.completionTitle,
      message: TUTORIAL_CONFIG.copy.completionDescription,
      content,
      contentHeight: 110,
      width: 420,
      dismissible: false,
      theme: this.theme,
      primaryAction: {
        label: primaryLabel,
        closeOnClick: false,
        onClick: () => {
          this.onContinue();
        },
      },
    });

    this.modal.resize(this.scene.scale.width, this.scene.scale.height);
    this.modal.open(animate);
  }

  public close(): void {
    if (this.modal?.isOpen() === true) {
      this.modal.close(false);
    }
  }

  public resize(width: number, height: number): void {
    this.modal?.resize(width, height);
  }

  public setTheme(theme: GameTheme): void {
    this.theme = theme;
    this.modal?.setTheme(theme);
  }

  public destroy(): void {
    this.modal?.destroy();
    this.modal = undefined;
  }
}
