# Bottle Shuffle — Advertising & Monetisation Test Report

- **Verification Date:** 2026-11-27
- **Build Target:** `npm run build:youtube` (`dist/`, 44 files)
- **Observed Live Official SDK Version:** `1.20261116.0100` (`https://www.youtube.com/game_api/v1`)

---

## 1. Automated Unit & Integration Test Results (Vitest)

- **Full Regression + New Suite Result:** **73/73 test files passed, 311/311 tests passed** (`0` failures)
- **New Task 18 Test Suites:**
  - `tests/unit/advertising/AdPlacementPolicy.test.ts` — **9/9 passed**
    - Eligible campaign level transition (`campaign_level_transition`)
    - Coalesced chapter boundary transition (`chapter_transition`, single request)
    - Ineligible triggers suppressed (`active_gameplay`, `pause`, `resume`, `settings`, `restart`, `replay`, `new_practice_puzzle`, `view_levels`, `home`, `resize`, `boot`)
    - Tutorial and practice modes suppressed
    - Unfinished, uncommitted, or unpresented victory suppressed
    - Invalid, locked, or identical destination suppressed
    - Host-suspended and disabled config suppressed
    - Rewarded opt-in, production-UI disabled guard, and non-PII reward ID validation
  - `tests/unit/advertising/AdvertisingProvidersAndService.test.ts` — **5/5 passed**
    - YouTube technical capability detection (`interstitialAds`, `rewardedAds`) and missing `ytgame.ads` fallback
    - Standalone browser `NoOpAdvertisingProvider` immediate unavailable behavior
    - `YouTubeAdvertisingProvider` delegation and `AdErrorMapper` (`API_UNAVAILABLE`, `INVALID_PARAMS`, `SIZE_LIMIT_EXCEEDED`, `undefined` rejection)
    - Single active request lock blocking concurrent interstitial and rewarded calls + disabled config suppression
    - Diagnostic delayed-response watchdog (non-cancelling) + post-disposal stale callback discarding
  - `tests/unit/advertising/RewardedAdServiceAndTransition.test.ts` — **3/3 passed**
    - Production UI guard, explicit opt-in, valid reward IDs, single grant on `true`, zero grants on `false`/rejection, duplicate transaction ID deduplication
    - Host-suspended grant deferral + out-of-context earned reward preservation (`onPreserveEarnedReward`)
    - `LevelTransitionCoordinator` single launch, locked-destination rejection, duplicate tap blocking, failed-ad recovery, host pause/resume launch deferral, and post-disposal callback cancellation
  - `tests/integration/AdvertisingIntegration.test.ts` — **9/9 passed**
    - Journey 1: Successful campaign transition (score/progression -> save flush -> eligible interstitial -> single next-level launch)
    - Journey 2: Unavailable advertisement recovery with completion records preserved
    - Journey 3: Failed SDK request recovery with zero retry loops and intact progression
    - Journey 4: Repeated Next Level presses producing 1 ad request, 1 transaction, 1 launch
    - Journey 5: Host pause/resume interruption deferring next-level launch safely
    - Journey 6: Host mute audio authority preserved across ad transition into next level
    - Journey 7: Tutorial and practice transitions producing zero interstitials
    - Journey 8: Standalone browser ad-free campaign completion and navigation
    - Journey 9: Isolated rewarded simulation granting once on earned, zero on not-earned/failed, without mutating campaign progress

---

## 2. Production Bundle Audit (`npm run build:youtube`)

