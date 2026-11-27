import { computeModalBounds } from '../../design-system/layout/LayoutConstraints';
import type { ViewportOrientation } from '../../design-system/tokens/Breakpoints';
import { Dimens } from '../../design-system/tokens/Dimens';
import type { LayoutProfile } from './LayoutProfile';
import { resolveLayoutProfile } from './LayoutProfileResolver';
import { createViewportMetrics, type PartialSafeAreaInsets } from './ViewportMetrics';

export type VictoryLayoutMode = 'landscape' | 'compact-landscape' | 'portrait';

export interface VictoryLayoutOptions {
  readonly hasOptimalBadge: boolean;
  readonly hasPersonalBest: boolean;
  readonly hasMilestoneBanner: boolean;
  readonly isCampaignComplete: boolean;
  readonly secondaryActionCount: number;
  readonly safeArea?: PartialSafeAreaInsets;
}

export interface VictoryPoint {
  readonly x: number;
  readonly y: number;
}

export interface VictoryRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface VictoryLayoutMetrics {
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly orientation: ViewportOrientation;
  readonly profile: LayoutProfile;
  readonly mode: VictoryLayoutMode;
  readonly panelRect: VictoryRect;
  readonly contentWidth: number;
  readonly labelPosition: VictoryPoint;
  readonly starsPosition: VictoryPoint;
  readonly starSize: number;
  readonly starSpacing: number;
  readonly titlePosition: VictoryPoint;
  readonly titleFontScale: number;
  readonly optimalBadgePosition: VictoryPoint;
  readonly scorePosition: VictoryPoint;
  readonly scoreFontScale: number;
  readonly personalBestPosition: VictoryPoint;
  readonly personalBestMaxWidth: number;
  readonly statsRect: VictoryRect;
  readonly statsColumns: 2 | 4;
  readonly milestoneRect: VictoryRect | null;
  readonly primaryButtonRect: VictoryRect;
  readonly secondaryButtonRects: readonly VictoryRect[];
  readonly verticalGap: number;
}

/**
 * Pure responsive layout calculator for the Victory overlay.
 * Supports all 5 layout profiles and the full 14-viewport verification matrix
 * (320x480 through 1920x1080) with touch targets >= 44px and zero overlap.
 */
export function computeVictoryLayout(
  viewportWidth: number,
  viewportHeight: number,
  options: VictoryLayoutOptions,
): VictoryLayoutMetrics {
  const viewport = createViewportMetrics({
    width: viewportWidth,
    height: viewportHeight,
    ...(options.safeArea !== undefined ? { safeArea: options.safeArea } : {}),
  });
  const profile = resolveLayoutProfile(viewport);
  const secondaryCount = Math.max(1, Math.min(3, Math.floor(options.secondaryActionCount)));

  const isCompactLandscape =
    viewport.orientation === 'landscape' && viewport.effectiveHeight <= 480;
  const mode: VictoryLayoutMode = isCompactLandscape
    ? 'compact-landscape'
    : viewport.orientation === 'portrait'
      ? 'portrait'
      : 'landscape';

  if (mode === 'compact-landscape') {
    return computeCompactLandscapeLayout(viewport, profile, options, secondaryCount);
  }

  return computeSingleColumnLayout(viewport, profile, mode, options, secondaryCount);
}

