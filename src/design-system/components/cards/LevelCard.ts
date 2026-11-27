import Phaser from 'phaser';
import { DefaultGameTheme, type GameTheme } from '../../theme/GameTheme';
import { ensureMinimumTouchTarget } from '../../tokens/Breakpoints';
import { Colors, darkenHex, hexToNumber } from '../../tokens/Colors';
import { Dimens } from '../../tokens/Dimens';
import { MotionEasings, MotionPresets, resolveMotionDuration } from '../../tokens/Motion';
import { SemanticShapes } from '../../tokens/Shapes';
import { createTextStyle, Typography } from '../../tokens/Typography';
import { drawIcon } from '../common/IconGraphic';
import { drawElevatedSurface } from '../common/SurfaceRenderer';
import { StarRating } from '../indicators/StarRating';

export type LevelCardStatus = 'locked' | 'unlocked' | 'completed' | 'current';

export interface LevelCardConfig {
  readonly x?: number;
  readonly y?: number;
  readonly width?: number;
  readonly height?: number;
  readonly levelNumber: number;
  readonly metaText?: string;
  readonly stars?: number;
  readonly showStars?: boolean;
  readonly status?: LevelCardStatus;
  readonly selected?: boolean;
  readonly focused?: boolean;
  readonly accentColor?: string;
  readonly onSelect?: (levelNumber: number) => void;
  readonly onLockedSelect?: (levelNumber: number) => void;
  readonly theme?: GameTheme;
}

export class LevelCard extends Phaser.GameObjects.Container {
  private theme: GameTheme;
  private cardWidth: number;
  private cardHeight: number;
  private levelNumber: number;
  private status: LevelCardStatus;
  private selected: boolean;
  private focused: boolean;
  private showStars: boolean;
  private accentColor?: string;
  private onSelectCallback?: (levelNumber: number) => void;
  private onLockedSelectCallback?: (levelNumber: number) => void;
  private hovered = false;
  private pressed = false;

  private readonly surfaceGraphics: Phaser.GameObjects.Graphics;
  private readonly emphasisGraphics: Phaser.GameObjects.Graphics;
  private readonly iconGraphics: Phaser.GameObjects.Graphics;
  private readonly numberText: Phaser.GameObjects.Text;
  private readonly badgeText: Phaser.GameObjects.Text;
  private readonly metaLabelText: Phaser.GameObjects.Text;
  private readonly starRating: StarRating;
  private metaLabelValue: string;
  private readonly hitZone: Phaser.GameObjects.Zone;
  private activeTween?: Phaser.Tweens.Tween;
  private pulseTween?: Phaser.Tweens.Tween;

  public constructor(scene: Phaser.Scene, config: LevelCardConfig) {
    super(scene, config.x ?? 0, config.y ?? 0);

    this.theme = config.theme ?? DefaultGameTheme;
    this.cardWidth = Math.max(72, config.width ?? 108);
    this.cardHeight = Math.max(76, config.height ?? 116);
    this.levelNumber = config.levelNumber;
    this.status = config.status ?? 'unlocked';
    this.selected = config.selected ?? false;
    this.focused = config.focused ?? false;
    this.showStars = config.showStars ?? config.stars !== undefined;
    this.metaLabelValue = config.metaText ?? '';
    this.accentColor = config.accentColor;
    this.onSelectCallback = config.onSelect;
    this.onLockedSelectCallback = config.onLockedSelect;

    this.surfaceGraphics = scene.add.graphics();
    this.emphasisGraphics = scene.add.graphics();
    this.iconGraphics = scene.add.graphics();

    this.numberText = scene.add
      .text(
        0,
        0,
        String(this.levelNumber),
        createTextStyle(Typography.HeadlineSmall, {
          color: Colors.Text.Primary,
          align: 'center',
        }),
      )
      .setOrigin(0.5);

    this.badgeText = scene.add
      .text(
        0,
        -this.cardHeight / 2 + Dimens.Space12,
        'NEXT',
        createTextStyle(Typography.LabelSmall, {
          color: Colors.Text.OnPrimary,
          align: 'center',
          scale: 0.72,
          minFontSize: 10,
        }),
      )
      .setOrigin(0.5);

    this.metaLabelText = scene.add
      .text(
        0,
        this.cardHeight / 2 - Dimens.Space16,
        this.metaLabelValue,
        createTextStyle(Typography.LabelSmall, {
          color: Colors.Text.Secondary,
          align: 'center',
          scale: 0.68,
          minFontSize: 9,
        }),
      )
      .setOrigin(0.5);

    this.starRating = new StarRating(scene, {
      x: 0,
      y: this.cardHeight / 2 - Dimens.Space24,
      rating: config.stars ?? 0,
      maxStars: 3,
      starSize: 18,
      spacing: Dimens.Space4,
      theme: this.theme,
    });

    this.hitZone = scene.add
      .zone(
        0,
        0,
        ensureMinimumTouchTarget(this.cardWidth),
        ensureMinimumTouchTarget(this.cardHeight),
      )
      .setOrigin(0.5);

    this.add([
      this.surfaceGraphics,
      this.emphasisGraphics,
      this.iconGraphics,
      this.numberText,
      this.badgeText,
      this.metaLabelText,
      this.starRating,
      this.hitZone,
    ]);

    this.setSize(this.cardWidth, this.cardHeight);
    this.bindInput();
    this.refreshVisuals();
    this.syncRecommendedPulse();

    scene.add.existing(this);
  }

