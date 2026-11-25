import Phaser from 'phaser';
import { DefaultGameTheme, type GameTheme } from '../../theme/GameTheme';
import { ensureMinimumTouchTarget } from '../../tokens/Breakpoints';
import { Colors, darkenHex } from '../../tokens/Colors';
import { Dimens } from '../../tokens/Dimens';
import { MotionPresets, resolveMotionDuration } from '../../tokens/Motion';
import { SemanticShapes } from '../../tokens/Shapes';
import { createTextStyle, Typography } from '../../tokens/Typography';
import { drawIcon } from '../common/IconGraphic';
import { drawElevatedSurface } from '../common/SurfaceRenderer';
import { StarRating } from '../indicators/StarRating';

export type LevelCardStatus = 'locked' | 'unlocked' | 'completed' | 'current';

export interface LevelCardConfig {
  readonly x?: number;
  readonly y?: number;
  readonly width?: number;
  readonly height?: number;
  readonly levelNumber: number;
  readonly stars?: number;
  readonly status?: LevelCardStatus;
  readonly onSelect?: (levelNumber: number) => void;
  readonly theme?: GameTheme;
}

export class LevelCard extends Phaser.GameObjects.Container {
  private theme: GameTheme;
  private cardWidth: number;
  private cardHeight: number;
  private levelNumber: number;
  private status: LevelCardStatus;
  private onSelectCallback?: (levelNumber: number) => void;
  private hovered = false;
  private pressed = false;

  private readonly surfaceGraphics: Phaser.GameObjects.Graphics;
  private readonly iconGraphics: Phaser.GameObjects.Graphics;
  private readonly numberText: Phaser.GameObjects.Text;
  private readonly badgeText: Phaser.GameObjects.Text;
  private readonly starRating: StarRating;
  private readonly hitZone: Phaser.GameObjects.Zone;
  private activeTween?: Phaser.Tweens.Tween;

  public constructor(scene: Phaser.Scene, config: LevelCardConfig) {
    super(scene, config.x ?? 0, config.y ?? 0);

    this.theme = config.theme ?? DefaultGameTheme;
    this.cardWidth = Math.max(84, config.width ?? 108);
    this.cardHeight = Math.max(96, config.height ?? 116);
    this.levelNumber = config.levelNumber;
    this.status = config.status ?? 'unlocked';
    this.onSelectCallback = config.onSelect;

    this.surfaceGraphics = scene.add.graphics();
    this.iconGraphics = scene.add.graphics();

    this.numberText = scene.add
      .text(
        0,
        -12,
        String(this.levelNumber),
        createTextStyle(Typography.HeadlineSmall, {
          color: Colors.Text.Primary,
          align: 'center',
        }),
      )
      .setOrigin(0.5);

    this.badgeText = scene.add
      .text(
        0,
        -this.cardHeight / 2 + Dimens.Space12,
        'NEXT',
        createTextStyle(Typography.LabelSmall, {
          color: Colors.Text.OnPrimary,
          align: 'center',
          scale: 0.72,
          minFontSize: 10,
        }),
      )
      .setOrigin(0.5);

    this.starRating = new StarRating(scene, {
      x: 0,
      y: this.cardHeight / 2 - Dimens.Space24,
      rating: config.stars ?? 0,
      maxStars: 3,
      starSize: 18,
      spacing: Dimens.Space4,
      theme: this.theme,
    });

    this.hitZone = scene.add
      .zone(
        0,
        0,
        ensureMinimumTouchTarget(this.cardWidth),
        ensureMinimumTouchTarget(this.cardHeight),
      )
      .setOrigin(0.5);

    this.add([
      this.surfaceGraphics,
      this.iconGraphics,
      this.numberText,
      this.badgeText,
      this.starRating,
      this.hitZone,
    ]);

    this.setSize(this.cardWidth, this.cardHeight);
    this.bindInput();
    this.refreshVisuals();

    scene.add.existing(this);
  }

  public setLevelState(status: LevelCardStatus, stars?: number): this {
    this.status = status;
    if (stars !== undefined) {
      this.starRating.setRating(stars, false);
    }
    this.hovered = false;
    this.pressed = false;
    this.updateInteractivity();
    this.refreshVisuals();
    return this;
  }

  public getStatus(): LevelCardStatus {
    return this.status;
  }

  public setTheme(theme: GameTheme): this {
    this.theme = theme;
    this.starRating.setTheme(theme);
    return this;
  }

  private isInteractiveStatus(): boolean {
    return this.status !== 'locked';
  }

