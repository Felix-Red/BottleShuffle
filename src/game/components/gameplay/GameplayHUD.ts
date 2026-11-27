import Phaser from 'phaser';
import { hasMoveLimit, hasTimeLimit, type ChallengeMode } from '../../../core';
import { GAMEPLAY_CONFIG, GAMEPLAY_COPY } from '../../../config/GameplayConfig';
import {
  Colors,
  DefaultGameTheme,
  MatchCounter,
  ProgressBar,
  StatCard,
  type GameTheme,
} from '../../../design-system';
import type { CountdownUrgency } from '../../../services/GameplayClock';
import {
  resolveAnimationPolicy,
  type AnimationPolicy,
} from '../../animations/core/AnimationPolicy';
import type { MatchFeedbackView } from '../../gameplay/GameplayViewState';
import type { GameplayHudLayout } from '../../layout/GameplayLayout';
import { FloatingMatchFeedback } from '../effects/FloatingMatchFeedback';
import { spawnParticleBurst } from '../effects/ParticleBurst';

export interface GameplayHudConfig {
  readonly initialMatches: number;
  readonly totalBottles: number;
  readonly initialMoves?: number;
  readonly initialRemainingMoves?: number | null;
  readonly initialTime?: string;
  readonly challengeMode?: ChallengeMode;
  readonly initialCountdownRatio?: number | null;
  readonly theme?: GameTheme;
  readonly policy?: AnimationPolicy;
}

function resolveUrgencyColor(urgency: CountdownUrgency, defaultColor: string): string {
  switch (urgency) {
    case 'critical':
      return Colors.Semantic.Error;
    case 'warning':
      return Colors.Semantic.Warning;
    default:
      return defaultColor;
  }
}

export class GameplayHUD extends Phaser.GameObjects.Container {
  private theme: GameTheme;
  private policy: AnimationPolicy;
  private challengeMode: ChallengeMode;
  private readonly matchCounter: MatchCounter;
  private readonly moveCard: StatCard;
  private readonly timerCard: StatCard;
  private readonly countdownBar: ProgressBar;
  private readonly floatingFeedback: FloatingMatchFeedback;

  private lastMatchCount: number;
  private lastTotalCount: number;
  private lastMoveDisplay: number;
  private lastTimeLabel: string;
  private lastUrgency: CountdownUrgency = 'normal';
  private lastCountdownRatio = 1;
  private lastFeedbackId = -1;
  private cancelActiveParticles?: () => void;

  public constructor(scene: Phaser.Scene, config: GameplayHudConfig) {
    super(scene, 0, 0);

    this.theme = config.theme ?? DefaultGameTheme;
    this.policy = config.policy ?? resolveAnimationPolicy(this.theme.reducedMotion);
    this.challengeMode = config.challengeMode ?? 'classic';
    this.lastMatchCount = config.initialMatches;
    this.lastTotalCount = config.totalBottles;
    this.lastMoveDisplay =
      hasMoveLimit(this.challengeMode) && config.initialRemainingMoves !== undefined
        ? (config.initialRemainingMoves ?? 0)
        : (config.initialMoves ?? 0);
    this.lastTimeLabel = config.initialTime ?? '00:00';
    this.lastCountdownRatio = config.initialCountdownRatio ?? 1;

    this.matchCounter = new MatchCounter(scene, {
      label: 'CORRECT MATCHES',
      matched: this.lastMatchCount,
      total: this.lastTotalCount,
      width: 340,
      theme: this.theme,
    });

    this.moveCard = new StatCard(scene, {
      icon: 'moves',
      label: hasMoveLimit(this.challengeMode)
        ? GAMEPLAY_COPY.hud.movesLeftLabel
        : GAMEPLAY_COPY.hud.movesUsedLabel,
      value: String(this.lastMoveDisplay),
      accentColor: Colors.Brand.PrimaryLight,
      width: 170,
      height: 76,
      theme: this.theme,
    });

    this.timerCard = new StatCard(scene, {
      icon: 'clock',
      label: hasTimeLimit(this.challengeMode)
        ? GAMEPLAY_COPY.hud.timeRemainingLabel
        : GAMEPLAY_COPY.hud.timeElapsedLabel,
      value: this.lastTimeLabel,
      accentColor: Colors.Semantic.Info,
      width: 170,
      height: 76,
      theme: this.theme,
    });

    this.countdownBar = new ProgressBar(scene, {
      width: 340,
      height: 10,
      value: Math.round(this.lastCountdownRatio * 1000),
      max: 1000,
      variant: 'continuous',
      fillColor: Colors.Semantic.Info,
      trackColor: Colors.Surface.ElevatedSurface,
      borderColor: Colors.Surface.Border,
      animated: false,
      theme: this.theme,
    });
    this.countdownBar.setVisible(hasTimeLimit(this.challengeMode));

    this.floatingFeedback = new FloatingMatchFeedback(scene, 0, 0);

    this.add([
      this.moveCard,
      this.timerCard,
      this.matchCounter,
      this.countdownBar,
      this.floatingFeedback,
    ]);
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

    const showBar = layout.countdownBar.visible && hasTimeLimit(this.challengeMode);
    this.countdownBar.setVisible(showBar);
    if (showBar) {
      this.countdownBar.setBarSize(layout.countdownBar.width, layout.countdownBar.height);
      this.countdownBar.setPosition(layout.countdownBar.x, layout.countdownBar.y);
    }

    this.floatingFeedback.setAnchorPosition(layout.feedbackX, layout.feedbackY);
    return this;
  }

  public getMatchCounterPosition(): { readonly x: number; readonly y: number } {
    return {
      x: this.x + this.matchCounter.x,
      y: this.y + this.matchCounter.y,
    };
  }

