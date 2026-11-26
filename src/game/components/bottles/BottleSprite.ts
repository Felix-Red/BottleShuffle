import Phaser from 'phaser';
import { DefaultGameTheme, type GameTheme } from '../../../design-system/theme/GameTheme';
import { ensureMinimumTouchTarget } from '../../../design-system/tokens/Breakpoints';
import { Colors, hexToNumber, type BottleColorId } from '../../../design-system/tokens/Colors';
import {
  MotionDurations,
  MotionEasings,
  resolveMotionDuration,
} from '../../../design-system/tokens/Motion';
import { EFFECT_TEXTURE_KEYS } from '../../assets/AssetKeys';
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

interface StatePose {
  readonly liftY: number;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly shadowLift: number;
  readonly bottleAlpha: number;
  readonly showSelection: boolean;
  readonly showTrail: boolean;
}

const POSE_BY_STATE: Readonly<Record<BottleVisualState, StatePose>> = {
  default: {
    liftY: 0,
    scaleX: 1,
    scaleY: 1,
    shadowLift: 0,
    bottleAlpha: 1,
    showSelection: false,
    showTrail: false,
  },
  hovered: {
    liftY: -7,
    scaleX: 1.03,
    scaleY: 1.03,
    shadowLift: 7,
    bottleAlpha: 1,
    showSelection: false,
    showTrail: false,
  },
  pressed: {
    liftY: 2,
    scaleX: 1.04,
    scaleY: 0.95,
    shadowLift: 0,
    bottleAlpha: 1,
    showSelection: false,
    showTrail: false,
  },
  selected: {
    liftY: -16,
    scaleX: 1.04,
    scaleY: 1.04,
    shadowLift: 16,
    bottleAlpha: 1,
    showSelection: true,
    showTrail: false,
  },
  swapping: {
    liftY: -22,
    scaleX: 1.05,
    scaleY: 1.05,
    shadowLift: 24,
    bottleAlpha: 0.98,
    showSelection: false,
    showTrail: true,
  },
  disabled: {
    liftY: 0,
    scaleX: 1,
    scaleY: 1,
    shadowLift: 0,
    bottleAlpha: 0.45,
    showSelection: false,
    showTrail: false,
  },
};

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
  private readonly trailContainer: Phaser.GameObjects.Container;
  private readonly bottleImage: Phaser.GameObjects.Image;
  private readonly hitZone: Phaser.GameObjects.Zone;

  private activePoseTween?: Phaser.Tweens.Tween;
  private activeTrailTween?: Phaser.Tweens.Tween;

  public constructor(scene: Phaser.Scene, config: BottleSpriteConfig) {
    super(scene, config.x ?? 0, config.y ?? 0);

    this.theme = config.theme ?? DefaultGameTheme;
    this.bottleId = config.bottleId;
    this.bottleWidth = Math.max(40, config.width ?? 88);
    this.bottleHeight = Math.max(80, config.height ?? this.bottleWidth * 2);
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

    this.trailContainer = this.buildMotionTrail(scene, metadata.colorHex);
    this.trailContainer.setVisible(false);

    this.bottleImage = scene.add
      .image(0, 0, metadata.textureKey)
      .setOrigin(0.5, 1)
      .setDisplaySize(this.bottleWidth, this.bottleHeight);

    this.bodyContainer.add([this.trailContainer, this.selectionIndicator, this.bottleImage]);

    this.hitZone = scene.add
      .zone(
        0,
        -this.bottleHeight / 2,
        ensureMinimumTouchTarget(this.bottleWidth),
        ensureMinimumTouchTarget(this.bottleHeight),
      )
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

  public setBottleId(nextId: BottleColorId): this {
    if (this.bottleId === nextId) {
      return this;
    }
    this.bottleId = nextId;
    const metadata = getBottleMetadata(nextId);
    this.bottleImage.setTexture(metadata.textureKey);
    this.bottleImage.setDisplaySize(this.bottleWidth, this.bottleHeight);
    this.tintMotionTrail(metadata.colorHex);
    return this;
  }

  public setDisplayDimensions(width: number, height?: number): this {
    this.bottleWidth = Math.max(40, width);
    this.bottleHeight = Math.max(80, height ?? this.bottleWidth * 2);

    this.bottleImage.setDisplaySize(this.bottleWidth, this.bottleHeight);
    this.shadow.setBottleWidth(this.bottleWidth);
    this.selectionIndicator
      .setBottleDimensions(this.bottleWidth, this.bottleHeight)
      .setPosition(0, -this.bottleHeight / 2);

    this.hitZone.setPosition(0, -this.bottleHeight / 2);
    this.hitZone.setSize(
      ensureMinimumTouchTarget(this.bottleWidth),
      ensureMinimumTouchTarget(this.bottleHeight),
    );
    this.setSize(this.bottleWidth, this.bottleHeight);
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
    }
    this.updateCursor();
    this.applyVisualState(animate);
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
  }

  private updateCursor(): void {
    if (this.hitZone.input !== null) {
      this.hitZone.input.cursor = this.canAcceptInput() ? 'pointer' : 'default';
    }
  }

  private readonly handleOver = (): void => {
    if (!this.canAcceptInput()) {
      return;
    }
    this.hoveredState = true;
    this.applyVisualState(true);
  };

  private readonly handleOut = (): void => {
    if (!this.hoveredState && !this.pressedState) {
      return;
    }
    this.hoveredState = false;
    this.pressedState = false;
    this.applyVisualState(true);
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
    this.applyVisualState(true);
  };

  private applyVisualState(animate: boolean): void {
    const state = this.getVisualState();
    const pose = POSE_BY_STATE[state];

    this.selectionIndicator.setSelectedVisible(pose.showSelection, animate);
    this.shadow.setElevation(pose.shadowLift, animate);
    this.updateMotionTrail(pose.showTrail);

    if (state === 'disabled') {
      this.bottleImage.setTint(hexToNumber(Colors.Text.Disabled));
    } else {
      this.bottleImage.clearTint();
    }

    const targetAlpha = this.baseOpacity * pose.bottleAlpha;

    this.stopPoseTween();
    const duration = animate
      ? resolveMotionDuration(MotionDurations.Short, this.theme.reducedMotion)
      : 0;

    if (duration === 0) {
      this.bodyContainer.setPosition(0, pose.liftY);
      this.bodyContainer.setScale(pose.scaleX, pose.scaleY);
      this.bottleImage.setAlpha(targetAlpha);
      return;
    }

    this.activePoseTween = this.scene.tweens.add({
      targets: this.bodyContainer,
      y: pose.liftY,
      scaleX: pose.scaleX,
      scaleY: pose.scaleY,
      duration,
      ease: state === 'selected' ? MotionEasings.EaseOutBack : MotionEasings.EaseOutCubic,
      onComplete: () => {
        this.activePoseTween = undefined;
      },
    });
    this.bottleImage.setAlpha(targetAlpha);
  }

  private buildMotionTrail(scene: Phaser.Scene, colorHex: string): Phaser.GameObjects.Container {
    const container = scene.add.container(0, -this.bottleHeight * 0.45);
    const offsets = [
      { x: -this.bottleWidth * 0.48, y: 12, scale: 0.72, alpha: 0.55 },
      { x: -this.bottleWidth * 0.78, y: 20, scale: 0.48, alpha: 0.32 },
      { x: this.bottleWidth * 0.48, y: 12, scale: 0.72, alpha: 0.55 },
    ];
    const tint = hexToNumber(colorHex);

    for (const item of offsets) {
      const dot = scene.add
        .image(item.x, item.y, EFFECT_TEXTURE_KEYS.PARTICLE)
        .setScale(item.scale)
        .setAlpha(item.alpha)
        .setTint(tint);
      container.add(dot);
    }

    return container;
  }

  private tintMotionTrail(colorHex: string): void {
    const tint = hexToNumber(colorHex);
    for (const child of this.trailContainer.list) {
      if (child instanceof Phaser.GameObjects.Image) {
        child.setTint(tint);
      }
    }
  }

  private updateMotionTrail(active: boolean): void {
    this.stopTrailTween();
    this.trailContainer.setVisible(active);
    if (!active || this.theme.reducedMotion) {
      this.trailContainer.setAlpha(active ? 0.65 : 0);
      return;
    }

    this.trailContainer.setAlpha(0.85);
    this.activeTrailTween = this.scene.tweens.add({
      targets: this.trailContainer,
      alpha: { from: 0.85, to: 0.35 },
      duration: MotionDurations.Medium,
      yoyo: true,
      repeat: -1,
      ease: MotionEasings.EaseInOutCubic,
    });
  }

  private stopPoseTween(): void {
    if (this.activePoseTween !== undefined) {
      this.activePoseTween.stop();
      this.activePoseTween = undefined;
    }
  }

  private stopTrailTween(): void {
    if (this.activeTrailTween !== undefined) {
      this.activeTrailTween.stop();
      this.activeTrailTween = undefined;
    }
  }

  public override destroy(fromScene?: boolean): void {
    this.stopPoseTween();
    this.stopTrailTween();
    if (this.interactiveEnabled) {
      this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.handleGlobalUp);
    }
    this.hitZone.removeAllListeners();
    super.destroy(fromScene);
  }
}
