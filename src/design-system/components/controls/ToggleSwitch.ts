import Phaser from 'phaser';
import { DefaultGameTheme, type GameTheme } from '../../theme/GameTheme';
import { ensureMinimumTouchTarget } from '../../tokens/Breakpoints';
import { Colors, hexToNumber } from '../../tokens/Colors';
import { Dimens } from '../../tokens/Dimens';
import { MotionDurations, MotionEasings, resolveMotionDuration } from '../../tokens/Motion';
import { createTextStyle, Typography } from '../../tokens/Typography';

export interface ToggleSwitchConfig {
  readonly x?: number;
  readonly y?: number;
  readonly value?: boolean;
  readonly enabled?: boolean;
  readonly label?: string;
  readonly width?: number;
  readonly onChange?: (value: boolean) => void;
  readonly theme?: GameTheme;
}

const TRACK_WIDTH = 56;
const TRACK_HEIGHT = 32;
const THUMB_RADIUS = 12;
const THUMB_TRAVEL = (TRACK_WIDTH - TRACK_HEIGHT) / 2;

export class ToggleSwitch extends Phaser.GameObjects.Container {
  private theme: GameTheme;
  private valueState: boolean;
  private enabledState: boolean;
  private labelValue: string;
  private rowWidth: number;
  private onChangeCallback?: (value: boolean) => void;
  private thumbProgress: number;

  private readonly trackGraphics: Phaser.GameObjects.Graphics;
  private readonly thumbGraphics: Phaser.GameObjects.Graphics;
  private readonly labelText?: Phaser.GameObjects.Text;
  private readonly hitZone: Phaser.GameObjects.Zone;
  private activeTween?: Phaser.Tweens.Tween;

  public constructor(scene: Phaser.Scene, config: ToggleSwitchConfig = {}) {
    super(scene, config.x ?? 0, config.y ?? 0);

    this.theme = config.theme ?? DefaultGameTheme;
    this.valueState = config.value ?? false;
    this.enabledState = config.enabled ?? true;
    this.labelValue = config.label ?? '';
    this.onChangeCallback = config.onChange;
    this.thumbProgress = this.valueState ? 1 : 0;

    const hasLabel = this.labelValue.length > 0;
    this.rowWidth = hasLabel ? Math.max(180, config.width ?? 240) : TRACK_WIDTH;

    this.trackGraphics = scene.add.graphics();
    this.thumbGraphics = scene.add.graphics();

    if (hasLabel) {
      this.labelText = scene.add
        .text(
          -this.rowWidth / 2,
          0,
          this.labelValue,
          createTextStyle(Typography.BodyMedium, {
            color: this.enabledState ? Colors.Text.Primary : Colors.Text.Disabled,
          }),
        )
        .setOrigin(0, 0.5);
      this.add(this.labelText);
    }

    const hitW = ensureMinimumTouchTarget(this.rowWidth);
    const hitH = ensureMinimumTouchTarget(TRACK_HEIGHT);
    this.hitZone = scene.add.zone(0, 0, hitW, hitH).setOrigin(0.5);

    this.add([this.trackGraphics, this.thumbGraphics, this.hitZone]);
    this.setSize(this.rowWidth, Math.max(TRACK_HEIGHT, Dimens.MinTouchTarget));

    this.configureInteractivity();
    this.hitZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, this.handleToggle);
    this.redraw();

    scene.add.existing(this);
  }

  public getValue(): boolean {
    return this.valueState;
  }

  public isEnabled(): boolean {
    return this.enabledState;
  }

  public setValue(nextValue: boolean, animate = true, emitChange = false): this {
    if (this.valueState === nextValue) {
      return this;
    }

    this.valueState = nextValue;
    this.animateTo(nextValue ? 1 : 0, animate);

    if (emitChange) {
      this.onChangeCallback?.(this.valueState);
    }

    return this;
  }

  public setEnabled(enabled: boolean): this {
    if (this.enabledState === enabled) {
      return this;
    }
    this.enabledState = enabled;
    this.configureInteractivity();
    this.redraw();
    return this;
  }

  public setTheme(theme: GameTheme): this {
    this.theme = theme;
    return this;
  }

  private configureInteractivity(): void {
    this.hitZone.setInteractive({ useHandCursor: this.enabledState });
    if (this.hitZone.input !== null) {
      this.hitZone.input.cursor = this.enabledState ? 'pointer' : 'default';
    }
  }

  private readonly handleToggle = (): void => {
    if (!this.enabledState) {
      return;
    }
    this.setValue(!this.valueState, true, true);
  };

  private animateTo(target: number, animate: boolean): void {
    if (this.activeTween !== undefined) {
      this.activeTween.stop();
      this.activeTween = undefined;
    }

    const duration = animate
      ? resolveMotionDuration(MotionDurations.Short, this.theme.reducedMotion)
      : 0;

    if (duration === 0) {
      this.thumbProgress = target;
      this.redraw();
      return;
    }

    const proxy = { progress: this.thumbProgress };
    this.activeTween = this.scene.tweens.add({
      targets: proxy,
      progress: target,
      duration,
      ease: MotionEasings.EaseOutCubic,
      onUpdate: () => {
        this.thumbProgress = proxy.progress;
        this.redraw();
      },
      onComplete: () => {
        this.thumbProgress = target;
        this.redraw();
        this.activeTween = undefined;
      },
    });
  }

  private redraw(): void {
    const trackCenterX = this.labelText !== undefined ? this.rowWidth / 2 - TRACK_WIDTH / 2 : 0;
    const isOn = this.valueState;
    const alpha = this.enabledState ? 1 : 0.45;

    if (this.labelText !== undefined) {
      this.labelText.setColor(this.enabledState ? Colors.Text.Primary : Colors.Text.Disabled);
    }

    const trackColor = isOn ? Colors.Brand.Primary : Colors.Surface.ElevatedSurface;
    const borderColor = isOn ? Colors.Brand.PrimaryLight : Colors.Surface.Border;

    this.trackGraphics.clear();
    this.trackGraphics.fillStyle(hexToNumber(trackColor), alpha);
    this.trackGraphics.fillRoundedRect(
      trackCenterX - TRACK_WIDTH / 2,
      -TRACK_HEIGHT / 2,
      TRACK_WIDTH,
      TRACK_HEIGHT,
      TRACK_HEIGHT / 2,
    );
    this.trackGraphics.lineStyle(Dimens.BorderMedium, hexToNumber(borderColor), alpha);
    this.trackGraphics.strokeRoundedRect(
      trackCenterX - TRACK_WIDTH / 2,
      -TRACK_HEIGHT / 2,
      TRACK_WIDTH,
      TRACK_HEIGHT,
      TRACK_HEIGHT / 2,
    );

    const thumbX =
      trackCenterX + Phaser.Math.Linear(-THUMB_TRAVEL, THUMB_TRAVEL, this.thumbProgress);
    this.thumbGraphics.clear();
    this.thumbGraphics.fillStyle(hexToNumber(Colors.Black), 0.28 * alpha);
    this.thumbGraphics.fillCircle(thumbX, 2, THUMB_RADIUS);
    this.thumbGraphics.fillStyle(hexToNumber(Colors.White), alpha);
    this.thumbGraphics.fillCircle(thumbX, 0, THUMB_RADIUS);
  }

  public override destroy(fromScene?: boolean): void {
    if (this.activeTween !== undefined) {
      this.activeTween.stop();
      this.activeTween = undefined;
    }
    this.hitZone.removeAllListeners();
    super.destroy(fromScene);
  }
}
