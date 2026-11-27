import { describe, expect, it } from 'vitest';
import { ASSET_MANIFEST, getExpectedAssetKeys } from '../../src/game/assets/AssetManifest';
import { BOTTLE_CATALOG } from '../../src/game/assets/BottleCatalog';

describe('AssetManifest', () => {
  it('registers every expected asset key with unique keys and relative local paths', () => {
    const expectedKeys = getExpectedAssetKeys();
    const manifestKeys = ASSET_MANIFEST.map((entry) => entry.key);
    const manifestPaths = ASSET_MANIFEST.map((entry) => entry.path);

    expect(new Set(manifestKeys).size).toBe(manifestKeys.length);
    expect(new Set(manifestPaths).size).toBe(manifestPaths.length);
    expect(manifestKeys).toHaveLength(expectedKeys.length);

    for (const key of expectedKeys) {
      expect(manifestKeys).toContain(key);
    }

    for (const entry of ASSET_MANIFEST) {
      expect(entry.path.startsWith('./assets/')).toBe(true);
      expect(entry.path.includes('http://')).toBe(false);
      expect(entry.path.includes('https://')).toBe(false);
    }
  });

  it('includes a dedicated runtime texture entry for all ten bottles in BottleCatalog', () => {
    const manifestByKey = new Map(ASSET_MANIFEST.map((entry) => [entry.key, entry]));

    for (const bottle of BOTTLE_CATALOG) {
      const manifestEntry = manifestByKey.get(bottle.textureKey);
      expect(manifestEntry).toBeDefined();
      expect(manifestEntry?.path).toBe(`./assets/bottles/${bottle.id}.webp`);
    }
  });
});
