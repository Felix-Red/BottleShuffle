# Visual Assets Guide — Bottle Shuffle

This document describes the visual art direction, bottle catalogue, asset specifications, reproducible generation pipeline, measured sizes, and guidelines for adding new assets to **Bottle Shuffle**.

---

## 1. Art Direction

Bottle Shuffle uses a playful, polished 2.5D casual puzzle aesthetic anchored by:

- **Vibrant glossy glass bottles** with rounded shoulders, metallic ribbed caps, cylindrical shading, curved left specular streaks, subtle base glass thickness, frosted labels, and bold white accessibility symbols.
- **Polished natural-wood display shelf** with a beveled top surface, soft contact shadows beneath each bottle, and a darker wooden front fascia edge.
- **Recessed concealed lower compartment** displaying uniform dark rounded slots with neutral lock icons (`SECRET SEQUENCE`), keeping the hidden target arrangement visually mysterious.
- **Deep twilight purple ambient backdrop** (`#171126` with a gentle central radial glow and low-contrast outer bokeh) so bottles remain the dominant visual focus without background clutter or expensive real-time shaders.

---

## 2. Bottle Catalogue

Single source of truth: `src/game/assets/BottleCatalog.ts` (referencing colour and symbol tokens from `src/design-system/tokens/Colors.ts`).

| Bottle ID | Display Name | Texture Key     | Colour Hex | Accessibility Symbol  | Accessible Label          |
| --------- | ------------ | --------------- | ---------- | --------------------- | ------------------------- |
| `red`     | Red          | `bottle:red`    | `#EF4444`  | `circle` (Circle)     | `Red bottle (Circle)`     |
| `blue`    | Blue         | `bottle:blue`   | `#3B82F6`  | `diamond` (Diamond)   | `Blue bottle (Diamond)`   |
| `green`   | Green        | `bottle:green`  | `#22C55E`  | `triangle` (Triangle) | `Green bottle (Triangle)` |
| `yellow`  | Yellow       | `bottle:yellow` | `#EAB308`  | `star` (Star)         | `Yellow bottle (Star)`    |
| `purple`  | Purple       | `bottle:purple` | `#A855F7`  | `sparkle` (Sparkle)   | `Purple bottle (Sparkle)` |
| `orange`  | Orange       | `bottle:orange` | `#F97316`  | `square` (Square)     | `Orange bottle (Square)`  |
| `pink`    | Pink         | `bottle:pink`   | `#EC4899`  | `heart` (Heart)       | `Pink bottle (Heart)`     |
| `teal`    | Teal         | `bottle:teal`   | `#14B8A6`  | `cross` (Cross)       | `Teal bottle (Cross)`     |
| `brown`   | Brown        | `bottle:brown`  | `#92400E`  | `stripes` (Stripes)   | `Brown bottle (Stripes)`  |
| `silver`  | Silver       | `bottle:silver` | `#94A3B8`  | `ring` (Ring)         | `Silver bottle (Ring)`    |

### Contrast & Legibility Notes

- **Yellow** and **Silver** bottles use a subtly darkened translucent frosted label (`#171126` at 26% opacity) so the pure white Star and Ring symbols achieve high visual contrast.
- **Brown** uses warm caramel highlights (`#C26D32` / `#E29E69`) and a crisp rim contour so it remains clearly separated from the `#171126` backdrop.
- **Red vs Pink** and **Blue vs Teal** are clearly separated both by luminance/hue and by distinct geometric symbols (`Circle` vs `Heart`, `Diamond` vs `Cross`).

---

## 3. Asset Specifications

