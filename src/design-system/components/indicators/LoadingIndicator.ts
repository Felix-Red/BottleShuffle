import Phaser from 'phaser';
import { DefaultGameTheme, type GameTheme } from '../../theme/GameTheme';
import { Colors, hexToNumber } from '../../tokens/Colors';
import { MotionDurations, MotionEasings } from '../../tokens/Motion';

export interface LoadingIndicatorConfig {
  readonly x?: number;
  readonly y?: number;
  readonly radius?: number;
  readonly strokeWidth?: number;
  readonly color?: string;
  readonly trackColor?: string;
  readonly theme?: GameTheme;
  readonly autoStart?: boolean;
}

export class LoadingIndicator extends Phaser.GameObjects.Container {
  private theme: GameTheme;
  private readonly radius: number;
  private readonly strokeWidth: number;
  private readonly colorHex: string;
  private readonly trackColorHex: string;
  private readonly trackGraphics: Phaser.GameObjects.Graphics;
  private readonly spinnerGraphics: Phaser.GameObjects.Graphics;
  private spinTween?: Phaser.Tweens.Tween;
  private running = false;

  public constructor(scene: Phaser.Scene, config: LoadingIndicatorConfig = {}) {
    super(scene, config.x ?? 0, config.y ?? 0);

    this.theme = config.theme ?? DefaultGameTheme;
    this.radius = Math.max(8, config.radius ?? 16);
    this.strokeWidth = Math.max(2, config.strokeWidth ?? Math.round(this.radius * 0.24));
    this.colorHex = config.color ?? Colors.Brand.PrimaryLight;
    this.trackColorHex = config.trackColor ?? Colors.Surface.Border;

    this.trackGraphics = scene.add.graphics();
    this.spinnerGraphics = scene.add.graphics();
    this.add([this.trackGraphics, this.spinnerGraphics]);

    this.drawIndicator();
    this.setSize(this.radius * 2 + this.strokeWidth, this.radius * 2 + this.strokeWidth);

    if (config.autoStart ?? true) {
      this.start();
    }

    scene.add.existing(this);
  }

  public start(): this {
    this.running = true;
    this.stopTween();

    if (this.theme.reducedMotion) {
      this.spinnerGraphics.setAngle(0);
      return this;
    }

    this.spinTween = this.scene.tweens.add({
      targets: this.spinnerGraphics,
      angle: 360,
      duration: MotionDurations.Celebration,
      ease: MotionEasings.Linear,
      repeat: -1,
    });
    return this;
  }

  public stop(): this {
    this.running = false;
    this.stopTween();
    return this;
  }

  public isRunning(): boolean {
    return this.running;
  }

  public setTheme(theme: GameTheme): this {
    this.theme = theme;
    if (this.running) {
      this.start();
    }
    return this;
  }

  private drawIndicator(): void {
    this.trackGraphics.clear();
    this.trackGraphics.lineStyle(this.strokeWidth, hexToNumber(this.trackColorHex), 0.35);
    this.trackGraphics.strokeCircle(0, 0, this.radius);

    this.spinnerGraphics.clear();
    this.spinnerGraphics.lineStyle(this.strokeWidth, hexToNumber(this.colorHex), 1);
    this.spinnerGraphics.beginPath();
    this.spinnerGraphics.arc(0, 0, this.radius, -Math.PI * 0.5, Math.PI * 0.6, false);
    this.spinnerGraphics.strokePath();
  }

  private stopTween(): void {
    if (this.spinTween !== undefined) {
      this.spinTween.stop();
      this.spinTween = undefined;
    }
  }

  public override destroy(fromScene?: boolean): void {
    this.stop();
    super.destroy(fromScene);
  }
}
