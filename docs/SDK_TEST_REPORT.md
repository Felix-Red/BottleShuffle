# YouTube Playables SDK Integration Test Report

- **Date:** 2026-11-27
- **Build Target:** `npm run build:youtube` (`dist/`, 44 files)
- **Observed Live Official SDK Version:** `1.20261116.0100` (from `https://www.youtube.com/game_api/v1` -> `https://www.youtube.com/s/ytgame/2784cb76/ytgame.js`)

---

## 1. Automated Unit & Integration Test Results (Vitest + MockYouTubeSdk)

- **Suite Result:** **69/69 test files passed, 285/285 tests passed** (`1.86s` wall time)
- **New Task 17 Suites:**
  - `tests/unit/platform/YouTubePlatformAndCapabilities.test.ts` — **6/6 passed**
    - Environment detection (SDK absent, `IN_PLAYABLES_ENV: false`, `IN_PLAYABLES_ENV: true`, incomplete SDK inside Playables without LocalStorage fallback, mock injection)
    - Capability restrictions (no LocalStorage, no haptics, no score reporting, no ads, language fallback)
    - Readiness gating & ordering (`firstFrameReady` -> `gameReady`, idempotent once per app lifecycle)
    - Listener single registration, callback deduplication, health error throttling, clean disposal
  - `tests/unit/platform/YouTubeSaveStorage.test.ts` — **5/5 passed**
    - Mandatory load-before-save blocking before `load()` and after failed `load()`
    - Official empty-string `""` -> `null` handling
    - Pre-SDK rejection of lone-surrogate malformed UTF-16 and `> 3 MiB` payloads
    - `SdkErrorType` (`API_UNAVAILABLE`, `SIZE_LIMIT_EXCEEDED`, `INVALID_PARAMS`) & unpopulated rejection mapping
    - Zero `localStorage` access verified via throwing property trap
  - `tests/integration/YouTubePlatformIntegration.test.ts` — **8/8 passed**
    - Journey 1: First YouTube launch (`firstFrameReady` -> `loadData` -> `gameReady`)
    - Journey 2: Existing cloud progress restoration without duplicate achievement events
    - Journey 3: Level completion -> cloud `saveData` -> fresh-service reload restoration
    - Journey 4: Failed cloud load -> `autoWriteBlocked`, `0` `saveData` calls, existing cloud data preserved
    - Journey 5: Host mute overrides in-game settings; unmute restores only permitted audio
    - Journeys 6 & 7: Host pause mid-swap reconciles cleanly, freezes clock, blocks input, and preserves manual pause across host resume
    - Journey 8: Browser regression outside Playables (`BrowserGamePlatform` + `BrowserSaveStorage`)
    - Certification aspect ratios (`9:32`, `9:21`, `9:16`, `3:4`, `1:1`, `4:3`, `16:9`, `21:9`, `32:9`, plus `0×0` container)

---

## 2. Production Build Audit & Measurements (`npm run build:youtube`)

| Metric                                    | Observed Measurement                                                                                                    | Official Limit / Guidance                            | Status   |
| :---------------------------------------- | :---------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------- | :------- |
| SDK Script Order (`dist/index.html`)      | `<script src="https://www.youtube.com/game_api/v1">` precedes `<script type="module" src="./assets/index-D53AxF2q.js">` | SDK must load first                                  | **PASS** |
| External Network Requests (CDP Audit)     | `https://www.youtube.com/game_api/v1` -> `ytgame.js` only                                                               | Official SDK only                                    | **PASS** |
| Initial Bundle (`index.html` + main JS)   | `1.65 MiB` (`1,732,133 B`) / gzip `430.13 KiB` (`440,458 B`)                                                            | `< 30 MiB` (`< 15 MiB` rec.)                         | **PASS** |
| Total `dist/` Bundle (44 files)           | `3.44 MiB` (`3,607,148 B`) / gzip `2.14 MiB` (`2,243,998 B`)                                                            | `< 250 MiB`                                          | **PASS** |
| Largest Individual File                   | `assets/index-D53AxF2q.js` — `1.65 MiB` (`1,729,778 B`)                                                                 | `< 30 MiB`                                           | **PASS** |
| Total Images / Audio / Fonts              | `1.39 MiB` / `289.36 KiB` / `106.33 KiB`                                                                                | Local bundled, relative paths                        | **PASS** |
| Dev Showcases / Mocks / Source Maps       | `0` found in `dist/`                                                                                                    | Excluded from production                             | **PASS** |
| Save Payload Size (Empty / Full 50-Level) | `323 B` / `7,080 B` (`6.91 KiB`)                                                                                        | `< 3 MiB` (`< 500 KiB` rec.; `<= 64 KiB` exit flush) | **PASS** |

