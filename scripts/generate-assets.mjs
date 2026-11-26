import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

const BOTTLE_SPECS = [
  {
    id: 'red',
    name: 'Red',
    base: '#EF4444',
    light: '#F87171',
    dark: '#B91C1C',
    rim: '#FCA5A5',
    darkLabel: false,
    symbol: 'circle',
  },
  {
    id: 'blue',
    name: 'Blue',
    base: '#3B82F6',
    light: '#60A5FA',
    dark: '#1D4ED8',
    rim: '#93C5FD',
    darkLabel: false,
    symbol: 'diamond',
  },
  {
    id: 'green',
    name: 'Green',
    base: '#22C55E',
    light: '#4ADE80',
    dark: '#15803D',
    rim: '#86EFAC',
    darkLabel: false,
    symbol: 'triangle',
  },
  {
    id: 'yellow',
    name: 'Yellow',
    base: '#EAB308',
    light: '#FACC15',
    dark: '#A16207',
    rim: '#FEF08A',
    darkLabel: true,
    symbol: 'star',
  },
  {
    id: 'purple',
    name: 'Purple',
    base: '#A855F7',
    light: '#C084FC',
    dark: '#6B21A8',
    rim: '#E9D5FF',
    darkLabel: false,
    symbol: 'sparkle',
  },
  {
    id: 'orange',
    name: 'Orange',
    base: '#F97316',
    light: '#FB923C',
    dark: '#C2410C',
    rim: '#FDBA74',
    darkLabel: false,
    symbol: 'square',
  },
  {
    id: 'pink',
    name: 'Pink',
    base: '#EC4899',
    light: '#F472B6',
    dark: '#BE185D',
    rim: '#F9A8D4',
    darkLabel: false,
    symbol: 'heart',
  },
  {
    id: 'teal',
    name: 'Teal',
    base: '#14B8A6',
    light: '#2DD4BF',
    dark: '#0F766E',
    rim: '#99F6E4',
    darkLabel: false,
    symbol: 'cross',
  },
  {
    id: 'brown',
    name: 'Brown',
    base: '#92400E',
    light: '#C26D32',
    dark: '#5C2707',
    rim: '#E29E69',
    darkLabel: false,
    symbol: 'stripes',
  },
  {
    id: 'silver',
    name: 'Silver',
    base: '#94A3B8',
    light: '#CBD5E1',
    dark: '#475569',
    rim: '#F1F5F9',
    darkLabel: true,
    symbol: 'ring',
  },
];

function buildSymbolSvg(symbol) {
  switch (symbol) {
    case 'circle':
      return `<circle cx="128" cy="350" r="32" fill="#FFFFFF" />`;
    case 'diamond':
      return `<path d="M128 313 L165 350 L128 387 L91 350 Z" fill="#FFFFFF" />`;
    case 'triangle':
      return `<path d="M128 315 L164 381 Q166 385 161 385 L95 385 Q90 385 92 381 Z" fill="#FFFFFF" />`;
    case 'star':
      return `<path d="M128 312 L139.2 335.2 L164.8 338.8 L146.2 356.8 L150.8 382.2 L128 370.1 L105.2 382.2 L109.8 356.8 L91.2 338.8 L116.8 335.2 Z" fill="#FFFFFF" />`;
    case 'sparkle':
      return `<path d="M128 310 C131 334 144 347 168 350 C144 353 131 366 128 390 C125 366 112 353 88 350 C112 347 125 334 128 310 Z" fill="#FFFFFF" />`;
    case 'square':
      return `<rect x="97" y="319" width="62" height="62" rx="11" fill="#FFFFFF" />`;
    case 'heart':
      return `<path d="M128 386 C125 384 91 361 91 338 C91 324 102 315 114 315 C121 315 126 319 128 324 C130 319 135 315 142 315 C154 315 165 324 165 338 C165 361 131 384 128 386 Z" fill="#FFFFFF" />`;
    case 'cross':
      return `<path d="M117 316 H139 V339 H162 V361 H139 V384 H117 V361 H94 V339 H117 Z" fill="#FFFFFF" />`;
    case 'stripes':
      return `<g fill="#FFFFFF">
        <rect x="94" y="321" width="68" height="13" rx="6.5" />
        <rect x="94" y="343.5" width="68" height="13" rx="6.5" />
        <rect x="94" y="366" width="68" height="13" rx="6.5" />
      </g>`;
    case 'ring':
      return `<g fill="none" stroke="#FFFFFF" stroke-linecap="round">
        <circle cx="128" cy="350" r="30" stroke-width="10" />
        <circle cx="128" cy="350" r="14" stroke-width="4.5" opacity="0.85" />
      </g>`;
    default:
      throw new Error(`Unknown symbol: ${symbol}`);
  }
}

