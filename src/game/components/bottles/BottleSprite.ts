import Phaser from 'phaser';
import { DefaultGameTheme, type GameTheme } from '../../../design-system/theme/GameTheme';
import { ensureMinimumTouchTarget } from '../../../design-system/tokens/Breakpoints';
import { Colors, hexToNumber, type BottleColorId } from '../../../design-system/tokens/Colors';
import {
  MotionDurations,
  MotionEasings,
  MotionParams,
  resolveMotionDuration,
} from '../../../design-system/tokens/Motion';
import { getBottleMetadata } from '../../assets/BottleCatalog';
import { BottleSelectionIndicator } from './BottleSelectionIndicator';
import { BottleShadow } from './BottleShadow';

export type BottleVisualState =
  'default' | 'hovered' | 'pressed' | 'selected' | 'swapping' | 'disabled';

export interface BottleSpriteConfig {
  readonly bottleId: BottleColorId;
  readonly x?: number;
  readonly y?: number;
  readonly width?: number;
  readonly height?: number;
  readonly hitWidth?: number;
  readonly hitHeight?: number;
  readonly scale?: number;
  readonly visible?: boolean;
  readonly opacity?: number;
  readonly enabled?: boolean;
  readonly selected?: boolean;
  readonly interactive?: boolean;
  readonly selectionColor?: string;
  readonly onInteract?: (bottleId: BottleColorId) => void;
  readonly theme?: GameTheme;
}

export interface BottleSwapTransform {
  readonly liftY?: number;
  readonly scaleX?: number;
  readonly scaleY?: number;
  readonly rotation?: number;
  readonly shadowOffsetX?: number;
  readonly shadowOffsetY?: number;
  readonly shadowElevation?: number;
}

interface ResolvedBottlePose {
  readonly liftY: number;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly shadowLift: number;
  readonly bottleAlpha: number;
  readonly showSelection: boolean;
  readonly durationMs: number;
  readonly ease: string;
}

export class BottleSprite extends Phaser.GameObjects.Container {
  private theme: GameTheme;
  private bottleId: BottleColorId;
  private bottleWidth: number;
  private bottleHeight: number;
  private baseOpacity: number;
  private enabledState: boolean;
  private selectedState: boolean;
  private hoveredState = false;
  private pressedState = false;
  private swappingState = false;
  private blockInputWhileSwapping = true;
  private forcedVisualState?: BottleVisualState;
  private readonly interactiveEnabled: boolean;
  private onInteractCallback?: (bottleId: BottleColorId) => void;

  private readonly shadow: BottleShadow;
  private readonly bodyContainer: Phaser.GameObjects.Container;
  private readonly selectionIndicator: BottleSelectionIndicator;
  private readonly bottleImage: Phaser.GameObjects.Image;
  private readonly hitZone: Phaser.GameObjects.Zone;

  private activePoseTween?: Phaser.Tweens.Tween;

  public constructor(scene: Phaser.Scene, config: BottleSpriteConfig) {
    super(scene, config.x ?? 0, config.y ?? 0);

    this.theme = config.theme ?? DefaultGameTheme;
    this.bottleId = config.bottleId;
    this.bottleWidth = Math.max(16, config.width ?? 88);
    this.bottleHeight = Math.max(32, config.height ?? this.bottleWidth * 2);
    this.baseOpacity = config.opacity ?? 1;
    this.enabledState = config.enabled ?? true;
    this.selectedState = config.selected ?? false;
    this.interactiveEnabled = config.interactive ?? true;
    this.onInteractCallback = config.onInteract;

    const metadata = getBottleMetadata(this.bottleId);

    this.shadow = new BottleShadow(scene, {
      x: 0,
      y: 2,
      bottleWidth: this.bottleWidth,
      theme: this.theme,
    });

    this.bodyContainer = scene.add.container(0, 0);

    this.selectionIndicator = new BottleSelectionIndicator(scene, {
      x: 0,
      y: -this.bottleHeight / 2,
      bottleWidth: this.bottleWidth,
      bottleHeight: this.bottleHeight,
      color: config.selectionColor ?? Colors.Brand.Secondary,
      visible: false,
      theme: this.theme,
    });

    this.bottleImage = scene.add
      .image(0, 0, metadata.textureKey)
      .setOrigin(0.5, 1)
      .setDisplaySize(this.bottleWidth, this.bottleHeight);

    this.bodyContainer.add([this.selectionIndicator, this.bottleImage]);

    const initialHitW = Math.max(
      this.bottleWidth,
      config.hitWidth ?? ensureMinimumTouchTarget(this.bottleWidth),
    );
    const initialHitH = Math.max(
      this.bottleHeight,
      config.hitHeight ?? ensureMinimumTouchTarget(this.bottleHeight),
    );

    this.hitZone = scene.add
      .zone(0, -this.bottleHeight / 2, initialHitW, initialHitH)
      .setOrigin(0.5);

    this.add([this.shadow, this.bodyContainer, this.hitZone]);

    if (config.scale !== undefined) {
      this.setScale(config.scale);
    }
    this.setVisible(config.visible ?? true);
    this.setSize(this.bottleWidth, this.bottleHeight);

    if (this.interactiveEnabled) {
      this.bindInputEvents();
    }

    this.applyVisualState(false);

    scene.add.existing(this);
  }

