import Phaser from 'phaser';
import {
  Colors,
  createTextStyle,
  DefaultGameTheme,
  Dimens,
  drawIcon,
  hexToNumber,
  Shapes,
  ToggleSwitch,
  Typography,
  type DesignIconName,
  type GameTheme,
} from '../../../design-system';
import type { SettingsToggleItemState } from '../../settings/SettingsViewState';

export interface SettingsToggleRowConfig {
  readonly icon: DesignIconName;
  readonly onChange: (enabled: boolean) => void;
  readonly theme?: GameTheme;
}

const SWITCH_AREA_WIDTH = 72;

/**
 * Reusable interactive settings toggle row.
 * Displays leading icon, title, supporting description (or disabled explanation),
 * explicit ON/OFF text indicator (non-colour-only accessibility), and ToggleSwitch.
 * The label area and switch area have disjoint hit targets to prevent duplicate updates.
 */
export class SettingsToggleRow extends Phaser.GameObjects.Container {
  private theme: GameTheme;
  private readonly iconName: DesignIconName;
  private readonly onChange: (enabled: boolean) => void;

  private rowWidth = 420;
  private rowHeight = 52;
  private compact = false;
  private hovered = false;
  private currentState: SettingsToggleItemState | null = null;

  private readonly bgGraphics: Phaser.GameObjects.Graphics;
  private readonly iconGraphics: Phaser.GameObjects.Graphics;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly descriptionText: Phaser.GameObjects.Text;
  private readonly stateLabelText: Phaser.GameObjects.Text;
  private readonly toggleSwitch: ToggleSwitch;
  private readonly rowHitZone: Phaser.GameObjects.Zone;

