import { execFile } from 'node:child_process';
import fs from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const CHROME_PATH =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PROMO_DIR = path.join(ROOT, 'release', 'promotional');

function inlineSvgDataUri(relPath) {
  const svg = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}

function buildIconSvg() {
  const red = inlineSvgDataUri('artwork/bottles/red.svg');
  const blue = inlineSvgDataUri('artwork/bottles/blue.svg');
  const yellow = inlineSvgDataUri('artwork/bottles/yellow.svg');
  const green = inlineSvgDataUri('artwork/bottles/green.svg');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <radialGradient id="bg" cx="50%" cy="42%" r="65%">
      <stop offset="0%" stop-color="#332258"/>
      <stop offset="65%" stop-color="#1E1535"/>
      <stop offset="100%" stop-color="#130D22"/>
    </radialGradient>
    <linearGradient id="shelf" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#8B5A3C"/>
      <stop offset="100%" stop-color="#563421"/>
    </linearGradient>
    <linearGradient id="arc" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#FBBF24"/>
      <stop offset="50%" stop-color="#FDE68A"/>
      <stop offset="100%" stop-color="#F59E0B"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="12" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="1024" height="1024" rx="180" fill="url(#bg)"/>
  <circle cx="512" cy="480" r="370" fill="#7C3AED" opacity="0.14"/>
  <!-- Swap arc accent -->
  <path d="M 330 270 Q 512 110 694 270" fill="none" stroke="url(#arc)" stroke-width="18" stroke-linecap="round" filter="url(#glow)"/>
  <polygon points="694,270 656,236 680,218" fill="#FBBF24"/>
  <polygon points="330,270 368,236 344,218" fill="#FBBF24"/>
  <!-- Sparkles -->
  <path d="M 512 115 L 524 148 L 557 160 L 524 172 L 512 205 L 500 172 L 467 160 L 500 148 Z" fill="#FDE68A"/>
  <circle cx="215" cy="240" r="10" fill="#C4B5FD" opacity="0.7"/>
  <circle cx="815" cy="240" r="10" fill="#FDE68A" opacity="0.7"/>
  <!-- Wooden shelf -->
  <rect x="96" y="790" width="832" height="58" rx="22" fill="url(#shelf)" stroke="#A77453" stroke-width="4"/>
  <!-- 4 crisp project bottles -->
  <image href="${red}" x="128" y="348" width="215" height="430" transform="rotate(-5 235 563)"/>
  <image href="${blue}" x="310" y="290" width="225" height="450"/>
  <image href="${yellow}" x="492" y="290" width="225" height="450"/>
  <image href="${green}" x="682" y="348" width="215" height="430" transform="rotate(5 789 563)"/>
</svg>`;
}

function buildThumbnailSvg(width, height, variant) {
  const red = inlineSvgDataUri('artwork/bottles/red.svg');
  const blue = inlineSvgDataUri('artwork/bottles/blue.svg');
  const green = inlineSvgDataUri('artwork/bottles/green.svg');
  const yellow = inlineSvgDataUri('artwork/bottles/yellow.svg');
  const purple = inlineSvgDataUri('artwork/bottles/purple.svg');

  if (variant === '16x9') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 1280 720">
  <defs>
    <radialGradient id="bg" cx="55%" cy="45%" r="70%">
      <stop offset="0%" stop-color="#312056"/>
      <stop offset="65%" stop-color="#1B1330"/>
      <stop offset="100%" stop-color="#120C21"/>
    </radialGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FDE68A"/>
      <stop offset="100%" stop-color="#F59E0B"/>
    </linearGradient>
    <linearGradient id="shelf" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#8B5A3C"/>
      <stop offset="100%" stop-color="#4D2E1C"/>
    </linearGradient>
  </defs>
  <rect width="1280" height="720" fill="url(#bg)"/>
  <circle cx="885" cy="360" r="310" fill="#7C3AED" opacity="0.16"/>
  <!-- Left Branding (No third-party logos) -->
  <text x="90" y="250" font-family="Fredoka, 'Arial Rounded MT Bold', sans-serif" font-size="96" font-weight="700" fill="url(#gold)" stroke="#2E1065" stroke-width="6" paint-order="stroke">BOTTLE</text>
  <text x="90" y="346" font-family="Fredoka, 'Arial Rounded MT Bold', sans-serif" font-size="96" font-weight="700" fill="#FFFFFF" stroke="#4C1D95" stroke-width="6" paint-order="stroke">SHUFFLE</text>
  <text x="94" y="405" font-family="Nunito, sans-serif" font-size="30" font-weight="700" fill="#C4B5FD">Swap. Match. Master.</text>
  <!-- Aggregate Match Counter Pill -->
  <rect x="92" y="455" width="320" height="76" rx="38" fill="#251A42" stroke="#10B981" stroke-width="3"/>
  <text x="128" y="502" font-family="Nunito, sans-serif" font-size="22" font-weight="700" fill="#94A3B8">MATCHES</text>
  <text x="305" y="505" font-family="Fredoka, sans-serif" font-size="40" font-weight="700" fill="#34D399">3 / 5</text>
  <!-- Right Gameplay Composition -->
  <path d="M 730 145 Q 885 45 1040 145" fill="none" stroke="#FBBF24" stroke-width="10" stroke-linecap="round"/>
  <polygon points="1040,145 1014,122 1030,110" fill="#FBBF24"/>
  <polygon points="730,145 756,122 740,110" fill="#FBBF24"/>
  <!-- Shelf -->
  <rect x="530" y="468" width="690" height="36" rx="14" fill="url(#shelf)" stroke="#A77453" stroke-width="3"/>
  <!-- 5 Bottles (two slightly lifted in mid-swap) -->
  <image href="${red}" x="556" y="210" width="122" height="244"/>
  <image href="${blue}" x="686" y="160" width="126" height="252" transform="rotate(-6 749 286)"/>
  <image href="${green}" x="818" y="210" width="122" height="244"/>
  <image href="${yellow}" x="948" y="160" width="126" height="252" transform="rotate(6 1011 286)"/>
  <image href="${purple}" x="1080" y="210" width="122" height="244"/>
  <!-- Hidden Sequence Compartment -->
  <rect x="556" y="535" width="638" height="106" rx="22" fill="#1F1638" stroke="#4C377A" stroke-width="3"/>
  <text x="875" y="566" text-anchor="middle" font-family="Nunito, sans-serif" font-size="16" font-weight="700" letter-spacing="3" fill="#94A3B8">HIDDEN TARGET ORDER</text>
  <g fill="#2C204C" stroke="#5B4591" stroke-width="2">
    <rect x="598" y="580" width="84" height="46" rx="10"/>
    <rect x="716" y="580" width="84" height="46" rx="10"/>
    <rect x="834" y="580" width="84" height="46" rx="10"/>
    <rect x="952" y="580" width="84" height="46" rx="10"/>
    <rect x="1070" y="580" width="84" height="46" rx="10"/>
  </g>
  <g fill="#C4B5FD" font-family="Fredoka, sans-serif" font-size="28" font-weight="700" text-anchor="middle">
    <text x="640" y="613">?</text><text x="758" y="613">?</text><text x="876" y="613">?</text><text x="994" y="613">?</text><text x="1112" y="613">?</text>
  </g>
</svg>`;
  }

  if (variant === '1x1') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 1024 1024">
  <defs>
    <radialGradient id="bg" cx="50%" cy="46%" r="68%">
      <stop offset="0%" stop-color="#322158"/>
      <stop offset="65%" stop-color="#1B1330"/>
      <stop offset="100%" stop-color="#120C21"/>
    </radialGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FDE68A"/>
      <stop offset="100%" stop-color="#F59E0B"/>
    </linearGradient>
    <linearGradient id="shelf" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#8B5A3C"/>
      <stop offset="100%" stop-color="#4D2E1C"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <circle cx="512" cy="540" r="360" fill="#7C3AED" opacity="0.15"/>
  <text x="512" y="150" text-anchor="middle" font-family="Fredoka, sans-serif" font-size="108" font-weight="700" fill="url(#gold)" stroke="#2E1065" stroke-width="6" paint-order="stroke">BOTTLE</text>
  <text x="512" y="252" text-anchor="middle" font-family="Fredoka, sans-serif" font-size="108" font-weight="700" fill="#FFFFFF" stroke="#4C1D95" stroke-width="6" paint-order="stroke">SHUFFLE</text>
  <path d="M 300 350 Q 512 245 724 350" fill="none" stroke="#FBBF24" stroke-width="12" stroke-linecap="round"/>
  <rect x="88" y="758" width="848" height="44" rx="18" fill="url(#shelf)" stroke="#A77453" stroke-width="4"/>
  <image href="${red}" x="108" y="420" width="160" height="320"/>
  <image href="${blue}" x="268" y="365" width="164" height="328" transform="rotate(-6 350 529)"/>
  <image href="${green}" x="432" y="420" width="160" height="320"/>
  <image href="${yellow}" x="592" y="365" width="164" height="328" transform="rotate(6 674 529)"/>
  <image href="${purple}" x="756" y="420" width="160" height="320"/>
  <rect x="262" y="846" width="500" height="92" rx="46" fill="#251A42" stroke="#10B981" stroke-width="4"/>
  <text x="330" y="902" font-family="Nunito, sans-serif" font-size="30" font-weight="700" fill="#94A3B8">MATCHES</text>
  <text x="610" y="907" font-family="Fredoka, sans-serif" font-size="52" font-weight="700" fill="#34D399">3 / 5</text>
