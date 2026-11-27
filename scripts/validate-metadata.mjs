import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const METADATA_PATH = path.join(ROOT, 'release', 'metadata', 'game-metadata.json');
const PROMO_MANIFEST_PATH = path.join(ROOT, 'release', 'promotional', 'promotional-manifest.json');
const PKG_PATH = path.join(ROOT, 'package.json');
const APP_CONFIG_PATH = path.join(ROOT, 'src', 'config', 'appConfig.ts');

const PROHIBITED_COPY_TERMS = [
  'multiplayer',
  'leaderboard',
  'in-app purchase',
  'real money',
  'cash prize',
  'official youtube',
  'drinking game',
];

function readPngDimensions(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf.length < 24 || buf.toString('ascii', 1, 4) !== 'PNG') {
    return null;
  }
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
  };
}

function main() {
  const errors = [];
  const warnings = [];

  if (!fs.existsSync(METADATA_PATH)) {
    throw new Error(`Missing metadata file: ${METADATA_PATH}`);
  }

  const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
  const metadata = JSON.parse(fs.readFileSync(METADATA_PATH, 'utf8'));
  const appConfigSource = fs.readFileSync(APP_CONFIG_PATH, 'utf8');
  const appVersionMatch = /APP_VERSION\s*=\s*'([^']+)'/.exec(appConfigSource);
  const appConfigVersion = appVersionMatch?.[1] ?? null;

  if (metadata.applicationVersion !== pkg.version) {
    errors.push(
      `Metadata applicationVersion (${String(metadata.applicationVersion)}) does not match package.json (${String(pkg.version)}).`,
    );
  }
  if (appConfigVersion !== pkg.version) {
    errors.push(
      `src/config/appConfig.ts APP_VERSION (${String(appConfigVersion)}) does not match package.json (${String(pkg.version)}).`,
    );
  }
  if (metadata.releaseIdentifier !== `bottle-shuffle-${String(pkg.version)}`) {
    errors.push(`Unexpected releaseIdentifier: ${String(metadata.releaseIdentifier)}`);
  }

  if (typeof metadata.gameTitle !== 'string' || metadata.gameTitle.trim().length === 0) {
    errors.push('gameTitle must be a non-empty string.');
  }
  if (
    typeof metadata.shortDescription !== 'string' ||
    metadata.shortDescription.trim().length === 0 ||
    metadata.shortDescription.length > 140
  ) {
    errors.push('shortDescription must be non-empty and <= 140 characters.');
  }
  if (typeof metadata.fullDescription !== 'string' || metadata.fullDescription.trim().length < 80) {
    errors.push('fullDescription is missing or unexpectedly short.');
  }

  const combinedCopy =
    `${String(metadata.gameTitle)} ${String(metadata.shortDescription)} ${String(metadata.fullDescription)}`.toLowerCase();
  for (const term of PROHIBITED_COPY_TERMS) {
    if (combinedCopy.includes(term)) {
      errors.push(`Metadata contains prohibited or unsupported feature claim: "${term}"`);
    }
  }

  if (
    !Array.isArray(metadata.supportedLanguages) ||
    metadata.supportedLanguages.join(',') !== 'en'
  ) {
    errors.push('supportedLanguages must honestly list only implemented locales (["en"]).');
  }

  if (String(metadata.supportContact).includes('OWNER_SUPPORT_EMAIL_REQUIRED')) {
    warnings.push(
      'supportContact is still an owner placeholder — fill in before portal submission.',
    );
  }
  if (String(metadata.privacyPolicyUrl).includes('OWNER_PRIVACY_POLICY_URL_REQUIRED')) {
    warnings.push(
      'privacyPolicyUrl is still an owner placeholder — publish & link before portal submission.',
    );
  }

  // Validate promotional manifest & PNG dimensions if present
  if (fs.existsSync(PROMO_MANIFEST_PATH)) {
    const promo = JSON.parse(fs.readFileSync(PROMO_MANIFEST_PATH, 'utf8'));
    const assets = Array.isArray(promo.assets) ? promo.assets : [];
    for (const asset of assets) {
      const full = path.join(ROOT, asset.filename);
      if (!fs.existsSync(full)) {
        errors.push(`Missing promotional asset: ${asset.filename}`);
        continue;
      }
      const stat = fs.statSync(full);
      if (stat.size === 0) errors.push(`Zero-byte promotional asset: ${asset.filename}`);
      if (stat.size > 5 * 1024 * 1024) {
        errors.push(`Promotional asset exceeds 5 MiB: ${asset.filename}`);
      }
      if (asset.format === 'PNG') {
        const dims = readPngDimensions(full);
        if (dims === null) {
          errors.push(`Invalid PNG header: ${asset.filename}`);
        } else if (`${String(dims.width)}x${String(dims.height)}` !== asset.actualDimensions) {
          errors.push(
            `Dimension mismatch for ${asset.filename}: header ${String(dims.width)}x${String(dims.height)} vs manifest ${String(asset.actualDimensions)}`,
          );
        }
      }
    }
    console.log(`Promotional assets verified : ${String(assets.length)}`);
  } else {
    warnings.push('release/promotional/promotional-manifest.json not yet generated.');
  }

  console.log('=== Bottle Shuffle Release Metadata Validation ===');
  console.log(`Version consistency         : ${String(pkg.version)}`);
  console.log(`Short description length    : ${String(metadata.shortDescription.length)} chars`);
  console.log(`Full description length     : ${String(metadata.fullDescription.length)} chars`);
  if (warnings.length > 0) {
    console.log('Owner action reminders:');
    for (const w of warnings) console.log(`  - [NOTICE] ${w}`);
  }

  if (errors.length > 0) {
    console.error('Metadata validation FAILED:');
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  console.log('Metadata validation PASSED.');
}

main();
