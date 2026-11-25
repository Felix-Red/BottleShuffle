import Phaser from 'phaser';
import { DefaultGameTheme, type GameTheme } from '../../theme/GameTheme';
import { ensureMinimumTouchTarget } from '../../tokens/Breakpoints';
import { Colors } from '../../tokens/Colors';
import { Dimens } from '../../tokens/Dimens';
import type { ElevationLevel } from '../../tokens/Elevation';
import { MotionPresets, resolveMotionDuration } from '../../tokens/Motion';
import { SemanticShapes } from '../../tokens/Shapes';
import { createTextStyle, Typography, type TypographyToken } from '../../tokens/Typography';
import { drawIcon, type DesignIconName } from '../common/IconGraphic';
import { drawElevatedSurface } from '../common/SurfaceRenderer';
import { LoadingIndicator } from '../indicators/LoadingIndicator';
import {
  canTriggerButtonAction,
  resolveButtonState,
  type ButtonInteractionState,
} from './buttonState';

export interface BaseButtonConfig {
  readonly x?: number;
  readonly y?: number;
  readonly width?: number;
  readonly height?: number;
  readonly label?: string;
  readonly icon?: DesignIconName;
  readonly iconPosition?: 'left' | 'right';
  readonly enabled?: boolean;
  readonly loading?: boolean;
  readonly visible?: boolean;
  readonly onClick?: () => void;
  readonly theme?: GameTheme;
  readonly minActivationIntervalMs?: number;
}

export interface ButtonStyleSpec {
  readonly fillDefault?: string;
  readonly fillHover?: string;
  readonly fillPressed?: string;
  readonly fillDisabled?: string;
  readonly fillAlphaDefault?: number;
  readonly fillAlphaHover?: number;
  readonly fillAlphaPressed?: number;
  readonly fillAlphaDisabled?: number;
  readonly depthColor?: string;
  readonly depthColorDisabled?: string;
  readonly borderColorDefault?: string;
  readonly borderColorHover?: string;
  readonly borderColorDisabled?: string;
  readonly borderWidth?: number;
  readonly textColorDefault: string;
  readonly textColorHover?: string;
  readonly textColorDisabled: string;
  readonly elevation: ElevationLevel;
  readonly cornerRadius: number;
  readonly typography: TypographyToken;
}

const DEFAULT_ACTIVATION_COOLDOWN_MS = 180;

export class BaseButton extends Phaser.GameObjects.Container {
  protected theme: GameTheme;
  protected buttonWidth: number;
  protected buttonHeight: number;
  protected labelValue: string;
  protected iconName?: DesignIconName;
  protected iconPosition: 'left' | 'right';

  private readonly styleSpec: ButtonStyleSpec;
  private readonly minActivationIntervalMs: number;
  private onClickCallback?: () => void;

  private enabledState: boolean;
  private loadingState: boolean;
  private hoveredState = false;
  private pressedState = false;
  private focusedState = false;
  private lastActivatedAtMs = -Infinity;

  private readonly surfaceGraphics: Phaser.GameObjects.Graphics;
  private readonly iconGraphics: Phaser.GameObjects.Graphics;
  private readonly labelText: Phaser.GameObjects.Text;
  private readonly loadingIndicator: LoadingIndicator;
  private readonly hitZone: Phaser.GameObjects.Zone;
  private activeScaleTween?: Phaser.Tweens.Tween;

