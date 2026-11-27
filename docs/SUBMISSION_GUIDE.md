# Bottle Shuffle — YouTube Playables Submission & Operations Guide

This guide documents the manual steps required to take **Bottle Shuffle (`v1.0.0-rc.1`)** from an internally verified release candidate to official **YouTube Playables** certification and publication.

> **Important:** No automated script or agent publishes the game or modifies external developer accounts. All portal uploads, disclosures, and submissions must be performed manually by the authorised project owner.

---

## 1. Prerequisites Before Opening the Developer Portal

Complete these four owner actions before uploading `bottle-shuffle-1.0.0-rc.1.zip`:

1. **YouTube Playables Onboarding:** Confirm your partner/developer account has active access to the **YouTube Playables Developer Portal** (via YouTube's official onboarding / Interest Form).
2. **Replace Metadata Placeholders in `release/metadata/game-metadata.json`:**
   - Replace `"[OWNER_SUPPORT_EMAIL_REQUIRED]"` with a monitored support email address.
   - Publish a live privacy policy (using the draft in Section 5 below after your own legal review) and replace `"[OWNER_PRIVACY_POLICY_URL_REQUIRED]"`.
   - Confirm whether `"CrowdArcade"` is your final public publisher/developer display name (updating `src/config/appConfig.ts` and `release/metadata/game-metadata.json` if changed, then re-packaging as `1.0.0-rc.2`).
3. **Verify Archive Checksum:**
   ```bash
   cd release/packages && shasum -a 256 -c bottle-shuffle-1.0.0-rc.1.sha256
   ```
4. **Run Local Official Playables SDK Test Suite** (Section 2 below).

---

## 2. Manual Official YouTube Playables SDK Test Suite Verification

1. Extract `release/packages/bottle-shuffle-1.0.0-rc.1.zip` into a clean directory and serve it locally over HTTP (or run `npm run preview` after verifying `dist/` matches the ZIP).
2. Open the official **YouTube Playables SDK Test Suite** (`https://developers.google.com/youtube/gaming/playables/test_suite`) in a signed-in desktop Chrome session and point it at your served local URL.
3. Verify every official SDK check passes without errors:
   - `ytgame.IN_PLAYABLES_ENV === true` detected cleanly.
   - `ytgame.game.firstFrameReady()` fires once on initial render, followed strictly by `ytgame.game.gameReady()` once interactive.
   - `ytgame.game.loadData()` is awaited before any `ytgame.game.saveData()`, and zero `localStorage` writes occur.
   - Toggling the Test Suite's **Audio Mute** immediately silences all music and SFX and overrides in-game settings.
   - Triggering **Pause** suspends gameplay, timers, tweens, and audio; triggering **Resume** restores the exact prior state.
   - Completing Level 1 and tapping **Next Level** triggers `ytgame.ads.requestInterstitialAd()` cleanly (while Pause, Settings, Tutorial, Practice, Restart, and Replay never trigger ads).
   - Resizing across `9:16`, `16:9`, `1:1`, `3:4`, `9:32`, and `32:9` preserves full playability with zero clipping or scrollbars.
   - DevTools Network tab confirms zero unauthorized external requests and zero HTTP 4xx/5xx responses.
4. Repeat manual QA on **Firefox**, **Safari/WebKit**, and **physical iOS & Android devices** (via Developer Portal preview links inside the YouTube app), plus human playtesting per `docs/QA_TEST_PLAN.md`.

---

## 3. Official 4-Step YouTube Playables Developer Portal Submission Flow

Per official YouTube Playables Developer Portal documentation (verified 2026-11-27):

### Step 1 — Details

1. Upload `release/packages/bottle-shuffle-1.0.0-rc.1.zip` (or promoted `1.0.0.zip` once owner placeholders are resolved).
2. Confirm **`index.html`** is selected as the root entry point.
3. Enter the verified **Game Title**, **Short Description**, and **Full Description** from `release/metadata/game-metadata.json`.
4. Upload promotional thumbnails and icons from `release/promotional/icons/` and `release/promotional/thumbnails/` (re-exporting from the editable `.svg` sources if the authenticated portal displays specific per-slot pixel dimensions).
5. Declare supported languages honestly: **English (`en`)** only.
6. Complete the **Monetisation / Ads** configuration accurately (interstitial ads via official `ytgame.ads` at natural campaign transitions; no third-party ads or IAPs; rewarded ads not exposed in `v1.0.0`) and accessibility disclosures (colour-blind symbol coding, reduced motion, pointer + keyboard controls).

### Step 2 — Test

1. Generate a confidential **Preview Link** in the portal.
2. Test on desktop web and physical mobile YouTube apps (iOS & Android), verifying load time, touch responsiveness, cloud save restore across sessions, host mute, host pause/resume, and interstitial transitions.

### Step 3 — Age Rating

1. Complete the portal's official **Age / Content Rating** questionnaire honestly based on Bottle Shuffle's actual content:
   - Single-player abstract colour-and-symbol bottle sorting puzzle.
   - Zero violence, zero user-generated content, zero chat/multiplayer, zero gambling/simulated gambling, zero alcohol branding or drinking themes, zero in-app purchases.
2. Record the official rating certificate issued by the rating authority inside the portal (never fabricate ratings beforehand).

### Step 4 — Review & Publish

1. Review all uploaded details, preview test results, and age-rating outputs.
2. Click **Submit for review** (note: YouTube permits at most **10 games in review per channel** at a time; **Cancel review** is available if an issue is found before approval).
3. Remember that **all future updates** — including metadata-only updates — must pass through review.

---

## 4. Handling Certification Feedback & Future Updates

If Google's review team reports an issue:

1. Reproduce locally using the archived commit and ZIP from `release/packages/`.
2. Implement the fix cleanly without altering Save Schema `v1` or campaign level IDs (`level-001`..`level-050`).
3. Increment the version (`1.0.0-rc.1` -> `1.0.0-rc.2` -> `1.0.0-rc.3`) in `package.json`, `src/config/appConfig.ts`, `release/metadata/game-metadata.json`, and `CHANGELOG.md`.
4. Run the full verification pipeline:
   ```bash
   npm run release:check
   npm run test:e2e
   npm run package:release
   npm run smoke:release
   ```
5. Re-verify in the official Test Suite and re-upload the new ZIP archive.
6. **Post-Launch Rollbacks / Hotfixes:** Because every YouTube Playables update undergoes review, maintain archived `.zip` + `.sha256` packages for every shipped version, ship urgent fixes as incremented patch versions (`1.0.1`), and coordinate any emergency halt or rollback directly with the Developer Portal / YouTube Partner Manager.

---

## 5. Factual Data-Handling Summary & Draft Privacy Policy (Owner Legal Review Required)

> **DRAFT FOR OWNER LEGAL REVIEW ONLY — NOT LEGAL ADVICE.** The project owner must review, customise with their legal entity name and real contact email, and host this policy at a public HTTPS URL before submitting to YouTube Playables.

### Factual Data Handling Implemented in Bottle Shuffle `v1.0.0-rc.1`

- **Backend Servers:** None. Bottle Shuffle executes 100% client-side.
- **Personal Information (PII):** None collected, requested, stored, or transmitted. There are no user accounts, login flows, chat features, leaderboards, or third-party analytics SDKs.
- **Gameplay Save Data:** Stores only non-personal gameplay state (`schemaVersion: 1`): completed campaign level IDs (`level-001`..`level-050`), move counts, completion times, scores, star ratings, tutorial completion flag, and audio/vibration/motion preferences.
  - Inside **YouTube Playables**, this JSON payload (`<= 8.2 KiB`) is stored exclusively via `ytgame.game.saveData()` / `ytgame.game.loadData()` under YouTube's platform privacy framework (zero `localStorage` writes).
  - In **standalone web browsers**, this JSON payload is stored locally in the user's browser `localStorage` (`bottle-shuffle.save`) and never leaves the device.
- **Advertising:** Bottle Shuffle integrates only the official YouTube Playables SDK (`ytgame.ads`) for interstitial ads at natural campaign level transitions when enabled by YouTube. It includes zero third-party ad networks, tracking pixels, or off-platform payment SDKs.

### Draft Privacy Policy Text (Template)

> **Privacy Policy for Bottle Shuffle**
> _Effective Date: [INSERT DATE]_
>
> **[INSERT LEGAL PUBLISHER / DEVELOPER NAME]** ("we", "us") respects your privacy. **Bottle Shuffle** is a single-player logic puzzle game designed to operate without collecting personal information.
>
> **1. Information We Do Not Collect**
> Bottle Shuffle does not require account registration and does not collect, store, or transmit personally identifiable information such as your name, email address, location, device identifiers, or contacts. The game does not operate external backend servers or third-party analytics trackers.
>
> **2. Game Progress & Settings Storage**
> To save your puzzle progress, scores, stars, tutorial state, and audio/motion settings, Bottle Shuffle stores a small non-personal game save file:
>
> - When played on **YouTube Playables**, game progress is saved solely through the official YouTube Playables SDK (`ytgame.game.saveData` / `loadData`) in accordance with Google's and YouTube's privacy policies.
> - When played in a standalone web browser, game progress is stored locally in your browser's `localStorage` and remains on your device.
>
> **3. Advertising**
> When played on YouTube Playables, advertisements (such as pre-roll or between-level interstitial ads) may be served exclusively by YouTube through the official YouTube Playables platform. We do not integrate third-party advertising networks or tracking SDKs.
>
> **4. Children's Privacy**
> Because Bottle Shuffle does not collect personal data from any user, it does not knowingly collect personal information from children.
>
> **5. Contact**
> For questions or support requests regarding Bottle Shuffle, please contact: **[INSERT OWNER SUPPORT EMAIL]**.
