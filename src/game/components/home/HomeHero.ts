import Phaser from 'phaser';
import { HOME_CONFIG, type HeroBottlePlacement } from '../../../config/HomeConfig';
import {
  Colors,
  DefaultGameTheme,
  hexToNumber,
  MotionDurations,
  MotionEasings,
  resolveMotionDuration,
  type GameTheme,
} from '../../../design-system';
import { EFFECT_TEXTURE_KEYS } from '../../assets/AssetKeys';
import { getBottleMetadata } from '../../assets/BottleCatalog';

export interface HomeHeroConfig {
  readonly x?: number;
  readonly y?: number;
  readonly width?: number;
  readonly height?: number;
  readonly bottleHeight?: number;
  readonly simplified?: boolean;
  readonly theme?: GameTheme;
}

interface DecorativeBottleNode {
  readonly placement: HeroBottlePlacement;
  readonly container: Phaser.GameObjects.Container;
  readonly shadow: Phaser.GameObjects.Image;
  readonly bottleImage: Phaser.GameObjects.Image;
  baseX: number;
  baseY: number;
  baseAngle: number;
  ambientTween?: Phaser.Tweens.Tween;
  tapTween?: Phaser.Tweens.Tween;
  ambientDelayTimer?: Phaser.Time.TimerEvent;
}

/**
 * Expressive decorative bottle hero composition reusing existing glossy bottle assets.
 * Communicates colourful bottle swapping with subtle curved golden swap arrows, grounded
 * shadows, optional playful tap bounce, and lightweight ambient floating that respects
 * reduced-motion and browser/platform suspension. Never mutates gameplay or progression state.
 */
export class HomeHero extends Phaser.GameObjects.Container {
  private theme: GameTheme;
  private heroWidth: number;
  private heroHeight: number;
  private bottleHeight: number;
  private simplified: boolean;
  private ambientActive = false;
  private suspended = false;

  private readonly haloGraphics: Phaser.GameObjects.Graphics;
  private readonly swapArcGraphics: Phaser.GameObjects.Graphics;
  private readonly bottlesLayer: Phaser.GameObjects.Container;
  private readonly sparklesLayer: Phaser.GameObjects.Container;
  private readonly bottleNodes: DecorativeBottleNode[] = [];
  private readonly activeEffectTweens = new Set<Phaser.Tweens.Tween>();
  private readonly activeEffectObjects = new Set<Phaser.GameObjects.Image>();

  public constructor(scene: Phaser.Scene, config: HomeHeroConfig = {}) {
    super(scene, config.x ?? 0, config.y ?? 0);

    this.theme = config.theme ?? DefaultGameTheme;
    this.heroWidth = Math.max(180, config.width ?? 440);
    this.heroHeight = Math.max(120, config.height ?? 340);
    this.bottleHeight = Math.max(82, config.bottleHeight ?? 210);
    this.simplified = config.simplified ?? false;

    this.haloGraphics = scene.add.graphics();
    this.swapArcGraphics = scene.add.graphics();
    this.bottlesLayer = scene.add.container(0, 0);
    this.sparklesLayer = scene.add.container(0, 0);

    this.add([this.haloGraphics, this.bottlesLayer, this.swapArcGraphics, this.sparklesLayer]);

    this.buildBottleNodes();
    this.layoutHero();

    scene.add.existing(this);
  }

