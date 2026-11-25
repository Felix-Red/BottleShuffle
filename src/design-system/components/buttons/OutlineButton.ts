import type Phaser from 'phaser';
import { Colors } from '../../tokens/Colors';
import { Dimens } from '../../tokens/Dimens';
import { SemanticShapes } from '../../tokens/Shapes';
import { Typography } from '../../tokens/Typography';
import { BaseButton, type BaseButtonConfig } from './BaseButton';

export type OutlineButtonConfig = BaseButtonConfig;

export class OutlineButton extends BaseButton {
  public constructor(scene: Phaser.Scene, config: OutlineButtonConfig) {
    super(scene, config, {
      fillDefault: Colors.Surface.Surface,
      fillHover: Colors.Surface.ElevatedSurface,
      fillPressed: Colors.Surface.Background,
      fillDisabled: Colors.Surface.Surface,
      fillAlphaDefault: 0.72,
      fillAlphaHover: 0.95,
      fillAlphaPressed: 0.95,
      fillAlphaDisabled: 0.35,
      borderColorDefault: Colors.Surface.Border,
      borderColorHover: Colors.Brand.PrimaryLight,
      borderColorDisabled: Colors.Surface.Border,
      borderWidth: Dimens.BorderMedium,
      textColorDefault: Colors.Text.Primary,
      textColorHover: Colors.Text.Primary,
      textColorDisabled: Colors.Text.Disabled,
      elevation: 'low',
      cornerRadius: SemanticShapes.Button,
      typography: Typography.LabelLarge,
    });
  }
}
