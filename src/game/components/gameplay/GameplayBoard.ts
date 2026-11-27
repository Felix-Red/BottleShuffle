import Phaser from 'phaser';
import type { BottleId } from '../../../core';
import { DefaultGameTheme, type GameTheme } from '../../../design-system';
import { playBottleSwapAnimation } from '../../animations/bottle/BottleSwapAnimation';
import {
  resolveAnimationPolicy,
  type AnimationPolicy,
} from '../../animations/core/AnimationPolicy';
import type { SafeTrajectoryBounds } from '../../animations/utils/AnimationCurves';
import type { GameplayBoardLayout } from '../../layout/GameplayLayout';
import { BottleSprite } from '../bottles/BottleSprite';
import { BottleRack } from '../environment/BottleRack';
import { HiddenSequenceRack } from '../environment/HiddenSequenceRack';

export interface GameplayBoardConfig {
  readonly initialSequence: readonly BottleId[];
  readonly layout: GameplayBoardLayout;
  readonly onSlotTap: (slotIndex: number) => void;
  readonly theme?: GameTheme;
  readonly policy?: AnimationPolicy;
  readonly safeBounds?: SafeTrajectoryBounds;
}

/**
 * Reusable visual board orchestrating BottleRack, BottleSprites (keyed by stable BottleId),
 * and HiddenSequenceRack. Contains zero puzzle rules or match calculations.
 */
export class GameplayBoard extends Phaser.GameObjects.Container {
  private theme: GameTheme;
  private policy: AnimationPolicy;
  private safeBounds?: SafeTrajectoryBounds;
  private readonly onSlotTap: (slotIndex: number) => void;

  private readonly hiddenRack: HiddenSequenceRack;
  private readonly rack: BottleRack;
  private readonly bottlesLayer: Phaser.GameObjects.Container;

  private readonly spritesById = new Map<BottleId, BottleSprite>();
  private currentSequence: readonly BottleId[];
  private cancelSwapAnimation?: () => void;

  public constructor(scene: Phaser.Scene, config: GameplayBoardConfig) {
    super(scene, 0, 0);

    this.theme = config.theme ?? DefaultGameTheme;
    this.policy = config.policy ?? resolveAnimationPolicy(this.theme.reducedMotion);
    this.safeBounds = config.safeBounds;
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
    this.applyLayout(config.layout, config.safeBounds);

    scene.add.existing(this);
  }

