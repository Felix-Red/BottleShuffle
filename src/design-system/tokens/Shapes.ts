export const Shapes = {
  None: 0,
  ExtraSmall: 4,
  Small: 8,
  Medium: 12,
  Large: 16,
  ExtraLarge: 24,
  Rounded: 32,
} as const;

export const SemanticShapes = {
  Button: Shapes.Large,
  IconButton: Shapes.Medium,
  Card: Shapes.Large,
  LevelCard: Shapes.Large,
  Modal: Shapes.ExtraLarge,
  Toast: Shapes.Large,
  ProgressBar: Shapes.Rounded,
  ToggleTrack: Shapes.Rounded,
  Badge: Shapes.Small,
} as const;

export type ShapeKey = keyof typeof Shapes;