  public setLevelState(status: LevelCardStatus, stars?: number, showStars?: boolean): this {
    this.status = status;
    if (showStars !== undefined) {
      this.showStars = showStars;
    }
    if (stars !== undefined) {
      this.starRating.setRating(stars, false);
    }
    this.hovered = false;
    this.pressed = false;
    this.updateInteractivity();
    this.refreshVisuals();
    this.syncRecommendedPulse();
    return this;
  }

  public setShowStars(showStars: boolean): this {
    if (this.showStars === showStars) {
      return this;
    }
    this.showStars = showStars;
    this.refreshVisuals();
    return this;
  }

  public setLevelNumber(levelNumber: number): this {
    this.levelNumber = levelNumber;
    this.numberText.setText(String(levelNumber));
    return this;
  }

  public setMetaText(metaText?: string): this {
    const next = metaText ?? '';
    if (this.metaLabelValue === next) {
      return this;
    }
    this.metaLabelValue = next;
    this.refreshVisuals();
    return this;
  }

  public setSelected(selected: boolean): this {
    if (this.selected === selected) {
      return this;
    }
    this.selected = selected;
    this.refreshVisuals();
    return this;
  }

  public setFocused(focused: boolean): this {
    if (this.focused === focused) {
      return this;
    }
    this.focused = focused;
    this.refreshVisuals();
    return this;
  }

  public setAccentColor(accentColor?: string): this {
    this.accentColor = accentColor;
    this.refreshVisuals();
    return this;
  }

  public setCardSize(width: number, height: number): this {
    const safeW = Math.max(72, Math.round(width));
    const safeH = Math.max(76, Math.round(height));
    if (safeW === this.cardWidth && safeH === this.cardHeight) {
      return this;
    }
    this.cardWidth = safeW;
    this.cardHeight = safeH;
    this.setSize(safeW, safeH);
    this.hitZone.setSize(ensureMinimumTouchTarget(safeW), ensureMinimumTouchTarget(safeH));
    this.refreshVisuals();
    return this;
  }

  public getStatus(): LevelCardStatus {
    return this.status;
  }

  public isSelected(): boolean {
    return this.selected;
  }

  public getCardDimensions(): { readonly width: number; readonly height: number } {
    return { width: this.cardWidth, height: this.cardHeight };
  }

  public setTheme(theme: GameTheme): this {
    this.theme = theme;
    this.starRating.setTheme(theme);
    this.syncRecommendedPulse();
    return this;
  }

  private isInteractiveStatus(): boolean {
    return this.status !== 'locked';
  }

