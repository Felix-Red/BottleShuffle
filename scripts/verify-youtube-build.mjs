import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const DIST_DIR = path.resolve(process.cwd(), 'dist');
const INDEX_HTML = path.join(DIST_DIR, 'index.html');
const OFFICIAL_SDK_SRC = 'https://www.youtube.com/game_api/v1';

const LIMITS = {
  initialHardMaxBytes: 30 * 1024 * 1024,
  initialRecommendedBytes: 15 * 1024 * 1024,
  totalHardMaxBytes: 250 * 1024 * 1024,
  singleFileHardMaxBytes: 30 * 1024 * 1024,
};

function walkFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(full));
    } else if (entry.isFile()) {
      results.push(full);
    }
  }
  return results;
}

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MiB (${String(bytes)} B)`;
  }
  return `${(bytes / 1024).toFixed(2)} KiB (${String(bytes)} B)`;
}

function run() {
  const errors = [];

  if (!fs.existsSync(INDEX_HTML)) {
    throw new Error('dist/index.html is missing. Run vite build first.');
  }

  const html = fs.readFileSync(INDEX_HTML, 'utf8');
  const sdkIdx = html.indexOf(OFFICIAL_SDK_SRC);
  const appScriptMatch = html.match(/<script\s+type="module"[^>]*>/i);
  const appScriptIdx = appScriptMatch ? html.indexOf(appScriptMatch[0]) : -1;

  if (sdkIdx === -1) {
    errors.push(
      `Missing official YouTube Playables SDK script (${OFFICIAL_SDK_SRC}) in dist/index.html.`,
    );
  }
  if (appScriptIdx === -1) {
    errors.push('Missing application module script tag in dist/index.html.');
  }
  if (sdkIdx !== -1 && appScriptIdx !== -1 && sdkIdx > appScriptIdx) {
    errors.push(
      'Official YouTube Playables SDK script must appear BEFORE application scripts in dist/index.html.',
    );
  }

  // Verify zero unauthorized external URLs in dist/index.html
  const externalUrls = [...html.matchAll(/https?:\/\/[^\s"'<>]+/gi)].map((m) => m[0]);
  for (const url of externalUrls) {
    if (url !== OFFICIAL_SDK_SRC) {
      errors.push(`Unexpected external URL in dist/index.html: ${url}`);
    }
  }

  const allFiles = walkFiles(DIST_DIR);
  let totalBytes = 0;
  let totalGzipBytes = 0;
  let initialBundleBytes = 0;
  let initialBundleGzipBytes = 0;
  let audioBytes = 0;
  let imageBytes = 0;
  let fontBytes = 0;
  let largestFile = { rel: '', bytes: 0 };

  const forbiddenDevStrings = [
    'Responsive Layout Diagnostics',
    'Save-Data Diagnostics',
    'Audio & Haptics Showcase',
    'Advertising Diagnostics',
    'AdvertisingShowcaseScene',
    'MockYouTubeSdk',
    'MockAdvertisingProvider',
    'Watch ad for 1 hint',
    'googlesyndication',
    'doubleclick.net',
    'pagead2',
    'applovin',
    'ironsrc',
    'unityads',
  ];

  for (const file of allFiles) {
    const rel = path.relative(DIST_DIR, file);
    const buf = fs.readFileSync(file);
    const bytes = buf.byteLength;
    const gzipBytes = zlib.gzipSync(buf, { level: 9 }).byteLength;

    totalBytes += bytes;
    totalGzipBytes += gzipBytes;

    if (bytes > largestFile.bytes) {
      largestFile = { rel, bytes };
    }

    if (bytes > LIMITS.singleFileHardMaxBytes) {
      errors.push(`File exceeds 30 MiB single-file limit: ${rel} (${formatBytes(bytes)})`);
    }

    if (rel.endsWith('.map')) {
      errors.push(`Source map found in production bundle: ${rel}`);
    }

    if (rel === 'index.html' || (rel.startsWith('assets/') && rel.endsWith('.js'))) {
      initialBundleBytes += bytes;
      initialBundleGzipBytes += gzipBytes;
    }

    if (
      rel.includes('/audio/') ||
      rel.endsWith('.m4a') ||
      rel.endsWith('.mp3') ||
      rel.endsWith('.ogg')
    ) {
      audioBytes += bytes;
    } else if (rel.endsWith('.png') || rel.endsWith('.webp') || rel.endsWith('.svg')) {
      imageBytes += bytes;
    } else if (rel.endsWith('.woff2') || rel.endsWith('.woff') || rel.endsWith('.ttf')) {
      fontBytes += bytes;
    }

    if (rel.endsWith('.js')) {
      const content = buf.toString('utf8');
      for (const forbidden of forbiddenDevStrings) {
        if (content.includes(forbidden)) {
          errors.push(
            `Development/test string "${forbidden}" leaked into production bundle: ${rel}`,
          );
        }
      }
    }
  }

  if (initialBundleBytes >= LIMITS.initialHardMaxBytes) {
    errors.push(`Initial bundle exceeds 30 MiB hard limit: ${formatBytes(initialBundleBytes)}`);
  }
  if (totalBytes >= LIMITS.totalHardMaxBytes) {
    errors.push(`Total bundle exceeds 250 MiB limit: ${formatBytes(totalBytes)}`);
  }

  console.log('=== YouTube Playables Production Build Audit ===');
  console.log(
    `SDK script before app JS : ${sdkIdx !== -1 && appScriptIdx !== -1 && sdkIdx < appScriptIdx ? 'PASS' : 'FAIL'}`,
  );
  console.log(`External URLs in HTML    : ${externalUrls.join(', ') || 'none'}`);
  console.log(`File count               : ${String(allFiles.length)}`);
  console.log(
    `Initial bundle (HTML+JS) : ${formatBytes(initialBundleBytes)} (gzip: ${formatBytes(initialBundleGzipBytes)})`,
  );
  console.log(
    `Total dist/ bundle       : ${formatBytes(totalBytes)} (gzip: ${formatBytes(totalGzipBytes)})`,
  );
  console.log(`Largest individual file  : ${largestFile.rel} — ${formatBytes(largestFile.bytes)}`);
  console.log(`Images total             : ${formatBytes(imageBytes)}`);
  console.log(`Audio total              : ${formatBytes(audioBytes)}`);
  console.log(`Fonts total              : ${formatBytes(fontBytes)}`);

  if (errors.length > 0) {
    console.error('\nBuild audit FAILED:');
    for (const err of errors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }

  console.log('\nYouTube Playables build audit PASSED.');
}

run();