| Metric                                           | Observed Measurement                                                                                                                                                                                             | Limit / Requirement          | Status   |
| :----------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------- | :------- |
| SDK Script Order (`dist/index.html`)             | Official `https://www.youtube.com/game_api/v1` precedes app module JS                                                                                                                                            | Must load first              | **PASS** |
| External URLs in HTML / Runtime                  | Official `youtube.com/game_api/v1` -> `ytgame.js` only                                                                                                                                                           | Zero third-party ad networks | **PASS** |
| Initial Bundle (`index.html` + main JS)          | `1.68 MiB` (`1,758,894 B`) / gzip `435.27 KiB` (`445,719 B`)                                                                                                                                                     | `< 30 MiB` (`< 15 MiB` rec.) | **PASS** |
| Overhead vs Task 17 Baseline                     | `+26.1 KiB` raw / `+5.14 KiB` gzip                                                                                                                                                                               | Minimal overhead             | **PASS** |
| Total `dist/` Bundle (44 files)                  | `3.47 MiB` (`3,633,909 B`) / gzip `2.15 MiB` (`2,249,259 B`)                                                                                                                                                     | `< 250 MiB`                  | **PASS** |
| Third-Party Ad SDKs / Dev Mocks / Reward Buttons | `0` found (`verify-youtube-build.mjs` checks `AdvertisingShowcaseScene`, `MockAdvertisingProvider`, `Watch ad for 1 hint`, `googlesyndication`, `doubleclick.net`, `pagead2`, `applovin`, `ironsrc`, `unityads`) | Strictly excluded            | **PASS** |
| `src/core/` Purity & `ytgame` Isolation          | `0` DOM/Phaser/SDK references in `src/core/`; runtime `ytgame` access confined to `YouTubeSdkClient.ts`                                                                                                          | Clean Architecture           | **PASS** |

---

## 3. Headless Chrome Browser Verification Results

Verified using headless Google Chrome CDP against both Vite dev server and production `vite preview` (`dist/`):

| Scenario                                                             | Viewport   | Console / Page Errors | External Requests | Visual & Functional Outcome                                                                                      |
| :------------------------------------------------------------------- | :--------- | :-------------------- | :---------------- | :--------------------------------------------------------------------------------------------------------------- |
| Dev `?scene=ads` (clicks + live mid-scene resize)                    | `1280×720` | `0`                   | Official SDK only | PASS — live counters updated (`Interstitial=1`, `Rewarded=1`, `Launches=1`, `Synthetic Rewards=1`), crisp layout |
| Dev `?scene=ads` (portrait)                                          | `390×844`  | `0`                   | Official SDK only | PASS — portrait summary font scale refined so zero text overlap occurs above event log                           |
| Dev Victory Overlay (`?scene=game&level=level-001&devVictory=3star`) | `1280×720` | `0`                   | Official SDK only | PASS — polished victory layout intact, zero fake ad UI or unfinished reward buttons                              |
| Dev Victory Overlay (portrait)                                       | `390×844`  | `0`                   | Official SDK only | PASS — clean responsive victory overlay                                                                          |
| Production `dist/` Preview with `?scene=ads`                         | `1280×720` | `0`                   | Official SDK only | PASS — `?scene=ads` ignored in production; standard Home screen rendered cleanly                                 |

---

## 4. Official YouTube Playables SDK Test Suite Status

- **Status:** **Not executed in automated CLI environment (Blocked on interactive signed-in Google session & staging release configuration).**
- **Important Disclaimer:** Mock-based tests and local browser verification validate application architecture, placement policies, failure recovery, and lifecycle handling, but **do not** verify live YouTube advertisement delivery, ad fill, impression reporting, monetisation approval, or physical device playback.

### Manual Verification Steps for Official Test Suite

1. Run `npm run build:youtube && npm run preview` to serve `dist/` at `http://localhost:4173/`.
2. Open the official **YouTube Playables SDK Test Suite** (`https://developers.google.com/youtube/gaming/playables/test_suite`) in Chrome and connect it to `http://localhost:4173/`.
3. Verify `firstFrameReady()` -> `gameReady()`, cloud `loadData()` / `saveData()`, host mute (`isAudioEnabled` / `onAudioEnabledChange`), and host `onPause()` / `onResume()`.
4. Complete Level 1, verify Victory appears without triggering an ad, press **Next Level**, and confirm a single `ytgame.ads.requestInterstitialAd()` call occurs with `"Preparing next level..."` restrained button feedback and clean launch into Level 2.
5. Repeat with simulated ad error / unavailable and host pause during request in the Test Suite, confirming normal progression and zero duplicate launches.
6. Confirm zero interstitial calls occur during Tutorial, Practice, Pause, Settings, Restart, or Replay.

---

## 5. Task 19 Regression Update

- Re-verified across **77/77 Vitest files (323/323 tests)** including the **120-cycle long-session soak test** (`LongSessionAndAdversarialStability.test.ts`: 120 interstitial transitions across completed/unavailable/failed modes with `0` leaked listeners) and **10/10 Playwright E2E tests** confirming `?scene=ads` remains inaccessible in optimised production `dist/` (`2.29 MiB` total / `999.02 KiB` gzip). See [QA_REPORT.md](./QA_REPORT.md).