- **Bottle source canvas:** `256 × 512 px` (`1:2` aspect ratio), transparent background, bottom-centre anchor (`origin 0.5, 1.0`), consistent outer bounds (`x: 36..220`, `y: 10..508`), zero baked-in selection rings or interaction states.
- **Background:** `1280 × 720 px` WebP (`background.webp`), scaled via cover projection to fill landscape, portrait, and square viewports without distortion.
- **Shelf & Compartment:** `1024 × 56 px` (`shelf.png`), `1024 × 32 px` (`shelf-edge.png`), `1024 × 156 px` (`hidden-compartment.png`), `128 × 128 px` (`hidden-slot.png`).
- **Effects & Icons:** `256 × 64 px` (`bottle-shadow.png`), `320 × 576 px` (`selection-glow.png`), `64 × 64 px` (`sparkle.png`), `32 × 32 px` (`particle.png`), `64 × 64 px` vector SVG (`lock.svg`).
- **Filtering:** Phaser smooth linear texture filtering (`antialias: true`, `pixelArt: false`) preserves crisp curves when scaling bottles dynamically.

### Individual Textures vs Texture Atlas Evaluation

For the current collection of 10 bottles + 9 environment/effect textures + 1 SVG icon, **individual textures** were selected over a packed texture atlas:

- Avoids introducing third-party atlas-packing tooling or brittle coordinate JSON regeneration during active visual iteration.
- Keeps every texture independently replaceable and easy to inspect.
- Total draw-call count for up to 10 visible bottles + shelf + 10 concealed slots remains minimal (~25 sprites), well within 60 fps mobile budgets.
- If future tasks add large particle sheets or animated sprite sequences, a dedicated sprite atlas can be introduced cleanly behind `AssetKeys.ts` and `AssetManifest.ts` without changing component consumers.

---

## 4. Directory Locations & Texture Naming Conventions

- **Editable source artwork:**
  - `artwork/bottles/<bottleId>.svg`
  - `artwork/environment/<name>.svg`
  - `artwork/effects/<name>.svg`
  - `artwork/icons/lock.svg`
- **Optimised runtime textures (bundled locally into `dist/assets/`):**
  - `public/assets/bottles/<bottleId>.png`
  - `public/assets/environment/<name>.{webp,png}`
  - `public/assets/effects/<name>.png`
  - `public/assets/icons/lock.svg`
- **Texture key convention (`src/game/assets/AssetKeys.ts`):**
  - Bottles: `bottle:<id>` (e.g. `bottle:purple`)
  - Environment: `env:<name>` (e.g. `env:shelf`, `env:hidden-slot`)
  - Effects: `fx:<name>` (e.g. `fx:bottle-shadow`, `fx:selection-glow`)
  - Icons: `icon:<name>` (e.g. `icon:lock`)

---

## 5. Asset-Generation Process

All source SVGs and runtime textures are generated deterministically from original programmatic vector artwork with zero external asset downloads:

1. Generate editable SVG source artwork into `artwork/` (and copy `lock.svg` to `public/assets/icons/`):
   ```bash
   node scripts/generate-assets.mjs
   ```
2. Rasterise the source SVGs into transparent RGBA PNGs and WebP runtime textures under `public/assets/` using local headless Chromium Canvas rendering:
   ```bash
   node scripts/rasterize-assets.mjs
   ```

---

## 6. Asset Loading Strategy

- Centralised in `src/game/assets/AssetManifest.ts` (`ASSET_MANIFEST` and `queueAssetManifest`).
- Integrated into `BootScene.preload()` so every texture is loaded before `HomeScene` or `AssetShowcaseScene` renders.
- Uses relative paths (`./assets/...`) so Vite dev and YouTube Playables relative production builds resolve identically without external CDN calls.
- Checks `scene.textures.exists(entry.key)` before queueing to prevent duplicate loading.
- Registers a `loaderror` diagnostic handler that logs missing keys/paths and unregisters on `complete`.

---

## 7. Measured Runtime Asset Sizes

Measured directly from `public/assets/` on disk:

