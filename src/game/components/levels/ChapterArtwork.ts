import Phaser from 'phaser';
import { getChapterVisualTheme } from '../../../config/ChapterVisualConfig';
import {
  DefaultGameTheme,
  hexToNumber,
  MotionEasings,
  type GameTheme,
} from '../../../design-system';
import { EFFECT_TEXTURE_KEYS } from '../../assets/AssetKeys';
import { getBottleMetadata } from '../../assets/BottleCatalog';
import type { LevelSelectionLayout } from '../../layout/LevelSelectionLayout';
import type { ChapterViewState } from '../../levels/ChapterViewState';

interface ArtworkBottleNode {
  readonly image: Phaser.GameObjects.Image;
  readonly shadow: Phaser.GameObjects.Image;
  readonly baseY: number;
}

/**
 * Reusable chapter bottle artwork communicating each chapter's bottle count (3..10)
 * using existing bundled glossy bottle textures. Never generates a puzzle or mirrors
 * any level's hidden target sequence. Degrades gracefully if a decorative texture is missing.
 */
export class ChapterArtwork extends Phaser.GameObjects.Container {
  private theme: GameTheme;
  private artworkWidth = 320;
  private artworkHeight = 160;
  private targetBottleHeight = 116;
  private simplified = false;
  private suspended = false;

  private chapter: ChapterViewState | null = null;
  private readonly haloGraphics: Phaser.GameObjects.Graphics;
  private readonly bottlesContainer: Phaser.GameObjects.Container;
  private readonly bottleNodes: ArtworkBottleNode[] = [];
  private ambientTweens: Phaser.Tweens.Tween[] = [];

  public constructor(scene: Phaser.Scene, theme: GameTheme = DefaultGameTheme) {
    super(scene, 0, 0);
    this.theme = theme;

    this.haloGraphics = scene.add.graphics();
    this.bottlesContainer = scene.add.container(0, 0);
    this.add([this.haloGraphics, this.bottlesContainer]);

    scene.add.existing(this);
  }

  public applyBounds(bounds: LevelSelectionLayout['chapterArtwork']): this {
    this.setVisible(bounds.visible);
    this.artworkWidth = Math.max(160, bounds.width);
    this.artworkHeight = Math.max(48, bounds.height);
    this.targetBottleHeight = Math.max(48, bounds.bottleHeight);
    this.simplified = bounds.simplified;

    this.setPosition(
      Math.round(bounds.x + bounds.width / 2),
      Math.round(bounds.y + bounds.height / 2),
    );

    if (bounds.visible && this.chapter !== null) {
      this.rebuildComposition();
    } else {
      this.stopAmbient();
    }
    return this;
  }

  public setChapter(chapter: ChapterViewState): this {
    this.chapter = chapter;
    if (this.visible) {
      this.rebuildComposition();
    }
    return this;
  }

  public setTheme(theme: GameTheme): this {
    this.theme = theme;
    if (theme.reducedMotion) {
      this.stopAmbient();
      this.resetBottleOffsets();
    } else if (!this.suspended && this.visible) {
      this.startAmbient();
    }
    return this;
  }

  public setSuspended(suspended: boolean): this {
    this.suspended = suspended;
    if (suspended) {
      for (const tween of this.ambientTweens) {
        tween.pause();
      }
    } else if (!this.theme.reducedMotion && this.visible) {
      for (const tween of this.ambientTweens) {
        tween.resume();
      }
    }
    return this;
  }

  public stopAmbient(): void {
    for (const tween of this.ambientTweens) {
      tween.stop();
    }
    this.ambientTweens = [];
  }

