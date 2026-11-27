import Phaser from 'phaser';
import {
  Colors,
  createTextStyle,
  Dimens,
  hexToNumber,
  Shapes,
  Typography,
} from '../../../design-system';

export interface AttemptStatItem {
  readonly label: string;
  readonly value: string;
  readonly highlight?: boolean;
}

export interface AttemptStatisticsConfig {
  readonly x?: number;
  readonly y?: number;
  readonly width?: number;
  readonly height?: number;
  readonly columns?: 2 | 4;
}

interface StatCell {
  readonly labelText: Phaser.GameObjects.Text;
  readonly valueText: Phaser.GameObjects.Text;
}

/**
 * Compact, uncluttered attempt statistics strip (Moves, Optimal, Efficiency, Time).
 * Adapts seamlessly between a 4-column bar and a 2x2 compact grid.
 */
export class AttemptStatistics extends Phaser.GameObjects.Container {
  private boxWidth: number;
  private boxHeight: number;
  private columns: 2 | 4;
  private items: readonly AttemptStatItem[] = [];
  private readonly bgGraphics: Phaser.GameObjects.Graphics;
  private readonly cells: StatCell[] = [];

  public constructor(scene: Phaser.Scene, config: AttemptStatisticsConfig = {}) {
    super(scene, config.x ?? 0, config.y ?? 0);

    this.boxWidth = config.width ?? 440;
    this.boxHeight = config.height ?? 64;
    this.columns = config.columns ?? 4;

    this.bgGraphics = scene.add.graphics();
    this.add(this.bgGraphics);

    for (let i = 0; i < 4; i += 1) {
      const labelText = scene.add
        .text(
          0,
          0,
          '',
          createTextStyle(Typography.LabelSmall, {
            color: Colors.Text.Secondary,
            align: 'center',
            scale: 0.84,
            minFontSize: 10,
          }),
        )
        .setOrigin(0.5);

      const valueText = scene.add
        .text(
          0,
          0,
          '',
          createTextStyle(Typography.LabelLarge, {
            color: Colors.Text.Primary,
            align: 'center',
            scale: 0.92,
            minFontSize: 13,
          }),
        )
        .setOrigin(0.5);

      this.cells.push({ labelText, valueText });
      this.add([labelText, valueText]);
    }

    scene.add.existing(this);
  }

  public setStats(items: readonly AttemptStatItem[]): this {
    this.items = items.slice(0, 4);
    this.renderLayout();
    return this;
  }

  public setLayout(width: number, height: number, columns: 2 | 4): this {
    this.boxWidth = Math.max(160, Math.round(width));
    this.boxHeight = Math.max(48, Math.round(height));
    this.columns = columns;
    this.renderLayout();
    return this;
  }

  private renderLayout(): void {
    this.bgGraphics.clear();
    const halfW = this.boxWidth / 2;
    const halfH = this.boxHeight / 2;

    this.bgGraphics.fillStyle(hexToNumber(Colors.Surface.Surface), 0.92);
    this.bgGraphics.fillRoundedRect(-halfW, -halfH, this.boxWidth, this.boxHeight, Shapes.Medium);
    this.bgGraphics.lineStyle(1, hexToNumber(Colors.Surface.Border), 0.72);
    this.bgGraphics.strokeRoundedRect(-halfW, -halfH, this.boxWidth, this.boxHeight, Shapes.Medium);

    const cols = this.columns;
    const rows = cols === 2 ? 2 : 1;
    const cellW = this.boxWidth / cols;
    const cellH = this.boxHeight / rows;

    // Subtle internal dividers
    this.bgGraphics.lineStyle(1, hexToNumber(Colors.Surface.Border), 0.35);
    for (let c = 1; c < cols; c += 1) {
      const x = -halfW + c * cellW;
      this.bgGraphics.lineBetween(x, -halfH + Dimens.Space8, x, halfH - Dimens.Space8);
    }
    if (rows === 2) {
      this.bgGraphics.lineBetween(-halfW + Dimens.Space10, 0, halfW - Dimens.Space10, 0);
    }

    for (let i = 0; i < this.cells.length; i += 1) {
      const cell = this.cells[i];
      const item = this.items[i];
      if (cell === undefined) {
        continue;
      }
      if (item === undefined) {
        cell.labelText.setVisible(false);
        cell.valueText.setVisible(false);
        continue;
      }

      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = -halfW + cellW * (col + 0.5);
      const cy = -halfH + cellH * (row + 0.5);

      cell.labelText.setVisible(true);
      cell.valueText.setVisible(true);
      cell.labelText.setText(item.label.toUpperCase());
      cell.valueText.setText(item.value);
      cell.valueText.setColor(
        item.highlight === true ? Colors.Semantic.Success : Colors.Text.Primary,
      );

      const offset = rows === 2 ? 9 : 11;
      cell.labelText.setPosition(Math.round(cx), Math.round(cy - offset));
      cell.valueText.setPosition(Math.round(cx), Math.round(cy + offset));
    }
  }
}
