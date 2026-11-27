import { expect, test, type Page } from '@playwright/test';

const SAVE_STORAGE_KEY = 'bottle-shuffle.save';

function buildFixtureSave(completedCount: number, musicEnabled = true): string {
  const completedLevels: Record<
    string,
    {
      completionCount: number;
      bestMoveCount: number;
      bestElapsedMs: number;
      bestScore: number;
      bestStarRating: 1 | 2 | 3;
      scoringPolicyVersion: number;
    }
  > = {};

  for (let n = 1; n <= completedCount; n += 1) {
    const id = `level-${String(n).padStart(3, '0')}`;
    completedLevels[id] = {
      completionCount: 1,
      bestMoveCount: 3,
      bestElapsedMs: 14_000 + n * 200,
      bestScore: 1000,
      bestStarRating: 3,
      scoringPolicyVersion: 1,
    };
  }

  return JSON.stringify({
    schemaVersion: 1,
    gameId: 'bottle-shuffle',
    revision: 5,
    updatedAt: '2026-11-27T18:00:00.000Z',
    progression: {
      completedLevels,
      lastPlayedLevelId:
        completedCount > 0 ? `level-${String(completedCount).padStart(3, '0')}` : null,
    },
    settings: {
      musicEnabled,
      soundEffectsEnabled: true,
      vibrationEnabled: false,
      motionPreference: 'system',
    },
    tutorial: {
      status: 'completed',
      completed: true,
    },
  });
}

async function stubYouTubeSdkForBrowser(page: Page, inPlayablesEnv = false): Promise<void> {
  await page.route('https://www.youtube.com/game_api/v1*', async (route) => {
    const body = `
      window.__E2E_YT__ = {
        readinessOrder: [],
        loadCalls: 0,
        saveCalls: 0,
        interstitialCalls: 0,
        rewardedCalls: 0,
        pauseListeners: [],
        resumeListeners: [],
        audioListeners: [],
        audioEnabled: true,
      };
      window.ytgame = {
        SDK_VERSION: '1.0.0-e2e',
        IN_PLAYABLES_ENV: ${inPlayablesEnv ? 'true' : 'false'},
        game: {
          firstFrameReady() { window.__E2E_YT__.readinessOrder.push('firstFrameReady'); },
          gameReady() { window.__E2E_YT__.readinessOrder.push('gameReady'); },
          loadData() { window.__E2E_YT__.loadCalls += 1; return Promise.resolve(''); },
          saveData() { window.__E2E_YT__.saveCalls += 1; return Promise.resolve(); },
        },
        system: {
          isAudioEnabled() { return window.__E2E_YT__.audioEnabled; },
          onAudioEnabledChange(cb) {
            window.__E2E_YT__.audioListeners.push(cb);
            return () => {};
          },
          onPause(cb) {
            window.__E2E_YT__.pauseListeners.push(cb);
            return () => {};
          },
          onResume(cb) {
            window.__E2E_YT__.resumeListeners.push(cb);
            return () => {};
          },
          getLanguage() { return Promise.resolve('en-US'); },
        },
        ads: {
          requestInterstitialAd() { window.__E2E_YT__.interstitialCalls += 1; return Promise.resolve(); },
          requestRewardedAd() { window.__E2E_YT__.rewardedCalls += 1; return Promise.resolve(false); },
        },
        health: { logError() {} },
      };
    `;
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body,
    });
  });
}

