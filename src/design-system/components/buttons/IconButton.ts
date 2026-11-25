import type Phaser from 'phaser';
import { Colors, lightenHex } from '../../tokens/Colors';
import { Dimens } from '../../tokens/Dimens';
import { SemanticShapes } from '../../tokens/Shapes';
import { Typography } from '../../tokens/Typography';
import type { DesignIconName } from '../common/IconGraphic';
import { BaseButton, type BaseButtonConfig, type ButtonStyleSpec } from './BaseButton';

export type IconButtonVariant = 'surface' | 'primary' | 'secondary' | 'ghost';

export interface IconButtonConfig extends Omit<BaseButtonConfig, 'label' | 'iconPosition'> {
  readonly icon: DesignIconName;
  readonly size?: number;
  readonly variant?: IconButtonVariant;
}

function getIconButtonStyle(variant: IconButtonVariant): ButtonStyleSpec {
  switch (variant) {
    case 'primary':
      return {
        fillDefault: Colors.Brand.Primary,
        fillHover: Colors.Brand.PrimaryLight,
        fillPressed: Colors.Brand.PrimaryDark,
        fillDisabled: Colors.Surface.ElevatedSurface,
        depthColor: Colors.Brand.PrimaryDark,
        textColorDefault: Colors.Text.OnPrimary,
        textColorDisabled: Colors.Text.Disabled,
        elevation: 'medium',
        cornerRadius: SemanticShapes.IconButton,
        typography: Typography.LabelMedium,
      };
    case 'secondary':
      return {
        fillDefault: Colors.Brand.Secondary,
        fillHover: lightenHex(Colors.Brand.Secondary, 0.14),
        fillPressed: Colors.Brand.SecondaryDark,
        fillDisabled: Colors.Surface.ElevatedSurface,
        depthColor: Colors.Brand.SecondaryDark,
        textColorDefault: Colors.Text.OnSecondary,
        textColorDisabled: Colors.Text.Disabled,
        elevation: 'medium',
        cornerRadius: SemanticShapes.IconButton,
        typography: Typography.LabelMedium,
      };
    case 'ghost':
      return {
        fillDefault: Colors.Surface.ElevatedSurface,
        fillHover: Colors.Surface.ElevatedSurface,
        fillPressed: Colors.Surface.Surface,
        fillAlphaDefault: 0,
        fillAlphaHover: 0.7,
        fillAlphaPressed: 0.9,
        fillAlphaDisabled: 0,
        textColorDefault: Colors.Text.Primary,
        textColorHover: Colors.Brand.PrimaryLight,
        textColorDisabled: Colors.Text.Disabled,
        elevation: 'flat',
        cornerRadius: SemanticShapes.IconButton,
        typography: Typography.LabelMedium,
      };
    case 'surface':
    default:
      return {
        fillDefault: Colors.Surface.ElevatedSurface,
        fillHover: lightenHex(Colors.Surface.ElevatedSurface, 0.1),
        fillPressed: Colors.Surface.Surface,
        fillDisabled: Colors.Surface.Surface,
        borderColorDefault: Colors.Surface.Border,
        borderColorHover: Colors.Brand.PrimaryLight,
        borderWidth: Dimens.BorderThin,
        textColorDefault: Colors.Text.Primary,
        textColorDisabled: Colors.Text.Disabled,
        elevation: 'low',
        cornerRadius: SemanticShapes.IconButton,
        typography: Typography.LabelMedium,
      };
  }
}

export class IconButton extends BaseButton {
  public constructor(scene: Phaser.Scene, config: IconButtonConfig) {
    const dimension = Math.max(Dimens.MinTouchTarget, config.size ?? Dimens.MinTouchTarget);
    const variant = config.variant ?? 'surface';

    super(
      scene,
      {
        ...config,
        width: config.width ?? dimension,
        height: config.height ?? dimension,
        label: '',
      },
      getIconButtonStyle(variant),
    );
  }
}