  public getBottleId(): BottleColorId {
    return this.bottleId;
  }

  public getBottleDimensions(): { readonly width: number; readonly height: number } {
    return {
      width: this.bottleWidth,
      height: this.bottleHeight,
    };
  }

  public getBodyContainer(): Phaser.GameObjects.Container {
    return this.bodyContainer;
  }

  public getShadow(): BottleShadow {
    return this.shadow;
  }

  public setBottleId(nextId: BottleColorId): this {
    if (this.bottleId === nextId) {
      return this;
    }
    this.bottleId = nextId;
    const metadata = getBottleMetadata(nextId);
    this.bottleImage.setTexture(metadata.textureKey);
    this.bottleImage.setDisplaySize(this.bottleWidth, this.bottleHeight);
    return this;
  }

  public setDisplayDimensions(
    width: number,
    height?: number,
    hitWidth?: number,
    hitHeight?: number,
  ): this {
    this.bottleWidth = Math.max(16, width);
    this.bottleHeight = Math.max(32, height ?? this.bottleWidth * 2);

    this.bottleImage.setDisplaySize(this.bottleWidth, this.bottleHeight);
    this.shadow.setBottleWidth(this.bottleWidth);
    this.selectionIndicator
      .setBottleDimensions(this.bottleWidth, this.bottleHeight)
      .setPosition(0, -this.bottleHeight / 2);

    this.hitZone.setPosition(0, -this.bottleHeight / 2);
    this.hitZone.setSize(
      Math.max(this.bottleWidth, hitWidth ?? ensureMinimumTouchTarget(this.bottleWidth)),
      Math.max(this.bottleHeight, hitHeight ?? ensureMinimumTouchTarget(this.bottleHeight)),
    );
    this.setSize(this.bottleWidth, this.bottleHeight);
    if (!this.swappingState) {
      this.applyVisualState(false);
    }
    return this;
  }

  public setOpacity(alpha: number): this {
    this.baseOpacity = Math.min(1, Math.max(0, alpha));
    this.applyVisualState(false);
    return this;
  }

  public isEnabled(): boolean {
    return this.enabledState;
  }

  public setEnabled(enabled: boolean): this {
    if (this.enabledState === enabled) {
      return this;
    }
    this.enabledState = enabled;
    if (!enabled) {
      this.hoveredState = false;
      this.pressedState = false;
      this.selectedState = false;
    }
    this.updateCursor();
    this.applyVisualState(true);
    return this;
  }

  public isSelected(): boolean {
    return this.selectedState;
  }

  public setSelected(selected: boolean, animate = true): this {
    if (this.selectedState === selected) {
      return this;
    }
    this.selectedState = selected;
    this.applyVisualState(animate);
    return this;
  }

  public setSwapping(swapping: boolean, blockInput = true, animate = true): this {
    this.swappingState = swapping;
    this.blockInputWhileSwapping = blockInput;
    if (swapping) {
      this.hoveredState = false;
      this.pressedState = false;
      this.stopPoseTween();
      this.selectionIndicator.setSelectedVisible(false, false);
    }
    this.updateCursor();
    if (!swapping) {
      this.bodyContainer.setRotation(0);
      this.shadow.resetShadow();
      this.applyVisualState(animate);
    }
    return this;
  }

  /**
   * Direct per-frame transform hook used by BottleSwapAnimation during anticipation,
   * curved Bezier flight, and landing squash-and-stretch.
   */
  public setSwapTransform(transform: BottleSwapTransform): this {
    this.stopPoseTween();
    if (transform.liftY !== undefined) {
      this.bodyContainer.setY(transform.liftY);
    }
    if (transform.scaleX !== undefined || transform.scaleY !== undefined) {
      this.bodyContainer.setScale(
        transform.scaleX ?? this.bodyContainer.scaleX,
        transform.scaleY ?? this.bodyContainer.scaleY,
      );
    }
    if (transform.rotation !== undefined) {
      this.bodyContainer.setRotation(transform.rotation);
    }
    if (transform.shadowOffsetX !== undefined || transform.shadowOffsetY !== undefined) {
      this.shadow.setGroundOffset(transform.shadowOffsetX ?? 0, transform.shadowOffsetY ?? 0);
    }
    if (transform.shadowElevation !== undefined) {
      this.shadow.setElevationImmediate(transform.shadowElevation, this.bottleHeight * 0.45);
    }
    return this;
  }