  public applyBounds(bounds: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly bottleHeight: number;
    readonly simplified: boolean;
    readonly visible?: boolean;
  }): this {
    const isVisible = bounds.visible ?? bounds.height > 0;
    this.setVisible(isVisible);
    if (!isVisible) {
      this.stopAmbientTweensOnly();
      return this;
    }

    this.setPosition(bounds.x, bounds.y);
    this.heroWidth = Math.max(160, bounds.width);
    this.heroHeight = Math.max(60, bounds.height);
    this.bottleHeight = Math.max(54, bounds.bottleHeight);
    this.simplified = bounds.simplified;

    const wasAmbient = this.ambientActive;
    this.stopAmbient();
    this.layoutHero();
    if (wasAmbient && !this.suspended) {
      this.startAmbient();
    }
    return this;
  }

  public setTheme(theme: GameTheme): this {
    this.theme = theme;
    if (theme.reducedMotion) {
      this.stopAmbient();
      this.resetBottlePoses();
    } else if (!this.suspended && this.ambientActive) {
      this.startAmbient();
    }
    return this;
  }

  public setSuspended(suspended: boolean): this {
    this.suspended = suspended;
    if (suspended) {
      this.pauseAmbientTweens();
    } else if (this.ambientActive && !this.theme.reducedMotion) {
      this.resumeAmbientTweens();
    }
    return this;
  }

  public startAmbient(): this {
    this.ambientActive = true;
    this.stopAmbientTweensOnly();

    if (this.theme.reducedMotion || this.suspended || this.simplified) {
      this.resetBottlePoses();
      return this;
    }

    const floatPx = HOME_CONFIG.motion.ambientFloatPx;
    const tiltDeg = HOME_CONFIG.motion.ambientTiltDeg;

    for (const node of this.bottleNodes) {
      const startDrift = (): void => {
        node.ambientDelayTimer = undefined;
        if (!this.ambientActive || this.suspended || this.theme.reducedMotion || !this.active) {
          return;
        }
        const amp = floatPx * node.placement.floatAmplitude;
        const tiltDelta = node.placement.angleDeg >= 0 ? tiltDeg : -tiltDeg;
        node.ambientTween = this.scene.tweens.add({
          targets: node.bottleImage,
          y: -amp,
          angle: node.baseAngle + tiltDelta,
          duration: HOME_CONFIG.motion.ambientFloatDurationMs,
          ease: MotionEasings.EaseInOut,
          yoyo: true,
          repeat: -1,
          onUpdate: () => {
            const liftRatio = Math.min(1, Math.max(0, -node.bottleImage.y / Math.max(1, amp)));
            node.shadow.setAlpha(0.55 - liftRatio * 0.14);
          },
        });
      };

      if (node.placement.phaseOffsetMs > 0) {
        node.ambientDelayTimer = this.scene.time.delayedCall(
          node.placement.phaseOffsetMs,
          startDrift,
        );
      } else {
        startDrift();
      }
    }

    return this;
  }

  public stopAmbient(): this {
    this.ambientActive = false;
    this.stopAmbientTweensOnly();
    this.resetBottlePoses();
    return this;
  }

  private buildBottleNodes(): void {
    const ordered = [...HOME_CONFIG.heroBottles].sort((a, b) => a.zOrder - b.zOrder);

    for (const placement of ordered) {
      const meta = getBottleMetadata(placement.bottleId);
      // Graceful fallback if decorative texture is missing
      if (!this.scene.textures.exists(meta.textureKey)) {
        continue;
      }

      const nodeContainer = this.scene.add.container(0, 0);
      const shadowKey = this.scene.textures.exists(EFFECT_TEXTURE_KEYS.BOTTLE_SHADOW)
        ? EFFECT_TEXTURE_KEYS.BOTTLE_SHADOW
        : meta.textureKey;

      const shadow = this.scene.add
        .image(0, 4, shadowKey)
        .setOrigin(0.5, 0.5)
        .setAlpha(shadowKey === EFFECT_TEXTURE_KEYS.BOTTLE_SHADOW ? 0.55 : 0);

      const bottleImage = this.scene.add
        .image(0, 0, meta.textureKey)
        .setOrigin(0.5, 1)
        .setAngle(placement.angleDeg);

      nodeContainer.add([shadow, bottleImage]);
      this.bottlesLayer.add(nodeContainer);

      const node: DecorativeBottleNode = {
        placement,
        container: nodeContainer,
        shadow,
        bottleImage,
        baseX: 0,
        baseY: 0,
        baseAngle: placement.angleDeg,
      };

      bottleImage.setInteractive({ useHandCursor: true });
      bottleImage.on(Phaser.Input.Events.POINTER_DOWN, () => {
        this.playDecorativeTapFeedback(node);
      });

      this.bottleNodes.push(node);
    }
  }

  private layoutHero(): void {
    const baseBottleH = this.bottleHeight;
    const baseBottleW = Math.round(baseBottleH * 0.5);
    const baselineY = Math.round(this.heroHeight * 0.32);

    // Subtle radial ambient glow behind hero bottles
    this.haloGraphics.clear();
    const glowR = Math.min(this.heroWidth * 0.46, this.heroHeight * 0.52);
    this.haloGraphics.fillStyle(hexToNumber(Colors.Brand.Primary), 0.14);
    this.haloGraphics.fillCircle(0, -this.heroHeight * 0.04, glowR);
    this.haloGraphics.fillStyle(hexToNumber(Colors.Brand.Secondary), 0.08);
    this.haloGraphics.fillCircle(0, -this.heroHeight * 0.08, glowR * 0.62);

    // Subtle curved swap-arrow accent suggesting the core swapping mechanic
    this.swapArcGraphics.clear();
    if (!this.simplified) {
      const arcSpan = Math.min(this.heroWidth * 0.3, baseBottleW * 2.05);
      const arcRadius = arcSpan * 0.62;
      const arcCenterY = baselineY - baseBottleH * 1.24 + arcRadius;
      this.swapArcGraphics.lineStyle(3, hexToNumber(Colors.Brand.Secondary), 0.76);
      this.swapArcGraphics.beginPath();
      this.swapArcGraphics.arc(0, arcCenterY, arcRadius, Math.PI * 1.2, Math.PI * 1.8, false);
      this.swapArcGraphics.strokePath();

      // Right arrowhead
      const rightX = Math.cos(Math.PI * 1.8) * arcRadius;
      const rightY = arcCenterY + Math.sin(Math.PI * 1.8) * arcRadius;
      this.swapArcGraphics.fillStyle(hexToNumber(Colors.Brand.Secondary), 0.88);
      this.swapArcGraphics.fillTriangle(
        rightX + 5,
        rightY + 2,
        rightX - 7,
        rightY - 6,
        rightX - 5,
        rightY + 7,
      );

      // Left arrowhead
      const leftX = Math.cos(Math.PI * 1.2) * arcRadius;
      const leftY = arcCenterY + Math.sin(Math.PI * 1.2) * arcRadius;
      this.swapArcGraphics.fillTriangle(
        leftX - 5,
        leftY + 2,
        leftX + 7,
        leftY - 6,
        leftX + 5,
        leftY + 7,
      );
    }

    // Restrained static decorative sparkles
    this.sparklesLayer.removeAll(true);
    if (!this.simplified && this.scene.textures.exists(EFFECT_TEXTURE_KEYS.SPARKLE)) {
      const sparkleSpots = [
        { x: -this.heroWidth * 0.34, y: -this.heroHeight * 0.34, scale: 0.42, alpha: 0.65 },
        { x: this.heroWidth * 0.35, y: -this.heroHeight * 0.28, scale: 0.36, alpha: 0.55 },
        { x: 0, y: -this.heroHeight * 0.48, scale: 0.32, alpha: 0.5 },
      ];
      for (const spot of sparkleSpots) {
        const sp = this.scene.add
          .image(spot.x, spot.y, EFFECT_TEXTURE_KEYS.SPARKLE)
          .setTint(hexToNumber(Colors.Brand.Secondary))
          .setScale(spot.scale)
          .setAlpha(spot.alpha);
        this.sparklesLayer.add(sp);
      }
    }

    for (const node of this.bottleNodes) {
      const w = Math.round(baseBottleW * node.placement.scale);
      const h = Math.round(baseBottleH * node.placement.scale);
      const x = Math.round(node.placement.offsetXRatio * this.heroWidth);
      const y = Math.round(baselineY + node.placement.offsetYRatio * this.heroHeight);

      node.baseX = x;
      node.baseY = y;
      node.container.setPosition(x, y);
      node.bottleImage.setDisplaySize(w, h);
      node.bottleImage.setPosition(0, 0);
      node.bottleImage.setAngle(node.baseAngle);
      node.shadow.setDisplaySize(Math.round(w * 1.08), Math.max(10, Math.round(w * 0.26)));
      node.shadow.setAlpha(0.55);
    }
  }

  private playDecorativeTapFeedback(node: DecorativeBottleNode): void {
    if (this.theme.reducedMotion || this.suspended) {
      return;
    }

    if (node.tapTween !== undefined) {
      node.tapTween.stop();
      node.tapTween = undefined;
    }

    const baseScaleX = node.bottleImage.scaleX;
    const baseScaleY = node.bottleImage.scaleY;
    const duration = resolveMotionDuration(MotionDurations.Short, this.theme.reducedMotion);
    if (duration === 0) {
      return;
    }

    node.tapTween = this.scene.tweens.add({
      targets: node.bottleImage,
      scaleX: baseScaleX * 1.07,
      scaleY: baseScaleY * 0.94,
      angle: node.baseAngle + (node.baseAngle >= 0 ? 5 : -5),
      duration: Math.round(duration * 0.6),
      ease: MotionEasings.EaseOut,
      yoyo: true,
      onComplete: () => {
        node.bottleImage.setScale(baseScaleX, baseScaleY);
        node.bottleImage.setAngle(node.baseAngle);
        node.tapTween = undefined;
      },
    });

    // Subtle single sparkle pop above tapped decorative bottle
    if (this.scene.textures.exists(EFFECT_TEXTURE_KEYS.SPARKLE)) {
      const sp = this.scene.add
        .image(
          node.baseX,
          node.baseY - node.bottleImage.displayHeight * 0.92,
          EFFECT_TEXTURE_KEYS.SPARKLE,
        )
        .setTint(hexToNumber(Colors.Brand.Secondary))
        .setScale(0.35)
        .setAlpha(0.9);
      this.sparklesLayer.add(sp);
      this.activeEffectObjects.add(sp);

      const fxTween = this.scene.tweens.add({
        targets: sp,
        y: sp.y - 22,
        scaleX: 0.65,
        scaleY: 0.65,
        alpha: 0,
        duration: 360,
        ease: MotionEasings.EaseOut,
        onComplete: () => {
          this.activeEffectTweens.delete(fxTween);
          this.activeEffectObjects.delete(sp);
          if (sp.active) {
            sp.destroy();
          }
        },
      });
      this.activeEffectTweens.add(fxTween);
    }
  }

  private pauseAmbientTweens(): void {
    for (const node of this.bottleNodes) {
      node.ambientTween?.pause();
    }
  }

  private resumeAmbientTweens(): void {
    for (const node of this.bottleNodes) {
      if (node.ambientTween !== undefined) {
        node.ambientTween.resume();
      }
    }
  }

  private stopAmbientTweensOnly(): void {
    for (const node of this.bottleNodes) {
      if (node.ambientDelayTimer !== undefined) {
        node.ambientDelayTimer.remove(false);
        node.ambientDelayTimer = undefined;
      }
      if (node.ambientTween !== undefined) {
        node.ambientTween.stop();
        node.ambientTween = undefined;
      }
      if (node.tapTween !== undefined) {
        node.tapTween.stop();
        node.tapTween = undefined;
      }
    }
  }

  private resetBottlePoses(): void {
    for (const node of this.bottleNodes) {
      node.bottleImage.setPosition(0, 0);
      node.bottleImage.setAngle(node.baseAngle);
      node.shadow.setAlpha(0.55);
    }
  }

  public override destroy(fromScene?: boolean): void {
    this.stopAmbient();
    for (const tween of this.activeEffectTweens) {
      tween.stop();
    }
    this.activeEffectTweens.clear();
    for (const obj of this.activeEffectObjects) {
      if (obj.active) {
        obj.destroy();
      }
    }
    this.activeEffectObjects.clear();
    for (const node of this.bottleNodes) {
      node.bottleImage.removeAllListeners();
    }
    super.destroy(fromScene);
  }
}
