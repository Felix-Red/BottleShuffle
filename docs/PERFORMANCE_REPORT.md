# Bottle Shuffle — Performance & Optimisation Report

- **Date:** 2026-11-27
- **Reference Hardware:** Apple M1 Pro (`arm64`), 16 GiB RAM, macOS 27.2.1 (`Build 26B131`)
- **Node.js:** `v26.0.0`
- **Browser:** Google Chrome `158.0.8127.89` (headless CDP, `1280×720`, DPR `1`, localhost `vite preview`)

---

## 1. Measurement Methodology

All before-and-after measurements were captured on the identical reference machine against production `dist/` served by `vite preview`:

- **Bundle & Asset Sizes:** Exact file byte counts and level-9 gzip sizes measured via `scripts/verify-youtube-build.mjs` and `scripts/analyse-bundle.mjs`.
- **Startup Readiness:** Measured via Chrome CDP intercepting `https://www.youtube.com/game_api/v1` with a zero-latency local spy (`firstFrameReadyMs`, `gameReadyMs`) to eliminate external internet latency jitter, alongside live standalone loads with official `ytgame` v1 (`1.20261116.0100`).
- **Frame-Time Distribution:** 90 consecutive `requestAnimationFrame` deltas sampled on the rendered production canvas (`avg`, `p50`, `p95`, `max`, long frames `> 33.4 ms`).
- **JavaScript Heap:** Measured via Chrome `performance.memory` (`usedJSHeapSize` / `totalJSHeapSize`) and 120-cycle Node soak test listener verification.

---

## 2. Optimisations Performed

1. **Image Texture Optimisation (`OPT-001`):** Re-encoded all 10 bottle textures (`256×512`) and `selection-glow` (`320×576`) from RGBA PNG to high-quality alpha WebP (`0.94` / `0.92` quality) via `scripts/rasterize-assets.mjs`, retaining original editable SVGs in `artwork/` and verifying crisp bottle symbols and alpha edges visually.
2. **Vite Vendor Code Splitting (`OPT-002`):** Configured Rolldown `codeSplitting` in `vite.config.ts` to separate Phaser (`vendor-phaser-*.js`, `1.14 MiB` raw / `306.52 KiB` gzip) from Bottle Shuffle application code (`index-*.js`, `548.29 KiB` raw / `127.97 KiB` gzip), eliminating Vite's chunk-size warning and enabling independent engine caching.
3. **Favicon 404 Elimination (`DEF-001`):** Added local `public/favicon.svg` (`336 B`) so standalone loads incur zero 404 network retries.

---

## 3. Before-and-After Comparison