function buildBottleSvg(spec) {
  const labelFill = spec.darkLabel ? '#171126' : '#FFFFFF';
  const labelOpacity = spec.darkLabel ? '0.26' : '0.24';
  const labelStroke = spec.darkLabel ? 'rgba(255,255,255,0.42)' : 'rgba(255,255,255,0.34)';

  const bodyPath =
    'M100 50 H156 V136 C156 174 220 194 220 250 V464 C220 492 200 508 172 508 H84 C56 508 36 492 36 464 V250 C36 194 100 174 100 136 Z';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="256" height="512" viewBox="0 0 256 512" role="img" aria-label="${spec.name} bottle with ${spec.symbol} symbol">
  <defs>
    <linearGradient id="glassBody-${spec.id}" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${spec.dark}" />
      <stop offset="16%" stop-color="${spec.light}" />
      <stop offset="48%" stop-color="${spec.base}" />
      <stop offset="86%" stop-color="${spec.dark}" />
      <stop offset="100%" stop-color="${spec.rim}" />
    </linearGradient>

    <linearGradient id="glassVertical-${spec.id}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.22" />
      <stop offset="30%" stop-color="#FFFFFF" stop-opacity="0.03" />
      <stop offset="82%" stop-color="#000000" stop-opacity="0.06" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0.28" />
    </linearGradient>

    <linearGradient id="capGrad-${spec.id}" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#CBD5E1" />
      <stop offset="28%" stop-color="#F8FAFC" />
      <stop offset="70%" stop-color="#E2E8F0" />
      <stop offset="100%" stop-color="#94A3B8" />
    </linearGradient>

    <linearGradient id="specStreak-${spec.id}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.52" />
      <stop offset="55%" stop-color="#FFFFFF" stop-opacity="0.24" />
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0.04" />
    </linearGradient>

    <clipPath id="bottleClip-${spec.id}">
      <path d="${bodyPath}" />
    </clipPath>
  </defs>

  <!-- Main coloured glass body -->
  <path d="${bodyPath}" fill="url(#glassBody-${spec.id})" />
  <path d="${bodyPath}" fill="url(#glassVertical-${spec.id})" />

  <!-- Internal glass shading, highlights and base depth -->
  <g clip-path="url(#bottleClip-${spec.id})">
    <!-- Subtle neck shadow under cap -->
    <rect x="92" y="48" width="72" height="16" fill="#0F0A1A" opacity="0.26" />

    <!-- Soft left curved specular highlight -->
    <path d="M111 66 V136 C111 178 58 196 58 250 V454 C58 468 64 478 72 484" fill="none" stroke="url(#specStreak-${spec.id})" stroke-width="14" stroke-linecap="round" />

    <!-- Crisp secondary shoulder gleam -->
    <ellipse cx="78" cy="216" rx="8" ry="22" transform="rotate(24 78 216)" fill="#FFFFFF" opacity="0.34" />

    <!-- Subtle right rim bounce highlight -->
    <path d="M206 254 V460 C206 478 194 492 178 496" fill="none" stroke="${spec.rim}" stroke-width="6" stroke-linecap="round" opacity="0.45" />

    <!-- Glass base thickness band -->
    <path d="M36 472 Q128 492 220 472 V512 H36 Z" fill="#0F0A1A" opacity="0.2" />
    <path d="M68 488 Q128 502 188 488" fill="none" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" opacity="0.28" />
  </g>

  <!-- Crisp glass rim contour -->
  <path d="${bodyPath}" fill="none" stroke="${spec.rim}" stroke-width="3" opacity="0.48" />

  <!-- Neck collar lip -->
  <rect x="95" y="44" width="66" height="12" rx="6" fill="${spec.light}" opacity="0.92" />

  <!-- Metallic stylised bottle cap -->
  <rect x="86" y="10" width="84" height="38" rx="11" fill="url(#capGrad-${spec.id})" />
  <rect x="86" y="10" width="84" height="38" rx="11" fill="none" stroke="#FFFFFF" stroke-width="2" opacity="0.45" />
  <!-- Cap subtle vertical ribs -->
  <g stroke="#94A3B8" stroke-width="2" opacity="0.42">
    <line x1="102" y1="16" x2="102" y2="42" />
    <line x1="115" y1="16" x2="115" y2="42" />
    <line x1="128" y1="16" x2="128" y2="42" />
    <line x1="141" y1="16" x2="141" y2="42" />
    <line x1="154" y1="16" x2="154" y2="42" />
  </g>
  <rect x="94" y="13" width="68" height="6" rx="3" fill="#FFFFFF" opacity="0.55" />

  <!-- Frosted decorative label -->
  <rect x="60" y="282" width="136" height="136" rx="24" fill="${labelFill}" opacity="${labelOpacity}" />
  <rect x="60" y="282" width="136" height="136" rx="24" fill="none" stroke="${labelStroke}" stroke-width="2.5" />

  <!-- Accessibility symbol with subtle grounding shadow -->
  <g transform="translate(0, 3)" opacity="0.22">
    ${buildSymbolSvg(spec.symbol).replaceAll('#FFFFFF', '#171126')}
  </g>
  ${buildSymbolSvg(spec.symbol)}
</svg>
`;
}

function buildBackgroundSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    <radialGradient id="ambientGlow" cx="50%" cy="46%" r="64%">
      <stop offset="0%" stop-color="#2B1F4A" />
      <stop offset="48%" stop-color="#1A132C" />
      <stop offset="100%" stop-color="#110C1E" />
    </radialGradient>
    <radialGradient id="topSpot" cx="50%" cy="18%" r="48%">
      <stop offset="0%" stop-color="#8B5CF6" stop-opacity="0.16" />
      <stop offset="65%" stop-color="#8B5CF6" stop-opacity="0.03" />
      <stop offset="100%" stop-color="#8B5CF6" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="cornerWarm" cx="88%" cy="86%" r="36%">
      <stop offset="0%" stop-color="#FBBF24" stop-opacity="0.07" />
      <stop offset="100%" stop-color="#FBBF24" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="cornerCool" cx="12%" cy="82%" r="38%">
      <stop offset="0%" stop-color="#60A5FA" stop-opacity="0.08" />
      <stop offset="100%" stop-color="#60A5FA" stop-opacity="0" />
    </radialGradient>
  </defs>

  <rect width="1280" height="720" fill="url(#ambientGlow)" />
  <rect width="1280" height="720" fill="url(#topSpot)" />
  <rect width="1280" height="720" fill="url(#cornerWarm)" />
  <rect width="1280" height="720" fill="url(#cornerCool)" />

  <!-- Ultra-subtle low-contrast decorative bokeh shapes at outer edges only -->
  <circle cx="110" cy="128" r="88" fill="#A78BFA" opacity="0.03" />
  <circle cx="1175" cy="150" r="110" fill="#8B5CF6" opacity="0.035" />
  <circle cx="165" cy="610" r="96" fill="#60A5FA" opacity="0.025" />
  <circle cx="1125" cy="595" r="84" fill="#FBBF24" opacity="0.025" />
</svg>
`;
}

function buildShelfSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="56" viewBox="0 0 1024 56">
  <defs>
    <linearGradient id="woodTop" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#CFA578" />
      <stop offset="55%" stop-color="#B98D5E" />
      <stop offset="100%" stop-color="#9E7347" />
    </linearGradient>
    <linearGradient id="woodSideFade" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.16" />
      <stop offset="10%" stop-color="#000000" stop-opacity="0" />
      <stop offset="90%" stop-color="#000000" stop-opacity="0" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0.16" />
    </linearGradient>
  </defs>

  <!-- Beveled wooden shelf top plane -->
  <path d="M26 4 H998 L1018 46 Q1020 54 1010 54 H14 Q4 54 6 46 Z" fill="url(#woodTop)" />
  <path d="M26 4 H998 L1018 46 Q1020 54 1010 54 H14 Q4 54 6 46 Z" fill="url(#woodSideFade)" />

  <!-- Subtle polished wood grain streaks -->
  <g stroke="#7C542F" stroke-width="2" opacity="0.16" stroke-linecap="round">
    <line x1="72" y1="18" x2="360" y2="18" />
    <line x1="420" y1="16" x2="880" y2="16" />
    <line x1="120" y1="32" x2="540" y2="32" />
    <line x1="610" y1="34" x2="950" y2="34" />
  </g>

  <!-- Front bevel specular line -->
  <line x1="20" y1="44" x2="1004" y2="44" stroke="#F6DEC0" stroke-width="2" opacity="0.35" />