  /**
   * Immediately stops active bottle pose tweens and restores clean scale, rotation,
   * elevation, opacity, and grounded shadow state.
   */
  public resetVisualTransform(): this {
    this.stopPoseTween();
    this.swappingState = false;
    this.pressedState = false;
    this.bodyContainer.setPosition(0, 0);
    this.bodyContainer.setScale(1, 1);
    this.bodyContainer.setRotation(0);
    this.shadow.resetShadow();
    this.updateCursor();
    this.applyVisualState(false);
    return this;
  }

  /**
   * Explicit visual-state override for showcases or externally driven previews.
   * Passing undefined restores normal interactive state resolution.
   */
  public setForcedVisualState(state?: BottleVisualState, animate = true): this {
    this.forcedVisualState = state;
    this.applyVisualState(animate);
    return this;
  }

  public getVisualState(): BottleVisualState {
    if (this.forcedVisualState !== undefined) {
      return this.forcedVisualState;
    }
    if (!this.enabledState) {
      return 'disabled';
    }
    if (this.swappingState) {
      return 'swapping';
    }
    if (this.pressedState) {
      return 'pressed';
    }
    if (this.selectedState) {
      return 'selected';
    }
    if (this.hoveredState) {
      return 'hovered';
    }
    return 'default';
  }

  public setOnInteract(callback?: (bottleId: BottleColorId) => void): this {
    this.onInteractCallback = callback;
    return this;
  }

  public setSelectionColor(colorHex: string): this {
    this.selectionIndicator.setIndicatorColor(colorHex);
    return this;
  }

  public setTheme(theme: GameTheme): this {
    this.theme = theme;
    this.shadow.setTheme(theme);
    this.selectionIndicator.setTheme(theme);
    if (!this.swappingState) {
      this.applyVisualState(false);
    }
    return this;
  }

  private canAcceptInput(): boolean {
    if (!this.interactiveEnabled || !this.enabledState) {
      return false;
    }
    if (this.swappingState && this.blockInputWhileSwapping) {
      return false;
    }
    return true;
  }