  public applyLayout(layout: GameplayBoardLayout, safeBounds?: SafeTrajectoryBounds): this {
    this.stopSwapTweens();
    if (safeBounds !== undefined) {
      this.safeBounds = safeBounds;
    }

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

  public getRackVisualBounds(): {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  } {
    const rackLayout = this.rack.getLayout();
    return {
      x: this.x + this.rack.x,
      y: this.y + this.rack.y,
      width: rackLayout.rackWidth,
      height: rackLayout.rackHeight,
    };
  }

  public getSlotScreenBounds(slotIndex: number): {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  } | null {
    const rackLayout = this.rack.getLayout();
    if (slotIndex < 0 || slotIndex >= rackLayout.bottleCount) {
      return null;
    }
    const pos = this.rack.getSlotWorldPosition(slotIndex);
    const w = rackLayout.bottleWidth;
    const h = rackLayout.bottleHeight;
    // BottleSprite uses bottom-center origin (0.5, 1) resting on the wooden shelf
    return {
      x: Math.round(this.x + pos.x - w / 2),
      y: Math.round(this.y + pos.y - h),
      width: Math.round(w),
      height: Math.round(h),
    };
  }

  public getHiddenRackScreenBounds(): {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  } {
    const comp = this.hiddenRack.getCompartmentBounds();
    const w = comp.width * this.hiddenRack.scaleX;
    const h = comp.height * this.hiddenRack.scaleY;
    return {
      x: Math.round(this.x + this.hiddenRack.x - w / 2),
      y: Math.round(this.y + this.hiddenRack.y - h / 2),
      width: Math.round(w),
      height: Math.round(h),
    };
  }

  /**
   * Rebuilds the visual racks and bottle sprites in place when switching between
   * tutorial fixtures with different bottle counts or bottle sets.
   */
  public loadSequence(
    sequence: readonly BottleId[],
    layout: GameplayBoardLayout,
    safeBounds?: SafeTrajectoryBounds,
  ): this {
    this.stopSwapTweens();
    this.currentSequence = [...sequence];
    for (const sprite of this.spritesById.values()) {
      sprite.destroy();
    }
    this.spritesById.clear();
    this.bottlesLayer.removeAll(true);

    this.rack.setBottleCount(sequence.length);
    this.hiddenRack.setSlotCount(sequence.length);
    this.applyLayout(layout, safeBounds);
    this.createBottleSprites(sequence);
    this.reconcileBottlePositions(sequence);
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
   * Animates the two swapped bottles using the multi-stage curved swap animation
   * (Anticipation -> Opposing Quadratic Bezier Movement -> Landing Squash & Settle),
   * returning a cancellation callback for safe interruption.
   */
  public animateSwap(
    firstIndex: number,
    secondIndex: number,
    nextSequence: readonly BottleId[],
    onComplete: () => void,
    onLanding?: () => void,
  ): () => void {
    this.stopSwapTweens();
    this.currentSequence = [...nextSequence];

    // After the swap in nextSequence, the bottle now at firstIndex came from secondIndex and vice versa
    const movedToFirstId = nextSequence[firstIndex];
    const movedToSecondId = nextSequence[secondIndex];
    const spriteMovingToFirst =
      movedToFirstId !== undefined ? this.spritesById.get(movedToFirstId) : undefined;
    const spriteMovingToSecond =
      movedToSecondId !== undefined ? this.spritesById.get(movedToSecondId) : undefined;

    const slotFirstPos = this.rack.getSlotWorldPosition(firstIndex);
    const slotSecondPos = this.rack.getSlotWorldPosition(secondIndex);

    if (spriteMovingToFirst === undefined || spriteMovingToSecond === undefined) {
      this.reconcileBottlePositions(nextSequence);
      onLanding?.();
      onComplete();
      return () => undefined;
    }

    // spriteMovingToSecond starts at firstIndex -> goes to secondIndex
    // spriteMovingToFirst starts at secondIndex -> goes to firstIndex
    const cancel = playBottleSwapAnimation({
      scene: this.scene,
      spriteA: spriteMovingToSecond,
      spriteB: spriteMovingToFirst,
      fromA: slotFirstPos,
      fromB: slotSecondPos,
      bottlesLayer: this.bottlesLayer,
      policy: this.policy,
      ...(this.safeBounds !== undefined ? { bounds: this.safeBounds } : {}),
      ...(onLanding !== undefined ? { onLanding } : {}),
      onComplete: () => {
        this.cancelSwapAnimation = undefined;
        this.reconcileBottlePositions(this.currentSequence);
        onComplete();
      },
    });

    this.cancelSwapAnimation = cancel;
    return () => {
      if (this.cancelSwapAnimation === cancel) {
        this.cancelSwapAnimation = undefined;
      }
      cancel();
      this.reconcileBottlePositions(this.currentSequence);
    };
  }

  public reconcileImmediate(sequence: readonly BottleId[]): this {
    this.stopSwapTweens();
    this.currentSequence = [...sequence];
    this.reconcileBottlePositions(sequence);
    return this;
  }

  public setPolicy(policy: AnimationPolicy): this {
    this.policy = policy;
    return this;
  }

  public setTheme(theme: GameTheme): this {
    this.theme = theme;
    this.policy = resolveAnimationPolicy(theme.reducedMotion, this.policy.timeScale);
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
        hitWidth: rackLayout.hitWidth,
        hitHeight: rackLayout.hitHeight,
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
      sprite.resetVisualTransform();
      sprite.setDisplayDimensions(
        rackLayout.bottleWidth,
        rackLayout.bottleHeight,
        rackLayout.hitWidth,
        rackLayout.hitHeight,
      );
      sprite.setPosition(pos.x, pos.y);
    }
  }

  private stopSwapTweens(): void {
    if (this.cancelSwapAnimation !== undefined) {
      const cancel = this.cancelSwapAnimation;
      this.cancelSwapAnimation = undefined;
      cancel();
    }
  }

  public override destroy(fromScene?: boolean): void {
    this.stopSwapTweens();
    this.spritesById.clear();
    super.destroy(fromScene);
  }
}
