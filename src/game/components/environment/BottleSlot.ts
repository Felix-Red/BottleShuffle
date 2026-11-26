import Phaser from 'phaser';
import { Colors, hexToNumber } from '../../../design-system/tokens/Colors';
import { Dimens } from '../../../design-system/tokens/Dimens';
import { Shapes } from '../../../design-system/tokens/Shapes';

export interface BottleSlotConfig {
  readonly slotIndex: number;
  readonly x?: number;
  readonly y?: number;
  readonly width: number;
  readonly height: number;
  readonly occupied?: boolean;
  readonly highlighted?: boolean;
}

export class BottleSlot extends Phaser.GameObjects.Container {
  public readonly slotIndex: number;
  private slotWidth: number;
  private slotHeight: number;
  private occupiedState: boolean;
  private highlightedState: boolean;

  private readonly guideGraphics: Phaser.GameObjects.Graphics;

  public constructor(scene: Phaser.Scene, config: BottleSlotConfig) {
    super(scene, config.x ?? 0, config.y ?? 0);

    this.slotIndex = config.slotIndex;
    this.slotWidth = Math.max(36, config.width);
    this.slotHeight = Math.max(72, config.height);
    this.occupiedState = config.occupied ?? false;
    this.highlightedState = config.highlighted ?? false;

    this.guideGraphics = scene.add.graphics();
    this.add(this.guideGraphics);

    this.setSize(this.slotWidth, this.slotHeight);
    this.redraw();

    scene.add.existing(this);
  }

  public isOccupied(): boolean {
    return this.occupiedState;
  }

  public setOccupied(occupied: boolean): this {
    if (this.occupiedState === occupied) {
      return this;
    }
    this.occupiedState = occupied;
    this.redraw();
    return this;
  }

  public isHighlighted(): boolean {
    return this.highlightedState;
  }

  /**
   * Neutral interaction highlight (e.g. swap target emphasis).
   * Never encodes correctness or hidden sequence information.
   */
  public setHighlighted(highlighted: boolean): this {
    if (this.highlightedState === highlighted) {
      return this;
    }
    this.highlightedState = highlighted;
    this.redraw();
    return this;
  }

  public setSlotDimensions(width: number, height: number): this {
    this.slotWidth = Math.max(36, width);
    this.slotHeight = Math.max(72, height);
    this.setSize(this.slotWidth, this.slotHeight);
    this.redraw();
    return this;
  }

  private redraw(): void {
    this.guideGraphics.clear();

    // Subtle resting pad on shelf when empty
    if (!this.occupiedState) {
      const padW = this.slotWidth * 0.72;
      const padH = Math.max(8, Math.round(this.slotWidth * 0.14));
      this.guideGraphics.fillStyle(hexToNumber(Colors.Surface.ElevatedSurface), 0.35);
      this.guideGraphics.fillEllipse(0, -2, padW, padH);
      this.guideGraphics.lineStyle(Dimens.BorderThin, hexToNumber(Colors.Surface.Border), 0.55);
      this.guideGraphics.strokeRoundedRect(
        -this.slotWidth * 0.42,
        -this.slotHeight * 0.92,
        this.slotWidth * 0.84,
        this.slotHeight * 0.88,
        Shapes.Medium,
      );
    }

    // Optional neutral highlight (soft purple rim — never green)
    if (this.highlightedState) {
      const pad = 6;
      this.guideGraphics.fillStyle(hexToNumber(Colors.Brand.PrimaryLight), 0.12);
      this.guideGraphics.fillRoundedRect(
        -this.slotWidth / 2 - pad,
        -this.slotHeight - pad,
        this.slotWidth + pad * 2,
        this.slotHeight + pad * 2,
        Shapes.Large,
      );
      this.guideGraphics.lineStyle(
        Dimens.BorderMedium,
        hexToNumber(Colors.Brand.PrimaryLight),
        0.85,
      );
      this.guideGraphics.strokeRoundedRect(
        -this.slotWidth / 2 - pad,
        -this.slotHeight - pad,
        this.slotWidth + pad * 2,
        this.slotHeight + pad * 2,
        Shapes.Large,
      );
    }
  }
}
