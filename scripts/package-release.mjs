import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DIST_DIR = path.join(ROOT, 'dist');
const PACKAGES_DIR = path.join(ROOT, 'release', 'packages');

function walkFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

function safeExec(cmd, args) {
  try {
    return execFileSync(cmd, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'unknown';
  }
}

function main() {
  const forceOverwrite = process.argv.includes('--force');
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const metadata = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'release', 'metadata', 'game-metadata.json'), 'utf8'),
  );
  const version = String(pkg.version);
  const releaseId = `bottle-shuffle-${version}`;

  if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
    throw new Error('dist/index.html is missing. Run npm run build:youtube before packaging.');
  }

  // Run release verification before packaging
  execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'verify-release.mjs')], {
    stdio: 'inherit',
  });

  fs.mkdirSync(PACKAGES_DIR, { recursive: true });

  const zipName = `${releaseId}.zip`;
  const shaName = `${releaseId}.sha256`;
  const manifestName = `${releaseId}-manifest.json`;

  const zipPath = path.join(PACKAGES_DIR, zipName);
  const shaPath = path.join(PACKAGES_DIR, shaName);
  const manifestPath = path.join(PACKAGES_DIR, manifestName);

  if (fs.existsSync(zipPath) && !forceOverwrite) {
    throw new Error(
      `Release archive already exists: ${zipPath}. Pass --force only if regenerating an unreleased candidate.`,
    );
  }
  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }

  // Package directly from inside dist/ so index.html is at archive root (no outer folder!)
  execFileSync('zip', ['-r', '-q', '-X', zipPath, '.'], { cwd: DIST_DIR });

  // Verify archive entries via unzip -Z1 (exact file list)
  const zipEntries = execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' })
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.endsWith('/'));

  if (!zipEntries.includes('index.html')) {
    throw new Error('Packaged ZIP does not contain index.html at archive root!');
  }

  const distFiles = walkFiles(DIST_DIR).map((f) => path.relative(DIST_DIR, f));
  if (zipEntries.length !== distFiles.length) {
    throw new Error(
      `ZIP file count (${String(zipEntries.length)}) differs from dist/ (${String(distFiles.length)}).`,
    );
  }

  const prohibitedPatterns = [
    /\.map$/,
    /node_modules/,
    /^tests\//,
    /^src\//,
    /MockYouTubeSdk/,
    /MockAdvertisingProvider/,
    /\.env/,
  ];
  for (const entry of zipEntries) {
    for (const pat of prohibitedPatterns) {
      if (pat.test(entry)) {
        throw new Error(`Prohibited file found inside ZIP archive: ${entry}`);
      }
    }
  }

  const uncompressedBytes = walkFiles(DIST_DIR).reduce(
    (sum, file) => sum + fs.statSync(file).size,
    0,
  );
  const zipBuffer = fs.readFileSync(zipPath);
  const compressedBytes = zipBuffer.byteLength;
  const sha256 = crypto.createHash('sha256').update(zipBuffer).digest('hex');

  fs.writeFileSync(shaPath, `${sha256}  ${zipName}\n`, 'utf8');

  const manifest = {
    gameTitle: metadata.gameTitle,
    applicationVersion: version,
    releaseIdentifier: releaseId,
    gitCommit: safeExec('git', ['rev-parse', 'HEAD']),
    gitCommitShort: safeExec('git', ['rev-parse', '--short', 'HEAD']),
    buildTimestamp: new Date().toISOString(),
    nodeVersion: process.version,
    npmVersion: safeExec('npm', ['--version']),
    buildConfiguration: 'vite build --mode youtube',
    versions: metadata.versions,
    package: {
      filename: zipName,
      entryPoint: 'index.html',
      fileCount: zipEntries.length,
      uncompressedBytes,
      compressedBytes,
      sha256,
    },
    verificationStatus: {
      staticChecksAndUnitSuite: 'verified',
      campaignSolvability50Of50: 'verified',
      productionBuildAndAssetAudit: 'verified',
      playwrightProductionE2E: 'verified',
      officialYouTubeTestSuite: 'blocked_external_portal_access',
      physicalMobileDevices: 'not_tested',
      humanPlaytesting: 'not_tested',
    },
  };

  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  console.log('\n=== Bottle Shuffle Release Package Created ===');
  console.log(`Archive           : release/packages/${zipName}`);
  console.log(`Checksum          : release/packages/${shaName}`);
  console.log(`Manifest          : release/packages/${manifestName}`);
  console.log(`Root index.html   : VERIFIED`);
  console.log(`File count        : ${String(zipEntries.length)}`);
  console.log(
    `Uncompressed size : ${(uncompressedBytes / (1024 * 1024)).toFixed(2)} MiB (${String(uncompressedBytes)} B)`,
  );
  console.log(
    `Compressed ZIP    : ${(compressedBytes / (1024 * 1024)).toFixed(2)} MiB (${String(compressedBytes)} B)`,
  );
  console.log(`SHA-256           : ${sha256}`);
}

main();