  private bindInput(): void {
    this.updateInteractivity();
    this.hitZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, this.handleOver);
    this.hitZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, this.handleOut);
    this.hitZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, this.handleDown);
    this.hitZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, this.handleUp);
    this.scene.input.on(Phaser.Input.Events.POINTER_UP, this.handleOut);
  }

  private updateInteractivity(): void {
    this.hitZone.setInteractive({ useHandCursor: this.isInteractiveStatus() });
    if (this.hitZone.input !== null) {
      this.hitZone.input.cursor = this.isInteractiveStatus() ? 'pointer' : 'default';
    }
  }

  private readonly handleOver = (): void => {
    if (!this.isInteractiveStatus()) {
      return;
    }
    this.hovered = true;
    this.refreshVisuals();
    this.animateScale(MotionPresets.Hover.scaleTo, MotionPresets.Hover.duration);
  };

  private readonly handleOut = (): void => {
    if (!this.hovered && !this.pressed) {
      return;
    }
    this.hovered = false;
    this.pressed = false;
    this.refreshVisuals();
    this.animateScale(1, MotionPresets.ButtonRelease.duration);
  };

  private readonly handleDown = (): void => {
    if (!this.isInteractiveStatus()) {
      return;
    }
    this.pressed = true;
    this.refreshVisuals();
    this.animateScale(MotionPresets.ButtonPress.scaleTo, MotionPresets.ButtonPress.duration);
  };

  private readonly handleUp = (): void => {
    if (!this.pressed || !this.isInteractiveStatus()) {
      return;
    }
    this.pressed = false;
    this.refreshVisuals();
    this.animateScale(
      this.hovered ? MotionPresets.Hover.scaleTo : 1,
      MotionPresets.ButtonRelease.duration,
    );
    this.onSelectCallback?.(this.levelNumber);
  };

  private animateScale(target: number, durationMs: number): void {
    if (this.activeTween !== undefined) {
      this.activeTween.stop();
      this.activeTween = undefined;
    }
    const duration = resolveMotionDuration(durationMs, this.theme.reducedMotion);
    if (duration === 0) {
      this.setScale(target);
      return;
    }
    this.activeTween = this.scene.tweens.add({
      targets: this,
      scaleX: target,
      scaleY: target,
      duration,
      ease: MotionPresets.ButtonRelease.ease,
    });
  }

  private refreshVisuals(): void {
    const isLocked = this.status === 'locked';
    const isCurrent = this.status === 'current';
    const isCompleted = this.status === 'completed';

    const fillColor = isCurrent
      ? Colors.Brand.Primary
      : isLocked
        ? Colors.Surface.Surface
        : Colors.Surface.ElevatedSurface;

    const borderColor = isCurrent
      ? Colors.Brand.PrimaryLight
      : isCompleted
        ? Colors.Semantic.Success
        : this.hovered
          ? Colors.Brand.PrimaryLight
          : Colors.Surface.Border;

    drawElevatedSurface(this.surfaceGraphics, {
      width: this.cardWidth,
      height: this.cardHeight,
      radius: SemanticShapes.LevelCard,
      fillColor,
      fillAlpha: isLocked ? 0.65 : 1,
      depthColor: isCurrent ? Colors.Brand.PrimaryDark : darkenHex(fillColor, 0.35),
      borderColor,
      borderWidth: isCurrent || isCompleted ? Dimens.BorderMedium : Dimens.BorderThin,
      borderAlpha: isLocked ? 0.45 : 1,
      elevation: isLocked ? 'flat' : isCurrent ? 'medium' : 'low',
      pressedOffsetY: this.pressed ? 2 : 0,
    });

    this.iconGraphics.clear();

    if (isLocked) {
      this.numberText.setVisible(false);
      this.badgeText.setVisible(false);
      this.starRating.setVisible(false);
      drawIcon(this.iconGraphics, 'lock', 0, 0, Dimens.IconLarge, Colors.Text.Disabled, 0.85);
      return;
    }

    this.numberText.setVisible(true);
    this.numberText.setText(String(this.levelNumber));
    this.numberText.setColor(isCurrent ? Colors.Text.OnPrimary : Colors.Text.Primary);
    this.numberText.setPosition(0, isCurrent ? -2 : -12);

    this.badgeText.setVisible(isCurrent);
    if (isCurrent) {
      this.badgeText.setPosition(0, -this.cardHeight / 2 + Dimens.Space16);
    }

    if (isCompleted) {
      drawIcon(
        this.iconGraphics,
        'check',
        this.cardWidth / 2 - Dimens.Space16,
        -this.cardHeight / 2 + Dimens.Space16,
        14,
        Colors.Semantic.Success,
      );
    }

    this.starRating.setVisible(isCompleted || this.status === 'unlocked');
    this.starRating.setPosition(0, this.cardHeight / 2 - Dimens.Space24);
  }

  public override destroy(fromScene?: boolean): void {
    if (this.activeTween !== undefined) {
      this.activeTween.stop();
      this.activeTween = undefined;
    }
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.handleOut);
    this.hitZone.removeAllListeners();
    super.destroy(fromScene);
  }
}
