import Phaser from 'phaser';
import { DefaultGameTheme, type GameTheme } from '../../../design-system/theme/GameTheme';
import { Colors } from '../../../design-system/tokens/Colors';
import { Dimens } from '../../../design-system/tokens/Dimens';
import { createTextStyle, Typography } from '../../../design-system/tokens/Typography';
import { ENVIRONMENT_TEXTURE_KEYS } from '../../assets/AssetKeys';
import { clampRackBottleCount } from './bottleLayout';
import { HiddenSequenceSlot } from './HiddenSequenceSlot';

export interface HiddenSequenceRackConfig {
  readonly x?: number;
  readonly y?: number;
  readonly slotCount: number;
  readonly availableWidth: number;
  readonly rows?: 1 | 2;
  readonly showLabel?: boolean;
  readonly label?: string;
  readonly theme?: GameTheme;
}

export class HiddenSequenceRack extends Phaser.GameObjects.Container {
  private theme: GameTheme;
  private slotCount: number;
  private availableWidth: number;
  private preferredRows?: 1 | 2;
  private readonly showLabel: boolean;
  private readonly labelString: string;

  private compartmentWidth = 320;
  private compartmentHeight = 84;

  private readonly compartmentImage: Phaser.GameObjects.Image;
  private readonly slotsLayer: Phaser.GameObjects.Container;
  private readonly captionText?: Phaser.GameObjects.Text;
  private readonly slots: HiddenSequenceSlot[] = [];

  public constructor(scene: Phaser.Scene, config: HiddenSequenceRackConfig) {
    super(scene, config.x ?? 0, config.y ?? 0);

    this.theme = config.theme ?? DefaultGameTheme;
    this.slotCount = clampRackBottleCount(config.slotCount);
    this.availableWidth = Math.max(200, config.availableWidth);
    this.preferredRows = config.rows;
    this.showLabel = config.showLabel ?? true;
    this.labelString = config.label ?? 'SECRET SEQUENCE';

    this.compartmentImage = scene.add
      .image(0, 0, ENVIRONMENT_TEXTURE_KEYS.HIDDEN_COMPARTMENT)
      .setOrigin(0.5);

    this.slotsLayer = scene.add.container(0, 0);
    this.add([this.compartmentImage, this.slotsLayer]);

    if (this.showLabel) {
      this.captionText = scene.add
        .text(
          0,
          0,
          this.labelString,
          createTextStyle(Typography.LabelSmall, {
            color: Colors.Text.Secondary,
            align: 'center',
            scale: 0.88,
          }),
        )
        .setOrigin(0.5, 0)
        .setAlpha(0.75);
      this.add(this.captionText);
    }

    this.rebuild();
    scene.add.existing(this);
  }

  public getSlotCount(): number {
    return this.slotCount;
  }

  public getSlot(index: number): HiddenSequenceSlot | undefined {
    return this.slots[index];
  }

  public getCompartmentBounds(): { readonly width: number; readonly height: number } {
    return {
      width: this.compartmentWidth,
      height: this.compartmentHeight,
    };
  }

  public setSlotCount(count: number, rows?: 1 | 2): this {
    this.slotCount = clampRackBottleCount(count);
    if (rows !== undefined) {
      this.preferredRows = rows;
    }
    this.rebuild();
    return this;
  }

  public resize(availableWidth: number, rows?: 1 | 2): this {
    this.availableWidth = Math.max(200, availableWidth);
    if (rows !== undefined) {
      this.preferredRows = rows;
    }
    this.rebuild();
    return this;
  }

  /**
   * Future win-state reveal interface.
   * Accepts an externally computed ordered array of texture keys.
   */
  public revealSequence(textureKeys: readonly string[], animate = true): this {
    for (let i = 0; i < this.slots.length; i += 1) {
      const textureKey = textureKeys[i];
      if (textureKey !== undefined) {
        this.slots[i]?.reveal(textureKey, animate);
      }
    }
    return this;
  }

  public concealAll(): this {
    for (const slot of this.slots) {
      slot.conceal();
    }
    return this;
  }

  public setTheme(theme: GameTheme): this {
    this.theme = theme;
    for (const slot of this.slots) {
      slot.setTheme(theme);
    }
    return this;
  }

  private rebuild(): void {
    this.slotsLayer.removeAll(true);
    this.slots.length = 0;

    const padX = Dimens.Space16;
    const padY = Dimens.Space12;
    const gapX = this.availableWidth < 520 ? Dimens.Space6 : Dimens.Space10;
    const gapY = Dimens.Space8;

    const rows: 1 | 2 =
      this.preferredRows ?? (this.slotCount >= 6 && this.availableWidth < 560 ? 2 : 1);

    const rowCounts =
      rows === 1
        ? [this.slotCount]
        : [Math.ceil(this.slotCount / 2), this.slotCount - Math.ceil(this.slotCount / 2)];
    const maxCols = Math.max(...rowCounts);

    const usableW = Math.max(160, this.availableWidth - padX * 2);
    const maxSlotW = Math.floor((usableW - gapX * (maxCols - 1)) / maxCols);
    const slotW = Math.min(82, Math.max(40, maxSlotW));
    const slotH = Math.min(64, Math.max(40, Math.round(slotW * 0.78)));

    const innerContentW = maxCols * slotW + Math.max(0, maxCols - 1) * gapX;
    const innerContentH = rows * slotH + Math.max(0, rows - 1) * gapY;

    this.compartmentWidth = Math.min(this.availableWidth, innerContentW + padX * 2);
    this.compartmentHeight = innerContentH + padY * 2;

    this.compartmentImage.setDisplaySize(this.compartmentWidth, this.compartmentHeight);

    let slotIndex = 0;
    const startY = -innerContentH / 2 + slotH / 2;

    for (let r = 0; r < rows; r += 1) {
      const countInRow = rowCounts[r] ?? 0;
      const rowW = countInRow * slotW + Math.max(0, countInRow - 1) * gapX;
      const startX = -rowW / 2 + slotW / 2;
      const y = startY + r * (slotH + gapY);

      for (let c = 0; c < countInRow; c += 1) {
        const slot = new HiddenSequenceSlot(this.scene, {
          slotIndex,
          x: Math.round(startX + c * (slotW + gapX)),
          y: Math.round(y),
          width: slotW,
          height: slotH,
          theme: this.theme,
        });
        this.slots.push(slot);
        this.slotsLayer.add(slot);
        slotIndex += 1;
      }
    }

    if (this.captionText !== undefined) {
      this.captionText.setPosition(0, this.compartmentHeight / 2 + Dimens.Space10);
    }

    const totalH = this.compartmentHeight + (this.captionText !== undefined ? Dimens.Space32 : 0);
    this.setSize(this.compartmentWidth, totalH);
  }
}
