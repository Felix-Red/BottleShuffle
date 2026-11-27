import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const DIST_DIR = path.resolve(process.cwd(), 'dist');

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

function classify(rel) {
  if (rel.endsWith('.html')) return 'HTML';
  if (rel.endsWith('.js')) return 'JavaScript';
  if (rel.endsWith('.css')) return 'CSS';
  if (rel.endsWith('.woff2') || rel.endsWith('.woff') || rel.endsWith('.ttf')) return 'Fonts';
  if (rel.startsWith('assets/bottles/')) return 'Bottle Textures';
  if (rel.startsWith('assets/environment/')) return 'Environment Textures';
  if (rel.startsWith('assets/effects/') || rel.startsWith('assets/icons/'))
    return 'Effects & Icons';
  if (rel.startsWith('assets/audio/music/')) return 'Audio (Music)';
  if (rel.startsWith('assets/audio/sfx/')) return 'Audio (SFX)';
  return 'Other / Metadata';
}

function fmt(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
  return `${(bytes / 1024).toFixed(2)} KiB`;
}

function main() {
  if (!fs.existsSync(DIST_DIR)) {
    throw new Error('dist/ not found. Run npm run build first.');
  }

  const files = walk(DIST_DIR);
  const categories = new Map();
  const hashes = new Map();
  const duplicates = [];
  const fileRows = [];
  let totalRaw = 0;
  let totalGzip = 0;
  let initialRaw = 0;
  let initialGzip = 0;

  for (const full of files) {
    const rel = path.relative(DIST_DIR, full);
    const buf = fs.readFileSync(full);
    const raw = buf.byteLength;
    const gzip = zlib.gzipSync(buf, { level: 9 }).byteLength;
    const hash = crypto.createHash('sha256').update(buf).digest('hex');

    if (hashes.has(hash)) {
      duplicates.push({ file: rel, duplicateOf: hashes.get(hash), raw });
    } else {
      hashes.set(hash, rel);
    }

    totalRaw += raw;
    totalGzip += gzip;

    if (rel === 'index.html' || (rel.startsWith('assets/') && rel.endsWith('.js'))) {
      initialRaw += raw;
      initialGzip += gzip;
    }

    const cat = classify(rel);
    const prev = categories.get(cat) ?? { files: 0, raw: 0, gzip: 0 };
    categories.set(cat, {
      files: prev.files + 1,
      raw: prev.raw + raw,
      gzip: prev.gzip + gzip,
    });

    fileRows.push({ rel, cat, raw, gzip });
  }

  fileRows.sort((a, b) => b.raw - a.raw);

  console.log('=== Bottle Shuffle Production Bundle Analysis ===');
  console.log(`Total files         : ${String(files.length)}`);
  console.log(
    `Initial JS + HTML   : ${fmt(initialRaw)} (${String(initialRaw)} B) | gzip: ${fmt(initialGzip)} (${String(initialGzip)} B)`,
  );
  console.log(
    `Total dist/ bundle  : ${fmt(totalRaw)} (${String(totalRaw)} B) | gzip: ${fmt(totalGzip)} (${String(totalGzip)} B)`,
  );
  console.log('');
  console.log('--- Breakdown by Category ---');
  console.table(
    [...categories.entries()].map(([category, stats]) => ({
      category,
      files: stats.files,
      uncompressed: fmt(stats.raw),
      rawBytes: stats.raw,
      gzipped: fmt(stats.gzip),
      sharePct: `${((stats.raw / Math.max(1, totalRaw)) * 100).toFixed(1)}%`,
    })),
  );
  console.log('--- Top 12 Largest Production Files ---');
  console.table(
    fileRows.slice(0, 12).map((r) => ({
      file: r.rel,
      category: r.cat,
      uncompressed: fmt(r.raw),
      gzipped: fmt(r.gzip),
    })),
  );

  if (duplicates.length > 0) {
    console.warn('Duplicate binary files detected:', duplicates);
  } else {
    console.log('Duplicate binary files : 0');
  }
}

main();