---

## 3. Headless Chrome Production Runtime Measurements

Executed against `vite preview` serving `dist/`:

- **Standalone browser mode (with live official `ytgame` v1 script loaded):**
  - `ytgame` defined: `true`, `SDK_VERSION: "1.20261116.0100"`, `IN_PLAYABLES_ENV: false`
  - Selected adapter: `BrowserGamePlatform`, canvas mounted, `0` console errors, `0` page errors
  - JS Heap (`performance.memory`): `16.18 MB` used / `22.85 MB` total (limit: `< 512 MB`)
- **Simulated Playables host harness (`IN_PLAYABLES_ENV: true`):**
  - `firstFrameReady()`: `1` call at **`611 ms`**
  - `gameReady()`: `1` call at **`694 ms`** (target: `< 5,000 ms`)
  - Readiness sequence: `['firstFrameReady', 'gameReady']`
  - `loadData()` calls: `1`; `saveData()` calls on fresh empty launch: `0`
  - Host listener registrations (`audio` / `pause` / `resume`): `1` / `1` / `1`
  - JS Heap (`performance.memory`): `21.90 MB` used / `35.95 MB` total

---

## 4. Official Hosted Playables SDK Test Suite Status

- **Status:** **Blocked in automated CLI environment** (no interactive signed-in desktop browser session accessing `https://developers.google.com/youtube/gaming/playables/test_suite` against local `localhost:4173`).
- **Required Manual Action:** Follow Section 7 of [YOUTUBE_PLAYABLES.md](./YOUTUBE_PLAYABLES.md) to run `npm run build:youtube && npm run preview` and execute the hosted Test Suite checklist before Developer Portal submission. Mock-based tests and local audits do **not** replace official Test Suite validation or Google certification.

---

## 5. Task 18 Update — Advertising & Monetisation Verification

- Updated full automated suite: **73/73 test files passed, 311/311 tests passed** (adding `AdPlacementPolicy.test.ts`, `AdvertisingProvidersAndService.test.ts`, `RewardedAdServiceAndTransition.test.ts`, and 9-journey `AdvertisingIntegration.test.ts`).
- Updated `npm run build:youtube` measurements: Initial bundle **`1.68 MiB`** (`435.27 KiB` gzip), total `dist/` bundle **`3.47 MiB`** (`2.15 MiB` gzip), `0` third-party ad networks, `0` leaked dev showcases/mocks.
- See [ADVERTISING_TEST_REPORT.md](./ADVERTISING_TEST_REPORT.md) and [MONETIZATION.md](./MONETIZATION.md) for complete advertising verification evidence and manual Test Suite steps.

---

## 6. Task 19 Update — Comprehensive QA, E2E & Optimised Build

- Full automated suite expanded to **77/77 Vitest files (323/323 tests, 83.85% line coverage)** + **10/10 Playwright production E2E tests** (including route-intercepted YouTube Playables readiness order `firstFrameReady` -> `gameReady`, cloud `loadData` before `saveData`, zero `localStorage` writes, and extreme aspect ratios `9:32`, `32:9`, `1:1`).
- Optimised `npm run build:youtube`: **`2.29 MiB`** total (`999.02 KiB` gzip, `-54.5%` gzip reduction), `0` failed network requests (`public/favicon.svg` added), `firstFrameReady` `211 ms` / `gameReady` `320 ms`. See [QA_REPORT.md](./QA_REPORT.md) and [PERFORMANCE_REPORT.md](./PERFORMANCE_REPORT.md).