  public getMatchCounterBounds(): {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  } {
    const w = this.matchCounter.width * this.matchCounter.scaleX;
    const h = Math.max(76, this.matchCounter.height * this.matchCounter.scaleY);
    const pos = this.getMatchCounterPosition();
    return {
      x: Math.round(pos.x - w / 2),
      y: Math.round(pos.y - h / 2),
      width: Math.round(w),
      height: Math.round(h),
    };
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

  public setMoveCount(moves: number, animate = true): this {
    if (hasMoveLimit(this.challengeMode)) {
      return this;
    }
    if (moves === this.lastMoveDisplay) {
      return this;
    }
    const shouldPulse = animate && moves > this.lastMoveDisplay && this.policy.allowCounterPop;
    this.lastMoveDisplay = moves;
    this.moveCard.setAccentColor(Colors.Brand.PrimaryLight);
    this.moveCard.setValueColor(Colors.Text.Primary);
    this.moveCard.setValue(String(moves), shouldPulse);
    return this;
  }

  public setRemainingMoves(remaining: number | null, animate = true): this {
    if (!hasMoveLimit(this.challengeMode) || remaining === null) {
      return this;
    }
    const safeRemaining = Math.max(0, remaining);
    const changed = safeRemaining !== this.lastMoveDisplay;
    const shouldPulse =
      animate && changed && safeRemaining < this.lastMoveDisplay && this.policy.allowCounterPop;
    this.lastMoveDisplay = safeRemaining;

    const urgency: CountdownUrgency =
      safeRemaining <= GAMEPLAY_CONFIG.lowMovesCriticalThreshold
        ? 'critical'
        : safeRemaining <= GAMEPLAY_CONFIG.lowMovesWarningThreshold
          ? 'warning'
          : 'normal';

    const accent = resolveUrgencyColor(urgency, Colors.Brand.PrimaryLight);
    const textColor =
      urgency === 'normal'
        ? Colors.Text.Primary
        : resolveUrgencyColor(urgency, Colors.Text.Primary);

    this.moveCard.setLabel(GAMEPLAY_COPY.hud.movesLeftLabel);
    this.moveCard.setAccentColor(accent);
    this.moveCard.setValueColor(textColor);
    if (changed) {
      this.moveCard.setValue(String(safeRemaining), shouldPulse);
    }
    return this;
  }

  public setElapsedTime(formattedTime: string): this {
    if (hasTimeLimit(this.challengeMode)) {
      return this;
    }
    if (formattedTime === this.lastTimeLabel) {
      return this;
    }
    this.lastTimeLabel = formattedTime;
    this.timerCard.setValue(formattedTime);
    return this;
  }

  public setCountdownState(
    formattedTime: string,
    ratio: number | null,
    urgency: CountdownUrgency,
  ): this {
    if (!hasTimeLimit(this.challengeMode)) {
      return this.setElapsedTime(formattedTime);
    }

    const timeChanged = formattedTime !== this.lastTimeLabel;
    const urgencyChanged = urgency !== this.lastUrgency;
    const clampedRatio = ratio === null ? 0 : Math.max(0, Math.min(1, ratio));
    const ratioChanged = Math.abs(clampedRatio - this.lastCountdownRatio) >= 0.002;

    if (urgencyChanged) {
      this.lastUrgency = urgency;
      const accent = resolveUrgencyColor(urgency, Colors.Semantic.Info);
      const valueColor =
        urgency === 'normal'
          ? Colors.Text.Primary
          : resolveUrgencyColor(urgency, Colors.Text.Primary);
      this.timerCard.setAccentColor(accent);
      this.timerCard.setValueColor(valueColor);
      this.countdownBar.setFillColor(accent);
    }

    if (timeChanged) {
      const pulseCritical =
        urgency === 'critical' && !this.theme.reducedMotion && this.policy.allowCounterPop;
      this.lastTimeLabel = formattedTime;
      this.timerCard.setValue(formattedTime, pulseCritical);
    }

    if (ratioChanged || urgencyChanged) {
      this.lastCountdownRatio = clampedRatio;
      this.countdownBar.setProgress(Math.round(clampedRatio * 1000), 1000, false);
    }

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
    this.stopActiveParticles();

    this.floatingFeedback.show(feedback, this.policy);

    // Subtle aggregate sparkle burst near MatchCounter ONLY for positive aggregate deltas
    if (feedback.tone === 'positive' && this.policy.allowParticles) {
      const pos = this.getMatchCounterPosition();
      this.cancelActiveParticles = spawnParticleBurst(this.scene, {
        x: pos.x + this.matchCounter.width * 0.25,
        y: pos.y - 12,
        kind: 'matchPositive',
        policy: this.policy,
        depth: 420,
      });
    }

    return this;
  }

  public clearFeedback(): this {
    this.stopActiveParticles();
    this.floatingFeedback.clear();
    return this;
  }

  public setPolicy(policy: AnimationPolicy): this {
    this.policy = policy;
    return this;
  }

  public setTheme(theme: GameTheme): this {
    this.theme = theme;
    this.policy = resolveAnimationPolicy(theme.reducedMotion, this.policy.timeScale);
    this.matchCounter.setTheme(theme);
    this.moveCard.setTheme(theme);
    this.timerCard.setTheme(theme);
    this.countdownBar.setTheme(theme);
    return this;
  }

  private stopActiveParticles(): void {
    if (this.cancelActiveParticles !== undefined) {
      this.cancelActiveParticles();
      this.cancelActiveParticles = undefined;
    }
  }

  public override destroy(fromScene?: boolean): void {
    this.stopActiveParticles();
    this.floatingFeedback.clear();
    super.destroy(fromScene);
  }
}
