import { Colors, type BottleColorId, type BottleSymbol } from '../../design-system/tokens/Colors';
import { BOTTLE_TEXTURE_KEYS, type BottleTextureKey } from './AssetKeys';

export interface BottleCatalogEntry {
  readonly id: BottleColorId;
  readonly displayName: string;
  readonly textureKey: BottleTextureKey;
  readonly colorHex: string;
  readonly symbol: BottleSymbol;
  readonly symbolLabel: string;
  readonly accessibleLabel: string;
}

const SYMBOL_LABELS: Readonly<Record<BottleSymbol, string>> = {
  circle: 'Circle',
  diamond: 'Diamond',
  triangle: 'Triangle',
  star: 'Star',
  sparkle: 'Sparkle',
  square: 'Square',
  heart: 'Heart',
  cross: 'Cross',
  stripes: 'Stripes',
  ring: 'Ring',
};

export const BOTTLE_CATALOG: readonly BottleCatalogEntry[] = Colors.BottleTokens.map((token) => {
  const symbolLabel = SYMBOL_LABELS[token.symbol];
  return {
    id: token.id,
    displayName: token.label,
    textureKey: BOTTLE_TEXTURE_KEYS[token.id],
    colorHex: token.hex,
    symbol: token.symbol,
    symbolLabel,
    accessibleLabel: `${token.label} bottle (${symbolLabel})`,
  };
});

export const BOTTLE_IDS: readonly BottleColorId[] = BOTTLE_CATALOG.map((entry) => entry.id);

const BOTTLE_LOOKUP = new Map<BottleColorId, BottleCatalogEntry>(
  BOTTLE_CATALOG.map((entry) => [entry.id, entry]),
);

export function isValidBottleId(value: string): value is BottleColorId {
  return BOTTLE_LOOKUP.has(value as BottleColorId);
}

export function getBottleMetadata(id: BottleColorId): BottleCatalogEntry {
  const entry = BOTTLE_LOOKUP.get(id);
  if (entry === undefined) {
    throw new RangeError(`Unknown bottle id: "${id}"`);
  }
  return entry;
}

export function getAllBottleMetadata(): readonly BottleCatalogEntry[] {
  return BOTTLE_CATALOG;
}
