# Bottle Shuffle — Release Candidate Report (`v1.0.0-rc.1`)

- **Application Version:** `1.0.0-rc.1`
- **Release Identifier:** `bottle-shuffle-1.0.0-rc.1`
- **Build Date:** 2026-11-27
- **Target Platform:** YouTube Playables (HTML5) & Standalone Desktop/Mobile Web
- **Contract Versions:** Save Schema `v1` · Puzzle Generator `1.0.0` · Scoring Policy `v1` · Campaign Catalogue `1.0.0` (50 levels, 6 chapters)
- **Reference Build Environment:** macOS 27.2.1 (`arm64`, Apple M1 Pro, 16 GiB RAM), Node.js `v26.0.0`, Google Chrome `158.0.8127.89`

---

## 1. Release Readiness Classification

| Classification Tier             | Status                                                                                                                                                           |
| :------------------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Release Candidate Generated** | **YES** — Reproducible ZIP, SHA-256, manifest, metadata, and promo assets created                                                                                |
| **Internally Verified**         | **YES** — All automated QA, unit/integration, coverage, E2E, campaign, stress, and extracted-ZIP smoke checks pass                                               |
| **Submission-Ready**            | **NO (Blocked by external manual gates)** — Requires owner metadata values, hosted Playables Test Suite, cross-browser/physical mobile QA, and human playtesting |

---

## 2. Packaged Release Artefacts

| Artefact                               | Observed Value                                                           |
| :------------------------------------- | :----------------------------------------------------------------------- |
| **Archive Path**                       | `release/packages/bottle-shuffle-1.0.0-rc.1.zip`                         |
| **Checksum File**                      | `release/packages/bottle-shuffle-1.0.0-rc.1.sha256`                      |
| **Manifest File**                      | `release/packages/bottle-shuffle-1.0.0-rc.1-manifest.json`               |
| **SHA-256 Digest**                     | `51713cb9e8c935ae340d51dc50371df9fa50b79fbb4e09070f0c708c66f91466`       |
| **Archive Root Entry**                 | `index.html` (verified directly at ZIP root)                             |
| **Compressed ZIP Size**                | **`0.98 MiB`** (`1,031,852 B`)                                           |
| **Uncompressed Bundle Size**           | **`2.29 MiB`** (`2,404,674 B`) across **`47` files**                     |
| **Initial Bundle (`index.html` + JS)** | **`1.68 MiB`** (`1,759,255 B`) / **`435.91 KiB`** gzip (`< 15 MiB` rec.) |
| **Largest Individual File**            | `assets/vendor-phaser-BdPmfaKR.js` (`1.14 MiB` raw / `306.52 KiB` gzip)  |
| **Runtime Asset Categories**           | Images `226.03 KiB` · Audio `289.36 KiB` · Fonts `106.33 KiB`            |

---

## 3. Automated Verification & Smoke Test Summary

| Check                                                      |  Result  | Observed Evidence                                                                                                                                                |
| :--------------------------------------------------------- | :------: | :--------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prettier Formatting (`npm run format:check`)               | **PASS** | `0` formatting issues                                                                                                                                            |
| ESLint Strict Type-Checked (`npm run lint`)                | **PASS** | `0` errors, `0` warnings                                                                                                                                         |
| TypeScript Strict (`npm run typecheck`)                    | **PASS** | `0` errors                                                                                                                                                       |
| Vitest Unit, Integration & Performance (`npm test`)        | **PASS** | **77/77** test files passed, **323/323** tests passed (`0` failed, `0` skipped)                                                                                  |
| Vitest v8 Coverage (`npm run test:coverage`)               | **PASS** | **83.85%** overall lines (**95.32%** core engine, **88.10%** scoring/progression, **93.75%** lifecycle)                                                          |
| 50-Level Campaign Validation (`npm run validate:campaign`) | **PASS** | **50/50** validated & solved in exact `minimumSwapDistance`; max save payload `8,179 B`                                                                          |
| 12,000-Puzzle Stress Test (`npm run test:stress`)          | **PASS** | **12,000/12,000** passed across 6 tiers (`0` failures; slowest `0.581 ms`)                                                                                       |
| Production Build & YouTube Audit (`npm run build:youtube`) | **PASS** | SDK script order verified, `0` unauthorised URLs, `0` dev showcases/mocks/source maps                                                                            |
| Runtime Asset Audit (`npm run validate:assets`)            | **PASS** | `39` referenced assets verified, `0` missing, `0` unused, `0` duplicate binaries                                                                                 |
| Metadata & Promo Validation (`npm run validate:metadata`)  | **PASS** | Version sync verified, prohibited claims clean, all 11 promotional PNG headers verified                                                                          |
| Release Verification (`npm run verify:release`)            | **PASS** | `THIRD_PARTY_NOTICES.md`, `CHANGELOG.md`, single runtime dep (`phaser`), clean `dist/`                                                                           |
| Playwright Production E2E (`npm run test:e2e`)             | **PASS** | **10/10** passed across Desktop (`1280×720`) & Mobile Touch (`390×844`)                                                                                          |
| Extracted-ZIP Smoke Test (`npm run smoke:release`)         | **PASS** | SHA-256 verified, extracted ZIP served over HTTP, Home/Levels/Campaign/Expert/Portrait verified, `firstFrameReady -> gameReady`, `0` console errors, `0` 4xx/5xx |
| Dependency Security Audit (`npm audit`)                    | **PASS** | `0` vulnerabilities                                                                                                                                              |

---

## 4. Promotional Assets & Licensing Status

- **Icons (`release/promotional/icons/`):** `icon-source.svg`, `icon-512x512.png`, `icon-1024x1024.png` — visually inspected; zero third-party or YouTube logos.
- **Thumbnails (`release/promotional/thumbnails/`):** `thumbnail-16x9-1280x720.png`, `thumbnail-1x1-1024x1024.png`, `thumbnail-3x4-900x1200.png` (+ SVG sources) — visually inspected; authentic Bottle Shuffle visuals, zero misleading claims or external branding.
- **Production Screenshots (`release/promotional/screenshots/`):** 6 real screenshots captured directly from the extracted `bottle-shuffle-1.0.0-rc.1.zip` release build (Fresh Home, Returning Home, Level Selection, Level 13 5-Bottle Campaign, Level 41 10-Bottle Expert Landscape, Level 41 10-Bottle Expert Mobile Portrait `390×844`).
- **Third-Party Notices (`THIRD_PARTY_NOTICES.md`):** Documents Phaser 3.90 (MIT full text), YouTube Playables SDK v1, Fredoka & Nunito fonts (SIL OFL 1.1), original artwork/audio, and dev-only tooling.

---

## 5. Remaining Pre-Submission Blockers

1. Supply real owner values for `supportContact` and `privacyPolicyUrl` in `release/metadata/game-metadata.json` (and publish the owner-reviewed privacy policy).
2. Confirm final public publisher display name (`CrowdArcade` is currently provisional).
3. Run Google's hosted **YouTube Playables SDK Test Suite** against the extracted release build in a signed-in browser session.
4. Execute cross-browser QA (Firefox, WebKit/Safari), physical iOS/Android YouTube app WebView testing, and human playtesting.
5. Confirm exact promotional thumbnail pixel slots inside the authenticated Developer Portal **Details** step, complete the Age Rating questionnaire, and manually submit for Google certification review.
