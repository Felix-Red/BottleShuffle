# Bottle Shuffle — Task 19 QA Baseline

- **Captured:** 2026-11-27 (prior to Task 19 optimisations and defect fixes)
- **Reference Machine:** Apple M1 Pro (`arm64`), 16 GiB RAM, macOS 27.2.1 (`Build 26B131`)
- **Node.js:** `v26.0.0`
- **Browser:** Google Chrome `158.0.8127.89` (headless CDP, `1280×720`, DPR `1`, localhost `vite preview`)

---

## 1. Automated Quality Checks (Baseline)

| Check             | Command                                                   | Exit Code | Observed Result                                                                          |
| :---------------- | :-------------------------------------------------------- | --------: | :--------------------------------------------------------------------------------------- |
| TypeScript        | `npm run typecheck` (`tsc --noEmit`)                      |       `0` | 0 errors                                                                                 |
| ESLint            | `npm run lint` (`eslint .`)                               |       `0` | 0 errors, 0 warnings                                                                     |
| Prettier          | `npm run format:check`                                    |       `0` | All files formatted                                                                      |
| Vitest Suite      | `npm test` (`vitest run`)                                 |       `0` | **73/73** test files passed; **311/311** tests passed; `0` failed; `0` skipped (`2.17s`) |
| Coverage          | _(Not yet configured in baseline)_                        |         — | `@vitest/coverage-v8` not installed yet                                                  |
| Production Build  | `npm run build:youtube`                                   |       `0` | Built in `515 ms`; YouTube build audit PASSED                                            |
| Dependency Audit  | `npm audit --json`                                        |       `0` | **0** vulnerabilities (`3` prod, `163` dev, `34` optional)                               |
| TODO / FIXME Scan | `grep -rnE "TODO\|FIXME\|HACK\|XXX" src/ tests/ scripts/` |       `0` | 0 matches                                                                                |
| CI Workflows      | `.github/workflows/`                                      |         — | None present yet                                                                         |

---

## 2. Production Bundle & Asset Sizes (Baseline `dist/`)

| Category                                                       |            Uncompressed Size |                 Gzipped Size | Notes                                                                  |
| :------------------------------------------------------------- | ---------------------------: | ---------------------------: | :--------------------------------------------------------------------- |
| **Initial Bundle** (`index.html` + `assets/index-C97ItyMO.js`) | **1.68 MiB** (`1,758,894 B`) | **435.27 KiB** (`445,719 B`) | Single combined JS chunk (`1,756,539 B`) — Phaser + app unsplit        |
| **Total `dist/` Bundle** (44 files)                            | **3.47 MiB** (`3,633,909 B`) | **2.15 MiB** (`2,249,259 B`) | Well under 250 MiB limit                                               |
| **Images** (19 raster textures + 1 SVG)                        | **1.39 MiB** (`1,461,052 B`) |                            — | `selection-glow.png` (`236 KiB`) + 10 bottle PNGs (`100–118 KiB` each) |
| **Audio** (13 SFX + 2 music `.m4a` + `ATTRIBUTION.md`)         | **289.36 KiB** (`296,306 B`) |                            — | `gameplay-theme.m4a` (`108 KiB`), `menu-theme.m4a` (`101 KiB`)         |
| **Fonts** (`Fredoka` + `Nunito` `.woff2` + `OFL.txt`)          | **106.33 KiB** (`108,884 B`) |                            — | 4 `.woff2` files + 2 license files                                     |

### Largest Individual Production Files (Baseline)

1. `dist/assets/index-C97ItyMO.js` — `1.68 MiB` (`1,756,539 B`)
2. `dist/assets/effects/selection-glow.png` — `236 KiB`
3. `dist/assets/bottles/silver.png` — `118 KiB`
4. `dist/assets/bottles/purple.png` — `116 KiB`
5. `dist/assets/bottles/brown.png` — `115 KiB`
6. `dist/assets/bottles/yellow.png` — `114 KiB`
7. `dist/assets/bottles/blue.png`, `green.png`, `pink.png`, `teal.png` — `113 KiB` each
8. `dist/assets/bottles/orange.png` — `111 KiB`
9. `dist/assets/audio/music/gameplay-theme.m4a` — `108 KiB`
10. `dist/assets/audio/music/menu-theme.m4a` — `101 KiB`

---

## 3. Baseline Browser Runtime Measurements (`dist/` on `vite preview`)

- **Standalone Production Load (live `https://www.youtube.com/game_api/v1` `v1.20261116.0100`):**
  - `domContentLoaded`: `2,184 ms` (includes `1,874 ms` external YouTube SDK download)
  - `loadEvent`: `2,445 ms`
  - Main JS fetch (`447,515 B` transferred): `86 ms`
  - Resources loaded: `41`
  - Console / runtime errors: **`0`**
  - Failed network requests: **`1` (`GET /favicon.ico -> 404`)**
  - Idle Home Frame Distribution (90 samples): Avg `16.67 ms` (`60.0 FPS`), p50 `16.7 ms`, p95 `16.8 ms`, max `16.8 ms`, `0` frames `> 33.4 ms`
  - JS Heap (`performance.memory`): `17.39 MB` used / `22.88 MB` total
- **Simulated Playables Readiness Probe (zero external network jitter):**
  - `ytgame.game.firstFrameReady()`: **`216 ms`**
  - `ytgame.game.gameReady()`: **`301 ms`**
  - JS Heap (`performance.memory`): `22.92 MB` used / `30.48 MB` total

---

## 4. Initial Audit Findings (Before Task 19 Changes)

1. **`DEF-001` (P2 — Missing Favicon 404):** Browser emits a 404 network error for `/favicon.ico` on standalone load.
2. **`DEF-002` (P2 — Unnecessary `ATTRIBUTION.md` in `public/assets/audio/`):** While helpful for source documentation, copying developer markdown into runtime `dist/assets/audio/ATTRIBUTION.md` ships non-runtime markdown inside the game package (license `OFL.txt` for fonts is retained intentionally per OFL requirements; `ATTRIBUTION.md` can be documented in `docs/ASSETS.md` / `docs/AUDIO.md`).
3. **`OPT-001` (Asset Optimisation Opportunity):** 10 bottle textures (`256×512`) and `selection-glow` (`320×576`) are stored as heavy RGBA PNGs (`1.39 MiB` total images), whereas our own `rasterize-assets.mjs` already supports alpha WebP encoding (which compressed `1280×720` `background.webp` to `5.7 KiB`).
4. **`OPT-002` (JS Chunking Opportunity):** Phaser (~1.48 MiB) and Bottle Shuffle application code (~270 KiB) ship in a single `1.68 MiB` chunk (`index-*.js`), causing a Vite large-chunk warning and preventing engine/app cache separation.
5. **Testing Gaps Identified:** No Vitest coverage provider yet, no 10,000+ puzzle stress script, no programmatic 50-level campaign solver validator, no Playwright E2E suite, no exhaustive small-permutation match verifier, no 100-cycle long-session stability test, and no GitHub Actions CI pipeline.
