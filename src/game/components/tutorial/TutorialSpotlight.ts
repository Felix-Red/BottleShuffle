import Phaser from 'phaser';
import {
  Colors,
  DefaultGameTheme,
  Dimens,
  hexToNumber,
  SemanticShapes,
  type GameTheme,
} from '../../../design-system';
import { SpotlightAnimation } from '../../animations/tutorial/SpotlightAnimation';

export interface SpotlightRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Lightweight contextual spotlight using 4 surrounding translucent scrim rectangles
 * (zero shader cost, never blocks input inside the highlighted region) plus a pulsing
 * rounded gold emphasis frame.
 */
export class TutorialSpotlight extends Phaser.GameObjects.Container {
  private theme: GameTheme;
  private readonly scrimGraphics: Phaser.GameObjects.Graphics;
  private readonly ringGraphics: Phaser.GameObjects.Graphics;
  private readonly pulseAnimation: SpotlightAnimation;

  private viewportW = 1280;
  private viewportH = 720;
  private activeRect: SpotlightRect | null = null;

  public constructor(scene: Phaser.Scene, theme: GameTheme = DefaultGameTheme) {
    super(scene, 0, 0);
    this.theme = theme;
    this.setDepth(450);

    this.scrimGraphics = scene.add.graphics();
    this.ringGraphics = scene.add.graphics();
    this.pulseAnimation = new SpotlightAnimation();

    this.add([this.scrimGraphics, this.ringGraphics]);
    this.setVisible(false);

    scene.add.existing(this);
  }

  public setViewportSize(width: number, height: number): this {
    this.viewportW = Math.max(1, width);
    this.viewportH = Math.max(1, height);
    if (this.activeRect !== null) {
      this.redraw(this.activeRect);
    }
    return this;
  }

  public focusRect(rect: SpotlightRect | null): this {
    this.activeRect = rect;
    if (rect === null || rect.width <= 0 || rect.height <= 0) {
      this.pulseAnimation.stop();
      this.scrimGraphics.clear();
      this.ringGraphics.clear();
      this.setVisible(false);
      return this;
    }

    this.setVisible(true);
    this.redraw(rect);
    this.pulseAnimation.start(this.scene, this.ringGraphics, this.theme.reducedMotion);
    return this;
  }

  public setSuspended(suspended: boolean): this {
    this.pulseAnimation.setPaused(suspended);
    return this;
  }

  public setTheme(theme: GameTheme): this {
    this.theme = theme;
    if (this.activeRect !== null) {
      this.pulseAnimation.start(this.scene, this.ringGraphics, theme.reducedMotion);
    }
    return this;
  }

  private redraw(rect: SpotlightRect): void {
    const pad = 10;
    const holeLeft = Math.max(0, Math.round(rect.x - pad));
    const holeTop = Math.max(0, Math.round(rect.y - pad));
    const holeRight = Math.min(this.viewportW, Math.round(rect.x + rect.width + pad));
    const holeBottom = Math.min(this.viewportH, Math.round(rect.y + rect.height + pad));
    const holeW = Math.max(1, holeRight - holeLeft);
    const holeH = Math.max(1, holeBottom - holeTop);

    this.scrimGraphics.clear();
    this.scrimGraphics.fillStyle(hexToNumber(Colors.Surface.Overlay), 0.36);

    // Top strip
    if (holeTop > 0) {
      this.scrimGraphics.fillRect(0, 0, this.viewportW, holeTop);
    }
    // Bottom strip
    if (holeBottom < this.viewportH) {
      this.scrimGraphics.fillRect(0, holeBottom, this.viewportW, this.viewportH - holeBottom);
    }
    // Left strip
    if (holeLeft > 0) {
      this.scrimGraphics.fillRect(0, holeTop, holeLeft, holeH);
    }
    // Right strip
    if (holeRight < this.viewportW) {
      this.scrimGraphics.fillRect(holeRight, holeTop, this.viewportW - holeRight, holeH);
    }

    this.ringGraphics.clear();
    this.ringGraphics.lineStyle(Dimens.BorderThick + 1, hexToNumber(Colors.Brand.Secondary), 0.95);
    this.ringGraphics.strokeRoundedRect(holeLeft, holeTop, holeW, holeH, SemanticShapes.Card);

    this.ringGraphics.lineStyle(Dimens.BorderThin, hexToNumber(Colors.Brand.PrimaryLight), 0.7);
    this.ringGraphics.strokeRoundedRect(
      holeLeft - 4,
      holeTop - 4,
      holeW + 8,
      holeH + 8,
      SemanticShapes.Card + 4,
    );
  }

  public override destroy(fromScene?: boolean): void {
    this.pulseAnimation.stop();
    super.destroy(fromScene);
  }
}