| Metric                                      |                    Baseline (Before Task 19) |                            Final (After Task 19) |               Change               | Internal Target |        YouTube Limit         |
| :------------------------------------------ | -------------------------------------------: | -----------------------------------------------: | :--------------------------------: | :-------------: | :--------------------------: |
| **Total `dist/` Bundle (Uncompressed)**     |                   `3.47 MiB` (`3,633,909 B`) |                   **`2.29 MiB` (`2,404,619 B`)** |       **-33.8% (-1.18 MiB)**       |   `< 10 MiB`    |         `< 250 MiB`          |
| **Total `dist/` Bundle (Gzipped)**          |                   `2.15 MiB` (`2,249,259 B`) |                 **`999.02 KiB` (`1,023,001 B`)** |       **-54.5% (-1.17 MiB)**       |    `< 5 MiB`    |              —               |
| **Initial JS + HTML (Uncompressed)**        |                   `1.68 MiB` (`1,758,894 B`) |                   **`1.68 MiB` (`1,759,200 B`)** |  `+0.02%` _(split into 3 chunks)_  |    `< 5 MiB`    | `< 30 MiB` (`< 15 MiB` rec.) |
| **Initial JS + HTML (Gzipped)**             |                   `435.27 KiB` (`445,719 B`) |                   **`435.89 KiB` (`446,356 B`)** |              `+0.14%`              |    `< 5 MiB`    |              —               |
| **Largest Individual File**                 |                    `1.68 MiB` (`index-*.js`) |            **`1.14 MiB` (`vendor-phaser-*.js`)** |             **-32.0%**             |    `< 2 MiB`    |          `< 30 MiB`          |
| **All Runtime Images**                      |                   `1.39 MiB` (`1,461,052 B`) |                   **`226.03 KiB` (`231,456 B`)** |       **-84.2% (-1.17 MiB)**       |        —        |              —               |
| **Bottle Textures (10 files)**              |                   `1.10 MiB` (`1,152,914 B`) |                   **`105.07 KiB` (`107,596 B`)** |             **-90.7%**             |        —        |              —               |
| **Effects & Icons (5 files)**               |                   `254.86 KiB` (`260,978 B`) |                     **`74.57 KiB` (`76,364 B`)** |             **-70.7%**             |        —        |              —               |
| **Audio Assets (15 `.m4a` files)**          |                   `289.36 KiB` (`296,306 B`) |                       `289.36 KiB` (`296,306 B`) |    `0%` _(already compact AAC)_    |        —        |              —               |
| **Fonts (`Fredoka` + `Nunito` `.woff2`)**   |                   `106.33 KiB` (`108,884 B`) |                       `106.33 KiB` (`108,884 B`) |   `0%` _(already subset woff2)_    |        —        |              —               |
| **Playables `firstFrameReady()`**           |                                     `216 ms` |                                     **`211 ms`** |              `-2.3%`               |        —        |              —               |
| **Playables `gameReady()`**                 |                                     `301 ms` |                                     **`320 ms`** |  Within run variance (`< 0.35s`)   |   `~2,000 ms`   |      `< 5,000 ms` rec.       |
| **Idle Frame Time (Avg / p50 / p95 / Max)** | `16.67 / 16.7 / 16.8 / 16.8 ms` (`60.0 FPS`) | **`16.67 / 16.7 / 16.7 / 16.8 ms` (`60.0 FPS`)** |    Stable `60.0 FPS`, `0` drops    |    `60 FPS`     |              —               |
| **JS Heap (Standalone / Playables Probe)**  |                 `17.39 MB` / `22.92 MB` used |                 **`17.39 MB` / `22.87 MB` used** | Stable (`< 25%` of 100 MiB target) |   `< 100 MiB`   |          `< 512 MB`          |
| **Failed Network Requests**                 |                     `1` (`/favicon.ico` 404) |                                          **`0`** |             **-100%**              |       `0`       |             `0`              |

---

## 4. Memory Management & Long-Session Stability

- Executed 120 consecutive gameplay/transition/pause/settings/host-suspension/ad cycles in `tests/performance/LongSessionAndAdversarialStability.test.ts` (240 accepted swaps, 120 level launches, 120 interstitial ad requests):
  - Platform SDK listeners stayed pinned at `{ audio: 1, pause: 1, resume: 1 }` across all 120 cycles (zero per-scene leak) and dropped to `{ audio: 0, pause: 0, resume: 0 }` on disposal.
- Every Phaser scene detaches `Phaser.Scale.Events.RESIZE`, DOM `keydown`/`blur`/`focus` handlers, `ResponsiveLayoutService` subscriptions, `MotionPreferenceService` listeners, `AnimationCoordinator` tweens, and `LevelTransitionCoordinator` transactions cleanly inside `SHUTDOWN`.

---

## 5. Outstanding Bottlenecks & Unmeasured Environments

- **Phaser Core Engine Footprint:** `vendor-phaser-*.js` (`1.14 MiB` raw / `306.52 KiB` gzip) is the single largest remaining asset (49.7% of raw bundle); further reduction would require a custom Phaser build, which is unnecessary given our total gzipped game is already **999.02 KiB**.
- **Low-End Physical Mobile Profiling:** Real-device 30/60 FPS profiling and throttled 3G/4G startup measurements on low-end Android WebView and older iOS devices have **Not been measured** in this desktop CLI environment and remain a pre-launch QA task.
- **Adaptive Visual Quality:** Not needed on reference hardware (steady `60.0 FPS`, `0` frames `> 33.4 ms`, `effectiveDpr` already capped at `2`, decorative particle bursts strictly bounded).