  private bindInputEvents(): void {
    this.hitZone.setInteractive({ useHandCursor: this.canAcceptInput() });
    this.hitZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, this.handleOver);
    this.hitZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, this.handleOut);
    this.hitZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, this.handleDown);
    this.hitZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, this.handleUp);
    this.scene.input.on(Phaser.Input.Events.POINTER_UP, this.handleGlobalUp);
    this.scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.handleGlobalUp);
  }

  private updateCursor(): void {
    if (this.hitZone.input !== null) {
      this.hitZone.input.cursor = this.canAcceptInput() ? 'pointer' : 'default';
    }
  }

  private readonly handleOver = (pointer: Phaser.Input.Pointer): void => {
    // Touch devices do not depend on hover behaviour
    if (!this.canAcceptInput() || pointer.wasTouch) {
      return;
    }
    this.hoveredState = true;
    // Do not let hover override an active selection or swap animation
    if (!this.selectedState && !this.swappingState && !this.pressedState) {
      this.applyVisualState(true);
    }
  };

  private readonly handleOut = (): void => {
    if (!this.hoveredState && !this.pressedState) {
      return;
    }
    this.hoveredState = false;
    this.pressedState = false;
    if (!this.swappingState) {
      this.applyVisualState(true);
    }
  };

  private readonly handleDown = (): void => {
    if (!this.canAcceptInput()) {
      return;
    }
    this.pressedState = true;
    this.applyVisualState(true);
  };

  private readonly handleUp = (): void => {
    if (!this.pressedState) {
      return;
    }
    this.pressedState = false;
    this.applyVisualState(true);
    if (this.canAcceptInput()) {
      this.onInteractCallback?.(this.bottleId);
    }
  };

  private readonly handleGlobalUp = (): void => {
    if (!this.pressedState) {
      return;
    }
    this.pressedState = false;
    this.hoveredState = false;
    if (!this.swappingState) {
      this.applyVisualState(true);
    }
  };

  private resolvePose(state: BottleVisualState): ResolvedBottlePose {
    const reduced = this.theme.reducedMotion;
    const hoverLift = reduced
      ? 0
      : Math.round(this.bottleHeight * MotionParams.hoverElevationRatio);
    const selectLift = reduced
      ? 0
      : Math.round(this.bottleHeight * MotionParams.selectionElevationRatio);
    const swapLift = reduced
      ? 0
      : Math.round(this.bottleHeight * MotionParams.swapAnticipationLiftRatio * 2);

    switch (state) {
      case 'hovered':
        return {
          liftY: -hoverLift,
          scaleX: reduced ? 1 : MotionParams.hoverScale,
          scaleY: reduced ? 1 : MotionParams.hoverScale,
          shadowLift: hoverLift,
          bottleAlpha: 1,
          showSelection: false,
          durationMs: MotionDurations.BottleHover,
          ease: MotionEasings.EaseOut,
        };
      case 'pressed': {
        const baseLift = this.selectedState ? -selectLift : 0;
        return {
          liftY: baseLift + (reduced ? 0 : 2),
          scaleX: reduced ? 0.98 : MotionParams.pressScaleX,
          scaleY: reduced ? 0.98 : MotionParams.pressScaleY,
          shadowLift: this.selectedState ? selectLift * 0.8 : 0,
          bottleAlpha: 1,
          showSelection: this.selectedState,
          durationMs: MotionDurations.ButtonPress,
          ease: MotionEasings.EaseOutQuad,
        };
      }
      case 'selected':
        return {
          liftY: -selectLift,
          scaleX: reduced ? 1 : MotionParams.selectionScale,
          scaleY: reduced ? 1 : MotionParams.selectionScale,
          shadowLift: selectLift,
          bottleAlpha: 1,
          showSelection: true,
          durationMs: MotionDurations.BottleSelection,
          ease: MotionEasings.SoftOvershoot,
        };
      case 'swapping':
        return {
          liftY: -swapLift,
          scaleX: 1,
          scaleY: 1,
          shadowLift: swapLift,
          bottleAlpha: 1,
          showSelection: false,
          durationMs: MotionDurations.SwapAnticipation,
          ease: MotionEasings.EaseOut,
        };
      case 'disabled':
        return {
          liftY: 0,
          scaleX: 1,
          scaleY: 1,
          shadowLift: 0,
          bottleAlpha: 0.48,
          showSelection: false,
          durationMs: MotionDurations.BottleDeselection,
          ease: MotionEasings.EaseOut,
        };
      case 'default':
      default:
        return {
          liftY: 0,
          scaleX: 1,
          scaleY: 1,
          shadowLift: 0,
          bottleAlpha: 1,
          showSelection: false,
          durationMs: MotionDurations.BottleDeselection,
          ease: MotionEasings.GentleSettle,
        };
    }
  }

  private applyVisualState(animate: boolean): void {
    const state = this.getVisualState();
    const pose = this.resolvePose(state);

    this.selectionIndicator.setSelectedVisible(pose.showSelection, animate);
    this.shadow.setElevation(pose.shadowLift, animate, this.bottleHeight * 0.25);

    if (state === 'disabled') {
      this.bottleImage.setTint(hexToNumber(Colors.Text.Disabled));
    } else {
      this.bottleImage.clearTint();
    }

    const targetAlpha = this.baseOpacity * pose.bottleAlpha;

    this.stopPoseTween();
    const duration = animate ? resolveMotionDuration(pose.durationMs, this.theme.reducedMotion) : 0;

    if (duration === 0) {
      this.bodyContainer.setPosition(0, pose.liftY);
      this.bodyContainer.setScale(pose.scaleX, pose.scaleY);
      this.bodyContainer.setRotation(0);
      this.bottleImage.setAlpha(targetAlpha);
      return;
    }

    this.activePoseTween = this.scene.tweens.add({
      targets: this.bodyContainer,
      y: pose.liftY,
      scaleX: pose.scaleX,
      scaleY: pose.scaleY,
      rotation: 0,
      duration,
      ease: pose.ease,
      onComplete: () => {
        this.activePoseTween = undefined;
      },
    });
    this.bottleImage.setAlpha(targetAlpha);
  }

  private stopPoseTween(): void {
    if (this.activePoseTween !== undefined) {
      this.activePoseTween.stop();
      this.activePoseTween = undefined;
    }
  }

  public override destroy(fromScene?: boolean): void {
    this.stopPoseTween();
    if (this.interactiveEnabled) {
      this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.handleGlobalUp);
      this.scene.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.handleGlobalUp);
    }
    this.hitZone.removeAllListeners();
    super.destroy(fromScene);
  }
}
