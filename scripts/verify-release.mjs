import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

function main() {
  const errors = [];
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const version = String(pkg.version);

  // 1. Check required legal & changelog documentation
  const noticesPath = path.join(ROOT, 'THIRD_PARTY_NOTICES.md');
  const changelogPath = path.join(ROOT, 'CHANGELOG.md');
  if (!fs.existsSync(noticesPath)) {
    errors.push('Missing THIRD_PARTY_NOTICES.md.');
  } else {
    const notices = fs.readFileSync(noticesPath, 'utf8');
    if (
      !notices.includes('Phaser') ||
      !notices.includes('Fredoka') ||
      !notices.includes('Nunito')
    ) {
      errors.push('THIRD_PARTY_NOTICES.md must document Phaser, Fredoka, and Nunito.');
    }
  }

  if (!fs.existsSync(changelogPath)) {
    errors.push('Missing CHANGELOG.md.');
  } else {
    const changelog = fs.readFileSync(changelogPath, 'utf8');
    if (!changelog.includes(`[${version}]`)) {
      errors.push(`CHANGELOG.md does not contain an entry for [${version}].`);
    }
  }

  // 2. Check runtime dependencies discipline
  const prodDeps = Object.keys(pkg.dependencies ?? {});
  if (prodDeps.length !== 1 || prodDeps[0] !== 'phaser') {
    errors.push(`Unexpected production runtime dependencies: ${prodDeps.join(', ')}`);
  }

  // 3. Verify dist/ exists and contains no prohibited non-runtime directories/files
  const distDir = path.join(ROOT, 'dist');
  if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    errors.push('dist/index.html missing — run npm run build:youtube first.');
  } else {
    const prohibitedTopLevel = ['node_modules', 'tests', 'src', 'artwork', 'release', 'docs'];
    for (const name of prohibitedTopLevel) {
      if (fs.existsSync(path.join(distDir, name))) {
        errors.push(`Prohibited non-runtime path found inside dist/: ${name}`);
      }
    }
  }

  // 4. Delegate to YouTube build audit, asset validation, and metadata validation
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'verify-youtube-build.mjs')], {
      stdio: 'inherit',
    });
    execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'validate-assets.mjs')], {
      stdio: 'inherit',
    });
    execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'validate-metadata.mjs')], {
      stdio: 'inherit',
    });
  } catch {
    errors.push('One or more sub-verification scripts failed.');
  }

  if (errors.length > 0) {
    console.error('\nRelease verification FAILED:');
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  console.log(`\nRelease verification for Bottle Shuffle v${version} PASSED.`);
}

main();
