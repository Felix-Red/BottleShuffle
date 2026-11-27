import type Phaser from 'phaser';
import {
  getDeferredAudioEntries,
  getEssentialAudioEntries,
  type AudioCatalogEntry,
} from '../../services/audio/AudioCatalog';
import {
  ASSET_KEYS,
  BOTTLE_TEXTURE_KEYS,
  EFFECT_TEXTURE_KEYS,
  ENVIRONMENT_TEXTURE_KEYS,
  ICON_TEXTURE_KEYS,
  type AssetKey,
} from './AssetKeys';
import { BOTTLE_CATALOG } from './BottleCatalog';

export type AssetKind = 'image' | 'svg';

export interface AssetManifestEntry {
  readonly key: AssetKey;
  readonly kind: AssetKind;
  readonly path: string;
  readonly svgSize?: { readonly width: number; readonly height: number };
}

export const ASSET_MANIFEST: readonly AssetManifestEntry[] = [
  ...BOTTLE_CATALOG.map((entry): AssetManifestEntry => ({
    key: BOTTLE_TEXTURE_KEYS[entry.id],
    kind: 'image',
    path: `./assets/bottles/${entry.id}.webp`,
  })),
  {
    key: ENVIRONMENT_TEXTURE_KEYS.BACKGROUND,
    kind: 'image',
    path: './assets/environment/background.webp',
  },
  {
    key: ENVIRONMENT_TEXTURE_KEYS.SHELF,
    kind: 'image',
    path: './assets/environment/shelf.png',
  },
  {
    key: ENVIRONMENT_TEXTURE_KEYS.SHELF_EDGE,
    kind: 'image',
    path: './assets/environment/shelf-edge.png',
  },
  {
    key: ENVIRONMENT_TEXTURE_KEYS.HIDDEN_COMPARTMENT,
    kind: 'image',
    path: './assets/environment/hidden-compartment.png',
  },
  {
    key: ENVIRONMENT_TEXTURE_KEYS.HIDDEN_SLOT,
    kind: 'image',
    path: './assets/environment/hidden-slot.png',
  },
  {
    key: EFFECT_TEXTURE_KEYS.BOTTLE_SHADOW,
    kind: 'image',
    path: './assets/effects/bottle-shadow.png',
  },
  {
    key: EFFECT_TEXTURE_KEYS.SELECTION_GLOW,
    kind: 'image',
    path: './assets/effects/selection-glow.webp',
  },
  {
    key: EFFECT_TEXTURE_KEYS.SPARKLE,
    kind: 'image',
    path: './assets/effects/sparkle.png',
  },
  {
    key: EFFECT_TEXTURE_KEYS.PARTICLE,
    kind: 'image',
    path: './assets/effects/particle.png',
  },
  {
    key: ICON_TEXTURE_KEYS.LOCK,
    kind: 'svg',
    path: './assets/icons/lock.svg',
    svgSize: { width: 64, height: 64 },
  },
];

export function getExpectedAssetKeys(): readonly AssetKey[] {
  return [
    ...Object.values(ASSET_KEYS.Bottles),
    ...Object.values(ASSET_KEYS.Environment),
    ...Object.values(ASSET_KEYS.Effects),
    ...Object.values(ASSET_KEYS.Icons),
  ];
}

export interface AssetPreloadReport {
  readonly queuedCount: number;
  readonly skippedCount: number;
}

export function queueAssetManifest(
  scene: Phaser.Scene,
  onError?: (key: string, path: string) => void,
): AssetPreloadReport {
  let queuedCount = 0;
  let skippedCount = 0;

  const handleLoadError = (file: Phaser.Loader.File): void => {
    const key = file.key;
    const url =
      typeof file.src === 'string'
        ? file.src
        : typeof file.url === 'string'
          ? file.url
          : '<unknown>';
    console.error(`[AssetManifest] Failed to load asset "${key}" from "${url}".`);
    onError?.(key, url);
  };

  scene.load.on('loaderror', handleLoadError);
  scene.load.once('complete', () => {
    scene.load.off('loaderror', handleLoadError);
  });

  for (const entry of ASSET_MANIFEST) {
    if (scene.textures.exists(entry.key)) {
      skippedCount += 1;
      continue;
    }

    if (entry.kind === 'svg') {
      scene.load.svg(entry.key, entry.path, entry.svgSize);
    } else {
      scene.load.image(entry.key, entry.path);
    }
    queuedCount += 1;
  }

  return { queuedCount, skippedCount };
}

function queueAudioEntries(
  scene: Phaser.Scene,
  entries: readonly AudioCatalogEntry[],
  onError?: (key: string, path: string) => void,
): AssetPreloadReport {
  let queuedCount = 0;
  let skippedCount = 0;

  const handleLoadError = (file: Phaser.Loader.File): void => {
    const key = file.key;
    const url =
      typeof file.src === 'string'
        ? file.src
        : typeof file.url === 'string'
          ? file.url
          : '<unknown>';
    console.warn(`[AssetManifest] Audio asset "${key}" failed to load from "${url}".`);
    onError?.(key, url);
  };

  scene.load.on('loaderror', handleLoadError);
  scene.load.once('complete', () => {
    scene.load.off('loaderror', handleLoadError);
  });

  for (const entry of entries) {
    if (scene.cache.audio.exists(entry.id)) {
      skippedCount += 1;
      continue;
    }
    scene.load.audio(entry.id, entry.path);
    queuedCount += 1;
  }

  return { queuedCount, skippedCount };
}

/**
 * Queues lightweight, essential sound effects during BootScene preload so UI and
 * gameplay feedback are ready immediately without inflating startup time.
 */
export function queueEssentialAudioAssets(
  scene: Phaser.Scene,
  onError?: (key: string, path: string) => void,
): AssetPreloadReport {
  return queueAudioEntries(scene, getEssentialAudioEntries(), onError);
}

/**
 * Queues background music loops for non-blocking deferred loading after the
 * first playable frame is presented.
 */
export function queueDeferredMusicAssets(
  scene: Phaser.Scene,
  onError?: (key: string, path: string) => void,
): AssetPreloadReport {
  return queueAudioEntries(scene, getDeferredAudioEntries(), onError);
}