</svg>
`;
}

function buildShelfEdgeSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="32" viewBox="0 0 1024 32">
  <defs>
    <linearGradient id="edgeWood" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#9A6F44" />
      <stop offset="48%" stop-color="#7B532E" />
      <stop offset="100%" stop-color="#593A1E" />
    </linearGradient>
  </defs>

  <rect x="6" y="0" width="1012" height="26" rx="8" fill="url(#edgeWood)" />
  <line x1="18" y1="3" x2="1006" y2="3" stroke="#E8C69B" stroke-width="1.5" opacity="0.28" />
  <rect x="16" y="24" width="992" height="7" rx="3.5" fill="#090512" opacity="0.48" />
</svg>
`;
}

function buildHiddenCompartmentSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="156" viewBox="0 0 1024 156">
  <defs>
    <linearGradient id="recessBg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#110B1E" />
      <stop offset="30%" stop-color="#171128" />
      <stop offset="100%" stop-color="#1D1530" />
    </linearGradient>
  </defs>

  <rect x="8" y="6" width="1008" height="142" rx="22" fill="url(#recessBg)" />
  <!-- Top recessed shadow cast by shelf -->
  <rect x="10" y="8" width="1004" height="22" rx="14" fill="#07040F" opacity="0.58" />
  <!-- Outer recessed border -->
  <rect x="8" y="6" width="1008" height="142" rx="22" fill="none" stroke="#4C405F" stroke-width="2.5" opacity="0.85" />
</svg>
`;
}

function buildHiddenSlotSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="slotGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1B142C" />
      <stop offset="100%" stop-color="#271E3C" />
    </linearGradient>
  </defs>

  <rect x="6" y="6" width="116" height="116" rx="18" fill="url(#slotGrad)" />
  <rect x="8" y="8" width="112" height="18" rx="12" fill="#0B0714" opacity="0.35" />
  <rect x="6" y="6" width="116" height="116" rx="18" fill="none" stroke="#4C405F" stroke-width="2.5" opacity="0.9" />
</svg>
`;
}

function buildBottleShadowSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="256" height="64" viewBox="0 0 256 64">
  <defs>
    <radialGradient id="shadowGrad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#090512" stop-opacity="0.62" />
      <stop offset="55%" stop-color="#090512" stop-opacity="0.32" />
      <stop offset="100%" stop-color="#090512" stop-opacity="0" />
    </radialGradient>
  </defs>
  <ellipse cx="128" cy="32" rx="108" ry="22" fill="url(#shadowGrad)" />
