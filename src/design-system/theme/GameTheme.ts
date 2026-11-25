import { Colors } from '../tokens/Colors';
import { Dimens } from '../tokens/Dimens';
import { Elevation } from '../tokens/Elevation';
import { Motion } from '../tokens/Motion';
import { SemanticShapes, Shapes } from '../tokens/Shapes';
import { FontFamilies, Typography } from '../tokens/Typography';

export interface GameTheme {
  readonly colors: typeof Colors;
  readonly typography: typeof Typography;
  readonly fontFamilies: typeof FontFamilies;
  readonly dimens: typeof Dimens;
  readonly shapes: typeof Shapes;
  readonly semanticShapes: typeof SemanticShapes;
  readonly elevation: typeof Elevation;
  readonly motion: typeof Motion;
  readonly reducedMotion: boolean;
}

export const DefaultGameTheme: GameTheme = {
  colors: Colors,
  typography: Typography,
  fontFamilies: FontFamilies,
  dimens: Dimens,
  shapes: Shapes,
  semanticShapes: SemanticShapes,
  elevation: Elevation,
  motion: Motion,
  reducedMotion: false,
};

export function createGameTheme(
  overrides: Partial<Pick<GameTheme, 'reducedMotion'>> = {},
): GameTheme {
  return {
    ...DefaultGameTheme,
    ...overrides,
  };
}
