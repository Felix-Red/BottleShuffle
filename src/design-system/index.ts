// Tokens
export {
  BottleColors,
  BottleColorTokens,
  BrandColors,
  Colors,
  darkenHex,
  hexToNumber,
  hexToRgb,
  hexToRgba,
  lightenHex,
  mixHex,
  normalizeHex,
  SemanticColors,
  SurfaceColors,
  TextColors,
  type BottleColorId,
  type BottleColorToken,
  type BottlePattern,
  type BottleSymbol,
} from './tokens/Colors';

export {
  createTextStyle,
  FontFamilies,
  getResponsiveFontSize,
  Typography,
  type CanvasTextStyle,
  type TextStyleOverrides,
  type TypographyRole,
  type TypographyToken,
} from './tokens/Typography';

export { Dimens, type DimenKey } from './tokens/Dimens';
export { SemanticShapes, Shapes, type ShapeKey } from './tokens/Shapes';
export {
  Elevation,
  getElevationStyle,
  type ElevationLevel,
  type ElevationStyle,
} from './tokens/Elevation';
export {
  Motion,
  MotionDurations,
  MotionEasings,
  MotionPresets,
  resolveMotionDuration,
  type MotionSpec,
} from './tokens/Motion';
export {
  BreakpointThresholds,
  ensureMinimumTouchTarget,
  ReferenceViewport,
  resolveAspectCategory,
  resolveBreakpoint,
  resolveLayoutContext,
  type AspectCategory,
  type BreakpointSize,
  type ResponsiveLayoutContext,
  type ViewportOrientation,
} from './tokens/Breakpoints';

// Theme
export { createGameTheme, DefaultGameTheme, type GameTheme } from './theme/GameTheme';

// Shared visual utilities
export { drawIcon, type DesignIconName } from './components/common/IconGraphic';
export { drawElevatedSurface, type SurfaceDrawOptions } from './components/common/SurfaceRenderer';

// Buttons
export {
  canTriggerButtonAction,
  resolveButtonState,
  type ButtonInteractionState,
  type ButtonStateFlags,
} from './components/buttons/buttonState';
export {
  BaseButton,
  type BaseButtonConfig,
  type ButtonStyleSpec,
} from './components/buttons/BaseButton';
export { PrimaryButton, type PrimaryButtonConfig } from './components/buttons/PrimaryButton';
export { SecondaryButton, type SecondaryButtonConfig } from './components/buttons/SecondaryButton';
export { OutlineButton, type OutlineButtonConfig } from './components/buttons/OutlineButton';
export { TextButton, type TextButtonConfig } from './components/buttons/TextButton';
export {
  IconButton,
  type IconButtonConfig,
  type IconButtonVariant,
} from './components/buttons/IconButton';

// Cards
export { GameCard, type ContentBounds, type GameCardConfig } from './components/cards/GameCard';
export {
  LevelCard,
  type LevelCardConfig,
  type LevelCardStatus,
} from './components/cards/LevelCard';
export { StatCard, type StatCardConfig } from './components/cards/StatCard';

// Indicators
export {
  normalizeMatchState,
  normalizeProgress,
  normalizeStarCount,
  type NormalizedMatchState,
  type NormalizedProgress,
} from './components/indicators/indicatorMath';
export {
  ProgressBar,
  type ProgressBarConfig,
  type ProgressBarVariant,
} from './components/indicators/ProgressBar';
export { MatchCounter, type MatchCounterConfig } from './components/indicators/MatchCounter';
export { StarRating, type StarRatingConfig } from './components/indicators/StarRating';
export {
  LoadingIndicator,
  type LoadingIndicatorConfig,
} from './components/indicators/LoadingIndicator';

// Controls
export { ToggleSwitch, type ToggleSwitchConfig } from './components/controls/ToggleSwitch';

// Overlays
export { Modal, type ModalActionConfig, type ModalConfig } from './components/overlays/Modal';
export { ConfirmDialog, type ConfirmDialogConfig } from './components/overlays/ConfirmDialog';
export {
  Toast,
  type ToastConfig,
  type ToastShowOptions,
  type ToastVariant,
} from './components/overlays/Toast';

// Layout
export {
  GameHeader,
  type GameHeaderConfig,
  type HeaderActionConfig,
} from './components/layout/GameHeader';
export {
  GamePanel,
  type GamePanelConfig,
  type PanelContentArea,
  type PanelHorizontalAlign,
  type PanelVerticalAlign,
} from './components/layout/GamePanel';
