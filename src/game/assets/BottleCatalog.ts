import { CANONICAL_BOTTLE_IDS, isBottleId, type BottleId } from '../../core/models/BottleId';
import { Colors, type BottleSymbol } from '../../design-system/tokens/Colors';
import { BOTTLE_TEXTURE_KEYS, type BottleTextureKey } from './AssetKeys';

export interface BottleCatalogEntry {
  readonly id: BottleId;
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

const COLOR_TOKENS_BY_ID = new Map(Colors.BottleTokens.map((token) => [token.id, token]));

export const BOTTLE_CATALOG: readonly BottleCatalogEntry[] = Object.freeze(
  CANONICAL_BOTTLE_IDS.map((id) => {
    const token = COLOR_TOKENS_BY_ID.get(id);
    if (token === undefined) {
      throw new RangeError(`Missing visual colour token for canonical bottle id "${id}".`);
    }
    const symbolLabel = SYMBOL_LABELS[token.symbol];
    return Object.freeze({
      id,
      displayName: token.label,
      textureKey: BOTTLE_TEXTURE_KEYS[id],
      colorHex: token.hex,
      symbol: token.symbol,
      symbolLabel,
      accessibleLabel: `${token.label} bottle (${symbolLabel})`,
    });
  }),
);

export const BOTTLE_IDS: readonly BottleId[] = CANONICAL_BOTTLE_IDS;

const BOTTLE_LOOKUP = new Map<BottleId, BottleCatalogEntry>(
  BOTTLE_CATALOG.map((entry) => [entry.id, entry]),
);

export function isValidBottleId(value: string): value is BottleId {
  return isBottleId(value);
}

export function getBottleMetadata(id: BottleId): BottleCatalogEntry {
  const entry = BOTTLE_LOOKUP.get(id);
  if (entry === undefined) {
    throw new RangeError(`Unknown bottle id: "${id}"`);
  }
  return entry;
}

export function getAllBottleMetadata(): readonly BottleCatalogEntry[] {
  return BOTTLE_CATALOG;
}
