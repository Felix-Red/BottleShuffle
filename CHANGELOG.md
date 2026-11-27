# Changelog

All notable changes to **Bottle Shuffle** are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0-rc.1] — 2026-11-27

Initial release candidate prepared for YouTube Playables certification and staging QA.

### Added

- **Core Puzzle & Gameplay Engine:** Pure TypeScript deterministic puzzle generation (`v1.0.0`), Mulberry32 seeded PRNG, permutation-cycle minimum swap distance, tap-to-swap mechanics, hidden target sequences, and aggregate match-count feedback.
- **50-Level Campaign:** Six chapters across six difficulty tiers (`Beginner` 3 bottles through `Expert` 10 bottles), deterministic campaign seeds, sequential unlocking, chapter/campaign milestones, and level selection screen.
- **Interactive Tutorial:** First-time player guided onboarding teaching selection, swapping, and match counter deduction with skip and Settings replay support.
- **Practice Mode:** Unlimited randomised puzzles across all six difficulty tiers isolated from campaign records.
- **Scoring, Stars & Personal Bests:** Deterministic efficiency-based scoring (`policy v1`), three-star ratings, optimal solution detection, independent personal best tracking (best stars, score, moves, time), and animated Victory screen.
- **Audio, Haptics & Settings:** 15 original procedurally synthesised `.m4a` audio assets (2 seamless music loops + 13 SFX), autoplay-safe `AudioService`, optional capability-aware haptics (disabled inside Playables), centralised `SettingsService`, and OS + manual Reduced Motion support.
- **Persistence:** Versioned save schema (`v1`), `SaveService` single-writer coalescing queue, corruption/future-schema protection, standalone browser `LocalStorage` adapter, and exclusive YouTube Playables cloud storage (`ytgame.game.loadData` / `saveData`) with mandatory load-before-save guard.
- **Responsive Cross-Device Layouts:** Dynamic `Phaser.Scale.RESIZE` layout engine supporting landscape, portrait, square, and extreme YouTube Playables aspect ratios (`9:32` through `32:9`), 4-sided safe areas, and `>= 48px` touch targets.
- **YouTube Playables SDK & Monetisation Integration:** Official `https://www.youtube.com/game_api/v1` integration (`firstFrameReady` -> `gameReady`, authoritative host audio & pause/resume), eligible interstitial ad transitions via `ytgame.ads.requestInterstitialAd()`, ad-free fallback, and prepared (disabled in production UI) rewarded-ad infrastructure.
- **Release Tooling & CI:** Vitest v8 coverage, Playwright production E2E suite, 50-level campaign solver validator, 12,000-puzzle stress script, asset/bundle/metadata validators, reproducible ZIP + SHA-256 + release manifest packager, promotional artwork generator, and GitHub Actions CI/release workflows.

### Improved

- **Image Compression (`OPT-001`):** Converted all 10 bottle textures and selection glow to RGBA WebP (`0.94`/`0.92` quality), reducing runtime images by **84.2%** (`1.39 MiB` -> `226.03 KiB`) and total gzipped `dist/` size by **54.5%** (`2.15 MiB` -> `999.02 KiB`).
- **JavaScript Chunking (`OPT-002`):** Split `phaser` into a dedicated `vendor-phaser` chunk (`1.14 MiB` raw / `306.52 KiB` gzip) separate from application code (`548.29 KiB` raw / `127.97 KiB` gzip), eliminating Vite large-chunk warnings.
- **Accessibility Semantics (`DEF-002`):** Added `tabindex="0"` and descriptive pointer/keyboard `aria-label` to `#game-container`.

### Fixed

- **Missing Favicon 404 (`DEF-001`):** Added local `public/favicon.svg` (`336 B`) eliminating standalone `/favicon.ico` 404 network errors.

### Known Limitations

- Official hosted YouTube Playables SDK Test Suite, physical iOS/Android YouTube app WebView QA, Firefox/WebKit execution, human playtesting, and Developer Portal submission remain external manual gates prior to public `1.0.0` release.
- In-canvas Phaser UI controls are not directly traversable by screen readers without a mirrored DOM accessibility layer.
- Rewarded advertising buttons and hint/undo assistance mechanics are intentionally not exposed in `1.0.0-rc.1`.
