import Phaser from 'phaser';
import { DefaultGameTheme, type GameTheme } from '../../theme/GameTheme';
import { Colors } from '../../tokens/Colors';
import { Dimens } from '../../tokens/Dimens';
import type { ElevationLevel } from '../../tokens/Elevation';
import { SemanticShapes } from '../../tokens/Shapes';
import { drawElevatedSurface } from '../common/SurfaceRenderer';

export interface GameCardConfig {
  readonly x?: number;
  readonly y?: number;
  readonly width?: number;
  readonly height?: number;
  readonly backgroundColor?: string;
  readonly borderColor?: string;
  readonly borderWidth?: number;
  readonly cornerRadius?: number;
  readonly padding?: number;
  readonly elevation?: ElevationLevel;
  readonly theme?: GameTheme;
}

export interface ContentBounds {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export class GameCard extends Phaser.GameObjects.Container {
  protected theme: GameTheme;
  protected cardWidth: number;
  protected cardHeight: number;
  protected backgroundColor: string;
  protected borderColor?: string;
  protected borderWidth: number;
  protected cornerRadius: number;
  protected cardPadding: number;
  protected elevation: ElevationLevel;

  private readonly surfaceGraphics: Phaser.GameObjects.Graphics;
  private readonly contentContainer: Phaser.GameObjects.Container;

  public constructor(scene: Phaser.Scene, config: GameCardConfig = {}) {
    super(scene, config.x ?? 0, config.y ?? 0);

    this.theme = config.theme ?? DefaultGameTheme;
    this.cardWidth = Math.max(64, config.width ?? 280);
    this.cardHeight = Math.max(64, config.height ?? 160);
    this.backgroundColor = config.backgroundColor ?? Colors.Surface.Surface;
    this.borderColor = config.borderColor ?? Colors.Surface.Border;
    this.borderWidth = config.borderWidth ?? Dimens.BorderThin;
    this.cornerRadius = config.cornerRadius ?? SemanticShapes.Card;
    this.cardPadding = config.padding ?? Dimens.CardPadding;
    this.elevation = config.elevation ?? 'low';

    this.surfaceGraphics = scene.add.graphics();
    this.contentContainer = scene.add.container(0, 0);
    this.add([this.surfaceGraphics, this.contentContainer]);

    this.redrawSurface();
    this.setSize(this.cardWidth, this.cardHeight);

    scene.add.existing(this);
  }

  public addContent(child: Phaser.GameObjects.GameObject | Phaser.GameObjects.GameObject[]): this {
    this.contentContainer.add(child);
    return this;
  }

  public getContentBounds(): ContentBounds {
    const innerWidth = Math.max(0, this.cardWidth - this.cardPadding * 2);
    const innerHeight = Math.max(0, this.cardHeight - this.cardPadding * 2);
    return {
      left: -innerWidth / 2,
      top: -innerHeight / 2,
      width: innerWidth,
      height: innerHeight,
    };
  }

  public setCardSize(width: number, height: number): this {
    this.cardWidth = Math.max(64, width);
    this.cardHeight = Math.max(64, height);
    this.setSize(this.cardWidth, this.cardHeight);
    this.redrawSurface();
    return this;
  }

  public setCardStyle(
    style: Partial<
      Pick<
        GameCardConfig,
        'backgroundColor' | 'borderColor' | 'borderWidth' | 'cornerRadius' | 'elevation'
      >
    >,
  ): this {
    if (style.backgroundColor !== undefined) {
      this.backgroundColor = style.backgroundColor;
    }
    if (style.borderColor !== undefined) {
      this.borderColor = style.borderColor;
    }
    if (style.borderWidth !== undefined) {
      this.borderWidth = style.borderWidth;
    }
    if (style.cornerRadius !== undefined) {
      this.cornerRadius = style.cornerRadius;
    }
    if (style.elevation !== undefined) {
      this.elevation = style.elevation;
    }
    this.redrawSurface();
    return this;
  }

  public setTheme(theme: GameTheme): this {
    this.theme = theme;
    return this;
  }

  protected redrawSurface(): void {
    drawElevatedSurface(this.surfaceGraphics, {
      width: this.cardWidth,
      height: this.cardHeight,
      radius: this.cornerRadius,
      fillColor: this.backgroundColor,
      ...(this.borderColor !== undefined ? { borderColor: this.borderColor } : {}),
      borderWidth: this.borderWidth,
      elevation: this.elevation,
    });
  }
}
