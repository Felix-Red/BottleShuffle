import Phaser from 'phaser';
import {
  Colors,
  createTextStyle,
  Dimens,
  drawIcon,
  hexToNumber,
  Shapes,
  Typography,
  type DesignIconName,
} from '../../../design-system';

export interface SettingsNavigationRowConfig {
  readonly icon: DesignIconName;
  readonly title: string;
  readonly description?: string;
  readonly destructiveTint?: boolean;
  readonly enabled?: boolean;
  readonly onClick: () => void;
}

/**
 * Reusable interactive action/navigation row inside SettingsOverlay
 * (How to Play, About Bottle Shuffle, Reset Settings).
 */
export class SettingsNavigationRow extends Phaser.GameObjects.Container {
  private readonly iconName: DesignIconName;
  private readonly destructiveTint: boolean;
  private readonly onClick: () => void;

  private rowWidth = 420;
  private rowHeight = 46;
  private compact = false;
  private enabledState: boolean;
  private hovered = false;

  private readonly bgGraphics: Phaser.GameObjects.Graphics;
  private readonly iconGraphics: Phaser.GameObjects.Graphics;
  private readonly chevronGraphics: Phaser.GameObjects.Graphics;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly descriptionText: Phaser.GameObjects.Text;
  private readonly hitZone: Phaser.GameObjects.Zone;

  public constructor(scene: Phaser.Scene, config: SettingsNavigationRowConfig) {
    super(scene, 0, 0);

    this.iconName = config.icon;
    this.destructiveTint = config.destructiveTint ?? false;
    this.enabledState = config.enabled ?? true;
    this.onClick = config.onClick;

    this.bgGraphics = scene.add.graphics();
    this.iconGraphics = scene.add.graphics();
    this.chevronGraphics = scene.add.graphics();

    this.titleText = scene.add
      .text(
        0,
        0,
        config.title,
        createTextStyle(Typography.LabelMedium, {
          color: Colors.Text.Primary,
        }),
      )
      .setOrigin(0, 0.5);

    this.descriptionText = scene.add
      .text(
        0,
        0,
        config.description ?? '',
        createTextStyle(Typography.LabelSmall, {
          color: Colors.Text.Secondary,
          scale: 0.82,
          minFontSize: 10,
        }),
      )
      .setOrigin(0, 0.5);

    this.hitZone = scene.add.zone(0, 0, 200, 44).setOrigin(0.5);
    this.hitZone.setInteractive({ useHandCursor: this.enabledState });
    this.hitZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, this.handleOver);
    this.hitZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, this.handleOut);
    this.hitZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, this.handleUp);

    this.add([
      this.bgGraphics,
      this.iconGraphics,
      this.chevronGraphics,
      this.titleText,
      this.descriptionText,
      this.hitZone,
    ]);

    this.redraw();
    scene.add.existing(this);
  }

  public setEnabled(enabled: boolean): this {
    if (this.enabledState === enabled) {
      return this;
    }
    this.enabledState = enabled;
    if (!enabled) {
      this.hovered = false;
    }
    if (this.hitZone.input !== null) {
      this.hitZone.input.cursor = enabled ? 'pointer' : 'default';
    }
    this.redraw();
    return this;
  }

  public setRowLayout(width: number, height: number, compact = false): this {
    this.rowWidth = Math.max(180, Math.round(width));
    this.rowHeight = Math.max(44, Math.round(height));
    this.compact = compact;
    this.redraw();
    return this;
  }

  private readonly handleOver = (): void => {
    if (!this.enabledState) {
      return;
    }
    this.hovered = true;
    this.redraw();
  };

  private readonly handleOut = (): void => {
    if (!this.hovered) {
      return;
    }
    this.hovered = false;
    this.redraw();
  };

  private readonly handleUp = (): void => {
    if (!this.enabledState) {
      return;
    }
    this.onClick();
  };

  private redraw(): void {
    const halfW = this.rowWidth / 2;
    const halfH = this.rowHeight / 2;
    const enabled = this.enabledState;

    this.bgGraphics.clear();
    const fill = this.hovered && enabled ? Colors.Surface.ElevatedSurface : Colors.Surface.Surface;
    const border =
      this.hovered && enabled
        ? this.destructiveTint
          ? Colors.Semantic.Warning
          : Colors.Brand.PrimaryLight
        : Colors.Surface.Border;

    this.bgGraphics.fillStyle(hexToNumber(fill), enabled ? 0.92 : 0.48);
    this.bgGraphics.fillRoundedRect(-halfW, -halfH, this.rowWidth, this.rowHeight, Shapes.Medium);
    this.bgGraphics.lineStyle(1, hexToNumber(border), enabled ? 0.72 : 0.4);
    this.bgGraphics.strokeRoundedRect(-halfW, -halfH, this.rowWidth, this.rowHeight, Shapes.Medium);

    const iconX = -halfW + Dimens.Space20;
    const accentColor = !enabled
      ? Colors.Text.Disabled
      : this.destructiveTint
        ? Colors.Semantic.Warning
        : Colors.Brand.PrimaryLight;

    this.iconGraphics.clear();
    drawIcon(
      this.iconGraphics,
      this.iconName,
      iconX,
      0,
      this.compact ? 16 : 18,
      accentColor,
      enabled ? 1 : 0.6,
    );

    const chevronX = halfW - Dimens.Space16;
    this.chevronGraphics.clear();
    drawIcon(
      this.chevronGraphics,
      'next',
      chevronX,
      0,
      14,
      enabled ? Colors.Text.Secondary : Colors.Text.Disabled,
      enabled ? 0.85 : 0.4,
    );

    const textLeft = iconX + 20;
    const hasDesc = this.descriptionText.text.length > 0 && !this.compact;
    this.descriptionText.setVisible(hasDesc);

    this.titleText.setStyle(
      createTextStyle(Typography.LabelMedium, {
        color: !enabled
          ? Colors.Text.Disabled
          : this.destructiveTint
            ? Colors.Semantic.Warning
            : Colors.Text.Primary,
        scale: this.compact ? 0.86 : 0.92,
        minFontSize: 13,
      }),
    );

    if (hasDesc) {
      this.titleText.setPosition(Math.round(textLeft), -8);
      this.descriptionText.setPosition(Math.round(textLeft), 9);
      this.descriptionText.setColor(enabled ? Colors.Text.Secondary : Colors.Text.Disabled);
    } else {
      this.titleText.setPosition(Math.round(textLeft), 0);
    }

    this.hitZone.setSize(this.rowWidth, Math.max(Dimens.MinTouchTarget, this.rowHeight));
  }

  public override destroy(fromScene?: boolean): void {
    this.hitZone.removeAllListeners();
    super.destroy(fromScene);
  }
}
