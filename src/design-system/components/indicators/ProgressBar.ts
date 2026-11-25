import Phaser from 'phaser';
import { DefaultGameTheme, type GameTheme } from '../../theme/GameTheme';
import { Colors, hexToNumber, lightenHex } from '../../tokens/Colors';
import { Dimens } from '../../tokens/Dimens';
import { MotionDurations, MotionEasings, resolveMotionDuration } from '../../tokens/Motion';
import { SemanticShapes } from '../../tokens/Shapes';
import { normalizeProgress } from './indicatorMath';

export type ProgressBarVariant = 'continuous' | 'segmented';

export interface ProgressBarConfig {
  readonly x?: number;
  readonly y?: number;
  readonly width?: number;
  readonly height?: number;
  readonly value?: number;
  readonly max?: number;
  readonly variant?: ProgressBarVariant;
  readonly segments?: number;
  readonly fillColor?: string;
  readonly trackColor?: string;
  readonly borderColor?: string;
  readonly animated?: boolean;
  readonly theme?: GameTheme;
}

export class ProgressBar extends Phaser.GameObjects.Container {
  private theme: GameTheme;
  private barWidth: number;
  private barHeight: number;
  private variant: ProgressBarVariant;
  private segments: number;
  private fillColor: string;
  private trackColor: string;
  private borderColor: string;
  private animated: boolean;

  private currentValue: number;
  private maxValue: number;
  private displayedRatio: number;

  private readonly graphics: Phaser.GameObjects.Graphics;
  private activeTween?: Phaser.Tweens.Tween;

  public constructor(scene: Phaser.Scene, config: ProgressBarConfig = {}) {
    super(scene, config.x ?? 0, config.y ?? 0);

    this.theme = config.theme ?? DefaultGameTheme;
    this.barWidth = Math.max(48, config.width ?? 240);
    this.barHeight = Math.max(8, config.height ?? Dimens.ProgressBarHeight);
    this.variant = config.variant ?? 'continuous';
    this.fillColor = config.fillColor ?? Colors.Brand.Primary;
    this.trackColor = config.trackColor ?? Colors.Surface.Background;
    this.borderColor = config.borderColor ?? Colors.Surface.Border;
    this.animated = config.animated ?? true;

    const initial = normalizeProgress(config.value ?? 0, config.max ?? 100);
    this.currentValue = initial.value;
    this.maxValue = initial.max;
    this.segments = Math.max(1, Math.floor(config.segments ?? initial.max));
    this.displayedRatio = initial.ratio;

    this.graphics = scene.add.graphics();
    this.add(this.graphics);

    this.setSize(this.barWidth, this.barHeight);
    this.redraw();

    scene.add.existing(this);
  }

  public getValue(): number {
    return this.currentValue;
  }

  public getMax(): number {
    return this.maxValue;
  }

  public getRatio(): number {
    return normalizeProgress(this.currentValue, this.maxValue).ratio;
  }

  public setProgress(value: number, max?: number, animate?: boolean): this {
    const next = normalizeProgress(value, max ?? this.maxValue);
    this.currentValue = next.value;
    this.maxValue = next.max;
    if (this.variant === 'segmented' && max !== undefined) {
      this.segments = Math.max(1, Math.floor(next.max));
    }

    const shouldAnimate = animate ?? this.animated;
    const duration = shouldAnimate
      ? resolveMotionDuration(MotionDurations.Normal, this.theme.reducedMotion)
      : 0;

    this.stopTween();

    if (duration === 0) {
      this.displayedRatio = next.ratio;
      this.redraw();
      return this;
    }

    const proxy = { ratio: this.displayedRatio };
    this.activeTween = this.scene.tweens.add({
      targets: proxy,
      ratio: next.ratio,
      duration,
      ease: MotionEasings.EaseOutCubic,
      onUpdate: () => {
        this.displayedRatio = proxy.ratio;
        this.redraw();
      },
      onComplete: () => {
        this.displayedRatio = next.ratio;
        this.redraw();
        this.activeTween = undefined;
      },
    });

    return this;
  }

  public setFillColor(fillColor: string): this {
    this.fillColor = fillColor;
    this.redraw();
    return this;
  }

