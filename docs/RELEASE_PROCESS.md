# Bottle Shuffle — Production Release Process

This document defines the reproducible versioning, build, packaging, checksum verification, and release workflow for **Bottle Shuffle** targeting **YouTube Playables**.

---

## 1. Versioning Strategy

Bottle Shuffle follows **Semantic Versioning** (`MAJOR.MINOR.PATCH`, with `-rc.N` pre-release suffixes for certification candidates):

- **Release Candidates:** `1.0.0-rc.1`, `1.0.0-rc.2`, `1.0.0-rc.3` (used during internal QA, staging previews, and YouTube Playables certification).
- **Initial Launch Release:** `1.0.0` (promoted only after all certification gates pass).
- **Hotfixes & Bug Fixes:** `1.0.1`, `1.0.2` (strictly backwards-compatible).
- **Feature Updates:** `1.1.0`, `1.2.0` (must preserve existing player progress).

### Strict Separation of Version Numbers

Application release versions are intentionally decoupled from persisted and deterministic domain contracts so routine builds never invalidate player saves or puzzle seeds:

| Contract                       | Current Value | Source of Truth                                                 | Stability Policy                                                      |
| :----------------------------- | :------------ | :-------------------------------------------------------------- | :-------------------------------------------------------------------- |
| **Application Version**        | `1.0.0-rc.1`  | `package.json`, `src/config/appConfig.ts`, `game-metadata.json` | Bumped per release candidate / launch / hotfix                        |
| **Save Schema Version**        | `1`           | `src/core/persistence/SaveSchemaVersion.ts`                     | Bumped only on breaking save format changes with registered migration |
| **Puzzle Generator Version**   | `1.0.0`       | `src/core/engine/PuzzleGenerator.ts`                            | Frozen for `v1.x` so deterministic seeds reproduce identical puzzles  |
| **Scoring Policy Version**     | `1`           | `src/core/scoring/ScoringConfig.ts`                             | Frozen for `v1.x` so personal best comparisons remain consistent      |
| **Campaign Catalogue Version** | `1.0.0`       | `src/config/appConfig.ts` (`CAMPAIGN_CATALOG_VERSION`)          | Frozen for `v1.x` (`level-001` through `level-050`, 6 chapters)       |

`scripts/validate-metadata.mjs` automatically enforces that `package.json`, `src/config/appConfig.ts` (`APP_VERSION`), `release/metadata/game-metadata.json`, and `CHANGELOG.md` agree on the active application version.

---

## 2. Production vs Development Build Configuration

- **Production Command:** `npm run build:youtube` runs `tsc --noEmit && vite build --mode youtube && node scripts/verify-youtube-build.mjs`.
- **Relative Paths:** `vite.config.ts` sets `base: './'` so all bundled JS, WebP/PNG sprites, M4A audio, WOFF2 fonts, and `favicon.svg` load relative to `index.html`.
- **Code Splitting:** `phaser` is split into `assets/vendor-phaser-*.js`, isolated from application code (`assets/index-*.js`).
- **Development-Only Code Exclusion:** All 7 development showcase scenes (`?scene=showcase|assets|animations|audio|save|responsive|ads`), dev query overrides, and `DevVictoryPreview` are gated behind `if (import.meta.env.DEV)` and tree-shaken out of production builds.
- **No Source Maps:** Production builds emit `sourcemap: false` to keep bundles lean and prevent leaking internal source paths.
- **Official SDK Script Order:** `index.html` loads `<script src="https://www.youtube.com/game_api/v1"></script>` in `<head>` before any application `<script type="module">` bundle.

---

## 3. Release Scripts & Commands

| Command                     | Script                                        | Purpose                                                                                                                   |
| :-------------------------- | :-------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------ |
| `npm run qa`                | Chained QA gate                               | Format, lint, typecheck, Vitest, 50-level campaign solver, YouTube build, asset check, bundle analysis                    |
| `npm run validate:metadata` | `scripts/validate-metadata.mjs`               | Verifies version sync, description limits, prohibited copy claims, and promotional asset PNG dimensions                   |
| `npm run verify:release`    | `scripts/verify-release.mjs`                  | Verifies notices, changelog, single prod dependency (`phaser`), clean `dist/`, YouTube audit, assets, and metadata        |
| `npm run release:check`     | `qa` + `validate:metadata` + `verify:release` | Single-command pre-packaging gate                                                                                         |
| `npm run package:release`   | `scripts/package-release.mjs`                 | Builds the deterministic ZIP archive, `.sha256` checksum, and `-manifest.json` under `release/packages/`                  |
| `npm run smoke:release`     | `scripts/smoke-test-release.mjs`              | Verifies SHA-256, extracts the ZIP to a temp folder, serves over HTTP, and verifies launch, navigation, and SDK readiness |

---

## 4. Packaging Structure & Artefact Integrity

Running `npm run package:release` produces three immutable artefacts under `release/packages/` (refusing to overwrite an existing version unless `--force` is explicitly supplied):

1. **`release/packages/bottle-shuffle-<version>.zip`**
   - Contains **only** runtime files from `dist/` with **`index.html` at the archive root** (no parent wrapper directory, no `.DS_Store`, no `.map`, no `docs/`, `src/`, `tests/`, `artwork/`, `node_modules/`, or `release/`).
2. **`release/packages/bottle-shuffle-<version>.sha256`**
   - Standard `sha256sum` / `shasum -a 256` verification line for the `.zip` archive.
   - Verify integrity before upload:
     ```bash
     cd release/packages && shasum -a 256 -c bottle-shuffle-1.0.0-rc.1.sha256
     ```
3. **`release/packages/bottle-shuffle-<version>-manifest.json`**
   - Records `applicationVersion`, `saveSchemaVersion`, `puzzleGeneratorVersion`, `scoringPolicyVersion`, `campaignCatalogVersion`, `gitCommit`, `gitDirty`, `nodeVersion`, `buildTimestamp`, `compressedZipBytes`, `uncompressedBytes`, `fileCount`, `sha256`, and the sorted file inventory with per-file byte sizes.

---

## 5. CI Release Pipeline

`.github/workflows/release.yml` runs on manual `workflow_dispatch` or `v*` git tags with minimal `contents: read` permissions:

1. Runs `npm ci` and `npm run release:check`.
2. Installs Playwright Chromium and runs `npm run test:e2e`.
3. Runs `npm run package:release -- --force` and verifies `sha256sum -c`.
4. Runs `npm run smoke:release` against the extracted ZIP archive.
5. Uploads the `.zip`, `.sha256`, `-manifest.json`, and metadata manifests as workflow artefacts (`retention-days: 30`).

The workflow **never** publishes to YouTube Playables, **never** creates external GitHub releases, and **never** modifies developer accounts automatically.

---

## 6. Backwards Compatibility & Rollback Policy

- **Save Data:** Never mutate or delete existing keys in Save Schema `v1` without adding a deterministic migration in `SaveMigrationRegistry`. Existing campaign completion IDs (`level-001`..`level-050`) must remain stable.
- **Hotfix & Rollback:** Always archive every submitted `.zip` + `.sha256` + `-manifest.json` tagged in Git. If a post-launch defect occurs, prepare a new incremented patch release (`1.0.1`), pass `npm run release:check`, `npm run test:e2e`, and `npm run smoke:release`, and submit through the YouTube Playables Developer Portal (every update requires review; emergency halts or rollbacks must be coordinated via the Developer Portal or YouTube Partner Manager).
