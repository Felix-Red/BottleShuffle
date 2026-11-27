import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';

const ROOT = process.cwd();
const PUBLIC_ASSETS = path.join(ROOT, 'public', 'assets');
const DIST_ASSETS = path.join(ROOT, 'dist', 'assets');
const MAX_SINGLE_ASSET_BYTES = 2 * 1024 * 1024;

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

async function main() {
  const errors = [];
  const server = await createServer({
    logLevel: 'silent',
    server: { middlewareMode: true },
    appType: 'custom',
  });

  try {
    const manifestMod = await server.ssrLoadModule('/src/game/assets/AssetManifest.ts');
    const audioCatalogMod = await server.ssrLoadModule('/src/services/audio/AudioCatalog.ts');

    const referencedPaths = new Set();

    for (const entry of manifestMod.ASSET_MANIFEST) {
      referencedPaths.add(entry.path.replace(/^\.\/assets\//, ''));
    }
    for (const entry of audioCatalogMod.AUDIO_CATALOG) {
      referencedPaths.add(entry.path.replace(/^\.\/assets\//, ''));
    }

    // Parse font URLs from index.html
    const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    for (const match of indexHtml.matchAll(/url\(['"]?\.?\/?assets\/([^'")]+)['"]?\)/g)) {
      referencedPaths.add(match[1]);
    }

    // Required license/attribution files allowed in public/assets
    const allowedLicenseFiles = new Set([
      'fonts/fredoka/OFL.txt',
      'fonts/nunito/OFL.txt',
      'audio/ATTRIBUTION.md',
    ]);

    // 1. Verify every referenced asset exists in public/assets and (if built) dist/assets
    const hasDist = fs.existsSync(DIST_ASSETS);
    for (const rel of referencedPaths) {
      const pubFile = path.join(PUBLIC_ASSETS, rel);
      if (!fs.existsSync(pubFile)) {
        errors.push(`Missing referenced asset in public/assets/: ${rel}`);
      } else {
        const size = fs.statSync(pubFile).size;
        if (size === 0) errors.push(`Zero-byte asset: public/assets/${rel}`);
        if (size > MAX_SINGLE_ASSET_BYTES) {
          errors.push(
            `Asset exceeds 2 MiB internal target: public/assets/${rel} (${String(size)} B)`,
          );
        }
      }

      if (hasDist) {
        const distFile = path.join(DIST_ASSETS, rel);
        if (!fs.existsSync(distFile)) {
          errors.push(`Missing referenced asset in dist/assets/: ${rel}`);
        }
      }
    }

    // 2. Verify zero unused assets and zero duplicate binary files in public/assets
    const publicFiles = walk(PUBLIC_ASSETS);
    const seenHashes = new Map();
    for (const full of publicFiles) {
      const rel = path.relative(PUBLIC_ASSETS, full);
      if (!referencedPaths.has(rel) && !allowedLicenseFiles.has(rel)) {
        errors.push(`Unused asset in public/assets/: ${rel}`);
      }
      const hash = crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex');
      if (seenHashes.has(hash) && !rel.endsWith('OFL.txt')) {
        errors.push(`Duplicate binary asset: ${rel} matches ${seenHashes.get(hash)}`);
      } else {
        seenHashes.set(hash, rel);
      }
    }

    // 3. Verify required font licenses exist
    for (const lic of ['fonts/fredoka/OFL.txt', 'fonts/nunito/OFL.txt']) {
      if (!fs.existsSync(path.join(PUBLIC_ASSETS, lic))) {
        errors.push(`Missing required font license file: public/assets/${lic}`);
      }
    }

    console.log('=== Bottle Shuffle Asset Validation ===');
    console.log(`Referenced runtime assets : ${String(referencedPaths.size)}`);
    console.log(`Files in public/assets/   : ${String(publicFiles.length)}`);
    console.log(`Dist verification active  : ${hasDist ? 'YES' : 'NO'}`);

    if (errors.length > 0) {
      console.error('Asset validation FAILED:');
      for (const e of errors) console.error(`  - ${e}`);
      process.exitCode = 1;
    } else {
      console.log('Asset validation PASSED.');
    }
  } finally {
    await server.close();
  }
}

void main();