</svg>`;
  }

  // 3:4 portrait
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 900 1200">
  <defs>
    <radialGradient id="bg" cx="50%" cy="48%" r="68%">
      <stop offset="0%" stop-color="#322158"/>
      <stop offset="65%" stop-color="#1B1330"/>
      <stop offset="100%" stop-color="#120C21"/>
    </radialGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FDE68A"/>
      <stop offset="100%" stop-color="#F59E0B"/>
    </linearGradient>
    <linearGradient id="shelf" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#8B5A3C"/>
      <stop offset="100%" stop-color="#4D2E1C"/>
    </linearGradient>
  </defs>
  <rect width="900" height="1200" fill="url(#bg)"/>
  <circle cx="450" cy="610" r="350" fill="#7C3AED" opacity="0.16"/>
  <text x="450" y="175" text-anchor="middle" font-family="Fredoka, sans-serif" font-size="108" font-weight="700" fill="url(#gold)" stroke="#2E1065" stroke-width="6" paint-order="stroke">BOTTLE</text>
  <text x="450" y="278" text-anchor="middle" font-family="Fredoka, sans-serif" font-size="108" font-weight="700" fill="#FFFFFF" stroke="#4C1D95" stroke-width="6" paint-order="stroke">SHUFFLE</text>
  <text x="450" y="340" text-anchor="middle" font-family="Nunito, sans-serif" font-size="34" font-weight="700" fill="#C4B5FD">Swap. Match. Master.</text>
  <path d="M 240 445 Q 450 335 660 445" fill="none" stroke="#FBBF24" stroke-width="12" stroke-linecap="round"/>
  <rect x="64" y="828" width="772" height="44" rx="18" fill="url(#shelf)" stroke="#A77453" stroke-width="4"/>
  <image href="${red}" x="82" y="505" width="144" height="288"/>
  <image href="${blue}" x="228" y="455" width="148" height="296" transform="rotate(-6 302 603)"/>
  <image href="${green}" x="378" y="505" width="144" height="288"/>
  <image href="${yellow}" x="524" y="455" width="148" height="296" transform="rotate(6 598 603)"/>
  <image href="${purple}" x="674" y="505" width="144" height="288"/>
  <rect x="92" y="916" width="716" height="128" rx="26" fill="#1F1638" stroke="#4C377A" stroke-width="3"/>
  <text x="450" y="956" text-anchor="middle" font-family="Nunito, sans-serif" font-size="20" font-weight="700" letter-spacing="3" fill="#94A3B8">HIDDEN TARGET ORDER</text>
  <g fill="#2C204C" stroke="#5B4591" stroke-width="2">
    <rect x="130" y="974" width="102" height="52" rx="12"/>
    <rect x="262" y="974" width="102" height="52" rx="12"/>
    <rect x="394" y="974" width="102" height="52" rx="12"/>
    <rect x="526" y="974" width="102" height="52" rx="12"/>
    <rect x="658" y="974" width="102" height="52" rx="12"/>
  </g>
  <g fill="#C4B5FD" font-family="Fredoka, sans-serif" font-size="32" font-weight="700" text-anchor="middle">
    <text x="181" y="1011">?</text><text x="313" y="1011">?</text><text x="445" y="1011">?</text><text x="577" y="1011">?</text><text x="709" y="1011">?</text>
  </g>
  <rect x="230" y="1078" width="440" height="76" rx="38" fill="#251A42" stroke="#10B981" stroke-width="4"/>
  <text x="292" y="1125" font-family="Nunito, sans-serif" font-size="26" font-weight="700" fill="#94A3B8">MATCHES</text>
  <text x="530" y="1129" font-family="Fredoka, sans-serif" font-size="44" font-weight="700" fill="#34D399">3 / 5</text>
</svg>`;
}

