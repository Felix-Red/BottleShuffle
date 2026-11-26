import Phaser from 'phaser';
import type { BottleId } from '../../../core';
import {
  DefaultGameTheme,
  MotionEasings,
  resolveMotionDuration,
  type GameTheme,
} from '../../../design-system';
import { GAMEPLAY_CONFIG } from '../../../config/GameplayConfig';
import type { GameplayBoardLayout } from '../../layout/GameplayLayout';
import { BottleSprite } from '../bottles/BottleSprite';
import { BottleRack } from '../environment/BottleRack';
import { HiddenSequenceRack } from '../environment/HiddenSequenceRack';

export interface GameplayBoardConfig {
  readonly initialSequence: readonly BottleId[];
  readonly layout: GameplayBoardLayout;
  readonly onSlotTap: (slotIndex: number) => void;
  readonly theme?: GameTheme;
}

/**
 * Reusable visual board orchestrating BottleRack, BottleSprites (keyed by stable BottleId),
 * and HiddenSequenceRack. Contains zero puzzle rules or match calculations.
 */
export class GameplayBoard extends Phaser.GameObjects.Container {
  private theme: GameTheme;
  private readonly onSlotTap: (slotIndex: number) => void;

  private readonly hiddenRack: HiddenSequenceRack;
  private readonly rack: BottleRack;
  private readonly bottlesLayer: Phaser.GameObjects.Container;

  private readonly spritesById = new Map<BottleId, BottleSprite>();
  private currentSequence: readonly BottleId[];
  private activeSwapTweens: Phaser.Tweens.Tween[] = [];

  public constructor(scene: Phaser.Scene, config: GameplayBoardConfig) {
    super(scene, 0, 0);

    this.theme = config.theme ?? DefaultGameTheme;
    this.onSlotTap = config.onSlotTap;
    this.currentSequence = [...config.initialSequence];

    this.hiddenRack = new HiddenSequenceRack(scene, {
      x: config.layout.hiddenRackX,
      y: config.layout.hiddenRackY,
      slotCount: config.initialSequence.length,
      availableWidth: config.layout.hiddenRackWidth,
      rows: config.layout.hiddenRows,
      showLabel: true,
      label: 'SECRET SEQUENCE',
      theme: this.theme,
    });

    this.rack = new BottleRack(scene, {
      x: config.layout.rackX,
      y: config.layout.rackY,
      bottleCount: config.initialSequence.length,
      availableWidth: config.layout.rackAvailableWidth,
      availableHeight: config.layout.rackAvailableHeight,
      aspectRatio: config.layout.rackLayout.orientation === 'landscape' ? 16 / 9 : 9 / 16,
      verticalSpacing: config.layout.rackVerticalSpacing,
      maxBottleWidth: config.layout.rackLayout.bottleWidth,
      maxBottleHeight: config.layout.rackLayout.bottleHeight,
    });

    this.bottlesLayer = scene.add.container(0, 0);
    this.add([this.hiddenRack, this.rack, this.bottlesLayer]);

    this.createBottleSprites(config.initialSequence);
    this.applyLayout(config.layout);

    scene.add.existing(this);
  }

  public applyLayout(layout: GameplayBoardLayout): this {
    this.stopSwapTweens();

    this.rack.setPosition(layout.rackX, layout.rackY);
    this.rack.resize(
      layout.rackAvailableWidth,
      layout.rackAvailableHeight,
      layout.rackLayout.orientation === 'landscape' ? 16 / 9 : 9 / 16,
      {
        verticalSpacing: layout.rackVerticalSpacing,
        maxBottleWidth: layout.rackLayout.bottleWidth,
        maxBottleHeight: layout.rackLayout.bottleHeight,
      },
    );

    this.hiddenRack.setPosition(layout.hiddenRackX, layout.hiddenRackY);
    this.hiddenRack.resize(layout.hiddenRackWidth, layout.hiddenRows);
    this.hiddenRack.setScale(layout.hiddenScale);
    this.hiddenRack.setCaptionVisible(layout.showHiddenLabel);

    this.reconcileBottlePositions(this.currentSequence);
    return this;
  }

  public syncState(
    sequence: readonly BottleId[],
    selectedSlotIndex: number | null,
    focusedSlotIndex: number | null,
    inputEnabled: boolean,
    reconcilePositions = false,
  ): this {
    this.currentSequence = [...sequence];

    if (reconcilePositions) {
      this.stopSwapTweens();
      this.reconcileBottlePositions(sequence);
    }

    for (let slotIndex = 0; slotIndex < sequence.length; slotIndex += 1) {
      const bottleId = sequence[slotIndex];
      if (bottleId === undefined) {
        continue;
      }
      const sprite = this.spritesById.get(bottleId);
      if (sprite !== undefined) {
        sprite.setEnabled(inputEnabled);
        sprite.setSelected(selectedSlotIndex === slotIndex, true);
      }

      this.rack.setSlotOccupied(slotIndex, true);
      this.rack.setSlotHighlighted(
        slotIndex,
        inputEnabled && focusedSlotIndex === slotIndex && selectedSlotIndex !== slotIndex,
      );
    }

    return this;
  }