</svg>
`;
}

function buildSelectionGlowSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="320" height="576" viewBox="0 0 320 576">
  <defs>
    <radialGradient id="softHalo" cx="50%" cy="52%" r="52%">
      <stop offset="0%" stop-color="#FBBF24" stop-opacity="0.34" />
      <stop offset="68%" stop-color="#FBBF24" stop-opacity="0.1" />
      <stop offset="100%" stop-color="#FBBF24" stop-opacity="0" />
    </radialGradient>
  </defs>

  <!-- Soft outer luminous halo -->
  <rect x="8" y="8" width="304" height="560" rx="56" fill="url(#softHalo)" />
</svg>
`;
}

function buildSparkleSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <path d="M32 4 C34.5 22 42 29.5 60 32 C42 34.5 34.5 42 32 60 C29.5 42 22 34.5 4 32 C22 29.5 29.5 22 32 4 Z" fill="#FFFFFF" />
</svg>
`;
}

function buildParticleSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <defs>
    <radialGradient id="pGrad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="1" />
      <stop offset="55%" stop-color="#FFFFFF" stop-opacity="0.55" />
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0" />
    </radialGradient>
  </defs>
  <circle cx="16" cy="16" r="14" fill="url(#pGrad)" />
</svg>
`;
}

function buildLockIconSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="Locked sequence slot">
  <path d="M21 28 V21 C21 14.925 25.925 10 32 10 C38.075 10 43 14.925 43 21 V28" fill="none" stroke="#8F83A8" stroke-width="5.5" stroke-linecap="round" />
  <rect x="14" y="27" width="36" height="27" rx="7" fill="#8F83A8" />
  <circle cx="32" cy="39" r="3.5" fill="#1F1731" />
  <rect x="30.25" y="40" width="3.5" height="6.5" rx="1.75" fill="#1F1731" />
</svg>
`;
}

function ensureDirs() {
  for (const rel of [
    'artwork/bottles',
    'artwork/environment',
    'artwork/effects',
    'artwork/icons',
    'public/assets/bottles',
    'public/assets/environment',
    'public/assets/effects',
    'public/assets/icons',
  ]) {
    mkdirSync(join(ROOT, rel), { recursive: true });
  }
}

function main() {
  ensureDirs();

  for (const spec of BOTTLE_SPECS) {
    const svg = buildBottleSvg(spec);
    writeFileSync(join(ROOT, 'artwork/bottles', `${spec.id}.svg`), svg, 'utf8');
  }

  writeFileSync(join(ROOT, 'artwork/environment/background.svg'), buildBackgroundSvg(), 'utf8');
  writeFileSync(join(ROOT, 'artwork/environment/shelf.svg'), buildShelfSvg(), 'utf8');
  writeFileSync(join(ROOT, 'artwork/environment/shelf-edge.svg'), buildShelfEdgeSvg(), 'utf8');
  writeFileSync(
    join(ROOT, 'artwork/environment/hidden-compartment.svg'),
    buildHiddenCompartmentSvg(),
    'utf8',
  );
  writeFileSync(join(ROOT, 'artwork/environment/hidden-slot.svg'), buildHiddenSlotSvg(), 'utf8');

  writeFileSync(join(ROOT, 'artwork/effects/bottle-shadow.svg'), buildBottleShadowSvg(), 'utf8');
  writeFileSync(join(ROOT, 'artwork/effects/selection-glow.svg'), buildSelectionGlowSvg(), 'utf8');
  writeFileSync(join(ROOT, 'artwork/effects/sparkle.svg'), buildSparkleSvg(), 'utf8');
  writeFileSync(join(ROOT, 'artwork/effects/particle.svg'), buildParticleSvg(), 'utf8');

  const lockSvg = buildLockIconSvg();
  writeFileSync(join(ROOT, 'artwork/icons/lock.svg'), lockSvg, 'utf8');
  writeFileSync(join(ROOT, 'public/assets/icons/lock.svg'), lockSvg, 'utf8');

  console.log(`Generated ${BOTTLE_SPECS.length} bottle SVGs and 10 environment/effect/icon SVGs.`);
}

main();
