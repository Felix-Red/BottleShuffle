export type BottleColorId =
  'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'orange' | 'pink' | 'teal' | 'brown' | 'silver';

export type BottleSymbol =
  | 'circle'
  | 'diamond'
  | 'triangle'
  | 'star'
  | 'sparkle'
  | 'square'
  | 'heart'
  | 'cross'
  | 'stripes'
  | 'ring';

export type BottlePattern =
  | 'stripes'
  | 'waves'
  | 'dots'
  | 'zigzag'
  | 'diamonds'
  | 'chevron'
  | 'hearts'
  | 'rings'
  | 'grid'
  | 'diagonal';

export interface BottleColorToken {
  readonly id: BottleColorId;
  readonly label: string;
  readonly hex: string;
  readonly symbol: BottleSymbol;
  readonly pattern: BottlePattern;
}

export const BrandColors = {
  Primary: '#8B5CF6',
  PrimaryLight: '#A78BFA',
  PrimaryDark: '#6D28D9',
  Secondary: '#FBBF24',
  SecondaryDark: '#D97706',
} as const;

export const SurfaceColors = {
  Background: '#171126',
  Surface: '#29203D',
  ElevatedSurface: '#35294D',
  Border: '#4C405F',
  Overlay: '#000000',
  OverlayAlpha: 0.7,
} as const;

export const SemanticColors = {
  Success: '#4ADE80',
  SuccessDark: '#16A34A',
  Warning: '#FBBF24',
  WarningDark: '#D97706',
  Error: '#F87171',
  ErrorDark: '#DC2626',
  Info: '#60A5FA',
  InfoDark: '#2563EB',
} as const;

export const TextColors = {
  Primary: '#F8FAFC',
  Secondary: '#B4A8CC',
  Disabled: '#81788E',
  OnPrimary: '#FFFFFF',
  OnSecondary: '#171126',
} as const;

export const BottleColors = {
  Red: '#EF4444',
  Blue: '#3B82F6',
  Green: '#22C55E',
  Yellow: '#EAB308',
  Purple: '#A855F7',
  Orange: '#F97316',
  Pink: '#EC4899',
  Teal: '#14B8A6',
  Brown: '#92400E',
  Silver: '#94A3B8',
} as const;

export const BottleColorTokens: readonly BottleColorToken[] = [
  { id: 'red', label: 'Red', hex: BottleColors.Red, symbol: 'circle', pattern: 'stripes' },
  { id: 'blue', label: 'Blue', hex: BottleColors.Blue, symbol: 'diamond', pattern: 'waves' },
  { id: 'green', label: 'Green', hex: BottleColors.Green, symbol: 'triangle', pattern: 'dots' },
  { id: 'yellow', label: 'Yellow', hex: BottleColors.Yellow, symbol: 'star', pattern: 'zigzag' },
  {
    id: 'purple',
    label: 'Purple',
    hex: BottleColors.Purple,
    symbol: 'sparkle',
    pattern: 'diamonds',
  },
  { id: 'orange', label: 'Orange', hex: BottleColors.Orange, symbol: 'square', pattern: 'chevron' },
  { id: 'pink', label: 'Pink', hex: BottleColors.Pink, symbol: 'heart', pattern: 'hearts' },
  { id: 'teal', label: 'Teal', hex: BottleColors.Teal, symbol: 'cross', pattern: 'rings' },
  { id: 'brown', label: 'Brown', hex: BottleColors.Brown, symbol: 'stripes', pattern: 'grid' },
  { id: 'silver', label: 'Silver', hex: BottleColors.Silver, symbol: 'ring', pattern: 'diagonal' },
] as const;

export const Colors = {
  Brand: BrandColors,
  Surface: SurfaceColors,
  Semantic: SemanticColors,
  Text: TextColors,
  Bottle: BottleColors,
  BottleTokens: BottleColorTokens,
  White: '#FFFFFF',
  Black: '#000000',
} as const;

const HEX_SHORT_PATTERN = /^#?([0-9a-fA-F]{3})$/;
const HEX_FULL_PATTERN = /^#?([0-9a-fA-F]{6})$/;

export function normalizeHex(hex: string): string {
  const trimmed = hex.trim();
  const fullMatch = HEX_FULL_PATTERN.exec(trimmed);
  if (fullMatch?.[1] !== undefined) {
    return `#${fullMatch[1].toUpperCase()}`;
  }

  const shortMatch = HEX_SHORT_PATTERN.exec(trimmed);
  if (shortMatch?.[1] !== undefined) {
    const [r, g, b] = shortMatch[1].split('');
    return `#${(r ?? '0').repeat(2)}${(g ?? '0').repeat(2)}${(b ?? '0').repeat(2)}`.toUpperCase();
  }

  throw new RangeError(`Invalid hex colour value: "${hex}"`);
}

export function hexToNumber(hex: string): number {
  const normalized = normalizeHex(hex);
  return Number.parseInt(normalized.slice(1), 16);
}

export function hexToRgb(hex: string): {
  readonly r: number;
  readonly g: number;
  readonly b: number;
} {
  const numeric = hexToNumber(hex);
  return {
    r: (numeric >> 16) & 0xff,
    g: (numeric >> 8) & 0xff,
    b: numeric & 0xff,
  };
}

export function hexToRgba(hex: string, alpha: number): string {
  const clampedAlpha = Math.min(1, Math.max(0, alpha));
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${String(r)}, ${String(g)}, ${String(b)}, ${String(clampedAlpha)})`;
}

function clampChannel(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)));
}

function channelToHex(channel: number): string {
  return clampChannel(channel).toString(16).padStart(2, '0').toUpperCase();
}

export function mixHex(hexA: string, hexB: string, ratio: number): string {
  const t = Math.min(1, Math.max(0, ratio));
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const r = a.r + (b.r - a.r) * t;
  const g = a.g + (b.g - a.g) * t;
  const bl = a.b + (b.b - a.b) * t;
  return `#${channelToHex(r)}${channelToHex(g)}${channelToHex(bl)}`;
}

export function lightenHex(hex: string, amount: number): string {
  return mixHex(hex, Colors.White, amount);
}

export function darkenHex(hex: string, amount: number): string {
  return mixHex(hex, Colors.Black, amount);
}