| Category    | File                                 | Dimensions |          Actual Size |
| ----------- | ------------------------------------ | ---------- | -------------------: |
| Bottles     | `bottles/red.png`                    | 256 × 512  | 102,889 B (100.5 KB) |
| Bottles     | `bottles/orange.png`                 | 256 × 512  | 113,383 B (110.7 KB) |
| Bottles     | `bottles/teal.png`                   | 256 × 512  | 115,226 B (112.5 KB) |
| Bottles     | `bottles/blue.png`                   | 256 × 512  | 115,348 B (112.6 KB) |
| Bottles     | `bottles/pink.png`                   | 256 × 512  | 115,995 B (113.3 KB) |
| Bottles     | `bottles/green.png`                  | 256 × 512  | 116,109 B (113.4 KB) |
| Bottles     | `bottles/yellow.png`                 | 256 × 512  | 116,362 B (113.6 KB) |
| Bottles     | `bottles/brown.png`                  | 256 × 512  | 118,016 B (115.3 KB) |
| Bottles     | `bottles/purple.png`                 | 256 × 512  | 118,396 B (115.6 KB) |
| Bottles     | `bottles/silver.png`                 | 256 × 512  | 121,190 B (118.3 KB) |
| Environment | `environment/background.webp`        | 1280 × 720 |     5,868 B (5.7 KB) |
| Environment | `environment/shelf.png`              | 1024 × 56  |   17,402 B (17.0 KB) |
| Environment | `environment/shelf-edge.png`         | 1024 × 32  |     2,778 B (2.7 KB) |
| Environment | `environment/hidden-compartment.png` | 1024 × 156 |   15,804 B (15.4 KB) |
| Environment | `environment/hidden-slot.png`        | 128 × 128  |     5,308 B (5.2 KB) |
| Effects     | `effects/bottle-shadow.png`          | 256 × 64   |   16,127 B (15.7 KB) |
| Effects     | `effects/selection-glow.png`         | 320 × 576  | 241,824 B (236.2 KB) |
| Effects     | `effects/sparkle.png`                | 64 × 64    |     1,271 B (1.2 KB) |
| Effects     | `effects/particle.png`               | 32 × 32    |     1,226 B (1.2 KB) |
| Icons       | `icons/lock.svg`                     | 64 × 64    |       530 B (0.5 KB) |

- **Total visual runtime assets (20 files):** `1,461,052 bytes` (**1.39 MB**).
- **Local fonts (`Fredoka` + `Nunito` WOFF2 + OFL notices):** ~`115 KB`.
- **Optimisation note:** Bottle PNGs and `selection-glow.png` are currently stored as standard lossless RGBA PNGs encoded via Chromium Canvas. Converting them to WebP or running lossless PNG palette/compression optimisation in a future bundle-tuning pass can reduce the visual asset footprint by ~70–85% if tighter YouTube Playables initial-bundle margins are needed.

---

## 8. Licensing Information

- All bottle, environment, effect, and icon vector/raster assets in `artwork/` and `public/assets/{bottles,environment,effects,icons}/` are **100% original artwork** authored specifically for Bottle Shuffle with no third-party or copyrighted assets.
- Local fonts in `public/assets/fonts/fredoka/` and `public/assets/fonts/nunito/` are open-source fonts licensed under the SIL Open Font License 1.1 (`OFL.txt` included alongside each typeface).

---

## 9. Adding Additional Bottle Variants

1. Add the new bottle ID, colour token, and unique accessibility symbol in `src/design-system/tokens/Colors.ts` (`BottleColorId`, `BottleSymbol`, `BottleColors`, `BottleColorTokens`).
2. Add the matching texture key in `src/game/assets/AssetKeys.ts` (`BOTTLE_TEXTURE_KEYS`) and symbol display label in `src/game/assets/BottleCatalog.ts`.
3. Add the matching palette & vector symbol path in `scripts/generate-assets.mjs` and filename entry in `scripts/rasterize-assets.mjs`.
4. Run `node scripts/generate-assets.mjs && node scripts/rasterize-assets.mjs`.
5. Run `npm test` to verify catalogue uniqueness and asset manifest coverage.
