import Phaser from 'phaser';
import {
  Colors,
  createTextStyle,
  DefaultGameTheme,
  hexToNumber,
  Typography,
  type GameTheme,
} from '../../../design-system';
import { PointerAnimation } from '../../animations/tutorial/PointerAnimation';

/**
 * Original directional tutorial pointer badge ("TAP") with downward golden chevron.
 * Positioned above the highlighted bottle cap so bottle accessibility symbols remain unobstructed.
 */
export class TutorialPointer extends Phaser.GameObjects.Container {
  private theme: GameTheme;
  private readonly badgeContainer: Phaser.GameObjects.Container;
  private readonly pointerGraphics: Phaser.GameObjects.Graphics;
  private readonly labelText: Phaser.GameObjects.Text;
  private readonly bobAnimation: PointerAnimation;

  private anchorX = 0;
  private anchorY = 0;
  private pointing = false;

  public constructor(scene: Phaser.Scene, theme: GameTheme = DefaultGameTheme) {
    super(scene, 0, 0);
    this.theme = theme;
    this.setDepth(540);

    this.badgeContainer = scene.add.container(0, 0);
    this.pointerGraphics = scene.add.graphics();
    this.labelText = scene.add
      .text(
        0,
        -16,
        'TAP',
        createTextStyle(Typography.LabelSmall, {
          color: Colors.Text.OnSecondary,
          align: 'center',
          scale: 0.82,
          minFontSize: 10,
        }),
      )
      .setOrigin(0.5);

    this.drawPointerShape();
    this.badgeContainer.add([this.pointerGraphics, this.labelText]);
    this.add(this.badgeContainer);
    this.bobAnimation = new PointerAnimation();

    this.setVisible(false);
    scene.add.existing(this);
  }

  public pointAt(x: number, topOfTargetY: number): this {
    this.anchorX = Math.round(x);
    this.anchorY = Math.round(topOfTargetY - 12);
    this.pointing = true;

    this.setPosition(this.anchorX, this.anchorY);
    this.setVisible(true);
    this.bobAnimation.start(this.scene, this.badgeContainer, 0, this.theme.reducedMotion);
    return this;
  }

  public hide(): this {
    this.pointing = false;
    this.bobAnimation.stop();
    this.badgeContainer.setPosition(0, 0);
    this.badgeContainer.setScale(1);
    this.setVisible(false);
    return this;
  }

  public setSuspended(suspended: boolean): this {
    this.bobAnimation.setPaused(suspended);
    return this;
  }

  public setTheme(theme: GameTheme): this {
    this.theme = theme;
    if (this.pointing) {
      this.bobAnimation.start(this.scene, this.badgeContainer, 0, theme.reducedMotion);
    }
    return this;
  }

  private drawPointerShape(): void {
    this.pointerGraphics.clear();

    // Soft drop shadow
    this.pointerGraphics.fillStyle(hexToNumber(Colors.Black), 0.35);
    this.pointerGraphics.fillRoundedRect(-25, -27, 50, 24, 12);

    // Golden pill badge
    this.pointerGraphics.fillStyle(hexToNumber(Colors.Brand.Secondary), 1);
    this.pointerGraphics.fillRoundedRect(-25, -29, 50, 24, 12);
    this.pointerGraphics.lineStyle(2, hexToNumber(Colors.White), 0.85);
    this.pointerGraphics.strokeRoundedRect(-25, -29, 50, 24, 12);

    // Crisp downward triangle pointer
    this.pointerGraphics.fillStyle(hexToNumber(Colors.Brand.Secondary), 1);
    this.pointerGraphics.fillTriangle(-9, -6, 9, -6, 0, 5);
  }

  public override destroy(fromScene?: boolean): void {
    this.bobAnimation.stop();
    super.destroy(fromScene);
  }
}