  public constructor(scene: Phaser.Scene, config: BaseButtonConfig, styleSpec: ButtonStyleSpec) {
    super(scene, config.x ?? 0, config.y ?? 0);

    this.theme = config.theme ?? DefaultGameTheme;
    this.styleSpec = styleSpec;
    this.buttonWidth = config.width ?? 200;
    this.buttonHeight = Math.max(
      Dimens.ButtonHeightSmall,
      config.height ?? Dimens.ButtonHeightMedium,
    );
    this.labelValue = config.label ?? '';
    this.iconName = config.icon;
    this.iconPosition = config.iconPosition ?? 'left';
    this.enabledState = config.enabled ?? true;
    this.loadingState = config.loading ?? false;
    this.onClickCallback = config.onClick;
    this.minActivationIntervalMs = config.minActivationIntervalMs ?? DEFAULT_ACTIVATION_COOLDOWN_MS;

    this.surfaceGraphics = scene.add.graphics();
    this.iconGraphics = scene.add.graphics();
    this.labelText = scene.add
      .text(
        0,
        0,
        this.labelValue,
        createTextStyle(this.styleSpec.typography, {
          color: this.styleSpec.textColorDefault,
          align: 'center',
        }),
      )
      .setOrigin(0.5);

    this.loadingIndicator = new LoadingIndicator(scene, {
      radius: Math.min(11, Math.floor(this.buttonHeight * 0.22)),
      color: this.styleSpec.textColorDefault,
      theme: this.theme,
      autoStart: false,
    });
    this.loadingIndicator.setVisible(false);

    this.hitZone = scene.add.zone(0, 0, this.buttonWidth, this.buttonHeight).setOrigin(0.5);

    this.add([
      this.surfaceGraphics,
      this.iconGraphics,
      this.labelText,
      this.loadingIndicator,
      this.hitZone,
    ]);

    this.configureHitArea();
    this.bindInputEvents();
    this.setVisible(config.visible ?? true);
    this.refreshVisuals();

    scene.add.existing(this);
  }

