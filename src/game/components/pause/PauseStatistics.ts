import Phaser from 'phaser';
import {
  Colors,
  createTextStyle,
  Dimens,
  hexToNumber,
  Shapes,
  Typography,
} from '../../../design-system';

export interface PauseStatisticsData {
  readonly moves: number;
  readonly matched: number;
  readonly totalBottles: number;
  readonly formattedTime: string;
}

interface StatColumn {
  readonly label: Phaser.GameObjects.Text;
  readonly value: Phaser.GameObjects.Text;
}

/**
 * Compact 3-column recessed statistics strip displayed inside PauseOverlay
 * (Moves, Matched X/N, Elapsed Active Time).
 */
export class PauseStatistics extends Phaser.GameObjects.Container {
  private boxWidth = 360;
  private boxHeight = 64;
  private readonly bgGraphics: Phaser.GameObjects.Graphics;
  private readonly columns: StatColumn[] = [];

  public constructor(scene: Phaser.Scene, x = 0, y = 0) {
    super(scene, x, y);

    this.bgGraphics = scene.add.graphics();
    this.add(this.bgGraphics);

    const labels = ['MOVES', 'MATCHED', 'TIME'];
    for (const labelText of labels) {
      const label = scene.add
        .text(
          0,
          0,
          labelText,
          createTextStyle(Typography.LabelSmall, {
            color: Colors.Text.Secondary,
            align: 'center',
            scale: 0.84,
            minFontSize: 10,
          }),
        )
        .setOrigin(0.5);

      const value = scene.add
        .text(
          0,
          0,
          '0',
          createTextStyle(Typography.LabelLarge, {
            color: Colors.Text.Primary,
            align: 'center',
            scale: 0.94,
            minFontSize: 13,
          }),
        )
        .setOrigin(0.5);

      this.columns.push({ label, value });
      this.add([label, value]);
    }

    scene.add.existing(this);
  }

  public setDataValues(data: PauseStatisticsData): this {
    const values = [
      String(data.moves),
      `${String(data.matched)}/${String(data.totalBottles)}`,
      data.formattedTime,
    ];
    for (let i = 0; i < this.columns.length; i += 1) {
      this.columns[i]?.value.setText(values[i] ?? '');
    }
    return this;
  }

  public setDimensions(width: number, height: number): this {
    this.boxWidth = Math.max(180, Math.round(width));
    this.boxHeight = Math.max(52, Math.round(height));
    this.redraw();
    return this;
  }

  private redraw(): void {
    this.bgGraphics.clear();
    const halfW = this.boxWidth / 2;
    const halfH = this.boxHeight / 2;

    this.bgGraphics.fillStyle(hexToNumber(Colors.Surface.Surface), 0.92);
    this.bgGraphics.fillRoundedRect(-halfW, -halfH, this.boxWidth, this.boxHeight, Shapes.Medium);
    this.bgGraphics.lineStyle(1, hexToNumber(Colors.Surface.Border), 0.72);
    this.bgGraphics.strokeRoundedRect(-halfW, -halfH, this.boxWidth, this.boxHeight, Shapes.Medium);

    const colW = this.boxWidth / 3;
    this.bgGraphics.lineStyle(1, hexToNumber(Colors.Surface.Border), 0.35);
    for (let c = 1; c < 3; c += 1) {
      const x = -halfW + c * colW;
      this.bgGraphics.lineBetween(x, -halfH + Dimens.Space8, x, halfH - Dimens.Space8);
    }

    for (let i = 0; i < this.columns.length; i += 1) {
      const col = this.columns[i];
      if (col === undefined) {
        continue;
      }
      const cx = -halfW + colW * (i + 0.5);
      col.label.setPosition(Math.round(cx), -12);
      col.value.setPosition(Math.round(cx), 12);
    }
  }
}
