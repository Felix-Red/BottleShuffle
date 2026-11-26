import Phaser from 'phaser';
import {
  Colors,
  createTextStyle,
  DefaultGameTheme,
  MatchCounter,
  MotionPresets,
  resolveMotionDuration,
  StatCard,
  Typography,
  type GameTheme,
} from '../../../design-system';
import { GAMEPLAY_CONFIG } from '../../../config/GameplayConfig';
import type { MatchFeedbackView } from '../../gameplay/GameplayViewState';
import type { GameplayHudLayout } from '../../layout/GameplayLayout';

export interface GameplayHudConfig {
  readonly initialMatches: number;
  readonly totalBottles: number;
  readonly initialMoves?: number;
  readonly initialTime?: string;
  readonly theme?: GameTheme;
}

export class GameplayHUD extends Phaser.GameObjects.Container {
  private theme: GameTheme;
  private readonly matchCounter: MatchCounter;
  private readonly moveCard: StatCard;
  private readonly timerCard: StatCard;
  private readonly feedbackText: Phaser.GameObjects.Text;

  private lastMatchCount: number;
  private lastTotalCount: number;
  private lastMoveCount: number;
  private lastTimeLabel: string;
  private lastFeedbackId = -1;

  private feedbackTween?: Phaser.Tweens.Tween;
  private feedbackTimer?: Phaser.Time.TimerEvent;

  public constructor(scene: Phaser.Scene, config: GameplayHudConfig) {
    super(scene, 0, 0);

    this.theme = config.theme ?? DefaultGameTheme;
    this.lastMatchCount = config.initialMatches;
    this.lastTotalCount = config.totalBottles;
    this.lastMoveCount = config.initialMoves ?? 0;
    this.lastTimeLabel = config.initialTime ?? '00:00';

    this.matchCounter = new MatchCounter(scene, {
      label: 'CORRECT MATCHES',
      matched: this.lastMatchCount,
      total: this.lastTotalCount,
      width: 340,
      theme: this.theme,
    });

    this.moveCard = new StatCard(scene, {
      icon: 'moves',
      label: 'MOVES',
      value: String(this.lastMoveCount),
      accentColor: Colors.Brand.PrimaryLight,
      width: 170,
      height: 76,
      theme: this.theme,
    });

    this.timerCard = new StatCard(scene, {
      icon: 'clock',
      label: 'TIME',
      value: this.lastTimeLabel,
      accentColor: Colors.Semantic.Info,
      width: 170,
      height: 76,
      theme: this.theme,
    });

    this.feedbackText = scene.add
      .text(
        0,
        0,
        '',
        createTextStyle(Typography.LabelMedium, {
          color: Colors.Text.Secondary,
          align: 'center',
        }),
      )
      .setOrigin(0.5)
      .setVisible(false);

    this.add([this.moveCard, this.timerCard, this.matchCounter, this.feedbackText]);
    scene.add.existing(this);
  }

  public applyLayout(layout: GameplayHudLayout): this {
    this.matchCounter.setCounterWidth(layout.matchCounterWidth);
    this.matchCounter.setScale(layout.scale);
    this.matchCounter.setPosition(layout.matchCounterX, layout.matchCounterY);

    this.moveCard.setCardSize(layout.statWidth, layout.statHeight);
    this.moveCard.setScale(layout.scale);
    this.moveCard.setPosition(layout.moveCounterX, layout.moveCounterY);

    this.timerCard.setCardSize(layout.statWidth, layout.statHeight);
    this.timerCard.setScale(layout.scale);
    this.timerCard.setPosition(layout.timerX, layout.timerY);

    this.feedbackText.setPosition(layout.feedbackX, layout.feedbackY);
    return this;
  }

  public setMatches(matched: number, total: number, animate = true): this {
    if (matched === this.lastMatchCount && total === this.lastTotalCount) {
      return this;
    }
    this.lastMatchCount = matched;
    this.lastTotalCount = total;
    this.matchCounter.setMatches(matched, total, animate);
    return this;
  }

  public setMoveCount(moves: number): this {
    if (moves === this.lastMoveCount) {
      return this;
    }
    this.lastMoveCount = moves;
    this.moveCard.setValue(String(moves));
    return this;
  }

  public setElapsedTime(formattedTime: string): this {
    if (formattedTime === this.lastTimeLabel) {
      return this;
    }
    this.lastTimeLabel = formattedTime;
    this.timerCard.setValue(formattedTime);
    return this;
  }

  public showMatchFeedback(feedback: MatchFeedbackView | null): this {
    if (feedback === null) {
      this.clearFeedback();
      return this;
    }

    if (feedback.sequenceId === this.lastFeedbackId) {
      return this;
    }
    this.lastFeedbackId = feedback.sequenceId;
    this.clearFeedbackTimers();

    const color =
      feedback.tone === 'positive'
        ? Colors.Semantic.Success
        : feedback.tone === 'negative'
          ? Colors.Semantic.Error
          : Colors.Text.Secondary;

    this.feedbackText.setColor(color);
    this.feedbackText.setText(feedback.text);
    this.feedbackText.setVisible(true);
    this.feedbackText.setAlpha(1);

    const fadeInDur = resolveMotionDuration(
      MotionPresets.FadeIn.duration,
      this.theme.reducedMotion,
    );
    if (fadeInDur > 0) {
      this.feedbackText.setAlpha(0).setScale(0.92);
      this.feedbackTween = this.scene.tweens.add({
        targets: this.feedbackText,
        alpha: 1,
        scaleX: 1,
        scaleY: 1,
        duration: fadeInDur,
        ease: MotionPresets.FadeIn.ease,
      });
    } else {
      this.feedbackText.setScale(1);
    }

    this.feedbackTimer = this.scene.time.delayedCall(
      GAMEPLAY_CONFIG.matchFeedbackDurationMs,
      () => {
        this.fadeOutFeedback();
      },
    );

    return this;
  }

  public clearFeedback(): this {
    this.clearFeedbackTimers();
    this.feedbackText.setVisible(false);
    this.feedbackText.setText('');
    return this;
  }

  public setTheme(theme: GameTheme): this {
    this.theme = theme;
    this.matchCounter.setTheme(theme);
    this.moveCard.setTheme(theme);
    this.timerCard.setTheme(theme);
    return this;
  }

  private fadeOutFeedback(): void {
    this.clearFeedbackTimers();
    const fadeOutDur = resolveMotionDuration(
      MotionPresets.FadeOut.duration,
      this.theme.reducedMotion,
    );
    if (fadeOutDur === 0) {
      this.feedbackText.setVisible(false);
      return;
    }

    this.feedbackTween = this.scene.tweens.add({
      targets: this.feedbackText,
      alpha: 0,
      duration: fadeOutDur,
      ease: MotionPresets.FadeOut.ease,
      onComplete: () => {
        this.feedbackText.setVisible(false);
        this.feedbackTween = undefined;
      },
    });
  }

  private clearFeedbackTimers(): void {
    if (this.feedbackTimer !== undefined) {
      this.feedbackTimer.remove(false);
      this.feedbackTimer = undefined;
    }
    if (this.feedbackTween !== undefined) {
      this.feedbackTween.stop();
      this.feedbackTween = undefined;
    }
  }

  public override destroy(fromScene?: boolean): void {
    this.clearFeedbackTimers();
    super.destroy(fromScene);
  }
}
