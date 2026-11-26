import type Phaser from 'phaser';
import { Colors, hexToNumber } from '../../../design-system/tokens/Colors';
import { MotionEasings, MotionParams } from '../../../design-system/tokens/Motion';
import type { AnimationPolicy } from '../../animations/core/AnimationPolicy';
import { EFFECT_TEXTURE_KEYS } from '../../assets/AssetKeys';

export type ParticleBurstKind = 'matchPositive' | 'victory';

export interface ParticleBurstConfig {
  readonly x: number;
  readonly y: number;
  readonly kind: ParticleBurstKind;
  readonly policy: AnimationPolicy;
  readonly depth?: number;
  readonly spreadWidth?: number;
}

/**
 * Conservative bounded particle budgets documented for mobile browser performance.
 */
export const PARTICLE_BUDGETS = {
  matchPositive: 8,
  victory: 22,
} as const;

const VICTORY_PALETTE: readonly string[] = [
  Colors.Brand.Secondary,
  Colors.Semantic.Success,
  Colors.Brand.PrimaryLight,
  Colors.Text.Primary,
  Colors.Bottle.Pink,
  Colors.Bottle.Teal,
];

const POSITIVE_MATCH_PALETTE: readonly string[] = [
  Colors.Semantic.Success,
  Colors.Brand.Secondary,
  Colors.Text.Primary,
];

/**
 * Spawns a one-shot, bounded, self-cleaning particle burst using locally bundled
 * sparkle/particle textures. Never creates continuous emitters and no-ops in reduced motion.
 */
export function spawnParticleBurst(
  scene: Phaser.Scene,
  config: ParticleBurstConfig,
  onFinished?: () => void,
): () => void {
  if (!config.policy.allowParticles) {
    onFinished?.();
    return () => undefined;
  }

  const count = PARTICLE_BUDGETS[config.kind];
  const baseLifetime =
    config.kind === 'victory'
      ? MotionParams.celebrationParticleLifetimeMs
      : MotionParams.particleLifetimeMs;
  const lifetime = Math.max(120, Math.round(baseLifetime / config.policy.timeScale));
  const palette = config.kind === 'victory' ? VICTORY_PALETTE : POSITIVE_MATCH_PALETTE;
  const depth = config.depth ?? 420;

  const container = scene.add.container(config.x, config.y).setDepth(depth);
  const tweens: Phaser.Tweens.Tween[] = [];
  let finished = false;
  let remaining = count;

  const cleanup = (): void => {
    if (finished) {
      return;
    }
    finished = true;
    for (const tween of tweens) {
      tween.stop();
    }
    tweens.length = 0;
    if (container.active) {
      container.destroy(true);
    }
  };

  for (let i = 0; i < count; i += 1) {
    const isStar = i % 2 === 0;
    const textureKey = isStar ? EFFECT_TEXTURE_KEYS.SPARKLE : EFFECT_TEXTURE_KEYS.PARTICLE;
    const colorHex = palette[i % palette.length] ?? Colors.Brand.Secondary;

    // Deterministic radial distribution with subtle deterministic variation
    const angleBase =
      config.kind === 'victory'
        ? -Math.PI + (Math.PI * (i + 0.5)) / count + ((i % 3) - 1) * 0.14
        : (Math.PI * 2 * i) / count - Math.PI / 2;

    const startOffsetX =
      config.spreadWidth !== undefined && config.spreadWidth > 0
        ? (i / Math.max(1, count - 1) - 0.5) * config.spreadWidth * 0.65
        : 0;

    const radius = config.kind === 'victory' ? 56 + ((i * 23) % 74) : 28 + ((i * 13) % 26);

    const targetX = startOffsetX + Math.cos(angleBase) * radius;
    const targetY = Math.sin(angleBase) * radius + (config.kind === 'victory' ? 18 : -6);

    const startScale = isStar ? (config.kind === 'victory' ? 0.55 : 0.42) : 0.36;
    const sprite = scene.add
      .image(startOffsetX, 0, textureKey)
      .setTint(hexToNumber(colorHex))
      .setScale(startScale)
      .setAlpha(0.95);

    if (!isStar && config.kind === 'victory') {
      // Subtle confetti aspect ratio without generating extra textures
      sprite.setScale(0.46, 0.24);
    }

    container.add(sprite);

    const particleDuration = Math.round(lifetime * (0.76 + (i % 4) * 0.08));
    const tween = scene.tweens.add({
      targets: sprite,
      x: targetX,
      y: targetY,
      angle: config.kind === 'victory' ? (i % 2 === 0 ? 150 : -150) : 45,
      alpha: 0,
      scaleX: sprite.scaleX * 0.35,
      scaleY: sprite.scaleY * 0.35,
      duration: particleDuration,
      ease: MotionEasings.EaseOut,
      onComplete: () => {
        remaining -= 1;
        if (remaining <= 0 && !finished) {
          cleanup();
          onFinished?.();
        }
      },
    });
    tweens.push(tween);
  }

  return cleanup;
}