  private rebuildComposition(): void {
    this.stopAmbient();
    this.bottlesContainer.removeAll(true);
    this.bottleNodes.length = 0;
    this.haloGraphics.clear();

    if (this.chapter === null) {
      return;
    }

    const visual = getChapterVisualTheme(
      this.chapter.chapterId,
      this.chapter.bottleCount,
      this.chapter.chapterNumber,
    );
    const bottleIds = visual.decorativeBottleIds;
    const count = bottleIds.length;
    if (count === 0) {
      return;
    }

    // Chapter-specific ambient glow backdrop
    const glowR = Math.min(this.artworkWidth * 0.42, this.artworkHeight * 0.68);
    this.haloGraphics.fillStyle(hexToNumber(visual.accentHex), this.chapter.isLocked ? 0.08 : 0.16);
    this.haloGraphics.fillEllipse(0, 6, glowR * 2.15, glowR * 1.15);

    if (!this.simplified) {
      this.haloGraphics.lineStyle(
        1.5,
        hexToNumber(visual.accentHex),
        this.chapter.isLocked ? 0.16 : 0.3,
      );
      this.haloGraphics.strokeEllipse(0, 6, glowR * 1.9, glowR * 0.95);
    }

    // Compute clean single-row spacing that fits all 3..10 bottles comfortably
    const usableW = Math.max(120, this.artworkWidth - 20);
    const maxBottleHByHeight = Math.max(48, Math.round(this.artworkHeight * 0.82));
    let bottleH = Math.min(this.targetBottleHeight, maxBottleHByHeight);
    let bottleW = bottleH * 0.5;

    // Slight overlap for 8-10 bottles so silhouettes remain large and unmistakably countable
    const spacingFactor = count >= 8 ? 0.84 : count >= 6 ? 0.92 : 1.06;
    const rawTotalW = bottleW + (count - 1) * bottleW * spacingFactor;
    if (rawTotalW > usableW) {
      const shrink = usableW / Math.max(1, rawTotalW);
      bottleH = Math.max(44, Math.round(bottleH * shrink));
      bottleW = bottleH * 0.5;
    }

    const stepX = bottleW * spacingFactor;
    const totalSpanW = (count - 1) * stepX;
    const startX = -totalSpanW / 2;
    const baselineY = Math.round(this.artworkHeight * 0.38);
    const hasShadowTex = this.scene.textures.exists(EFFECT_TEXTURE_KEYS.BOTTLE_SHADOW);

    bottleIds.forEach((bottleId, idx) => {
      const meta = getBottleMetadata(bottleId);
      if (!this.scene.textures.exists(meta.textureKey)) {
        return;
      }

      const norm = count > 1 ? (idx / (count - 1)) * 2 - 1 : 0; // -1 .. +1
      const archLift = (1 - norm * norm) * Math.min(10, bottleH * 0.08);
      const scaleBoost = 1 + (1 - Math.abs(norm)) * 0.06;
      const x = Math.round(startX + idx * stepX);
      const y = Math.round(baselineY - archLift);
      const angle = Math.round(norm * (count >= 8 ? 4 : 6));
      const drawW = Math.round(bottleW * scaleBoost);
      const drawH = Math.round(bottleH * scaleBoost);

      const shadow = this.scene.add
        .image(x, y + 2, hasShadowTex ? EFFECT_TEXTURE_KEYS.BOTTLE_SHADOW : meta.textureKey)
        .setOrigin(0.5, 0.5)
        .setDisplaySize(Math.round(drawW * 1.05), Math.max(6, Math.round(drawW * 0.24)))
        .setAlpha(hasShadowTex ? (this.chapter?.isLocked ? 0.28 : 0.48) : 0);

      const image = this.scene.add
        .image(x, y, meta.textureKey)
        .setOrigin(0.5, 1)
        .setDisplaySize(drawW, drawH)
        .setAngle(angle)
        .setAlpha(this.chapter?.isLocked ? 0.62 : 1);

      this.bottlesContainer.add([shadow, image]);
      this.bottleNodes.push({ image, shadow, baseY: y });
    });

    if (!this.theme.reducedMotion && !this.simplified && !this.suspended) {
      this.startAmbient();
    }
  }

  private startAmbient(): void {
    this.stopAmbient();
    if (this.theme.reducedMotion || this.simplified || this.suspended) {
      return;
    }

    this.bottleNodes.forEach((node, idx) => {
      const tween = this.scene.tweens.add({
        targets: node.image,
        y: node.baseY - 4,
        duration: 1800 + (idx % 3) * 180,
        delay: (idx % 5) * 140,
        ease: MotionEasings.EaseInOut,
        yoyo: true,
        repeat: -1,
      });
      this.ambientTweens.push(tween);
    });
  }

  private resetBottleOffsets(): void {
    for (const node of this.bottleNodes) {
      node.image.setY(node.baseY);
    }
  }

  public override destroy(fromScene?: boolean): void {
    this.stopAmbient();
    super.destroy(fromScene);
  }
}
