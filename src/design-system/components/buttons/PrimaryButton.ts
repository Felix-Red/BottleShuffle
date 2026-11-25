import type Phaser from 'phaser';
import { Colors, darkenHex } from '../../tokens/Colors';
import { SemanticShapes } from '../../tokens/Shapes';
import { Typography } from '../../tokens/Typography';
import { BaseButton, type BaseButtonConfig } from './BaseButton';

export type PrimaryButtonConfig = BaseButtonConfig;

export class PrimaryButton extends BaseButton {
  public constructor(scene: Phaser.Scene, config: PrimaryButtonConfig) {
    super(scene, config, {
      fillDefault: Colors.Brand.Primary,
      fillHover: Colors.Brand.PrimaryLight,
      fillPressed: Colors.Brand.PrimaryDark,
      fillDisabled: Colors.Surface.ElevatedSurface,
      depthColor: Colors.Brand.PrimaryDark,
      depthColorDisabled: darkenHex(Colors.Surface.Surface, 0.2),
      textColorDefault: Colors.Text.OnPrimary,
      textColorDisabled: Colors.Text.Disabled,
      elevation: 'medium',
      cornerRadius: SemanticShapes.Button,
      typography: Typography.LabelLarge,
    });
  }
}