async function rasterizePromoJobs(jobs) {
  const html = `<!doctype html>
<html>
  <body>
    <pre id="out">PENDING</pre>
    <script>
      const jobs = ${JSON.stringify(jobs)};
      async function renderOne(job) {
        const blob = new Blob([job.svg], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        try {
          const img = new Image();
          img.width = job.width;
          img.height = job.height;
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = url;
          });
          const canvas = document.createElement('canvas');
          canvas.width = job.width;
          canvas.height = job.height;
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, job.width, job.height);
          ctx.drawImage(img, 0, 0, job.width, job.height);
          return { dest: job.dest, dataUrl: canvas.toDataURL('image/png') };
        } finally {
          URL.revokeObjectURL(url);
        }
      }
      Promise.all(jobs.map(renderOne))
        .then((res) => { document.getElementById('out').textContent = JSON.stringify(res); })
        .catch((err) => { document.getElementById('out').textContent = 'ERROR:' + String(err); });
    </script>
  </body>
</html>`;

  const server = createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : 0;

  try {
    const { stdout: dumped } = await execFileAsync(
      CHROME_PATH,
      [
        '--headless=new',
        '--disable-gpu',
        '--virtual-time-budget=8000',
        '--dump-dom',
        `http://127.0.0.1:${String(port)}/`,
      ],
      { encoding: 'utf8', maxBuffer: 80 * 1024 * 1024 },
    );

    const match = /<pre id="out">([\s\S]*?)<\/pre>/.exec(dumped);
    if (!match?.[1] || match[1].startsWith('ERROR:') || match[1] === 'PENDING') {
      throw new Error(`Promotional rasterisation failed: ${match?.[1] ?? 'empty output'}`);
    }

    const results = JSON.parse(match[1]);
    for (const item of results) {
      const base64 = item.dataUrl.split(',')[1];
      const fullPath = path.join(ROOT, item.dest);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, Buffer.from(base64, 'base64'));
    }
  } finally {
    server.close();
  }
}

