import Phaser from 'phaser';
import {
  canTriggerButtonAction,
  Colors,
  createTextStyle,
  DefaultGameTheme,
  drawElevatedSurface,
  drawIcon,
  ensureMinimumTouchTarget,
  MotionPresets,
  resolveButtonState,
  resolveMotionDuration,
  SemanticShapes,
  Typography,
  type GameTheme,
} from '../../../design-system';

export interface ContinueButtonConfig {
  readonly x?: number;
  readonly y?: number;
  readonly width?: number;
  readonly height?: number;
  readonly label: string;
  readonly supportingText: string;
  readonly enabled?: boolean;
  readonly onClick?: () => void;
  readonly theme?: GameTheme;
}

const ACTIVATION_COOLDOWN_MS = 220;

/**
 * Dominant primary CTA button for the production Home screen.
 * Displays the Play icon, bold primary label (PLAY / CONTINUE / PLAY AGAIN),
 * and supporting level subtitle using the established PrimaryButton brand tokens.
 */
export class ContinueButton extends Phaser.GameObjects.Container {
  private theme: GameTheme;
  private btnWidth: number;
  private btnHeight: number;
  private mainLabel: string;
  private supportingText: string;
  private enabledState: boolean;
  private hovered = false;
  private pressed = false;
  private focused = false;
  private lastActivatedAtMs = -Infinity;
  private onClickCallback?: () => void;

  private readonly surfaceGraphics: Phaser.GameObjects.Graphics;
  private readonly iconGraphics: Phaser.GameObjects.Graphics;
  private readonly mainLabelText: Phaser.GameObjects.Text;
  private readonly supportingLabelText: Phaser.GameObjects.Text;
  private readonly hitZone: Phaser.GameObjects.Zone;
  private scaleTween?: Phaser.Tweens.Tween;

  public constructor(scene: Phaser.Scene, config: ContinueButtonConfig) {
    super(scene, config.x ?? 0, config.y ?? 0);

    this.theme = config.theme ?? DefaultGameTheme;
    this.btnWidth = Math.max(200, config.width ?? 360);
    this.btnHeight = Math.max(54, config.height ?? 74);
    this.mainLabel = config.label;
    this.supportingText = config.supportingText;
    this.enabledState = config.enabled ?? true;
    this.onClickCallback = config.onClick;

    this.surfaceGraphics = scene.add.graphics();
    this.iconGraphics = scene.add.graphics();

    this.mainLabelText = scene.add
      .text(
        0,
        0,
        this.mainLabel,
        createTextStyle(Typography.TitleLarge, {
          color: Colors.Text.OnPrimary,
          align: 'center',
        }),
      )
      .setOrigin(0.5);

    this.supportingLabelText = scene.add
      .text(
        0,
        0,
        this.supportingText,
        createTextStyle(Typography.LabelSmall, {
          color: Colors.Text.OnPrimary,
          align: 'center',
        }),
      )
      .setOrigin(0.5)
      .setAlpha(0.88);

    this.hitZone = scene.add
      .zone(0, 0, ensureMinimumTouchTarget(this.btnWidth), ensureMinimumTouchTarget(this.btnHeight))
      .setOrigin(0.5);

    this.add([
      this.surfaceGraphics,
      this.iconGraphics,
      this.mainLabelText,
      this.supportingLabelText,
      this.hitZone,
    ]);

    this.bindInput();
    this.refreshVisuals();

    scene.add.existing(this);
  }

  public setActionText(label: string, supportingText: string): this {
    if (this.mainLabel === label && this.supportingText === supportingText) {
      return this;
    }
    this.mainLabel = label;
    this.supportingText = supportingText;
    this.mainLabelText.setText(label);
    this.supportingLabelText.setText(supportingText);
    this.refreshVisuals();
    return this;
  }

  public setButtonSize(width: number, height: number): this {
    this.btnWidth = Math.max(200, width);
    this.btnHeight = Math.max(54, height);
    this.hitZone.setSize(
      ensureMinimumTouchTarget(this.btnWidth),
      ensureMinimumTouchTarget(this.btnHeight),
    );
    this.setSize(this.btnWidth, this.btnHeight);
    this.refreshVisuals();
    return this;
  }

  public setEnabled(enabled: boolean): this {
    if (this.enabledState === enabled) {
      return this;
    }
    this.enabledState = enabled;
    if (!enabled) {
      this.hovered = false;
      this.pressed = false;
    }
    if (this.hitZone.input !== null) {
      this.hitZone.input.cursor = enabled ? 'pointer' : 'default';
    }
    this.refreshVisuals();
    return this;
  }

  public setFocused(focused: boolean): this {
    if (this.focused === focused) {
      return this;
    }
    this.focused = focused;
    this.refreshVisuals();
    return this;
  }

  public setTheme(theme: GameTheme): this {
    this.theme = theme;
    this.refreshVisuals();
    return this;
  }

