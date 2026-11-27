import Phaser from 'phaser';
import {
  Colors,
  DefaultGameTheme,
  MatchCounter,
  StatCard,
  type GameTheme,
} from '../../../design-system';
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
  readonly initialTime?: string;
  readonly theme?: GameTheme;
  readonly policy?: AnimationPolicy;
}

export class GameplayHUD extends Phaser.GameObjects.Container {
  private theme: GameTheme;
  private policy: AnimationPolicy;
  private readonly matchCounter: MatchCounter;
  private readonly moveCard: StatCard;
  private readonly timerCard: StatCard;
  private readonly floatingFeedback: FloatingMatchFeedback;

  private lastMatchCount: number;
  private lastTotalCount: number;
  private lastMoveCount: number;
  private lastTimeLabel: string;
  private lastFeedbackId = -1;
  private cancelActiveParticles?: () => void;

  public constructor(scene: Phaser.Scene, config: GameplayHudConfig) {
    super(scene, 0, 0);

    this.theme = config.theme ?? DefaultGameTheme;
    this.policy = config.policy ?? resolveAnimationPolicy(this.theme.reducedMotion);
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

    this.floatingFeedback = new FloatingMatchFeedback(scene, 0, 0);

    this.add([this.moveCard, this.timerCard, this.matchCounter, this.floatingFeedback]);
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
    if (moves === this.lastMoveCount) {
      return this;
    }
    const shouldPulse = animate && moves > this.lastMoveCount && this.policy.allowCounterPop;
    this.lastMoveCount = moves;
    this.moveCard.setValue(String(moves), shouldPulse);
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
