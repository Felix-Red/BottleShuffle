import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';

const ROOT = process.cwd();
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const VERSION = String(PKG.version);
const RELEASE_ID = `bottle-shuffle-${VERSION}`;
const ZIP_PATH = path.join(ROOT, 'release', 'packages', `${RELEASE_ID}.zip`);
const SHA_PATH = path.join(ROOT, 'release', 'packages', `${RELEASE_ID}.sha256`);
const SHOTS_DIR = path.join(ROOT, 'release', 'promotional', 'screenshots');
const CAPTURE_SHOTS = process.argv.includes('--capture-screenshots');
const LOCAL_MAC_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.m4a': 'audio/mp4',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

function buildSaveFixture(completedCount) {
  const completedLevels = {};
  for (let n = 1; n <= completedCount; n += 1) {
    const id = `level-${String(n).padStart(3, '0')}`;
    completedLevels[id] = {
      completionCount: 1,
      bestMoveCount: 3,
      bestElapsedMs: 14_000 + n * 150,
      bestScore: 1000,
      bestStarRating: 3,
      scoringPolicyVersion: 1,
    };
  }
  return JSON.stringify({
    schemaVersion: 2,
    gameId: 'bottle-shuffle',
    campaignCatalogVersion: '2.0.0',
    revision: 3,
    updatedAt: '2026-11-27T19:00:00.000Z',
    progression: {
      completedLevels,
      lastPlayedLevelId:
        completedCount > 0 ? `level-${String(completedCount).padStart(3, '0')}` : null,
    },
    settings: {
      musicEnabled: true,
      soundEffectsEnabled: true,
      vibrationEnabled: false,
      motionPreference: 'system',
    },
    tutorial: { status: 'completed', completed: true },
    seenChallengeIntros: ['timed', 'limited_moves', 'combined'],
  });
}

function startStaticServer(dir) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const reqPath = (req.url || '/').split('?')[0];
      const safeRel = reqPath === '/' ? 'index.html' : reqPath.replace(/^\/+/, '');
      const fullPath = path.join(dir, safeRel);
      if (
        !fullPath.startsWith(dir) ||
        !fs.existsSync(fullPath) ||
        fs.statSync(fullPath).isDirectory()
      ) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const ext = path.extname(fullPath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] ?? 'application/octet-stream' });
      fs.createReadStream(fullPath).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({ server, url: `http://127.0.0.1:${String(addr.port)}` });
    });
  });
}

