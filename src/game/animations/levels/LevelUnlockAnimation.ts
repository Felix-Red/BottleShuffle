import type Phaser from 'phaser';
import { LEVEL_SELECTION_MOTION } from '../../../config/ChapterVisualConfig';
import {
  Colors,
  Dimens,
  drawIcon,
  hexToNumber,
  MotionEasings,
  resolveMotionDuration,
  SemanticShapes,
  type LevelCard,
} from '../../../design-system';
import { EFFECT_TEXTURE_KEYS } from '../../assets/AssetKeys';

/**
 * Restrained level-unlocking reveal played once when a newly unlocked level card
 * first becomes visible in LevelSelectionScene.
 * Purely presentational: never unlocks levels or mutates ProgressionEngine state.
 */
export class LevelUnlockAnimation {
  private readonly scene: Phaser.Scene;
  private readonly activeTweens = new Set<Phaser.Tweens.Tween>();
  private readonly transientObjects = new Set<Phaser.GameObjects.GameObject>();

  public constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  public playOnCard(card: LevelCard, reducedMotion: boolean): void {
    const duration = resolveMotionDuration(
      LEVEL_SELECTION_MOTION.levelUnlockDurationMs,
      reducedMotion,
    );
    if (duration === 0 || !card.active) {
      card.setScale(1);
      return;
    }

    const { width, height } = card.getCardDimensions();

    // Soft pop-in emphasis on the unlocked card
    card.setScale(0.92);
    const cardTween = this.scene.tweens.add({
      targets: card,
      scaleX: 1,
      scaleY: 1,
      duration: Math.round(duration * 0.72),
      ease: MotionEasings.SoftOvershoot,
      onComplete: () => {
        this.activeTweens.delete(cardTween);
        if (card.active) {
          card.setScale(1);
        }
      },
    });
    this.activeTweens.add(cardTween);

    // Transient fading lock icon lifting away from the card
    const lockGhost = this.scene.add.graphics();
    drawIcon(lockGhost, 'lock', 0, 0, 22, Colors.Brand.Secondary, 0.95);
    card.add(lockGhost);
    this.transientObjects.add(lockGhost);

    const lockTween = this.scene.tweens.add({
      targets: lockGhost,
      y: -18,
      scaleX: 1.3,
      scaleY: 1.3,
      alpha: 0,
      duration: Math.round(duration * 0.65),
      ease: MotionEasings.EaseOut,
      onComplete: () => {
        this.activeTweens.delete(lockTween);
        this.transientObjects.delete(lockGhost);
        if (lockGhost.active) {
          lockGhost.destroy();
        }
      },
    });
    this.activeTweens.add(lockTween);

    // Brief outline glow ring expanding gently around the card
    const ring = this.scene.add.graphics();
    ring.lineStyle(Dimens.BorderThick, hexToNumber(Colors.Brand.Secondary), 0.9);
    ring.strokeRoundedRect(
      -width / 2 - 2,
      -height / 2 - 2,
      width + 4,
      height + 4,
      SemanticShapes.LevelCard + 2,
    );
    card.add(ring);
    this.transientObjects.add(ring);

    const ringTween = this.scene.tweens.add({
      targets: ring,
      scaleX: 1.12,
      scaleY: 1.12,
      alpha: 0,
      duration,
      ease: MotionEasings.EaseOutCubic,
      onComplete: () => {
        this.activeTweens.delete(ringTween);
        this.transientObjects.delete(ring);
        if (ring.active) {
          ring.destroy();
        }
      },
    });
    this.activeTweens.add(ringTween);

    // Bounded 4-sparkle celebration burst using bundled sparkle sprite
    if (this.scene.textures.exists(EFFECT_TEXTURE_KEYS.SPARKLE)) {
      const angles = [-Math.PI * 0.75, -Math.PI * 0.25, Math.PI * 0.25, Math.PI * 0.75];
      const radius = Math.min(width, height) * 0.52;
      for (const angle of angles) {
        const sp = this.scene.add
          .image(0, 0, EFFECT_TEXTURE_KEYS.SPARKLE)
          .setTint(hexToNumber(Colors.Brand.Secondary))
          .setScale(0.32)
          .setAlpha(0.95);
        card.add(sp);
        this.transientObjects.add(sp);

        const spTween = this.scene.tweens.add({
          targets: sp,
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius,
          scaleX: 0.55,
          scaleY: 0.55,
          alpha: 0,
          duration,
          ease: MotionEasings.EaseOut,
          onComplete: () => {
            this.activeTweens.delete(spTween);
            this.transientObjects.delete(sp);
            if (sp.active) {
              sp.destroy();
            }
          },
        });
        this.activeTweens.add(spTween);
      }
    }
  }

  public cancelAll(): void {
    for (const tween of this.activeTweens) {
      tween.stop();
    }
    this.activeTweens.clear();

    for (const obj of this.transientObjects) {
      if (obj.active) {
        obj.destroy();
      }
    }
    this.transientObjects.clear();
  }
}