  public constructor(scene: Phaser.Scene, config: SettingsToggleRowConfig) {
    super(scene, 0, 0);

    this.theme = config.theme ?? DefaultGameTheme;
    this.iconName = config.icon;
    this.onChange = config.onChange;

    this.bgGraphics = scene.add.graphics();
    this.iconGraphics = scene.add.graphics();

    this.titleText = scene.add
      .text(
        0,
        0,
        '',
        createTextStyle(Typography.LabelMedium, {
          color: Colors.Text.Primary,
        }),
      )
      .setOrigin(0, 0.5);

    this.descriptionText = scene.add
      .text(
        0,
        0,
        '',
        createTextStyle(Typography.LabelSmall, {
          color: Colors.Text.Secondary,
          scale: 0.84,
          minFontSize: 10,
        }),
      )
      .setOrigin(0, 0.5);

    this.stateLabelText = scene.add
      .text(
        0,
        0,
        'OFF',
        createTextStyle(Typography.LabelSmall, {
          color: Colors.Text.Secondary,
          align: 'right',
          scale: 0.8,
          minFontSize: 10,
        }),
      )
      .setOrigin(1, 0.5);

    this.toggleSwitch = new ToggleSwitch(scene, {
      value: false,
      enabled: true,
      theme: this.theme,
      onChange: (nextVal) => {
        if (this.currentState?.enabled === true) {
          this.onChange(nextVal);
        }
      },
    });

    this.rowHitZone = scene.add.zone(0, 0, 200, 48).setOrigin(0, 0.5);
    this.rowHitZone.setInteractive({ useHandCursor: true });
    this.rowHitZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, this.handleOver);
    this.rowHitZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, this.handleOut);
    this.rowHitZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, this.handleRowTap);

    this.add([
      this.bgGraphics,
      this.iconGraphics,
      this.titleText,
      this.descriptionText,
      this.stateLabelText,
      this.rowHitZone,
      this.toggleSwitch,
    ]);

    scene.add.existing(this);
  }

  public applyState(state: SettingsToggleItemState, animateSwitch = true): this {
    this.currentState = state;
    this.titleText.setText(state.title);
    this.descriptionText.setText(state.description);
    this.stateLabelText.setText(state.stateLabel);

    this.toggleSwitch.setEnabled(state.enabled);
    this.toggleSwitch.setValue(state.value, animateSwitch, false);

    if (this.rowHitZone.input !== null) {
      this.rowHitZone.input.cursor = state.enabled ? 'pointer' : 'default';
    }
    if (!state.enabled) {
      this.hovered = false;
    }

    this.redraw();
    return this;
  }

  public setRowLayout(width: number, height: number, compact = false): this {
    this.rowWidth = Math.max(200, Math.round(width));
    this.rowHeight = Math.max(44, Math.round(height));
    this.compact = compact;
    this.redraw();
    return this;
  }

  public setTheme(theme: GameTheme): this {
    this.theme = theme;
    this.toggleSwitch.setTheme(theme);
    return this;
  }

  private readonly handleOver = (): void => {
    if (this.currentState?.enabled !== true) {
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

  private readonly handleRowTap = (): void => {
    if (this.currentState?.enabled !== true) {
      return;
    }
    this.onChange(!this.currentState.value);
  };

  private redraw(): void {
    const enabled = this.currentState?.enabled ?? true;
    const isOn = this.currentState?.value ?? false;
    const halfW = this.rowWidth / 2;
    const halfH = this.rowHeight / 2;

    this.bgGraphics.clear();
    const fill = this.hovered && enabled ? Colors.Surface.ElevatedSurface : Colors.Surface.Surface;
    const border = this.hovered && enabled ? Colors.Brand.PrimaryLight : Colors.Surface.Border;
    this.bgGraphics.fillStyle(hexToNumber(fill), enabled ? 0.92 : 0.52);
    this.bgGraphics.fillRoundedRect(-halfW, -halfH, this.rowWidth, this.rowHeight, Shapes.Medium);
    this.bgGraphics.lineStyle(1, hexToNumber(border), enabled ? 0.72 : 0.42);
    this.bgGraphics.strokeRoundedRect(-halfW, -halfH, this.rowWidth, this.rowHeight, Shapes.Medium);

    const iconX = -halfW + Dimens.Space20;
    const iconColor = !enabled
      ? Colors.Text.Disabled
      : isOn
        ? Colors.Brand.PrimaryLight
        : Colors.Text.Secondary;

    this.iconGraphics.clear();
    drawIcon(
      this.iconGraphics,
      this.iconName,
      iconX,
      0,
      this.compact ? 17 : 19,
      iconColor,
      enabled ? 1 : 0.6,
    );

    const textLeft = iconX + 20;
    const switchCenterX = halfW - Dimens.Space16 - 28;
    const stateLabelX = switchCenterX - 36;
    const maxTextWidth = Math.max(80, stateLabelX - textLeft - Dimens.Space12);

    this.titleText.setColor(enabled ? Colors.Text.Primary : Colors.Text.Disabled);
    this.titleText.setStyle(
      createTextStyle(Typography.LabelMedium, {
        color: enabled ? Colors.Text.Primary : Colors.Text.Disabled,
        scale: this.compact ? 0.88 : 0.94,
        minFontSize: 13,
      }),
    );

    const showDescription = !this.compact || !enabled;
    this.descriptionText.setVisible(showDescription);
    if (showDescription) {
      this.descriptionText.setStyle(
        createTextStyle(Typography.LabelSmall, {
          color: enabled ? Colors.Text.Secondary : Colors.Text.Disabled,
          scale: this.compact ? 0.76 : 0.82,
          minFontSize: 10,
          wordWrapWidth: maxTextWidth,
        }),
      );
      this.titleText.setPosition(Math.round(textLeft), this.compact ? -8 : -9);
      this.descriptionText.setPosition(Math.round(textLeft), this.compact ? 9 : 10);
    } else {
      this.titleText.setPosition(Math.round(textLeft), 0);
    }

    this.stateLabelText.setVisible(this.rowWidth >= 270);
    this.stateLabelText.setColor(
      !enabled ? Colors.Text.Disabled : isOn ? Colors.Semantic.Success : Colors.Text.Secondary,
    );
    this.stateLabelText.setPosition(Math.round(stateLabelX), 0);

    this.toggleSwitch.setPosition(Math.round(switchCenterX), 0);

    // Row hit zone covers everything left of the ToggleSwitch so tapping the label toggles
    // cleanly without overlapping the ToggleSwitch's own pointer target.
    const hitWidth = Math.max(44, this.rowWidth - SWITCH_AREA_WIDTH);
    this.rowHitZone.setPosition(-halfW, 0);
    this.rowHitZone.setSize(hitWidth, Math.max(Dimens.MinTouchTarget, this.rowHeight));
  }

  public override destroy(fromScene?: boolean): void {
    this.rowHitZone.removeAllListeners();
    super.destroy(fromScene);
  }
}
