import type Phaser from 'phaser';
import { Colors } from '../../tokens/Colors';
import { Dimens } from '../../tokens/Dimens';
import { SemanticShapes } from '../../tokens/Shapes';
import { Typography } from '../../tokens/Typography';
import { BaseButton, type BaseButtonConfig } from './BaseButton';

export type TextButtonConfig = BaseButtonConfig;

export class TextButton extends BaseButton {
  public constructor(scene: Phaser.Scene, config: TextButtonConfig) {
    super(
      scene,
      {
        width: config.width ?? 140,
        height: config.height ?? Dimens.ButtonHeightSmall,
        ...config,
      },
      {
        fillDefault: Colors.Surface.ElevatedSurface,
        fillHover: Colors.Surface.ElevatedSurface,
        fillPressed: Colors.Surface.Surface,
        fillAlphaDefault: 0,
        fillAlphaHover: 0.65,
        fillAlphaPressed: 0.9,
        fillAlphaDisabled: 0,
        textColorDefault: Colors.Brand.PrimaryLight,
        textColorHover: Colors.Text.Primary,
        textColorDisabled: Colors.Text.Disabled,
        elevation: 'flat',
        cornerRadius: SemanticShapes.Button,
        typography: Typography.LabelLarge,
      },
    );
  }
}