async function main() {
  const iconsDir = path.join(PROMO_DIR, 'icons');
  const thumbsDir = path.join(PROMO_DIR, 'thumbnails');
  const shotsDir = path.join(PROMO_DIR, 'screenshots');
  fs.mkdirSync(iconsDir, { recursive: true });
  fs.mkdirSync(thumbsDir, { recursive: true });
  fs.mkdirSync(shotsDir, { recursive: true });

  const iconSvg = buildIconSvg();
  const thumb16x9Svg = buildThumbnailSvg(1280, 720, '16x9');
  const thumb1x1Svg = buildThumbnailSvg(1024, 1024, '1x1');
  const thumb3x4Svg = buildThumbnailSvg(900, 1200, '3x4');

  fs.writeFileSync(path.join(iconsDir, 'icon-source.svg'), iconSvg, 'utf8');
  fs.writeFileSync(path.join(thumbsDir, 'thumbnail-16x9.svg'), thumb16x9Svg, 'utf8');
  fs.writeFileSync(path.join(thumbsDir, 'thumbnail-1x1.svg'), thumb1x1Svg, 'utf8');
  fs.writeFileSync(path.join(thumbsDir, 'thumbnail-3x4.svg'), thumb3x4Svg, 'utf8');

  const rasterJobs = [
    {
      dest: 'release/promotional/icons/icon-512x512.png',
      width: 512,
      height: 512,
      svg: iconSvg,
      type: 'icon',
      aspectRatio: '1:1',
      source: 'release/promotional/icons/icon-source.svg',
    },
    {
      dest: 'release/promotional/icons/icon-1024x1024.png',
      width: 1024,
      height: 1024,
      svg: iconSvg,
      type: 'icon',
      aspectRatio: '1:1',
      source: 'release/promotional/icons/icon-source.svg',
    },
    {
      dest: 'release/promotional/thumbnails/thumbnail-16x9-1280x720.png',
      width: 1280,
      height: 720,
      svg: thumb16x9Svg,
      type: 'thumbnail_landscape',
      aspectRatio: '16:9',
      source: 'release/promotional/thumbnails/thumbnail-16x9.svg',
    },
    {
      dest: 'release/promotional/thumbnails/thumbnail-1x1-1024x1024.png',
      width: 1024,
      height: 1024,
      svg: thumb1x1Svg,
      type: 'thumbnail_square',
      aspectRatio: '1:1',
      source: 'release/promotional/thumbnails/thumbnail-1x1.svg',
    },
    {
      dest: 'release/promotional/thumbnails/thumbnail-3x4-900x1200.png',
      width: 900,
      height: 1200,
      svg: thumb3x4Svg,
      type: 'thumbnail_portrait',
      aspectRatio: '3:4',
      source: 'release/promotional/thumbnails/thumbnail-3x4.svg',
    },
  ];

  await rasterizePromoJobs(rasterJobs);

  const manifestEntries = rasterJobs.map((job) => {
    const sizeBytes = fs.statSync(path.join(ROOT, job.dest)).size;
    return {
      filename: job.dest,
      assetType: job.type,
      aspectRatio: job.aspectRatio,
      requiredDimensionsNote:
        'Confirm exact pixel slots inside authenticated YouTube Playables Developer Portal Details step',
      actualDimensions: `${String(job.width)}x${String(job.height)}`,
      format: 'PNG',
      fileSizeBytes: sizeBytes,
      sourceArtwork: job.source,
      validationStatus: 'generated_locally_pending_portal_spec_verification',
    };
  });

  // Include any production screenshots already captured under release/promotional/screenshots/
  if (fs.existsSync(shotsDir)) {
    for (const file of fs.readdirSync(shotsDir).sort()) {
      if (!file.endsWith('.png')) continue;
      const rel = `release/promotional/screenshots/${file}`;
      const sizeBytes = fs.statSync(path.join(shotsDir, file)).size;
      const dimMatch = /(\d+)x(\d+)/.exec(file);
      manifestEntries.push({
        filename: rel,
        assetType: 'production_screenshot',
        aspectRatio: dimMatch && Number(dimMatch[1]) > Number(dimMatch[2]) ? '16:9' : 'portrait',
        requiredDimensionsNote: 'Captured directly from served production dist/ build',
        actualDimensions: dimMatch ? `${dimMatch[1]}x${dimMatch[2]}` : 'unknown',
        format: 'PNG',
        fileSizeBytes: sizeBytes,
        sourceArtwork: 'dist/ production build',
        validationStatus: 'captured_from_production_build',
      });
    }
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    officialRequirementNote:
      'Public YouTube Playables documentation requires thumbnails across multiple aspect ratios with zero third-party/YouTube branding or misleading visuals; exact per-slot pixel constraints are displayed inside the authenticated Playables Developer Portal Details step.',
    assets: manifestEntries,
  };

  fs.writeFileSync(
    path.join(PROMO_DIR, 'promotional-manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );

  console.log(`Generated ${String(rasterJobs.length)} promotional artwork PNGs + manifest.`);
}

void main();
