import Phaser from 'phaser';
import { DefaultGameTheme, type GameTheme } from '../../theme/GameTheme';
import { Colors } from '../../tokens/Colors';
import { Dimens } from '../../tokens/Dimens';
import type { ElevationLevel } from '../../tokens/Elevation';
import { SemanticShapes } from '../../tokens/Shapes';
import { drawElevatedSurface } from '../common/SurfaceRenderer';

export type PanelHorizontalAlign = 'left' | 'center' | 'right';
export type PanelVerticalAlign = 'top' | 'middle' | 'bottom';

export interface GamePanelConfig {
  readonly x?: number;
  readonly y?: number;
  readonly width?: number;
  readonly height?: number;
  readonly padding?: number;
  readonly horizontalAlign?: PanelHorizontalAlign;
  readonly verticalAlign?: PanelVerticalAlign;
  readonly showSurface?: boolean;
  readonly backgroundColor?: string;
  readonly borderColor?: string;
  readonly elevation?: ElevationLevel;
  readonly cornerRadius?: number;
  readonly theme?: GameTheme;
}

export interface PanelContentArea {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
  readonly anchorX: number;
  readonly anchorY: number;
}

export class GamePanel extends Phaser.GameObjects.Container {
  private theme: GameTheme;
  private panelWidth: number;
  private panelHeight: number;
  private panelPadding: number;
  private horizontalAlign: PanelHorizontalAlign;
  private verticalAlign: PanelVerticalAlign;
  private readonly showSurface: boolean;
  private readonly backgroundColor: string;
  private readonly borderColor: string;
  private readonly elevation: ElevationLevel;
  private readonly cornerRadius: number;

  private readonly surfaceGraphics: Phaser.GameObjects.Graphics;
  private readonly contentContainer: Phaser.GameObjects.Container;

  public constructor(scene: Phaser.Scene, config: GamePanelConfig = {}) {
    super(scene, config.x ?? 0, config.y ?? 0);

    this.theme = config.theme ?? DefaultGameTheme;
    this.panelWidth = Math.max(80, config.width ?? 360);
    this.panelHeight = Math.max(80, config.height ?? 200);
    this.panelPadding = config.padding ?? Dimens.CardPadding;
    this.horizontalAlign = config.horizontalAlign ?? 'center';
    this.verticalAlign = config.verticalAlign ?? 'middle';
    this.showSurface = config.showSurface ?? true;
    this.backgroundColor = config.backgroundColor ?? Colors.Surface.Surface;
    this.borderColor = config.borderColor ?? Colors.Surface.Border;
    this.elevation = config.elevation ?? 'low';
    this.cornerRadius = config.cornerRadius ?? SemanticShapes.Card;

    this.surfaceGraphics = scene.add.graphics();
    this.contentContainer = scene.add.container(0, 0);
    this.add([this.surfaceGraphics, this.contentContainer]);

    this.resize(this.panelWidth, this.panelHeight);
    scene.add.existing(this);
  }

  public addContent(child: Phaser.GameObjects.GameObject | Phaser.GameObjects.GameObject[]): this {
    this.contentContainer.add(child);
    return this;
  }

  public getContentArea(): PanelContentArea {
    const innerWidth = Math.max(0, this.panelWidth - this.panelPadding * 2);
    const innerHeight = Math.max(0, this.panelHeight - this.panelPadding * 2);
    const left = -innerWidth / 2;
    const right = innerWidth / 2;
    const top = -innerHeight / 2;
    const bottom = innerHeight / 2;

    const anchorX =
      this.horizontalAlign === 'left' ? left : this.horizontalAlign === 'right' ? right : 0;
    const anchorY =
      this.verticalAlign === 'top' ? top : this.verticalAlign === 'bottom' ? bottom : 0;

    return {
      left,
      right,
      top,
      bottom,
      width: innerWidth,
      height: innerHeight,
      anchorX,
      anchorY,
    };
  }

  public setAlignment(horizontal: PanelHorizontalAlign, vertical: PanelVerticalAlign): this {
    this.horizontalAlign = horizontal;
    this.verticalAlign = vertical;
    this.syncContentAnchor();
    return this;
  }

  public resize(width: number, height: number): this {
    this.panelWidth = Math.max(80, width);
    this.panelHeight = Math.max(80, height);
    this.setSize(this.panelWidth, this.panelHeight);

    if (this.showSurface) {
      drawElevatedSurface(this.surfaceGraphics, {
        width: this.panelWidth,
        height: this.panelHeight,
        radius: this.cornerRadius,
        fillColor: this.backgroundColor,
        borderColor: this.borderColor,
        borderWidth: Dimens.BorderThin,
        elevation: this.elevation,
      });
    } else {
      this.surfaceGraphics.clear();
    }

    this.syncContentAnchor();
    return this;
  }

  public setTheme(theme: GameTheme): this {
    this.theme = theme;
    return this;
  }

  public getTheme(): GameTheme {
    return this.theme;
  }

  private syncContentAnchor(): void {
    const area = this.getContentArea();
    this.contentContainer.setPosition(area.anchorX, area.anchorY);
  }
}