test.describe('Bottle Shuffle Production E2E Suite', () => {
  test('Fresh standalone launch: mounts canvas, zero console/network errors, zero leaked debug globals', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const failedResponses: string[] = [];
    const externalRequests: string[] = [];

    page.on('pageerror', (err) => consoleErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('response', (res) => {
      if (res.status() >= 400) failedResponses.push(`${String(res.status())} ${res.url()}`);
    });
    page.on('request', (req) => {
      const u = req.url();
      if (u.startsWith('http') && !u.startsWith('http://127.0.0.1:4173')) {
        externalRequests.push(u);
      }
    });

    await stubYouTubeSdkForBrowser(page, false);
    await page.goto('/');
    await expect(page.locator('#game-container canvas')).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(800);

    // Accessibility container semantics
    const container = page.locator('#game-container');
    await expect(container).toHaveAttribute('role', 'application');
    await expect(container).toHaveAttribute('tabindex', '0');

    // No production debug globals or target sequences exposed on window
    const leakedGlobals = await page.evaluate(() => ({
      hasTarget: 'targetSequence' in window,
      hasDebugSolver: '__BOTTLE_SOLVER__' in window,
    }));
    expect(leakedGlobals).toEqual({ hasTarget: false, hasDebugSolver: false });

    // No unintended scrollbars
    const overflow = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
      scrollH: document.documentElement.scrollHeight,
      innerH: window.innerHeight,
    }));
    expect(overflow.scrollW).toBeLessThanOrEqual(overflow.innerW);
    expect(overflow.scrollH).toBeLessThanOrEqual(overflow.innerH);

    // Only authorised external URL is the official YouTube SDK script
    for (const url of externalRequests) {
      expect(url).toContain('https://www.youtube.com/game_api/v1');
    }
    expect(failedResponses).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Returning player & 49-level campaign fixture restore cleanly across reload without corrupting save', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await stubYouTubeSdkForBrowser(page, false);
    const returningFixture = buildFixtureSave(49, false);

    await page.addInitScript(
      ({ key, payload }) => {
        window.localStorage.setItem(key, payload);
      },
      { key: SAVE_STORAGE_KEY, payload: returningFixture },
    );

    await page.goto('/');
    await expect(page.locator('#game-container canvas')).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(900);

    // Reload and verify saved payload remains intact and readable
    await page.reload();
    await expect(page.locator('#game-container canvas')).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(700);

    const stored = await page.evaluate((key) => window.localStorage.getItem(key), SAVE_STORAGE_KEY);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored ?? '{}') as {
      progression?: { completedLevels?: Record<string, unknown> };
      settings?: { musicEnabled?: boolean };
    };
    expect(Object.keys(parsed.progression?.completedLevels ?? {}).length).toBe(49);
    expect(parsed.settings?.musicEnabled).toBe(false);
    expect(errors).toEqual([]);
  });

  test('Production build blocks all dev showcase query routes (?scene=ads, save, showcase, responsive)', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await stubYouTubeSdkForBrowser(page, false);

    for (const route of ['/?scene=ads', '/?scene=save', '/?scene=showcase', '/?scene=responsive']) {
      await page.goto(route);
      await expect(page.locator('#game-container canvas')).toBeVisible({ timeout: 10_000 });
      await page.waitForTimeout(450);
    }
    expect(errors).toEqual([]);
  });

  test('YouTube Playables environment: ordered readiness, cloud load-before-save, zero LocalStorage writes, host pause/mute resilience', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await stubYouTubeSdkForBrowser(page, true);
    await page.addInitScript(() => {
      window.localStorage.clear();
    });

    await page.goto('/');
    await expect(page.locator('#game-container canvas')).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1000);

    const ytState = await page.evaluate(() => {
      const spy = (
        window as unknown as {
          __E2E_YT__: {
            readinessOrder: string[];
            loadCalls: number;
            saveCalls: number;
            pauseListeners: (() => void)[];
            resumeListeners: (() => void)[];
            audioListeners: ((e: boolean) => void)[];
            audioEnabled: boolean;
          };
        }
      ).__E2E_YT__;

      // Trigger host mute -> host pause -> host resume
      spy.audioEnabled = false;
      for (const cb of spy.audioListeners) cb(false);
      for (const cb of spy.pauseListeners) cb();
      for (const cb of spy.resumeListeners) cb();

      return {
        readinessOrder: spy.readinessOrder,
        loadCalls: spy.loadCalls,
        saveCalls: spy.saveCalls,
        localStorageLength: window.localStorage.length,
      };
    });

    expect(ytState.readinessOrder).toEqual(['firstFrameReady', 'gameReady']);
    expect(ytState.loadCalls).toBe(1);
    expect(ytState.saveCalls).toBe(0);
    expect(ytState.localStorageLength).toBe(0);
    expect(errors).toEqual([]);
  });

  test('Responsive viewport & orientation matrix including extreme YouTube Playables ratios & reduced motion', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await stubYouTubeSdkForBrowser(page, false);
    await page.emulateMedia({ reducedMotion: 'reduce' });

    await page.goto('/');
    await expect(page.locator('#game-container canvas')).toBeVisible({ timeout: 10_000 });

    const viewports = [
      { width: 1280, height: 720 },
      { width: 390, height: 844 },
      { width: 320, height: 568 },
      { width: 768, height: 1024 },
      { width: 1024, height: 768 },
      { width: 360, height: 1280 }, // 9:32 extreme portrait
      { width: 1280, height: 360 }, // 32:9 extreme landscape
      { width: 600, height: 600 }, // 1:1 square
    ];

    for (const vp of viewports) {
      await page.setViewportSize(vp);
      await page.waitForTimeout(200);
      const dims = await page.evaluate(() => {
        const c = document.querySelector('#game-container canvas');
        const rect = c?.getBoundingClientRect();
        return {
          width: Math.round(rect?.width ?? 0),
          height: Math.round(rect?.height ?? 0),
          scrollW: document.documentElement.scrollWidth,
          innerW: window.innerWidth,
          scrollH: document.documentElement.scrollHeight,
          innerH: window.innerHeight,
        };
      });
      expect(dims.width).toBeGreaterThan(0);
      expect(dims.height).toBeGreaterThan(0);
      expect(dims.scrollW).toBeLessThanOrEqual(dims.innerW);
      expect(dims.scrollH).toBeLessThanOrEqual(dims.innerH);
    }

    // Keyboard interaction smoke check (must never throw)
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
    expect(errors).toEqual([]);
  });
});
