import Phaser from 'phaser';
import { Colors, createTextStyle, Typography } from '../../../design-system';
import type { GameplayInstructionsLayout } from '../../layout/GameplayLayout';

export class GameplayInstructions extends Phaser.GameObjects.Container {
  private readonly labelText: Phaser.GameObjects.Text;
  private currentMessage = '';

  public constructor(scene: Phaser.Scene, initialText = '') {
    super(scene, 0, 0);

    this.currentMessage = initialText;
    this.labelText = scene.add
      .text(
        0,
        0,
        initialText,
        createTextStyle(Typography.BodySmall, {
          color: Colors.Text.Secondary,
          align: 'center',
        }),
      )
      .setOrigin(0.5);

    this.add(this.labelText);
    scene.add.existing(this);
  }

  public setMessage(message: string, isComplete = false): this {
    const nextColor = isComplete ? Colors.Semantic.Success : Colors.Text.Secondary;
    if (message !== this.currentMessage) {
      this.currentMessage = message;
      this.labelText.setText(message);
    }
    this.labelText.setColor(nextColor);
    return this;
  }

  public applyLayout(layout: GameplayInstructionsLayout): this {
    this.setPosition(layout.x, layout.y);
    this.labelText.setWordWrapWidth(layout.maxWidth, true);
    return this;
  }
}
