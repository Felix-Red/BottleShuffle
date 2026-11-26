import Phaser from 'phaser';
import { Colors, hexToNumber } from '../../../design-system/tokens/Colors';
import { Dimens } from '../../../design-system/tokens/Dimens';
import { MotionEasings, MotionParams } from '../../../design-system/tokens/Motion';
import { createTextStyle, Typography } from '../../../design-system/tokens/Typography';
import type { AnimationPolicy } from '../../animations/core/AnimationPolicy';
import type { MatchFeedbackView } from '../../gameplay/GameplayViewState';

/**
 * Reusable floating aggregate match-change feedback displayed near the MatchCounter.
 * Never reveals individual bottle correctness and replaces previous messages cleanly
 * so stacked labels never obscure the HUD.
 */
export class FloatingMatchFeedback extends Phaser.GameObjects.Container {
  private readonly badgeGraphics: Phaser.GameObjects.Graphics;
  private readonly labelText: Phaser.GameObjects.Text;

  private anchorX = 0;
  private anchorY = 0;
  private activeTweens: Phaser.Tweens.Tween[] = [];
  private holdTimer?: Phaser.Time.TimerEvent;

  public constructor(scene: Phaser.Scene, x = 0, y = 0) {
    super(scene, x, y);
    this.anchorX = x;
    this.anchorY = y;

    this.badgeGraphics = scene.add.graphics();
    this.labelText = scene.add
      .text(
        0,
        0,
        '',
        createTextStyle(Typography.LabelMedium, {
          color: Colors.Text.Primary,
          align: 'center',
        }),
      )
      .setOrigin(0.5);

    this.add([this.badgeGraphics, this.labelText]);
    this.setVisible(false);
    this.setAlpha(0);

    scene.add.existing(this);
  }

  public setAnchorPosition(x: number, y: number): this {
    this.anchorX = x;
    this.anchorY = y;
    if (!this.visible) {
      this.setPosition(x, y);
    }
    return this;
  }

  public show(feedback: MatchFeedbackView, policy: AnimationPolicy, onDone?: () => void): this {
    this.clear();

    const accentColor =
      feedback.tone === 'positive'
        ? Colors.Semantic.Success
        : feedback.tone === 'negative'
          ? Colors.Semantic.Error
          : Colors.Text.Secondary;

    this.labelText.setColor(accentColor);
    this.labelText.setText(feedback.text);

    const pillW = Math.max(96, Math.ceil(this.labelText.width) + Dimens.Space24);
    const pillH = 26;

    this.badgeGraphics.clear();
    this.badgeGraphics.fillStyle(hexToNumber(Colors.Surface.ElevatedSurface), 0.92);
    this.badgeGraphics.fillRoundedRect(-pillW / 2, -pillH / 2, pillW, pillH, pillH / 2);
    this.badgeGraphics.lineStyle(Dimens.BorderThin, hexToNumber(accentColor), 0.65);
    this.badgeGraphics.strokeRoundedRect(-pillW / 2, -pillH / 2, pillW, pillH, pillH / 2);

    this.setVisible(true);
    this.setPosition(this.anchorX, this.anchorY);

    const totalMs = Math.max(200, policy.floatingFeedbackDurationMs);

    if (policy.reducedMotion) {
      this.setScale(1);
      this.setAlpha(1);
      this.holdTimer = this.scene.time.delayedCall(totalMs, () => {
        this.holdTimer = undefined;
        this.setVisible(false);
        this.setAlpha(0);
        onDone?.();
      });
      return this;
    }

    const enterMs = Math.round(totalMs * 0.24);
    const holdMs = Math.round(totalMs * 0.44);
    const exitMs = Math.max(80, totalMs - enterMs - holdMs);
    const travelY = MotionParams.floatingFeedbackDisplacementPx;

    this.setAlpha(0);
    this.setScale(0.88);
    this.setPosition(this.anchorX, this.anchorY + 6);

    const enterTween = this.scene.tweens.add({
      targets: this,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      y: this.anchorY - Math.round(travelY * 0.45),
      duration: enterMs,
      ease: MotionEasings.SoftOvershoot,
      onComplete: () => {
        this.holdTimer = this.scene.time.delayedCall(holdMs, () => {
          this.holdTimer = undefined;
          const exitTween = this.scene.tweens.add({
            targets: this,
            alpha: 0,
            y: this.anchorY - travelY,
            duration: exitMs,
            ease: MotionEasings.EaseOut,
            onComplete: () => {
              this.clear();
              onDone?.();
            },
          });
          this.activeTweens.push(exitTween);
        });
      },
    });
    this.activeTweens.push(enterTween);

    return this;
  }

  public clear(): this {
    for (const tween of this.activeTweens) {
      tween.stop();
    }
    this.activeTweens = [];

    if (this.holdTimer !== undefined) {
      this.holdTimer.remove(false);
      this.holdTimer = undefined;
    }

    this.setVisible(false);
    this.setAlpha(0);
    this.setScale(1);
    this.setPosition(this.anchorX, this.anchorY);
    return this;
  }

  public override destroy(fromScene?: boolean): void {
    this.clear();
    super.destroy(fromScene);
  }
}
