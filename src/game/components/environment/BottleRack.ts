import Phaser from 'phaser';
import { Dimens } from '../../../design-system/tokens/Dimens';
import { ENVIRONMENT_TEXTURE_KEYS } from '../../assets/AssetKeys';
import {
  calculateBottleRackLayout,
  type BottleRackLayoutInput,
  type BottleRackLayoutResult,
  type BottleSlotLayout,
} from './bottleLayout';
import { BottleSlot } from './BottleSlot';

export interface BottleRackConfig {
  readonly x?: number;
  readonly y?: number;
  readonly bottleCount: number;
  readonly availableWidth: number;
  readonly availableHeight: number;
  readonly aspectRatio?: number;
  readonly horizontalSpacing?: number;
  readonly verticalSpacing?: number;
  readonly maxBottleWidth?: number;
  readonly maxBottleHeight?: number;
}

export class BottleRack extends Phaser.GameObjects.Container {
  private layoutOptions: Omit<
    BottleRackLayoutInput,
    'bottleCount' | 'availableWidth' | 'availableHeight'
  >;
  private bottleCount: number;
  private availableWidth: number;
  private availableHeight: number;
  private layoutResult: BottleRackLayoutResult;

  private readonly shelvesLayer: Phaser.GameObjects.Container;
  private readonly slotsLayer: Phaser.GameObjects.Container;
  private readonly slots: BottleSlot[] = [];

  public constructor(scene: Phaser.Scene, config: BottleRackConfig) {
    super(scene, config.x ?? 0, config.y ?? 0);

    this.bottleCount = config.bottleCount;
    this.availableWidth = config.availableWidth;
    this.availableHeight = config.availableHeight;
    this.layoutOptions = {
      ...(config.aspectRatio !== undefined ? { aspectRatio: config.aspectRatio } : {}),
      ...(config.horizontalSpacing !== undefined
        ? { horizontalSpacing: config.horizontalSpacing }
        : {}),
      ...(config.verticalSpacing !== undefined ? { verticalSpacing: config.verticalSpacing } : {}),
      ...(config.maxBottleWidth !== undefined ? { maxBottleWidth: config.maxBottleWidth } : {}),
      ...(config.maxBottleHeight !== undefined ? { maxBottleHeight: config.maxBottleHeight } : {}),
    };

    this.shelvesLayer = scene.add.container(0, 0);
    this.slotsLayer = scene.add.container(0, 0);
    this.add([this.shelvesLayer, this.slotsLayer]);

    this.layoutResult = this.computeLayout();
    this.rebuildVisuals();

    scene.add.existing(this);
  }

  public getLayout(): BottleRackLayoutResult {
    return this.layoutResult;
  }

  public getSlotCount(): number {
    return this.layoutResult.bottleCount;
  }

  public getSlot(slotIndex: number): BottleSlot | undefined {
    return this.slots[slotIndex];
  }

  public getSlotLayout(slotIndex: number): BottleSlotLayout | undefined {
    return this.layoutResult.slots[slotIndex];
  }

  public getSlotWorldPosition(slotIndex: number): { readonly x: number; readonly y: number } {
    const slot = this.layoutResult.slots[slotIndex];
    if (slot === undefined) {
      return { x: this.x, y: this.y };
    }
    return {
      x: this.x + slot.x * this.scaleX,
      y: this.y + slot.y * this.scaleY,
    };
  }

  public setSlotOccupied(slotIndex: number, occupied: boolean): this {
    this.slots[slotIndex]?.setOccupied(occupied);
    return this;
  }

  public setSlotHighlighted(slotIndex: number, highlighted: boolean): this {
    this.slots[slotIndex]?.setHighlighted(highlighted);
    return this;
  }

  public setBottleCount(count: number): this {
    this.bottleCount = count;
    this.layoutResult = this.computeLayout();
    this.rebuildVisuals();
    return this;
  }

  public resize(
    availableWidth: number,
    availableHeight: number,
    aspectRatio?: number,
    options?: Partial<
      Pick<
        BottleRackLayoutInput,
        'maxBottleWidth' | 'maxBottleHeight' | 'horizontalSpacing' | 'verticalSpacing'
      >
    >,
  ): this {
    this.availableWidth = availableWidth;
    this.availableHeight = availableHeight;
    this.layoutOptions = {
      ...this.layoutOptions,
      ...(aspectRatio !== undefined ? { aspectRatio } : {}),
      ...(options ?? {}),
    };
    this.layoutResult = this.computeLayout();
    this.rebuildVisuals();
    return this;
  }

  private computeLayout(): BottleRackLayoutResult {
    return calculateBottleRackLayout({
      bottleCount: this.bottleCount,
      availableWidth: this.availableWidth,
      availableHeight: this.availableHeight,
      ...this.layoutOptions,
    });
  }

  private rebuildVisuals(): void {
    const previousOccupied = this.slots.map((slot) => slot.isOccupied());
    const previousHighlighted = this.slots.map((slot) => slot.isHighlighted());

    this.shelvesLayer.removeAll(true);
    this.slotsLayer.removeAll(true);
    this.slots.length = 0;

    // Render one polished wooden shelf plank + front edge per row
    for (const row of this.layoutResult.rowLayouts) {
      const shelfTopH = Math.max(20, Math.round(row.shelfThickness * 1.2));
      const edgeH = Math.max(12, Math.round(row.shelfThickness * 0.72));
      const shelfWidth = row.shelfWidth + Dimens.Space16;

      const shelfTop = this.scene.add
        .image(0, row.shelfY - 4, ENVIRONMENT_TEXTURE_KEYS.SHELF)
        .setOrigin(0.5, 0.25)
        .setDisplaySize(shelfWidth, shelfTopH);

      const shelfEdge = this.scene.add
        .image(0, row.shelfY + shelfTopH * 0.62, ENVIRONMENT_TEXTURE_KEYS.SHELF_EDGE)
        .setOrigin(0.5, 0)
        .setDisplaySize(shelfWidth, edgeH);

      this.shelvesLayer.add([shelfEdge, shelfTop]);
    }

    // Render deterministic visual slot markers
    for (const slotSpec of this.layoutResult.slots) {
      const slot = new BottleSlot(this.scene, {
        slotIndex: slotSpec.slotIndex,
        x: slotSpec.x,
        y: slotSpec.y,
        width: slotSpec.width,
        height: slotSpec.height,
        occupied: previousOccupied[slotSpec.slotIndex] ?? false,
        highlighted: previousHighlighted[slotSpec.slotIndex] ?? false,
      });
      this.slots.push(slot);
      this.slotsLayer.add(slot);
    }

    this.setSize(this.layoutResult.rackWidth, this.layoutResult.rackHeight);
  }
}
