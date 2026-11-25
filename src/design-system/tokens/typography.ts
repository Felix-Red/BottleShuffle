import { Colors } from './Colors';

export const FontFamilies = {
  Display: '"Fredoka", "Nunito", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  Body: '"Nunito", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
} as const;

export interface TypographyToken {
  readonly fontFamily: string;
  readonly fontSize: number;
  readonly fontWeight: 400 | 600 | 700;
  readonly lineHeight: number;
  readonly letterSpacing: number;
}

export const Typography = {
  Display: {
    fontFamily: FontFamilies.Display,
    fontSize: 64,
    fontWeight: 700,
    lineHeight: 1.12,
    letterSpacing: 1,
  },
  HeadlineLarge: {
    fontFamily: FontFamilies.Display,
    fontSize: 48,
    fontWeight: 700,
    lineHeight: 1.15,
    letterSpacing: 0.5,
  },
  HeadlineMedium: {
    fontFamily: FontFamilies.Display,
    fontSize: 36,
    fontWeight: 700,
    lineHeight: 1.2,
    letterSpacing: 0.25,
  },
  HeadlineSmall: {
    fontFamily: FontFamilies.Display,
    fontSize: 28,
    fontWeight: 600,
    lineHeight: 1.25,
    letterSpacing: 0,
  },
  TitleLarge: {
    fontFamily: FontFamilies.Display,
    fontSize: 24,
    fontWeight: 700,
    lineHeight: 1.25,
    letterSpacing: 0,
  },
  TitleMedium: {
    fontFamily: FontFamilies.Body,
    fontSize: 20,
    fontWeight: 600,
    lineHeight: 1.3,
    letterSpacing: 0,
  },
  BodyLarge: {
    fontFamily: FontFamilies.Body,
    fontSize: 20,
    fontWeight: 400,
    lineHeight: 1.4,
    letterSpacing: 0,
  },
  BodyMedium: {
    fontFamily: FontFamilies.Body,
    fontSize: 18,
    fontWeight: 400,
    lineHeight: 1.4,
    letterSpacing: 0,
  },
  BodySmall: {
    fontFamily: FontFamilies.Body,
    fontSize: 16,
    fontWeight: 400,
    lineHeight: 1.4,
    letterSpacing: 0,
  },
  LabelLarge: {
    fontFamily: FontFamilies.Body,
    fontSize: 18,
    fontWeight: 700,
    lineHeight: 1.2,
    letterSpacing: 0.5,
  },
  LabelMedium: {
    fontFamily: FontFamilies.Body,
    fontSize: 16,
    fontWeight: 600,
    lineHeight: 1.2,
    letterSpacing: 0.25,
  },
  LabelSmall: {
    fontFamily: FontFamilies.Body,
    fontSize: 14,
    fontWeight: 600,
    lineHeight: 1.2,
    letterSpacing: 0.25,
  },
} as const satisfies Record<string, TypographyToken>;

export type TypographyRole = keyof typeof Typography;

export interface TextStyleOverrides {
  readonly color?: string;
  readonly align?: 'left' | 'center' | 'right';
  readonly scale?: number;
  readonly minFontSize?: number;
  readonly wordWrapWidth?: number;
}

export interface CanvasTextStyle {
  readonly fontFamily: string;
  readonly fontSize: string;
  readonly fontStyle: string;
  readonly color: string;
  readonly align?: 'left' | 'center' | 'right';
  readonly padding: {
    readonly left: number;
    readonly right: number;
    readonly top: number;
    readonly bottom: number;
  };
  readonly wordWrap?: {
    readonly width: number;
    readonly useAdvancedWrap: boolean;
  };
}

export function getResponsiveFontSize(token: TypographyToken, scale = 1, minFontSize = 12): number {
  const safeScale = Math.max(0.25, scale);
  return Math.max(minFontSize, Math.round(token.fontSize * safeScale));
}

export function createTextStyle(
  token: TypographyToken,
  overrides: TextStyleOverrides = {},
): CanvasTextStyle {
  const fontSizePx = getResponsiveFontSize(
    token,
    overrides.scale ?? 1,
    overrides.minFontSize ?? 12,
  );
  const verticalPadding = Math.max(4, Math.ceil(fontSizePx * 0.12));

  return {
    fontFamily: token.fontFamily,
    fontSize: `${String(fontSizePx)}px`,
    fontStyle: String(token.fontWeight),
    color: overrides.color ?? Colors.Text.Primary,
    ...(overrides.align !== undefined ? { align: overrides.align } : {}),
    padding: {
      left: 2,
      right: 2,
      top: verticalPadding,
      bottom: verticalPadding,
    },
    ...(overrides.wordWrapWidth !== undefined && overrides.wordWrapWidth > 0
      ? {
          wordWrap: {
            width: overrides.wordWrapWidth,
            useAdvancedWrap: true,
          },
        }
      : {}),
  };
}
