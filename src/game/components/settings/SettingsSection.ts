import Phaser from 'phaser';
import { Colors, createTextStyle, Typography } from '../../../design-system';

/**
 * Restrained uppercase section heading inside SettingsOverlay (AUDIO, GAMEPLAY, HELP).
 */
export class SettingsSection extends Phaser.GameObjects.Container {
  private readonly labelText: Phaser.GameObjects.Text;

  public constructor(scene: Phaser.Scene, title: string, x = 0, y = 0) {
    super(scene, x, y);

    this.labelText = scene.add
      .text(
        0,
        0,
        title.toUpperCase(),
        createTextStyle(Typography.LabelSmall, {
          color: Colors.Text.Secondary,
          scale: 0.84,
          minFontSize: 10,
        }),
      )
      .setOrigin(0, 0.5);

    this.add(this.labelText);
    scene.add.existing(this);
  }
}