  /**
   * Animates the two swapped bottles between their logical slot positions using
   * lightweight position tweens, then reconciles cleanly with authoritative state.
   */
  public animateSwap(
    firstIndex: number,
    secondIndex: number,
    nextSequence: readonly BottleId[],
    onComplete: () => void,
  ): this {
    this.stopSwapTweens();
    this.currentSequence = [...nextSequence];

    // After the swap in nextSequence, the bottle now at firstIndex came from secondIndex and vice versa
    const movedToFirstId = nextSequence[firstIndex];
    const movedToSecondId = nextSequence[secondIndex];
    const spriteA = movedToFirstId !== undefined ? this.spritesById.get(movedToFirstId) : undefined;
    const spriteB =
      movedToSecondId !== undefined ? this.spritesById.get(movedToSecondId) : undefined;

    const targetPosA = this.rack.getSlotWorldPosition(firstIndex);
    const targetPosB = this.rack.getSlotWorldPosition(secondIndex);

    const duration = resolveMotionDuration(
      GAMEPLAY_CONFIG.swapTransitionDurationMs,
      this.theme.reducedMotion,
    );

    if (duration === 0 || spriteA === undefined || spriteB === undefined) {
      this.reconcileBottlePositions(nextSequence);
      onComplete();
      return this;
    }

    spriteA.setSelected(false, false);
    spriteB.setSelected(false, false);
    spriteA.setSwapping(true, true, true);
    spriteB.setSwapping(true, true, true);
    this.bottlesLayer.bringToTop(spriteA);
    this.bottlesLayer.bringToTop(spriteB);

    let finishedCount = 0;
    const handleOneComplete = (): void => {
      finishedCount += 1;
      if (finishedCount < 2) {
        return;
      }
      this.activeSwapTweens = [];
      spriteA.setSwapping(false, true, true);
      spriteB.setSwapping(false, true, true);
      this.reconcileBottlePositions(this.currentSequence);
      onComplete();
    };

    this.activeSwapTweens.push(
      this.scene.tweens.add({
        targets: spriteA,
        x: targetPosA.x,
        y: targetPosA.y,
        duration,
        ease: MotionEasings.EaseInOutCubic,
        onComplete: handleOneComplete,
      }),
      this.scene.tweens.add({
        targets: spriteB,
        x: targetPosB.x,
        y: targetPosB.y,
        duration,
        ease: MotionEasings.EaseInOutCubic,
        onComplete: handleOneComplete,
      }),
    );

    return this;
  }

  public reconcileImmediate(sequence: readonly BottleId[]): this {
    this.stopSwapTweens();
    this.currentSequence = [...sequence];
    this.reconcileBottlePositions(sequence);
    return this;
  }

  public setTheme(theme: GameTheme): this {
    this.theme = theme;
    this.hiddenRack.setTheme(theme);
    for (const sprite of this.spritesById.values()) {
      sprite.setTheme(theme);
    }
    return this;
  }

  private createBottleSprites(sequence: readonly BottleId[]): void {
    const rackLayout = this.rack.getLayout();

    for (let slotIndex = 0; slotIndex < sequence.length; slotIndex += 1) {
      const bottleId = sequence[slotIndex];
      if (bottleId === undefined) {
        continue;
      }

      const slotPos = this.rack.getSlotWorldPosition(slotIndex);
      const sprite = new BottleSprite(this.scene, {
        bottleId,
        x: slotPos.x,
        y: slotPos.y,
        width: rackLayout.bottleWidth,
        height: rackLayout.bottleHeight,
        theme: this.theme,
        onInteract: (clickedId) => {
          const currentSlotIndex = this.currentSequence.indexOf(clickedId);
          if (currentSlotIndex !== -1) {
            this.onSlotTap(currentSlotIndex);
          }
        },
      });

      this.spritesById.set(bottleId, sprite);
      this.bottlesLayer.add(sprite);
      this.rack.setSlotOccupied(slotIndex, true);
    }
  }

  private reconcileBottlePositions(sequence: readonly BottleId[]): void {
    const rackLayout = this.rack.getLayout();

    for (let slotIndex = 0; slotIndex < sequence.length; slotIndex += 1) {
      const bottleId = sequence[slotIndex];
      if (bottleId === undefined) {
        continue;
      }
      const sprite = this.spritesById.get(bottleId);
      if (sprite === undefined) {
        continue;
      }
      const pos = this.rack.getSlotWorldPosition(slotIndex);
      sprite.setSwapping(false, true, false);
      sprite.setDisplayDimensions(rackLayout.bottleWidth, rackLayout.bottleHeight);
      sprite.setPosition(pos.x, pos.y);
    }
  }

  private stopSwapTweens(): void {
    for (const tween of this.activeSwapTweens) {
      tween.stop();
    }
    this.activeSwapTweens = [];
    for (const sprite of this.spritesById.values()) {
      sprite.setSwapping(false, true, false);
    }
  }

  public override destroy(fromScene?: boolean): void {
    this.stopSwapTweens();
    this.spritesById.clear();
    super.destroy(fromScene);
  }
}
