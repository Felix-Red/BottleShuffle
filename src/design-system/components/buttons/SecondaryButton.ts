import type Phaser from 'phaser';
import { Colors, darkenHex, lightenHex } from '../../tokens/Colors';
import { SemanticShapes } from '../../tokens/Shapes';
import { Typography } from '../../tokens/Typography';
import { BaseButton, type BaseButtonConfig } from './BaseButton';

export type SecondaryButtonConfig = BaseButtonConfig;

export class SecondaryButton extends BaseButton {
  public constructor(scene: Phaser.Scene, config: SecondaryButtonConfig) {
    super(scene, config, {
      fillDefault: Colors.Brand.Secondary,
      fillHover: lightenHex(Colors.Brand.Secondary, 0.14),
      fillPressed: Colors.Brand.SecondaryDark,
      fillDisabled: Colors.Surface.ElevatedSurface,
      depthColor: Colors.Brand.SecondaryDark,
      depthColorDisabled: darkenHex(Colors.Surface.Surface, 0.2),
      textColorDefault: Colors.Text.OnSecondary,
      textColorDisabled: Colors.Text.Disabled,
      elevation: 'medium',
      cornerRadius: SemanticShapes.Button,
      typography: Typography.LabelLarge,
    });
  }
}