  private bindInput(): void {
    this.updateInteractivity();
    this.hitZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, this.handleOver);
    this.hitZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, this.handleOut);
    this.hitZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, this.handleDown);
    this.hitZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, this.handleUp);
    this.scene.input.on(Phaser.Input.Events.POINTER_UP, this.handleOut);
  }

  private updateInteractivity(): void {
    const clickable = this.isInteractiveStatus() || this.onLockedSelectCallback !== undefined;
    if (clickable) {
      this.hitZone.setInteractive({ useHandCursor: this.isInteractiveStatus() });
      if (this.hitZone.input !== null) {
        this.hitZone.input.cursor = this.isInteractiveStatus() ? 'pointer' : 'not-allowed';
      }
    } else {
      this.hitZone.disableInteractive();
    }
  }

  private readonly handleOver = (): void => {
    if (!this.isInteractiveStatus()) {
      return;
    }
    this.hovered = true;
    this.refreshVisuals();
    this.animateScale(MotionPresets.Hover.scaleTo, MotionPresets.Hover.duration);
  };

  private readonly handleOut = (): void => {
    if (!this.hovered && !this.pressed) {
      return;
    }
    this.hovered = false;
    this.pressed = false;
    this.refreshVisuals();
    this.animateScale(1, MotionPresets.ButtonRelease.duration);
  };

  private readonly handleDown = (): void => {
    if (!this.isInteractiveStatus()) {
      if (this.onLockedSelectCallback !== undefined) {
        this.pressed = true;
      }
      return;
    }
    this.pressed = true;
    this.refreshVisuals();
    this.animateScale(MotionPresets.ButtonPress.scaleTo, MotionPresets.ButtonPress.duration);
  };

  private readonly handleUp = (): void => {
    if (!this.pressed) {
      return;
    }
    this.pressed = false;
    if (!this.isInteractiveStatus()) {
      this.onLockedSelectCallback?.(this.levelNumber);
      return;
    }
    this.refreshVisuals();
    this.animateScale(
      this.hovered ? MotionPresets.Hover.scaleTo : 1,
      MotionPresets.ButtonRelease.duration,
    );
    this.onSelectCallback?.(this.levelNumber);
  };

  private animateScale(target: number, durationMs: number): void {
    if (this.activeTween !== undefined) {
      this.activeTween.stop();
      this.activeTween = undefined;
    }
    const duration = resolveMotionDuration(durationMs, this.theme.reducedMotion);
    if (duration === 0) {
      this.setScale(target);
      return;
    }
    this.activeTween = this.scene.tweens.add({
      targets: this,
      scaleX: target,
      scaleY: target,
      duration,
      ease: MotionPresets.ButtonRelease.ease,
    });
  }

  private syncRecommendedPulse(): void {
    if (this.pulseTween !== undefined) {
      this.pulseTween.stop();
      this.pulseTween = undefined;
    }
    this.emphasisGraphics.setAlpha(1);

    if (this.status !== 'current' || this.theme.reducedMotion) {
      return;
    }

    this.pulseTween = this.scene.tweens.add({
      targets: this.emphasisGraphics,
      alpha: { from: 0.45, to: 1 },
      duration: 1200,
      ease: MotionEasings.EaseInOut,
      yoyo: true,
      repeat: -1,
    });
  }

  private refreshVisuals(): void {
    const isLocked = this.status === 'locked';
    const isCurrent = this.status === 'current';
    const isCompleted = this.status === 'completed';
    const isCompactCard = this.cardHeight < 92;

    const fillColor = isCurrent
      ? Colors.Brand.Primary
      : isLocked
        ? Colors.Surface.Surface
        : Colors.Surface.ElevatedSurface;

    const borderColor =
      this.selected || this.focused
        ? Colors.Brand.Secondary
        : isCurrent
          ? Colors.Brand.PrimaryLight
          : isCompleted
            ? Colors.Semantic.Success
            : this.hovered
              ? (this.accentColor ?? Colors.Brand.PrimaryLight)
              : Colors.Surface.Border;

    const borderWidth =
      this.selected || this.focused || isCurrent || isCompleted
        ? Dimens.BorderMedium
        : Dimens.BorderThin;

    drawElevatedSurface(this.surfaceGraphics, {
      width: this.cardWidth,
      height: this.cardHeight,
      radius: SemanticShapes.LevelCard,
      fillColor,
      fillAlpha: isLocked ? 0.58 : 1,
      depthColor: isCurrent ? Colors.Brand.PrimaryDark : darkenHex(fillColor, 0.35),
      borderColor,
      borderWidth,
      borderAlpha: isLocked ? 0.42 : 1,
      elevation: isLocked ? 'flat' : isCurrent ? 'medium' : 'low',
      pressedOffsetY: this.pressed && !isLocked ? 2 : 0,
    });

    this.emphasisGraphics.clear();
    if (this.selected || this.focused) {
      const pad = 4;
      this.emphasisGraphics.lineStyle(
        Dimens.BorderMedium,
        hexToNumber(Colors.Brand.Secondary),
        0.95,
      );
      this.emphasisGraphics.strokeRoundedRect(
        -this.cardWidth / 2 - pad,
        -this.cardHeight / 2 - pad,
        this.cardWidth + pad * 2,
        this.cardHeight + pad * 2,
        SemanticShapes.LevelCard + pad,
      );
    } else if (isCurrent) {
      const pad = 3;
      this.emphasisGraphics.lineStyle(
        Dimens.BorderMedium,
        hexToNumber(Colors.Brand.PrimaryLight),
        0.75,
      );
      this.emphasisGraphics.strokeRoundedRect(
        -this.cardWidth / 2 - pad,
        -this.cardHeight / 2 - pad,
        this.cardWidth + pad * 2,
        this.cardHeight + pad * 2,
        SemanticShapes.LevelCard + pad,
      );
    }

    this.iconGraphics.clear();

    const numberScale = isCompactCard ? 0.86 : 1;
    this.numberText.setScale(numberScale);
    this.numberText.setText(String(this.levelNumber));
    this.numberText.setVisible(true);

    const hasMeta = this.metaLabelValue.length > 0;
    const fitMetaWidth = (): void => {
      if (!hasMeta) {
        this.metaLabelText.setVisible(false);
        return;
      }
      this.metaLabelText.setVisible(true);
      this.metaLabelText.setText(this.metaLabelValue);
      this.metaLabelText.setScale(1);
      const maxMetaW = Math.max(40, this.cardWidth - 12);
      if (this.metaLabelText.width > maxMetaW) {
        this.metaLabelText.setScale(maxMetaW / Math.max(1, this.metaLabelText.width));
      }
    };

    if (isLocked) {
      this.badgeText.setVisible(false);
      this.starRating.setVisible(false);
      this.numberText.setColor(Colors.Text.Disabled);
      this.numberText.setAlpha(0.75);
      this.numberText.setPosition(
        0,
        hasMeta ? -Math.round(this.cardHeight * 0.22) : -Math.round(this.cardHeight * 0.16),
      );
      drawIcon(
        this.iconGraphics,
        'lock',
        0,
        hasMeta ? Math.round(this.cardHeight * 0.04) : Math.round(this.cardHeight * 0.19),
        isCompactCard ? 16 : 19,
        Colors.Text.Disabled,
        0.82,
      );
      fitMetaWidth();
      this.metaLabelText.setColor(Colors.Text.Disabled);
      this.metaLabelText.setAlpha(0.75);
      this.metaLabelText.setPosition(0, this.cardHeight / 2 - (isCompactCard ? 11 : 14));
      return;
    }

    this.numberText.setAlpha(1);
    this.numberText.setColor(isCurrent ? Colors.Text.OnPrimary : Colors.Text.Primary);
    this.metaLabelText.setAlpha(1);

    if (isCurrent) {
      this.badgeText.setVisible(true);
      this.badgeText.setPosition(0, -this.cardHeight / 2 + (isCompactCard ? 11 : 14));
      this.numberText.setPosition(0, hasMeta ? -4 : isCompactCard ? -1 : -3);
      if (hasMeta) {
        fitMetaWidth();
        this.metaLabelText.setColor(Colors.Text.OnPrimary);
        this.metaLabelText.setPosition(0, this.cardHeight / 2 - (isCompactCard ? 13 : 16));
      } else {
        this.metaLabelText.setVisible(false);
        drawIcon(
          this.iconGraphics,
          'play',
          0,
          this.cardHeight / 2 - (isCompactCard ? 16 : 20),
          isCompactCard ? 14 : 16,
          Colors.Text.OnPrimary,
          0.95,
        );
      }
      this.starRating.setVisible(false);
      return;
    }

    this.badgeText.setVisible(false);

    if (this.showStars) {
      this.numberText.setPosition(0, hasMeta ? -20 : -12);
      fitMetaWidth();
      this.metaLabelText.setColor(Colors.Text.Secondary);
      this.metaLabelText.setPosition(0, isCompactCard ? 3 : 4);
      this.starRating.setVisible(true);
      this.starRating.setPosition(0, this.cardHeight / 2 - (isCompactCard ? 14 : 18));
    } else {
      this.numberText.setPosition(0, hasMeta ? -10 : isCompleted ? -6 : 0);
      fitMetaWidth();
      this.metaLabelText.setColor(Colors.Text.Secondary);
      this.metaLabelText.setPosition(0, this.cardHeight / 2 - (isCompactCard ? 13 : 17));
      this.starRating.setVisible(false);
    }

    if (isCompleted) {
      const checkY = this.showStars
        ? -this.cardHeight / 2 + Dimens.Space16
        : this.cardHeight / 2 - (isCompactCard ? 16 : 20);
      const checkX = this.showStars ? this.cardWidth / 2 - Dimens.Space16 : 0;

      if (!this.showStars) {
        this.iconGraphics.fillStyle(hexToNumber(Colors.Semantic.Success), 0.16);
        this.iconGraphics.fillCircle(checkX, checkY, isCompactCard ? 10 : 12);
      }

      drawIcon(
        this.iconGraphics,
        'check',
        checkX,
        checkY,
        isCompactCard ? 12 : 14,
        Colors.Semantic.Success,
      );
    }
  }

  public override destroy(fromScene?: boolean): void {
    if (this.activeTween !== undefined) {
      this.activeTween.stop();
      this.activeTween = undefined;
    }
    if (this.pulseTween !== undefined) {
      this.pulseTween.stop();
      this.pulseTween = undefined;
    }
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.handleOut);
    this.hitZone.removeAllListeners();
    super.destroy(fromScene);
  }
}