async function stubSdk(page, inPlayablesEnv = false) {
  await page.route('https://www.youtube.com/game_api/v1*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `
        window.__SMOKE_YT__ = { readiness: [], loadCalls: 0, saveCalls: 0 };
        window.ytgame = {
          SDK_VERSION: '1.0.0-smoke',
          IN_PLAYABLES_ENV: ${inPlayablesEnv ? 'true' : 'false'},
          game: {
            firstFrameReady() { window.__SMOKE_YT__.readiness.push('firstFrameReady'); },
            gameReady() { window.__SMOKE_YT__.readiness.push('gameReady'); },
            loadData() { window.__SMOKE_YT__.loadCalls += 1; return Promise.resolve(''); },
            saveData() { window.__SMOKE_YT__.saveCalls += 1; return Promise.resolve(); },
          },
          system: {
            isAudioEnabled() { return true; },
            onAudioEnabledChange() { return () => {}; },
            onPause() { return () => {}; },
            onResume() { return () => {}; },
            getLanguage() { return Promise.resolve('en-US'); },
          },
          ads: {
            requestInterstitialAd() { return Promise.resolve(); },
            requestRewardedAd() { return Promise.resolve(false); },
          },
          health: { logError() {} },
        };
      `,
    });
  });
}

async function main() {
  if (!fs.existsSync(ZIP_PATH) || !fs.existsSync(SHA_PATH)) {
    throw new Error(
      `Release package missing (${ZIP_PATH}). Run "npm run package:release" before smoke testing.`,
    );
  }

  // 1. Verify SHA-256 checksum matches archive
  const expectedSha = fs.readFileSync(SHA_PATH, 'utf8').trim().split(/\s+/)[0];
  const actualSha = crypto.createHash('sha256').update(fs.readFileSync(ZIP_PATH)).digest('hex');
  if (expectedSha !== actualSha) {
    throw new Error(`SHA-256 mismatch! expected=${expectedSha} actual=${actualSha}`);
  }

  // 2. Extract ZIP archive to isolated temporary directory
  const extractDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bottle-shuffle-rc-smoke-'));
  execFileSync('unzip', ['-q', ZIP_PATH, '-d', extractDir]);

  if (!fs.existsSync(path.join(extractDir, 'index.html'))) {
    throw new Error('Extracted ZIP is missing index.html at root.');
  }

  if (CAPTURE_SHOTS) {
    fs.mkdirSync(SHOTS_DIR, { recursive: true });
  }

  const { server, url } = await startStaticServer(extractDir);
  const browser = await chromium.launch({
    headless: true,
    ...(fs.existsSync(LOCAL_MAC_CHROME) ? { executablePath: LOCAL_MAC_CHROME } : {}),
  });

  const consoleErrors = [];
  const failedRequests = [];

  try {
    // Pass 1: Fresh standalone launch + Home + Level Selection
    const ctx1 = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page1 = await ctx1.newPage();
    page1.on('pageerror', (e) => consoleErrors.push(e.message));
    page1.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text());
    });
    page1.on('response', (r) => {
      if (r.status() >= 400) failedRequests.push(`${String(r.status())} ${r.url()}`);
    });
    await stubSdk(page1, false);
    await page1.goto(url);
    await page1.waitForSelector('#game-container canvas');
    await page1.waitForTimeout(1100);
    if (CAPTURE_SHOTS) {
      await page1.screenshot({ path: path.join(SHOTS_DIR, '01-home-landscape-1280x720.png') });
    }

    // Click LEVELS button (Home landscape left column: x=245, y=434)
    await page1.mouse.click(245, 434);
    await page1.waitForTimeout(900);
    if (CAPTURE_SHOTS) {
      await page1.screenshot({ path: path.join(SHOTS_DIR, '03-levels-landscape-1280x720.png') });
    }
    await ctx1.close();

    // Pass 2: Returning player (12/50 completed, tutorial done) -> Home + Level 13 gameplay (5 bottles)
    const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page2 = await ctx2.newPage();
    page2.on('pageerror', (e) => consoleErrors.push(e.message));
    await stubSdk(page2, false);
    await page2.addInitScript(
      (payload) => globalThis.localStorage.setItem('bottle-shuffle.save', payload),
      buildSaveFixture(12),
    );
    await page2.goto(url);
    await page2.waitForSelector('#game-container canvas');
    await page2.waitForTimeout(1000);
    if (CAPTURE_SHOTS) {
      await page2.screenshot({ path: path.join(SHOTS_DIR, '02-home-returning-1280x720.png') });
    }

    // Click primary CONTINUE CTA (x=340, y=357) -> launches Level 13 gameplay
    await page2.mouse.click(340, 357);
    await page2.waitForTimeout(1100);
    if (CAPTURE_SHOTS) {
      await page2.screenshot({
        path: path.join(SHOTS_DIR, '04-gameplay-campaign-1280x720.png'),
      });
    }
    await ctx2.close();

    // Pass 3: Returning player at Level 41 (Expert 10 bottles) -> Landscape & Portrait gameplay
    const ctx3 = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page3 = await ctx3.newPage();
    page3.on('pageerror', (e) => consoleErrors.push(e.message));
    await stubSdk(page3, false);
    await page3.addInitScript(
      (payload) => globalThis.localStorage.setItem('bottle-shuffle.save', payload),
      buildSaveFixture(40),
    );
    await page3.goto(url);
    await page3.waitForSelector('#game-container canvas');
    await page3.waitForTimeout(900);
    await page3.mouse.click(340, 357); // CONTINUE -> Level 41 (Expert 10 bottles)
    await page3.waitForTimeout(1100);
    if (CAPTURE_SHOTS) {
      await page3.screenshot({ path: path.join(SHOTS_DIR, '05-gameplay-expert-1280x720.png') });
    }

    // Resize into mobile portrait (390x844) during Expert 10-bottle gameplay
    await page3.setViewportSize({ width: 390, height: 844 });
    await page3.waitForTimeout(700);
    if (CAPTURE_SHOTS) {
      await page3.screenshot({ path: path.join(SHOTS_DIR, '06-gameplay-portrait-390x844.png') });
    }
    await ctx3.close();

    // Pass 4: Extracted ZIP Playables SDK readiness & dev-route exclusion check
    const ctx4 = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page4 = await ctx4.newPage();
    page4.on('pageerror', (e) => consoleErrors.push(e.message));
    await stubSdk(page4, true);
    await page4.goto(`${url}/?scene=ads`);
    await page4.waitForSelector('#game-container canvas');
    await page4.waitForTimeout(1000);
    const ytSmoke = await page4.evaluate(() => globalThis.__SMOKE_YT__);
    if (ytSmoke.readiness.join(',') !== 'firstFrameReady,gameReady') {
      throw new Error(
        `Unexpected extracted-ZIP readiness sequence: ${ytSmoke.readiness.join(',')}`,
      );
    }
    if (ytSmoke.loadCalls !== 1 || ytSmoke.saveCalls !== 0) {
      throw new Error(`Unexpected extracted-ZIP cloud calls: ${JSON.stringify(ytSmoke)}`);
    }
    await ctx4.close();

    if (consoleErrors.length > 0 || failedRequests.length > 0) {
      throw new Error(
        `Extracted ZIP smoke test found errors: console=${JSON.stringify(consoleErrors)} net=${JSON.stringify(failedRequests)}`,
      );
    }

    console.log('=== Extracted ZIP Production Smoke Test PASSED ===');
    console.log(`Tested Archive  : release/packages/${RELEASE_ID}.zip`);
    console.log(`Verified SHA256 : ${actualSha}`);
    if (CAPTURE_SHOTS) {
      console.log(
        'Screenshots     : 6 production screenshots captured under release/promotional/screenshots/',
      );
    }
    console.log(`Readiness Order : ${ytSmoke.readiness.join(' -> ')}`);
    console.log('Console Errors  : 0 | Failed Network Requests : 0');
  } finally {
    await browser.close();
    server.close();
    fs.rmSync(extractDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