  public getInteractionState(): ButtonInteractionState {
    return resolveButtonState({
      enabled: this.enabledState,
      loading: this.loadingState,
      hovered: this.hoveredState,
      pressed: this.pressedState,
      focused: this.focusedState,
    });
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
    }
    this.updateCursorState();
    this.refreshVisuals();
    return this;
  }

  public isLoading(): boolean {
    return this.loadingState;
  }

  public setLoading(loading: boolean): this {
    if (this.loadingState === loading) {
      return this;
    }
    this.loadingState = loading;
    if (loading) {
      this.hoveredState = false;
      this.pressedState = false;
    }
    this.updateCursorState();
    this.refreshVisuals();
    return this;
  }

  public setFocused(focused: boolean): this {
    if (this.focusedState === focused) {
      return this;
    }
    this.focusedState = focused;
    this.refreshVisuals();
    return this;
  }

  public setLabel(label: string): this {
    this.labelValue = label;
    this.labelText.setText(label);
    this.refreshVisuals();
    return this;
  }

  public setIcon(icon?: DesignIconName): this {
    this.iconName = icon;
    this.refreshVisuals();
    return this;
  }

  public setOnClick(callback?: () => void): this {
    this.onClickCallback = callback;
    return this;
  }

  public setButtonSize(width: number, height: number): this {
    this.buttonWidth = Math.max(Dimens.MinTouchTarget, width);
    this.buttonHeight = Math.max(Dimens.ButtonHeightSmall, height);
    this.configureHitArea();
    this.refreshVisuals();
    return this;
  }

  public setTheme(theme: GameTheme): this {
    this.theme = theme;
    this.loadingIndicator.setTheme(theme);
    this.refreshVisuals();
    return this;
  }

  public getButtonDimensions(): { readonly width: number; readonly height: number } {
    return {
      width: this.buttonWidth,
      height: this.buttonHeight,
    };
  }

  private configureHitArea(): void {
    const hitW = ensureMinimumTouchTarget(this.buttonWidth, 1);
    const hitH = ensureMinimumTouchTarget(this.buttonHeight, 1);
    this.hitZone.setSize(hitW, hitH);
    this.hitZone.setInteractive({ useHandCursor: this.enabledState && !this.loadingState });
    this.setSize(this.buttonWidth, this.buttonHeight);
  }

  private updateCursorState(): void {
    const interactive = this.enabledState && !this.loadingState;
    if (this.hitZone.input !== null) {
      this.hitZone.input.cursor = interactive ? 'pointer' : 'default';
    }
  }

  private bindInputEvents(): void {
    this.hitZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, this.handlePointerOver);
    this.hitZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, this.handlePointerOut);
    this.hitZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, this.handlePointerDown);
    this.hitZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, this.handlePointerUp);
    this.scene.input.on(Phaser.Input.Events.POINTER_UP, this.handleGlobalPointerUp);
  }

  private readonly handlePointerOver = (): void => {
    if (!this.enabledState || this.loadingState) {
      return;
    }
    this.hoveredState = true;
    this.refreshVisuals();
    this.animateScale(
      MotionPresets.Hover.scaleTo,
      MotionPresets.Hover.duration,
      MotionPresets.Hover.ease,
    );
  };

  private readonly handlePointerOut = (): void => {
    if (!this.hoveredState && !this.pressedState) {
      return;
    }
    this.hoveredState = false;
    this.pressedState = false;
    this.refreshVisuals();
    this.animateScale(1, MotionPresets.ButtonRelease.duration, MotionPresets.ButtonRelease.ease);
  };

  private readonly handlePointerDown = (): void => {
    if (!this.enabledState || this.loadingState) {
      return;
    }
    this.pressedState = true;
    this.refreshVisuals();
    this.animateScale(
      MotionPresets.ButtonPress.scaleTo,
      MotionPresets.ButtonPress.duration,
      MotionPresets.ButtonPress.ease,
    );
  };

  private readonly handlePointerUp = (): void => {
    if (!this.pressedState) {
      return;
    }
    this.pressedState = false;
    const targetScale = this.hoveredState ? MotionPresets.Hover.scaleTo : 1;
    this.refreshVisuals();
    this.animateScale(
      targetScale,
      MotionPresets.ButtonRelease.duration,
      MotionPresets.ButtonRelease.ease,
    );

    const now = this.scene.time.now;
    if (
      canTriggerButtonAction(
        { enabled: this.enabledState, loading: this.loadingState },
        now,
        this.lastActivatedAtMs,
        this.minActivationIntervalMs,
      )
    ) {
      this.lastActivatedAtMs = now;
      this.onClickCallback?.();
    }
  };

  private readonly handleGlobalPointerUp = (): void => {
    if (!this.pressedState) {
      return;
    }
    this.pressedState = false;
    this.hoveredState = false;
    this.refreshVisuals();
    this.animateScale(1, MotionPresets.ButtonRelease.duration, MotionPresets.ButtonRelease.ease);
  };

  private animateScale(targetScale: number, durationMs: number, ease: string): void {
    this.stopActiveTween();
    const effectiveDuration = resolveMotionDuration(durationMs, this.theme.reducedMotion);
    if (effectiveDuration === 0) {
      this.setScale(targetScale);
      return;
    }

    this.activeScaleTween = this.scene.tweens.add({
      targets: this,
      scaleX: targetScale,
      scaleY: targetScale,
      duration: effectiveDuration,
      ease,
    });
  }

  private stopActiveTween(): void {
    if (this.activeScaleTween !== undefined) {
      this.activeScaleTween.stop();
      this.activeScaleTween = undefined;
    }
  }

  protected refreshVisuals(): void {
    const state = this.getInteractionState();
    const isDisabled = state === 'disabled';
    const isPressed = state === 'pressed';
    const isHovered = state === 'hovered';
    const isLoading = state === 'loading';
    const pressedOffsetY = isPressed ? 2 : 0;

    let fillColor = this.styleSpec.fillDefault;
    let fillAlpha = this.styleSpec.fillAlphaDefault ?? 1;
    let borderColor = this.styleSpec.borderColorDefault;
    let textColor = this.styleSpec.textColorDefault;

    if (isDisabled) {
      fillColor = this.styleSpec.fillDisabled ?? this.styleSpec.fillDefault;
      fillAlpha = this.styleSpec.fillAlphaDisabled ?? 0.65;
      borderColor = this.styleSpec.borderColorDisabled ?? this.styleSpec.borderColorDefault;
      textColor = this.styleSpec.textColorDisabled;
    } else if (isPressed) {
      fillColor = this.styleSpec.fillPressed ?? this.styleSpec.fillDefault;
      fillAlpha = this.styleSpec.fillAlphaPressed ?? this.styleSpec.fillAlphaDefault ?? 1;
      borderColor = this.styleSpec.borderColorHover ?? this.styleSpec.borderColorDefault;
    } else if (isHovered) {
      fillColor = this.styleSpec.fillHover ?? this.styleSpec.fillDefault;
      fillAlpha = this.styleSpec.fillAlphaHover ?? this.styleSpec.fillAlphaDefault ?? 1;
      borderColor = this.styleSpec.borderColorHover ?? this.styleSpec.borderColorDefault;
      textColor = this.styleSpec.textColorHover ?? this.styleSpec.textColorDefault;
    }

    drawElevatedSurface(this.surfaceGraphics, {
      width: this.buttonWidth,
      height: this.buttonHeight,
      radius: this.styleSpec.cornerRadius,
      ...(fillColor !== undefined ? { fillColor } : {}),
      fillAlpha,
      ...(isDisabled && this.styleSpec.depthColorDisabled !== undefined
        ? { depthColor: this.styleSpec.depthColorDisabled }
        : this.styleSpec.depthColor !== undefined
          ? { depthColor: this.styleSpec.depthColor }
          : {}),
      ...(borderColor !== undefined ? { borderColor } : {}),
      borderWidth: this.styleSpec.borderWidth ?? 0,
      borderAlpha: isDisabled ? 0.5 : 1,
      elevation: isDisabled ? 'flat' : this.styleSpec.elevation,
      pressedOffsetY,
      ...(state === 'focused' ? { focusRingColor: Colors.Brand.Secondary } : {}),
    });

    this.iconGraphics.clear();

    if (isLoading) {
      this.labelText.setVisible(false);
      this.loadingIndicator.setPosition(0, pressedOffsetY);
      this.loadingIndicator.setVisible(true);
      this.loadingIndicator.start();
      return;
    }

    this.loadingIndicator.stop();
    this.loadingIndicator.setVisible(false);

    const hasLabel = this.labelValue.trim().length > 0;
    const hasIcon = this.iconName !== undefined;
    const iconSize = Math.min(Dimens.IconMedium, Math.floor(this.buttonHeight * 0.44));
    const gap = hasLabel && hasIcon ? Dimens.Space8 : 0;

    if (hasLabel) {
      const maxLabelWidth = Math.max(
        40,
        this.buttonWidth - Dimens.Space24 - (hasIcon ? iconSize + gap : 0),
      );
      this.labelText.setStyle(
        createTextStyle(this.styleSpec.typography, {
          color: textColor,
          align: 'center',
          wordWrapWidth: maxLabelWidth,
        }),
      );
      this.labelText.setVisible(true);
    } else {
      this.labelText.setVisible(false);
    }

    const textWidth = hasLabel ? this.labelText.width : 0;
    const totalContentWidth = textWidth + (hasIcon ? iconSize : 0) + gap;
    const startX = -totalContentWidth / 2;

    if (hasIcon && this.iconName !== undefined) {
      const iconCenterX =
        this.iconPosition === 'left'
          ? startX + iconSize / 2
          : startX + textWidth + gap + iconSize / 2;
      drawIcon(
        this.iconGraphics,
        this.iconName,
        iconCenterX,
        pressedOffsetY,
        iconSize,
        textColor,
        isDisabled ? 0.65 : 1,
      );
    }

    if (hasLabel) {
      const labelCenterX =
        hasIcon && this.iconPosition === 'left'
          ? startX + iconSize + gap + textWidth / 2
          : hasIcon
            ? startX + textWidth / 2
            : 0;
      this.labelText.setPosition(labelCenterX, pressedOffsetY);
    }
  }

  public override destroy(fromScene?: boolean): void {
    this.stopActiveTween();
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.handleGlobalPointerUp);
    this.hitZone.removeAllListeners();
    super.destroy(fromScene);
  }
}

export const DefaultButtonDefaults = {
  CornerRadius: SemanticShapes.Button,
  Typography: Typography.LabelLarge,
} as const;
