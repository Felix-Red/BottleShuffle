import Phaser from 'phaser';
import { DefaultGameTheme, type GameTheme } from '../../theme/GameTheme';
import { Colors } from '../../tokens/Colors';
import { Dimens } from '../../tokens/Dimens';
import { MotionPresets, resolveMotionDuration } from '../../tokens/Motion';
import { SemanticShapes } from '../../tokens/Shapes';
import { createTextStyle, Typography } from '../../tokens/Typography';
import { drawIcon, type DesignIconName } from '../common/IconGraphic';
import { drawElevatedSurface } from '../common/SurfaceRenderer';

export type ToastVariant = 'success' | 'info' | 'warning' | 'error';

export interface ToastShowOptions {
  readonly message: string;
  readonly variant?: ToastVariant;
  readonly durationMs?: number;
}

export interface ToastConfig {
  readonly position?: 'top' | 'bottom';
  readonly marginY?: number;
  readonly defaultDurationMs?: number;
  readonly theme?: GameTheme;
}

const TOAST_DEPTH = 1100;
const TOAST_MIN_WIDTH = 240;
const TOAST_MAX_WIDTH = 440;
const TOAST_HEIGHT = 50;

function getVariantVisuals(variant: ToastVariant): {
  readonly accent: string;
  readonly icon: DesignIconName;
} {
  switch (variant) {
    case 'success':
      return { accent: Colors.Semantic.Success, icon: 'check' };
    case 'warning':
      return { accent: Colors.Semantic.Warning, icon: 'warning' };
    case 'error':
      return { accent: Colors.Semantic.Error, icon: 'error' };
    case 'info':
    default:
      return { accent: Colors.Semantic.Info, icon: 'info' };
  }
}

export class Toast extends Phaser.GameObjects.Container {
  private theme: GameTheme;
  private readonly placement: 'top' | 'bottom';
  private readonly marginY: number;
  private readonly defaultDurationMs: number;

  private readonly surfaceGraphics: Phaser.GameObjects.Graphics;
  private readonly iconGraphics: Phaser.GameObjects.Graphics;
  private readonly messageText: Phaser.GameObjects.Text;

  private currentVariant: ToastVariant = 'info';
  private currentWidth = 300;
  private activeTween?: Phaser.Tweens.Tween;
  private dismissTimer?: Phaser.Time.TimerEvent;
  private showing = false;

  public constructor(scene: Phaser.Scene, config: ToastConfig = {}) {
    super(scene, 0, 0);

    this.theme = config.theme ?? DefaultGameTheme;
    this.placement = config.position ?? 'bottom';
    this.marginY = config.marginY ?? Dimens.Space24;
    this.defaultDurationMs = config.defaultDurationMs ?? 2400;

    this.setDepth(TOAST_DEPTH);

    this.surfaceGraphics = scene.add.graphics();
    this.iconGraphics = scene.add.graphics();
    this.messageText = scene.add
      .text(
        0,
        0,
        '',
        createTextStyle(Typography.LabelMedium, {
          color: Colors.Text.Primary,
        }),
      )
      .setOrigin(0, 0.5);

    this.add([this.surfaceGraphics, this.iconGraphics, this.messageText]);
    this.setVisible(false);

    scene.add.existing(this);
  }

  public show(options: ToastShowOptions): this {
    this.clearTimersAndTweens();

    this.currentVariant = options.variant ?? 'info';
    this.showing = true;

    const maxWidth = Math.min(TOAST_MAX_WIDTH, this.scene.scale.width - Dimens.Space32);
    const maxTextWidth = Math.max(120, maxWidth - Dimens.Space64);

    this.messageText.setStyle(
      createTextStyle(Typography.LabelMedium, {
        color: Colors.Text.Primary,
        wordWrapWidth: maxTextWidth,
      }),
    );
    this.messageText.setText(options.message);

    this.currentWidth = Math.min(
      maxWidth,
      Math.max(TOAST_MIN_WIDTH, Math.ceil(this.messageText.width) + Dimens.Space64 + Dimens.Space8),
    );
    const toastHeight = Math.max(TOAST_HEIGHT, Math.ceil(this.messageText.height) + Dimens.Space20);

    this.redraw(toastHeight);
    this.positionForViewport(this.scene.scale.width, this.scene.scale.height);

    const targetY = this.y;
    const enterOffset = this.placement === 'bottom' ? 18 : -18;
    const duration = resolveMotionDuration(MotionPresets.FadeIn.duration, this.theme.reducedMotion);

    this.setVisible(true);

    if (duration === 0) {
      this.setAlpha(1);
    } else {
      this.setAlpha(0);
      this.setY(targetY + enterOffset);
      this.activeTween = this.scene.tweens.add({
        targets: this,
        alpha: 1,
        y: targetY,
        duration,
        ease: MotionPresets.FadeIn.ease,
      });
    }

    const displayMs = Math.max(400, options.durationMs ?? this.defaultDurationMs);
    this.dismissTimer = this.scene.time.delayedCall(displayMs, () => {
      this.hide();
    });

    return this;
  }

  public hide(): this {
    if (!this.showing) {
      return this;
    }

    this.showing = false;
    this.clearTimersAndTweens();

    const duration = resolveMotionDuration(
      MotionPresets.FadeOut.duration,
      this.theme.reducedMotion,
    );
    if (duration === 0) {
      this.setVisible(false);
      return this;
    }

    const exitOffset = this.placement === 'bottom' ? 12 : -12;
    this.activeTween = this.scene.tweens.add({
      targets: this,
      alpha: 0,
      y: this.y + exitOffset,
      duration,
      ease: MotionPresets.FadeOut.ease,
      onComplete: () => {
        this.setVisible(false);
      },
    });

    return this;
  }

  public resize(viewportWidth: number, viewportHeight: number): this {
    if (this.showing) {
      this.positionForViewport(viewportWidth, viewportHeight);
    }
    return this;
  }

  public setTheme(theme: GameTheme): this {
    this.theme = theme;
    return this;
  }

  private positionForViewport(viewportWidth: number, viewportHeight: number): void {
    const x = viewportWidth / 2;
    const y =
      this.placement === 'bottom'
        ? viewportHeight - this.marginY - TOAST_HEIGHT / 2
        : this.marginY + TOAST_HEIGHT / 2;
    this.setPosition(x, y);
  }

  private redraw(height: number): void {
    const { accent, icon } = getVariantVisuals(this.currentVariant);

    drawElevatedSurface(this.surfaceGraphics, {
      width: this.currentWidth,
      height,
      radius: SemanticShapes.Toast,
      fillColor: Colors.Surface.ElevatedSurface,
      borderColor: accent,
      borderWidth: Dimens.BorderMedium,
      elevation: 'floating',
    });

    const leftX = -this.currentWidth / 2 + Dimens.Space20 + Dimens.Space4;
    this.iconGraphics.clear();
    drawIcon(this.iconGraphics, icon, leftX, 0, Dimens.IconMedium, accent);

    this.messageText.setPosition(leftX + Dimens.Space20, 0);
  }

  private clearTimersAndTweens(): void {
    if (this.dismissTimer !== undefined) {
      this.dismissTimer.remove(false);
      this.dismissTimer = undefined;
    }
    if (this.activeTween !== undefined) {
      this.activeTween.stop();
      this.activeTween = undefined;
    }
  }

  public override destroy(fromScene?: boolean): void {
    this.clearTimersAndTweens();
    super.destroy(fromScene);
  }
}
