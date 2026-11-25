import Phaser from 'phaser';
import { DefaultGameTheme, type GameTheme } from '../../theme/GameTheme';
import { Colors } from '../../tokens/Colors';
import { Dimens } from '../../tokens/Dimens';
import { MotionPresets, resolveMotionDuration } from '../../tokens/Motion';
import { SemanticShapes } from '../../tokens/Shapes';
import { createTextStyle, Typography } from '../../tokens/Typography';
import { drawIcon } from '../common/IconGraphic';
import { drawElevatedSurface } from '../common/SurfaceRenderer';
import { normalizeMatchState, type NormalizedMatchState } from './indicatorMath';
import { ProgressBar } from './ProgressBar';

export interface MatchCounterConfig {
  readonly x?: number;
  readonly y?: number;
  readonly width?: number;
  readonly label?: string;
  readonly matched?: number;
  readonly total?: number;
  readonly theme?: GameTheme;
}

export class MatchCounter extends Phaser.GameObjects.Container {
  private theme: GameTheme;
  private counterWidth: number;
  private readonly counterHeight = 96;
  private matchState: NormalizedMatchState;

  private readonly surfaceGraphics: Phaser.GameObjects.Graphics;
  private readonly badgeIconGraphics: Phaser.GameObjects.Graphics;
  private readonly labelText: Phaser.GameObjects.Text;
  private readonly countText: Phaser.GameObjects.Text;
  private readonly progressBar: ProgressBar;
  private pulseTween?: Phaser.Tweens.Tween;

  public constructor(scene: Phaser.Scene, config: MatchCounterConfig = {}) {
    super(scene, config.x ?? 0, config.y ?? 0);

    this.theme = config.theme ?? DefaultGameTheme;
    this.counterWidth = Math.max(220, config.width ?? 320);
    this.matchState = normalizeMatchState(config.matched ?? 0, config.total ?? 10);

    this.surfaceGraphics = scene.add.graphics();
    this.badgeIconGraphics = scene.add.graphics();

    this.labelText = scene.add
      .text(
        0,
        0,
        config.label ?? 'CORRECT MATCHES',
        createTextStyle(Typography.LabelSmall, {
          color: Colors.Text.Secondary,
        }),
      )
      .setOrigin(0, 0.5);

    this.countText = scene.add
      .text(
        0,
        0,
        this.matchState.formatted,
        createTextStyle(Typography.TitleLarge, {
          color: Colors.Text.Primary,
          align: 'right',
        }),
      )
      .setOrigin(1, 0.5);

    this.progressBar = new ProgressBar(scene, {
      x: 0,
      y: 20,
      width: this.counterWidth - Dimens.Space32,
      height: Dimens.ProgressBarHeightLarge,
      value: this.matchState.matched,
      max: this.matchState.total,
      segments: this.matchState.total,
      variant: 'segmented',
      fillColor: this.matchState.isComplete ? Colors.Semantic.Success : Colors.Brand.Primary,
      trackColor: Colors.Surface.Background,
      borderColor: Colors.Surface.Border,
      theme: this.theme,
    });

    this.add([
      this.surfaceGraphics,
      this.badgeIconGraphics,
      this.labelText,
      this.countText,
      this.progressBar,
    ]);

    this.setSize(this.counterWidth, this.counterHeight);
    this.layoutAndRedraw();

    scene.add.existing(this);
  }

  public getState(): NormalizedMatchState {
    return this.matchState;
  }

  public setMatches(matched: number, total?: number, animate = true): this {
    const previous = this.matchState;
    const next = normalizeMatchState(matched, total ?? this.matchState.total);
    this.matchState = next;

    const fillColor = next.isComplete ? Colors.Semantic.Success : Colors.Brand.Primary;
    this.progressBar.setFillColor(fillColor);
    this.progressBar.setProgress(next.matched, next.total, animate);
    this.countText.setText(next.formatted);
    this.layoutAndRedraw();

    if (animate && (next.matched !== previous.matched || next.isComplete !== previous.isComplete)) {
      this.playFeedbackPulse(next.isComplete);
    }

    return this;
  }

  public setCounterWidth(width: number): this {
    this.counterWidth = Math.max(220, width);
    this.setSize(this.counterWidth, this.counterHeight);
    this.progressBar.setBarSize(this.counterWidth - Dimens.Space32, Dimens.ProgressBarHeightLarge);
    this.layoutAndRedraw();
    return this;
  }

  public setTheme(theme: GameTheme): this {
    this.theme = theme;
    this.progressBar.setTheme(theme);
    return this;
  }

  private layoutAndRedraw(): void {
    const isComplete = this.matchState.isComplete;
    const borderColor = isComplete ? Colors.Semantic.Success : Colors.Surface.Border;
    const countColor = isComplete ? Colors.Semantic.Success : Colors.Text.Primary;
    const labelColor = isComplete ? Colors.Semantic.Success : Colors.Text.Secondary;

    drawElevatedSurface(this.surfaceGraphics, {
      width: this.counterWidth,
      height: this.counterHeight,
      radius: SemanticShapes.Card,
      fillColor: Colors.Surface.Surface,
      borderColor,
      borderWidth: isComplete ? Dimens.BorderMedium : Dimens.BorderThin,
      elevation: 'low',
    });

    const leftEdge = -this.counterWidth / 2 + Dimens.Space16;
    const rightEdge = this.counterWidth / 2 - Dimens.Space16;
    const topRowY = -18;

    this.badgeIconGraphics.clear();
    if (isComplete) {
      drawIcon(
        this.badgeIconGraphics,
        'check',
        leftEdge + Dimens.Space10,
        topRowY,
        Dimens.IconSmall,
        Colors.Semantic.Success,
      );
      this.labelText.setPosition(leftEdge + Dimens.Space24, topRowY);
    } else {
      this.labelText.setPosition(leftEdge, topRowY);
    }

    this.labelText.setColor(labelColor);
    this.countText.setColor(countColor);
    this.countText.setPosition(rightEdge, topRowY);
    this.progressBar.setPosition(0, 20);
  }

  private playFeedbackPulse(isComplete: boolean): void {
    if (this.pulseTween !== undefined) {
      this.pulseTween.stop();
      this.pulseTween = undefined;
    }

    const duration = resolveMotionDuration(
      isComplete ? MotionPresets.SuccessFeedback.duration : MotionPresets.Selection.duration,
      this.theme.reducedMotion,
    );

    if (duration === 0) {
      this.countText.setScale(1);
      return;
    }

    const peakScale = isComplete ? 1.18 : 1.09;
    this.countText.setScale(1);
    this.pulseTween = this.scene.tweens.add({
      targets: this.countText,
      scaleX: peakScale,
      scaleY: peakScale,
      duration: Math.round(duration * 0.45),
      yoyo: true,
      ease: MotionPresets.SuccessFeedback.ease,
      onComplete: () => {
        this.countText.setScale(1);
        this.pulseTween = undefined;
      },
    });
  }

  public override destroy(fromScene?: boolean): void {
    if (this.pulseTween !== undefined) {
      this.pulseTween.stop();
      this.pulseTween = undefined;
    }
    super.destroy(fromScene);
  }
}
