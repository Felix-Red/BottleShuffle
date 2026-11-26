import type Phaser from 'phaser';
import { Colors, hexToNumber } from '../../../design-system/tokens/Colors';
import { Dimens } from '../../../design-system/tokens/Dimens';
import { MotionEasings } from '../../../design-system/tokens/Motion';
import { SemanticShapes } from '../../../design-system/tokens/Shapes';
import { spawnParticleBurst } from '../../components/effects/ParticleBurst';
import type { AnimationPolicy } from '../core/AnimationPolicy';

export interface VictoryCelebrationParams {
  readonly scene: Phaser.Scene;
  readonly rackBounds: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
  readonly matchCounterPosition: { readonly x: number; readonly y: number };
  readonly policy: AnimationPolicy;
  readonly onReadyForOverlay?: () => void;
  readonly onComplete?: () => void;
}

/**
 * Short, tasteful completion celebration triggered ONLY after the entire puzzle is solved.
 * Displays a full-rack success perimeter glow (never individual bottles during play) plus
 * bounded star & confetti bursts, and reveals the completion overlay promptly so players
 * are never kept waiting for controls.
 */
export function playVictoryCelebration(params: VictoryCelebrationParams): () => void {
  const { scene, rackBounds, matchCounterPosition, policy, onReadyForOverlay, onComplete } = params;

  let finished = false;
  const activeTweens: Phaser.Tweens.Tween[] = [];
  const activeTimers: Phaser.Time.TimerEvent[] = [];
  const cancelParticles: (() => void)[] = [];
  let glowGraphics: Phaser.GameObjects.Graphics | undefined;

  const cleanup = (): void => {
    for (const tween of activeTweens) {
      tween.stop();
    }
    activeTweens.length = 0;
    for (const timer of activeTimers) {
      timer.remove(false);
    }
    activeTimers.length = 0;
    for (const stopFx of cancelParticles) {
      stopFx();
    }
    cancelParticles.length = 0;
    if (glowGraphics?.active) {
      glowGraphics.destroy();
      glowGraphics = undefined;
    }
  };

  const cancel = (): void => {
    if (finished) {
      return;
    }
    finished = true;
    cleanup();
  };

  const totalDuration = Math.max(180, policy.victoryCelebrationMs);
  const overlayDelayMs = policy.reducedMotion
    ? 80
    : Math.min(460, Math.round(totalDuration * 0.56));

  // Full-rack success glow (strictly post-completion only)
  const glowW = rackBounds.width + Dimens.Space32;
  const glowH = rackBounds.height + Dimens.Space24;
  glowGraphics = scene.add.graphics().setDepth(350);
  glowGraphics.setPosition(rackBounds.x, rackBounds.y);
  glowGraphics.fillStyle(hexToNumber(Colors.Semantic.Success), 0.1);
  glowGraphics.fillRoundedRect(-glowW / 2, -glowH / 2, glowW, glowH, SemanticShapes.Modal);
  glowGraphics.lineStyle(6, hexToNumber(Colors.Semantic.Success), 0.28);
  glowGraphics.strokeRoundedRect(-glowW / 2, -glowH / 2, glowW, glowH, SemanticShapes.Modal);
  glowGraphics.lineStyle(2.5, hexToNumber(Colors.Brand.Secondary), 0.9);
  glowGraphics.strokeRoundedRect(-glowW / 2, -glowH / 2, glowW, glowH, SemanticShapes.Modal);

  if (policy.reducedMotion) {
    glowGraphics.setAlpha(0.8);
  } else {
    glowGraphics.setAlpha(0);
    glowGraphics.setScale(0.97);
    activeTweens.push(
      scene.tweens.add({
        targets: glowGraphics,
        alpha: 1,
        scaleX: 1,
        scaleY: 1,
        duration: Math.round(totalDuration * 0.28),
        ease: MotionEasings.EaseOut,
        onComplete: () => {
          if (finished || glowGraphics === undefined) {
            return;
          }
          activeTweens.push(
            scene.tweens.add({
              targets: glowGraphics,
              alpha: 0,
              duration: Math.round(totalDuration * 0.55),
              ease: MotionEasings.GentleSettle,
            }),
          );
        },
      }),
    );
  }

  // Bounded star & confetti burst near the MatchCounter and top of rack
  if (policy.allowParticles) {
    cancelParticles.push(
      spawnParticleBurst(scene, {
        x: matchCounterPosition.x,
        y: matchCounterPosition.y,
        kind: 'victory',
        policy,
        depth: 440,
        spreadWidth: Math.min(360, rackBounds.width * 0.65),
      }),
    );
  }

  activeTimers.push(
    scene.time.delayedCall(overlayDelayMs, () => {
      if (!finished) {
        onReadyForOverlay?.();
      }
    }),
    scene.time.delayedCall(totalDuration, () => {
      if (finished) {
        return;
      }
      finished = true;
      cleanup();
      onComplete?.();
    }),
  );

  return cancel;
}