function computeCompactLandscapeLayout(
  viewport: ReturnType<typeof createViewportMetrics>,
  profile: LayoutProfile,
  options: VictoryLayoutOptions,
  secondaryCount: number,
): VictoryLayoutMetrics {
  const modalBox = computeModalBounds(viewport, {
    maxWidth: 740,
    maxHeightRatio: 0.94,
  });
  const isUltraShort = viewport.effectiveHeight < 370;
  const panelWidth = Math.min(modalBox.width, 740);
  const panelHeight = Math.min(modalBox.maxHeight, isUltraShort ? 304 : 344);
  const padX = isUltraShort ? Dimens.Space16 : Dimens.Space20;
  const padY = isUltraShort ? Dimens.Space12 : Dimens.Space16;
  const colGap = isUltraShort ? Dimens.Space16 : Dimens.Space20;
  const innerWidth = panelWidth - padX * 2;
  const leftWidth = Math.round(innerWidth * 0.44);
  const rightWidth = innerWidth - leftWidth - colGap;

  const leftCenterX = -innerWidth / 2 + leftWidth / 2;
  const rightCenterX = innerWidth / 2 - rightWidth / 2;
  const topY = -panelHeight / 2 + padY;
  const bottomY = panelHeight / 2 - padY;

  // Left column: label, stars, title (+ optional optimal badge), score, optional PB
  const labelY = topY + (isUltraShort ? 8 : 10);
  const starSize = isUltraShort ? 28 : 34;
  const starSpacing = isUltraShort ? 6 : 8;
  const starsY = labelY + (isUltraShort ? 28 : 34);
  const titleY = starsY + (isUltraShort ? 32 : 38);
  const optimalBadgeY = titleY + (isUltraShort ? 22 : 24);
  const scoreY = options.hasOptimalBadge
    ? optimalBadgeY + (isUltraShort ? 34 : 42)
    : titleY + (isUltraShort ? 38 : 46);
  const pbY = Math.min(bottomY - 12, scoreY + (isUltraShort ? 34 : 44));

  // Right column: stats (2x2), optional milestone banner, primary CTA, secondary buttons row
  const buttonHeight = Math.max(44, isUltraShort ? 44 : Dimens.MinTouchTarget);
  const btnGap = isUltraShort ? Dimens.Space6 : Dimens.Space8;
  const secondaryRowY = bottomY - buttonHeight / 2;
  const primaryButtonY = secondaryRowY - buttonHeight - btnGap;

  const availableTopRight = primaryButtonY - buttonHeight / 2 - topY - btnGap;
  const statsHeight = options.hasMilestoneBanner
    ? Math.min(90, Math.max(66, Math.round(availableTopRight * 0.56)))
    : Math.min(104, Math.max(72, availableTopRight - 4));
  const statsCenterY = topY + statsHeight / 2 + 2;

  let milestoneRect: VictoryRect | null = null;
  if (options.hasMilestoneBanner) {
    const bannerTop = statsCenterY + statsHeight / 2 + btnGap;
    const bannerBottom = primaryButtonY - buttonHeight / 2 - btnGap;
    const bannerHeight = Math.max(38, Math.min(82, bannerBottom - bannerTop));
    milestoneRect = {
      x: rightCenterX,
      y: Math.round((bannerTop + bannerBottom) / 2),
      width: rightWidth,
      height: bannerHeight,
    };
  }

  const secondaryGap = isUltraShort ? Dimens.Space6 : Dimens.Space8;
  const secondaryWidth = Math.floor(
    (rightWidth - secondaryGap * (secondaryCount - 1)) / secondaryCount,
  );
  const secondaryRects: VictoryRect[] = [];
  const startSecX = rightCenterX - rightWidth / 2 + secondaryWidth / 2;
  for (let i = 0; i < secondaryCount; i += 1) {
    secondaryRects.push({
      x: Math.round(startSecX + i * (secondaryWidth + secondaryGap)),
      y: Math.round(secondaryRowY),
      width: secondaryWidth,
      height: buttonHeight,
    });
  }

  return {
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
    orientation: 'landscape',
    profile,
    mode: 'compact-landscape',
    panelRect: {
      x: modalBox.centerX,
      y: modalBox.centerY,
      width: panelWidth,
      height: panelHeight,
    },
    contentWidth: innerWidth,
    labelPosition: { x: leftCenterX, y: Math.round(labelY) },
    starsPosition: { x: leftCenterX, y: Math.round(starsY) },
    starSize,
    starSpacing,
    titlePosition: { x: leftCenterX, y: Math.round(titleY) },
    titleFontScale: isUltraShort ? 0.78 : 0.84,
    optimalBadgePosition: { x: leftCenterX, y: Math.round(optimalBadgeY) },
    scorePosition: { x: leftCenterX, y: Math.round(scoreY) },
    scoreFontScale: isUltraShort ? 0.78 : 0.86,
    personalBestPosition: { x: leftCenterX, y: Math.round(pbY) },
    personalBestMaxWidth: leftWidth,
    statsRect: {
      x: rightCenterX,
      y: Math.round(statsCenterY),
      width: rightWidth,
      height: statsHeight,
    },
    statsColumns: 2,
    milestoneRect,
    primaryButtonRect: {
      x: rightCenterX,
      y: Math.round(primaryButtonY),
      width: rightWidth,
      height: buttonHeight,
    },
    secondaryButtonRects: secondaryRects,
    verticalGap: btnGap,
  };
}