  public setBarSize(width: number, height?: number): this {
    this.barWidth = Math.max(48, width);
    if (height !== undefined) {
      this.barHeight = Math.max(8, height);
    }
    this.setSize(this.barWidth, this.barHeight);
    this.redraw();
    return this;
  }

  public setTheme(theme: GameTheme): this {
    this.theme = theme;
    return this;
  }

  private redraw(): void {
    this.graphics.clear();

    if (this.variant === 'segmented') {
      this.drawSegmented();
      return;
    }

    this.drawContinuous();
  }

  private drawContinuous(): void {
    const halfW = this.barWidth / 2;
    const halfH = this.barHeight / 2;
    const radius = Math.min(SemanticShapes.ProgressBar, Math.floor(this.barHeight / 2));

    this.graphics.fillStyle(hexToNumber(this.trackColor), 0.95);
    this.graphics.fillRoundedRect(-halfW, -halfH, this.barWidth, this.barHeight, radius);

    this.graphics.lineStyle(Dimens.BorderThin, hexToNumber(this.borderColor), 0.75);
    this.graphics.strokeRoundedRect(-halfW, -halfH, this.barWidth, this.barHeight, radius);

    const innerPad = 2;
    const usableW = Math.max(0, this.barWidth - innerPad * 2);
    const fillW = usableW * Math.min(1, Math.max(0, this.displayedRatio));
    const innerH = Math.max(4, this.barHeight - innerPad * 2);
    const innerRadius = Math.min(radius, Math.floor(innerH / 2));

    if (fillW > 1) {
      const clampedW = Math.max(innerH * 0.65, fillW);
      const drawW = Math.min(usableW, clampedW);
      this.graphics.fillStyle(hexToNumber(this.fillColor), 1);
      this.graphics.fillRoundedRect(-halfW + innerPad, -innerH / 2, drawW, innerH, innerRadius);

      // Subtle glossy highlight strip
      this.graphics.fillStyle(hexToNumber(lightenHex(this.fillColor, 0.35)), 0.45);
      this.graphics.fillRoundedRect(
        -halfW + innerPad + 2,
        -innerH / 2 + 1,
        Math.max(0, drawW - 4),
        Math.max(2, Math.floor(innerH * 0.35)),
        innerRadius,
      );
    }
  }

  private drawSegmented(): void {
    const segmentCount = Math.max(1, this.segments);
    const gap = segmentCount > 10 ? Dimens.Space4 : Dimens.Space6;
    const totalGaps = gap * (segmentCount - 1);
    const segWidth = Math.max(6, (this.barWidth - totalGaps) / segmentCount);
    const startX = -this.barWidth / 2;
    const halfH = this.barHeight / 2;
    const radius = Math.min(6, Math.floor(Math.min(segWidth, this.barHeight) / 2));
    const exactFilled = this.displayedRatio * segmentCount;

    for (let i = 0; i < segmentCount; i += 1) {
      const x = startX + i * (segWidth + gap);
      const segmentFill = Math.min(1, Math.max(0, exactFilled - i));

      this.graphics.fillStyle(hexToNumber(this.trackColor), 0.95);
      this.graphics.fillRoundedRect(x, -halfH, segWidth, this.barHeight, radius);

      this.graphics.lineStyle(Dimens.BorderThin, hexToNumber(this.borderColor), 0.65);
      this.graphics.strokeRoundedRect(x, -halfH, segWidth, this.barHeight, radius);

      if (segmentFill > 0.02) {
        const innerPad = 1.5;
        const innerW = Math.max(2, (segWidth - innerPad * 2) * segmentFill);
        const innerH = Math.max(4, this.barHeight - innerPad * 2);
        this.graphics.fillStyle(hexToNumber(this.fillColor), 1);
        this.graphics.fillRoundedRect(
          x + innerPad,
          -innerH / 2,
          innerW,
          innerH,
          Math.min(radius, Math.floor(innerH / 2)),
        );
      }
    }
  }

  private stopTween(): void {
    if (this.activeTween !== undefined) {
      this.activeTween.stop();
      this.activeTween = undefined;
    }
  }

  public override destroy(fromScene?: boolean): void {
    this.stopTween();
    super.destroy(fromScene);
  }
}