  private bindInput(): void {
    this.hitZone.setInteractive({ useHandCursor: this.enabledState });
    this.hitZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, this.handleOver);
    this.hitZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, this.handleOut);
    this.hitZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, this.handleDown);
    this.hitZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, this.handleUp);
    this.scene.input.on(Phaser.Input.Events.POINTER_UP, this.handleGlobalUp);
  }

  private readonly handleOver = (): void => {
    if (!this.enabledState) {
      return;
    }
    this.hovered = true;
    this.refreshVisuals();
    this.animateScale(
      MotionPresets.Hover.scaleTo,
      MotionPresets.Hover.duration,
      MotionPresets.Hover.ease,
    );
  };

  private readonly handleOut = (): void => {
    if (!this.hovered && !this.pressed) {
      return;
    }
    this.hovered = false;
    this.pressed = false;
    this.refreshVisuals();
    this.animateScale(1, MotionPresets.ButtonRelease.duration, MotionPresets.ButtonRelease.ease);
  };

  private readonly handleDown = (): void => {
    if (!this.enabledState) {
      return;
    }
    this.pressed = true;
    this.refreshVisuals();
    this.animateScale(
      MotionPresets.ButtonPress.scaleTo,
      MotionPresets.ButtonPress.duration,
      MotionPresets.ButtonPress.ease,
    );
  };

  private readonly handleUp = (): void => {
    if (!this.pressed) {
      return;
    }
    this.pressed = false;
    this.refreshVisuals();
    this.animateScale(
      this.hovered ? MotionPresets.Hover.scaleTo : 1,
      MotionPresets.ButtonRelease.duration,
      MotionPresets.ButtonRelease.ease,
    );

    const now = this.scene.time.now;
    if (
      canTriggerButtonAction(
        { enabled: this.enabledState, loading: false },
        now,
        this.lastActivatedAtMs,
        ACTIVATION_COOLDOWN_MS,
      )
    ) {
      this.lastActivatedAtMs = now;
      this.onClickCallback?.();
    }
  };

  private readonly handleGlobalUp = (): void => {
    if (!this.pressed) {
      return;
    }
    this.pressed = false;
    this.hovered = false;
    this.refreshVisuals();
    this.animateScale(1, MotionPresets.ButtonRelease.duration, MotionPresets.ButtonRelease.ease);
  };

  private animateScale(target: number, durationMs: number, ease: string): void {
    if (this.scaleTween !== undefined) {
      this.scaleTween.stop();
      this.scaleTween = undefined;
    }
    const duration = resolveMotionDuration(durationMs, this.theme.reducedMotion);
    if (duration === 0) {
      this.setScale(target);
      return;
    }
    this.scaleTween = this.scene.tweens.add({
      targets: this,
      scaleX: target,
      scaleY: target,
      duration,
      ease,
      onComplete: () => {
        this.scaleTween = undefined;
      },
    });
  }

  private refreshVisuals(): void {
    const state = resolveButtonState({
      enabled: this.enabledState,
      loading: false,
      hovered: this.hovered,
      pressed: this.pressed,
      focused: this.focused,
    });

    const isDisabled = state === 'disabled';
    const isPressed = state === 'pressed';
    const isHovered = state === 'hovered';
    const pressedOffsetY = isPressed ? 2 : 0;

    const fillColor = isDisabled
      ? Colors.Surface.ElevatedSurface
      : isPressed
        ? Colors.Brand.PrimaryDark
        : isHovered
          ? Colors.Brand.PrimaryLight
          : Colors.Brand.Primary;

    drawElevatedSurface(this.surfaceGraphics, {
      width: this.btnWidth,
      height: this.btnHeight,
      radius: SemanticShapes.Button,
      fillColor,
      depthColor: isDisabled ? Colors.Surface.Surface : Colors.Brand.PrimaryDark,
      elevation: isDisabled ? 'flat' : 'high',
      pressedOffsetY,
      ...(this.focused ? { focusRingColor: Colors.Brand.Secondary } : {}),
    });

    const compact = this.btnHeight < 64;
    const textColor = isDisabled ? Colors.Text.Disabled : Colors.Text.OnPrimary;
    this.mainLabelText.setStyle(
      createTextStyle(compact ? Typography.TitleMedium : Typography.TitleLarge, {
        color: textColor,
        align: 'center',
      }),
    );
    this.supportingLabelText.setStyle(
      createTextStyle(Typography.LabelSmall, {
        color: textColor,
        align: 'center',
        scale: compact ? 0.86 : 0.94,
      }),
    );

    const iconSize = compact ? 22 : 26;
    const contentShiftX = 12;
    this.mainLabelText.setPosition(contentShiftX, (compact ? -9 : -11) + pressedOffsetY);
    this.supportingLabelText.setPosition(contentShiftX, (compact ? 11 : 14) + pressedOffsetY);

    const iconX = -Math.max(this.mainLabelText.width, this.supportingLabelText.width) / 2 - 10;
    this.iconGraphics.clear();
    drawIcon(
      this.iconGraphics,
      'play',
      iconX,
      pressedOffsetY,
      iconSize,
      textColor,
      isDisabled ? 0.55 : 1,
    );
  }

  public override destroy(fromScene?: boolean): void {
    if (this.scaleTween !== undefined) {
      this.scaleTween.stop();
      this.scaleTween = undefined;
    }
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.handleGlobalUp);
    this.hitZone.removeAllListeners();
    super.destroy(fromScene);
  }
}