function computeSingleColumnLayout(
  viewport: ReturnType<typeof createViewportMetrics>,
  profile: LayoutProfile,
  mode: 'landscape' | 'portrait',
  options: VictoryLayoutOptions,
  secondaryCount: number,
): VictoryLayoutMetrics {
  const isPortrait = mode === 'portrait';
  const effectiveH = viewport.effectiveHeight;
  const isUltraTightPortrait = isPortrait && effectiveH < 560;
  const isTightPortrait = isPortrait && effectiveH <= 680;
  const isTightLandscape = !isPortrait && effectiveH <= 600;
  const isTight = isTightPortrait || isTightLandscape;

  const maxPanelWidth = isPortrait ? 456 : options.isCampaignComplete ? 580 : 540;
  const modalBox = computeModalBounds(viewport, {
    maxWidth: maxPanelWidth,
    maxHeightRatio: isUltraTightPortrait ? 0.96 : 0.94,
  });

  const panelWidth = modalBox.width;
  const padX = isUltraTightPortrait ? Dimens.Space12 : isPortrait ? Dimens.Space20 : Dimens.Space24;
  const padY = isUltraTightPortrait ? Dimens.Space12 : isTight ? Dimens.Space16 : Dimens.Space24;
  const contentWidth = panelWidth - padX * 2;

  const starSize = isUltraTightPortrait ? 26 : isTight ? 34 : isPortrait ? 40 : 44;
  const starSpacing = isUltraTightPortrait ? 8 : isTight ? 10 : 12;
  const primaryButtonHeight = Math.max(44, isUltraTightPortrait ? 44 : isTight ? 46 : 52);
  const secondaryButtonHeight = Math.max(44, isTight ? 44 : 46);
  const statsColumns: 2 | 4 = contentWidth < 340 ? 2 : 4;
  const statsHeight =
    statsColumns === 2 ? (isUltraTightPortrait ? 64 : isTight ? 84 : 94) : isTight ? 58 : 66;
  const milestoneHeight = !options.hasMilestoneBanner
    ? 0
    : options.isCampaignComplete
      ? isUltraTightPortrait
        ? 54
        : isTight
          ? 86
          : 98
      : isUltraTightPortrait
        ? 40
        : isTight
          ? 52
          : 60;

  const labelH = isUltraTightPortrait ? 14 : 18;
  const starsH = starSize + 4;
  const titleH = isUltraTightPortrait ? 24 : isTight ? 28 : 34;
  const optimalH = options.hasOptimalBadge ? (isUltraTightPortrait ? 20 : 24) : 0;
  const scoreH = isUltraTightPortrait ? 40 : isTight ? 52 : 62;
  const pbH = options.hasPersonalBest ? (isUltraTightPortrait ? 20 : isTight ? 26 : 30) : 0;

  const sectionCount =
    5 +
    (options.hasOptimalBadge ? 1 : 0) +
    (options.hasPersonalBest ? 1 : 0) +
    (options.hasMilestoneBanner ? 1 : 0);

  const rawContentSum =
    labelH +
    starsH +
    titleH +
    optimalH +
    scoreH +
    pbH +
    statsHeight +
    milestoneHeight +
    primaryButtonHeight +
    secondaryButtonHeight;

  const maxPanelHeight = modalBox.maxHeight;
  const defaultGap = isUltraTightPortrait ? 4 : isTight ? 8 : 12;
  const availableForGaps = maxPanelHeight - padY * 2 - rawContentSum;
  const verticalGap = Math.max(
    isUltraTightPortrait ? 3 : 5,
    Math.min(defaultGap, Math.floor(availableForGaps / Math.max(1, sectionCount))),
  );

  const panelHeight = Math.min(
    maxPanelHeight,
    padY * 2 +
      rawContentSum +
      verticalGap * sectionCount +
      (isUltraTightPortrait ? 2 : Dimens.Space6),
  );

  // Stack top-to-bottom centred inside the panel
  let cursorY = -panelHeight / 2 + padY;

  const labelY = cursorY + labelH / 2;
  cursorY += labelH + verticalGap;

  const starsY = cursorY + starsH / 2;
  cursorY += starsH + Math.max(3, verticalGap - 2);

  const titleY = cursorY + titleH / 2;
  cursorY += titleH + (options.hasOptimalBadge ? (isUltraTightPortrait ? 3 : 6) : verticalGap);

  const optimalBadgeY = cursorY + optimalH / 2;
  if (options.hasOptimalBadge) {
    cursorY += optimalH + verticalGap;
  }

  const scoreY = cursorY + scoreH / 2;
  cursorY += scoreH + (options.hasPersonalBest ? Math.max(3, verticalGap - 4) : verticalGap);

  const pbY = cursorY + pbH / 2;
  if (options.hasPersonalBest) {
    cursorY += pbH + verticalGap;
  }

  const statsCenterY = cursorY + statsHeight / 2;
  cursorY += statsHeight + verticalGap;

  // Anchor buttons cleanly to the bottom of the panel
  const bottomY = panelHeight / 2 - padY;
  const buttonGap = isUltraTightPortrait ? Dimens.Space6 : Dimens.Space10;
  const secondaryRowY = bottomY - secondaryButtonHeight / 2;
  const primaryButtonY =
    secondaryRowY - secondaryButtonHeight / 2 - buttonGap - primaryButtonHeight / 2;

  let milestoneRect: VictoryRect | null = null;
  if (options.hasMilestoneBanner) {
    const maxBannerBottom = primaryButtonY - primaryButtonHeight / 2 - verticalGap;
    const clampedBannerH = Math.max(32, Math.min(milestoneHeight, maxBannerBottom - cursorY));
    milestoneRect = {
      x: 0,
      y: Math.round(cursorY + clampedBannerH / 2),
      width: contentWidth,
      height: clampedBannerH,
    };
  }

  const secondaryGap = isUltraTightPortrait ? Dimens.Space6 : Dimens.Space10;
  const secondaryWidth = Math.floor(
    (contentWidth - secondaryGap * (secondaryCount - 1)) / secondaryCount,
  );
  const secondaryRects: VictoryRect[] = [];
  const startSecX = -contentWidth / 2 + secondaryWidth / 2;
  for (let i = 0; i < secondaryCount; i += 1) {
    secondaryRects.push({
      x: Math.round(startSecX + i * (secondaryWidth + secondaryGap)),
      y: Math.round(secondaryRowY),
      width: secondaryWidth,
      height: secondaryButtonHeight,
    });
  }

  return {
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
    orientation: mode === 'portrait' ? 'portrait' : 'landscape',
    profile,
    mode,
    panelRect: {
      x: modalBox.centerX,
      y: modalBox.centerY,
      width: panelWidth,
      height: panelHeight,
    },
    contentWidth,
    labelPosition: { x: 0, y: Math.round(labelY) },
    starsPosition: { x: 0, y: Math.round(starsY) },
    starSize,
    starSpacing,
    titlePosition: { x: 0, y: Math.round(titleY) },
    titleFontScale: isUltraTightPortrait ? 0.78 : isTight ? 0.86 : 1,
    optimalBadgePosition: { x: 0, y: Math.round(optimalBadgeY) },
    scorePosition: { x: 0, y: Math.round(scoreY) },
    scoreFontScale: isUltraTightPortrait ? 0.76 : isTight ? 0.86 : 1,
    personalBestPosition: { x: 0, y: Math.round(pbY) },
    personalBestMaxWidth: contentWidth,
    statsRect: {
      x: 0,
      y: Math.round(statsCenterY),
      width: contentWidth,
      height: statsHeight,
    },
    statsColumns,
    milestoneRect,
    primaryButtonRect: {
      x: 0,
      y: Math.round(primaryButtonY),
      width: contentWidth,
      height: primaryButtonHeight,
    },
    secondaryButtonRects: secondaryRects,
    verticalGap,
  };
}
