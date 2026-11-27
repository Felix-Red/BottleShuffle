import { getResponsiveTokens } from '../../design-system/layout/ResponsiveTokens';
import {
  ensureMinimumTouchTarget,
  type ViewportOrientation,
} from '../../design-system/tokens/Breakpoints';
import { Dimens } from '../../design-system/tokens/Dimens';
import type { LayoutProfile } from './LayoutProfile';
import { isCompactProfile, resolveLayoutProfile } from './LayoutProfileResolver';
import { createViewportMetrics, type PartialSafeAreaInsets } from './ViewportMetrics';

export type SafeAreaInsets = PartialSafeAreaInsets;

export interface LevelSelectionLayoutInput {
  readonly width: number;
  readonly height: number;
  readonly levelCount: number;
  readonly chapterCount: number;
  readonly safeArea?: SafeAreaInsets;
  readonly minTouchTarget?: number;
}

export interface RectBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface LevelCardSlot {
  readonly index: number;
  readonly row: number;
  readonly col: number;
  /** Center X relative to grid viewport origin (0, 0 = top-left of grid bounds). */
  readonly x: number;
  /** Center Y relative to scrollable grid content top (0 = top of grid content). */
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface LevelSelectionLayout {
  readonly orientation: ViewportOrientation;
  readonly profile: LayoutProfile;
  readonly isCompact: boolean;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly header: RectBounds & {
    readonly backX: number;
    readonly backY: number;
    readonly titleX: number;
    readonly titleY: number;
    readonly summaryX: number;
    readonly summaryY: number;
    readonly summaryWidth: number;
    readonly showSummaryBar: boolean;
  };
  readonly chapterBanner: RectBounds;
  readonly chapterArtwork: RectBounds & {
    readonly bottleHeight: number;
    readonly simplified: boolean;
    readonly visible: boolean;
  };
  readonly chapterProgress: RectBounds;
  readonly grid: RectBounds & {
    readonly columns: number;
    readonly rows: number;
    readonly cardWidth: number;
    readonly cardHeight: number;
    readonly gapX: number;
    readonly gapY: number;
    readonly contentHeight: number;
    readonly scrollNeeded: boolean;
    readonly maxScrollY: number;
    readonly cards: readonly LevelCardSlot[];
  };
  readonly chapterNav: RectBounds & {
    readonly prevX: number;
    readonly nextX: number;
    readonly centerX: number;
    readonly centerY: number;
    readonly buttonSize: number;
  };
  readonly pagination: RectBounds & {
    readonly dotRadius: number;
    readonly dotSpacing: number;
    readonly maxVisibleWidth: number;
  };
}

function buildGridSlots(params: {
  readonly gridBounds: RectBounds;
  readonly levelCount: number;
  readonly minTouchTarget: number;
  readonly maxColumns: number;
  readonly minCardWidth: number;
  readonly maxCardWidth: number;
  readonly cardAspectRatio: number;
  readonly gapX: number;
  readonly gapY: number;
}): LevelSelectionLayout['grid'] {
  const safeCount = Math.max(0, Math.floor(params.levelCount));
  const { gridBounds, gapX, gapY } = params;

  const fitCols = Math.max(1, Math.floor((gridBounds.width + gapX) / (params.minCardWidth + gapX)));
  const columns = Math.max(
    1,
    Math.min(params.maxColumns, safeCount > 0 ? Math.min(safeCount, fitCols) : fitCols),
  );
  const rows = safeCount > 0 ? Math.ceil(safeCount / columns) : 0;

  const rawCardW = Math.floor((gridBounds.width - gapX * (columns - 1)) / columns);
  const cardWidth = Math.max(
    ensureMinimumTouchTarget(params.minTouchTarget),
    Math.min(params.maxCardWidth, rawCardW),
  );

  let cardHeight = Math.max(
    ensureMinimumTouchTarget(params.minTouchTarget),
    Math.round(cardWidth * params.cardAspectRatio),
  );

  // If 1 or 2 rows can fit without scrolling by slightly moderating height, prefer clean no-scroll fit
  if (rows > 0 && rows <= 2) {
    const maxNoScrollH = Math.floor((gridBounds.height - gapY * (rows - 1)) / rows);
    if (maxNoScrollH >= Math.max(72, ensureMinimumTouchTarget(params.minTouchTarget))) {
      cardHeight = Math.min(cardHeight, Math.min(138, maxNoScrollH));
    }
  } else {
    cardHeight = Math.min(126, cardHeight);
  }

  const totalRowW = columns * cardWidth + (columns - 1) * gapX;
  const startX = Math.round((gridBounds.width - totalRowW) / 2 + cardWidth / 2);
  const contentHeight = rows > 0 ? rows * cardHeight + (rows - 1) * gapY : 0;
  const scrollNeeded = contentHeight > gridBounds.height + 2;
  const maxScrollY = scrollNeeded ? Math.max(0, contentHeight - gridBounds.height) : 0;

  // Center vertically inside grid bounds when scrolling is not needed, capping portrait gap
  const verticalSlack = Math.max(0, gridBounds.height - contentHeight);
  const cappedTopSlack =
    params.maxColumns < 5 || gridBounds.height > gridBounds.width * 0.72
      ? Math.min(44, Math.round(verticalSlack * 0.35))
      : Math.round(verticalSlack / 2);
  const topOffset = scrollNeeded
    ? Math.round(cardHeight / 2)
    : Math.round(cappedTopSlack + cardHeight / 2);

  const cards: LevelCardSlot[] = [];
  for (let i = 0; i < safeCount; i += 1) {
    const row = Math.floor(i / columns);
    const col = i % columns;
    const x = Math.round(startX + col * (cardWidth + gapX));
    const y = Math.round(topOffset + row * (cardHeight + gapY));
    cards.push(
      Object.freeze({
        index: i,
        row,
        col,
        x,
        y,
        width: cardWidth,
        height: cardHeight,
      }),
    );
  }

  return Object.freeze({
    ...gridBounds,
    columns,
    rows,
    cardWidth,
    cardHeight,
    gapX,
    gapY,
    contentHeight,
    scrollNeeded,
    maxScrollY,
    cards: Object.freeze(cards),
  });
}

/**
 * Pure responsive layout calculator for LevelSelectionScene.
 * Supports all 5 layout profiles and the 14-viewport verification matrix
 * (320x480 through 1920x1080) with zero forced orientation.
 */
export function calculateLevelSelectionLayout(
  input: LevelSelectionLayoutInput,
): LevelSelectionLayout {
  const viewport = createViewportMetrics({
    width: input.width,
    height: input.height,
    ...(input.safeArea !== undefined ? { safeArea: input.safeArea } : {}),
  });
  const profile = resolveLayoutProfile(viewport);
  const tokens = getResponsiveTokens(profile);

  const viewportWidth = viewport.width;
  const viewportHeight = viewport.height;
  const minTouchTarget = Math.max(
    Dimens.MinTouchTarget,
    input.minTouchTarget ?? tokens.minTouchTarget,
  );

  const { safeArea, orientation, contentBounds } = viewport;
  const effectiveW = contentBounds.width;
  const effectiveH = contentBounds.height;

  const isCompact =
    isCompactProfile(profile) ||
    (orientation === 'landscape' ? effectiveH <= 440 : effectiveH <= 680 || effectiveW <= 380);
  const isUltraShortLandscape = orientation === 'landscape' && effectiveH < 370;
  const isUltraShortPortrait = orientation === 'portrait' && effectiveH < 540;

  const marginX = isCompact
    ? Dimens.Space12
    : orientation === 'landscape'
      ? Math.min(48, Math.round(effectiveW * 0.038))
      : tokens.screenPaddingX;

  const maxSpan = Math.min(tokens.maxContentWidth, effectiveW - marginX * 2);
  const usableWidth = Math.max(220, maxSpan);
  const usableLeft = Math.round(contentBounds.x + (effectiveW - usableWidth) / 2);
  const usableRight = usableLeft + usableWidth;

  const headerHeight = isUltraShortLandscape || isUltraShortPortrait ? 46 : isCompact ? 54 : 70;
  const headerTop = safeArea.top + (isCompact ? Dimens.Space4 : Dimens.Space10);
  const headerCenterY = Math.round(headerTop + headerHeight / 2);

  const backSize = Math.max(minTouchTarget, isCompact ? 44 : 48);
  const backX = Math.round(usableLeft + backSize / 2);
  const showSummaryBar = orientation === 'landscape' && usableWidth >= 560 && !isCompact;
  const summaryWidth = showSummaryBar ? 186 : usableWidth >= 360 ? 114 : 94;
  const summaryX = Math.round(usableRight - summaryWidth / 2);
  const titleX = Math.round(backX + backSize / 2 + (isCompact ? Dimens.Space10 : Dimens.Space16));

  const header: LevelSelectionLayout['header'] = Object.freeze({
    x: Math.round(usableLeft),
    y: Math.round(headerTop),
    width: Math.round(usableWidth),
    height: headerHeight,
    backX,
    backY: headerCenterY,
    titleX,
    titleY: headerCenterY,
    summaryX,
    summaryY: headerCenterY,
    summaryWidth,
    showSummaryBar,
  });

  const navHeight = isUltraShortLandscape || isUltraShortPortrait ? 46 : isCompact ? 48 : 58;
  const navBottomMargin = safeArea.bottom + (isCompact ? Dimens.Space6 : Dimens.Space16);
  const navTop = Math.round(viewportHeight - navBottomMargin - navHeight);
  const navButtonSize = Math.max(minTouchTarget, isCompact ? 44 : 48);

  const bodyTop = Math.round(
    headerTop +
      headerHeight +
      (isUltraShortLandscape ? Dimens.Space4 : isCompact ? Dimens.Space8 : Dimens.Space16),
  );
  const bodyBottom = Math.round(
    navTop - (isUltraShortLandscape ? Dimens.Space4 : isCompact ? Dimens.Space8 : Dimens.Space16),
  );
  const bodyHeight = Math.max(120, bodyBottom - bodyTop);

  if (orientation === 'landscape') {
    const colGap = isCompact ? Dimens.Space12 : Math.min(36, Math.round(usableWidth * 0.03));
    const leftRatio = isCompact ? 0.36 : 0.34;
    const leftWidth = Math.max(188, Math.min(430, Math.round((usableWidth - colGap) * leftRatio)));
    const rightWidth = Math.max(240, Math.round(usableWidth - leftWidth - colGap));
    const leftX = Math.round(usableLeft);
    const rightX = Math.round(usableLeft + leftWidth + colGap);

    const bannerH = isUltraShortLandscape ? 54 : isCompact ? 62 : 94;
    const progressH = isUltraShortLandscape ? 48 : isCompact ? 54 : 74;
    const sectionGap = isUltraShortLandscape
      ? Dimens.Space6
      : isCompact
        ? Dimens.Space8
        : Dimens.Space12;

    const remainingArtworkH = bodyHeight - bannerH - progressH - sectionGap * 2;
    const artworkVisible = remainingArtworkH >= 60;
    const artworkH = artworkVisible ? Math.max(60, Math.min(250, remainingArtworkH)) : 0;

    const leftTotalH =
      bannerH + progressH + (artworkVisible ? artworkH + sectionGap * 2 : sectionGap);
    const leftStartY = Math.round(bodyTop + Math.max(0, (bodyHeight - leftTotalH) / 2));

    const chapterBanner: RectBounds = Object.freeze({
      x: leftX,
      y: leftStartY,
      width: leftWidth,
      height: bannerH,
    });

    const artworkTop = leftStartY + bannerH + sectionGap;
    const chapterArtwork: LevelSelectionLayout['chapterArtwork'] = Object.freeze({
      x: leftX,
      y: artworkTop,
      width: leftWidth,
      height: artworkH,
      bottleHeight: Math.max(48, Math.min(isCompact ? 92 : 148, Math.round(artworkH * 0.72))),
      simplified: isCompact || artworkH < 120,
      visible: artworkVisible,
    });

    const progressTop = artworkVisible
      ? artworkTop + artworkH + sectionGap
      : leftStartY + bannerH + sectionGap;

    const chapterProgress: RectBounds = Object.freeze({
      x: leftX,
      y: progressTop,
      width: leftWidth,
      height: progressH,
    });

    const gridBounds: RectBounds = Object.freeze({
      x: rightX,
      y: bodyTop,
      width: rightWidth,
      height: bodyHeight,
    });

    const grid = buildGridSlots({
      gridBounds,
      levelCount: input.levelCount,
      minTouchTarget,
      maxColumns: 5,
      minCardWidth: isUltraShortLandscape ? 66 : isCompact ? 76 : 92,
      maxCardWidth: isCompact ? 116 : 134,
      cardAspectRatio: isCompact ? 0.94 : 1.08,
      gapX: isUltraShortLandscape ? Dimens.Space8 : isCompact ? Dimens.Space10 : Dimens.Space16,
      gapY: isUltraShortLandscape ? Dimens.Space8 : isCompact ? Dimens.Space10 : Dimens.Space16,
    });

    const navWidth = Math.min(usableWidth, 560);
    const navLeft = Math.round(usableLeft + (usableWidth - navWidth) / 2);
    const navCenterY = Math.round(navTop + navHeight / 2);
    const chapterNav: LevelSelectionLayout['chapterNav'] = Object.freeze({
      x: navLeft,
      y: navTop,
      width: Math.round(navWidth),
      height: navHeight,
      prevX: Math.round(navLeft + navButtonSize / 2),
      nextX: Math.round(navLeft + navWidth - navButtonSize / 2),
      centerX: Math.round(navLeft + navWidth / 2),
      centerY: navCenterY,
      buttonSize: navButtonSize,
    });

    const pagination: LevelSelectionLayout['pagination'] = Object.freeze({
      x: Math.round(navLeft + navButtonSize + Dimens.Space12),
      y: navTop,
      width: Math.max(120, Math.round(navWidth - navButtonSize * 2 - Dimens.Space24)),
      height: navHeight,
      dotRadius: isCompact ? 5 : 6,
      dotSpacing: isCompact ? 18 : 22,
      maxVisibleWidth: Math.max(120, Math.round(navWidth - navButtonSize * 2 - Dimens.Space24)),
    });

    return Object.freeze({
      orientation,
      profile,
      isCompact,
      viewportWidth,
      viewportHeight,
      header,
      chapterBanner,
      chapterArtwork,
      chapterProgress,
      grid,
      chapterNav,
      pagination,
    });
  }

  // Portrait layout: Header -> Chapter Banner -> Chapter Artwork -> Chapter Progress -> Level Grid -> Chapter Nav/Pagination
  const stackGap = isUltraShortPortrait
    ? Dimens.Space6
    : isCompact
      ? Dimens.Space8
      : Dimens.Space12;
  const bannerH = isUltraShortPortrait ? 52 : isCompact ? 62 : 78;
  const artworkH = isCompact ? 74 : Math.min(132, Math.round(effectiveH * 0.145));
  const progressH = isUltraShortPortrait ? 48 : isCompact ? 54 : 64;

  let cursorY = bodyTop;
  const chapterBanner: RectBounds = Object.freeze({
    x: Math.round(usableLeft),
    y: cursorY,
    width: Math.round(usableWidth),
    height: bannerH,
  });
  cursorY += bannerH + stackGap;

  const artworkVisible = effectiveH >= 560;
  const chapterArtwork: LevelSelectionLayout['chapterArtwork'] = Object.freeze({
    x: Math.round(usableLeft),
    y: cursorY,
    width: Math.round(usableWidth),
    height: artworkVisible ? artworkH : 0,
    bottleHeight: Math.max(52, Math.min(108, Math.round(artworkH * 0.78))),
    simplified: isCompact || artworkH < 96,
    visible: artworkVisible,
  });
  if (artworkVisible) {
    cursorY += artworkH + stackGap;
  }

  const chapterProgress: RectBounds = Object.freeze({
    x: Math.round(usableLeft),
    y: cursorY,
    width: Math.round(usableWidth),
    height: progressH,
  });
  cursorY += progressH + stackGap;

  const gridHeight = Math.max(116, bodyBottom - cursorY);
  const gridBounds: RectBounds = Object.freeze({
    x: Math.round(usableLeft),
    y: cursorY,
    width: Math.round(usableWidth),
    height: gridHeight,
  });

  const portraitMaxCols = usableWidth >= 460 ? 5 : usableWidth >= 340 ? 4 : 3;
  const grid = buildGridSlots({
    gridBounds,
    levelCount: input.levelCount,
    minTouchTarget,
    maxColumns: portraitMaxCols,
    minCardWidth: usableWidth < 360 ? 72 : 78,
    maxCardWidth: 108,
    cardAspectRatio: isCompact ? 0.96 : 1.06,
    gapX: isCompact ? Dimens.Space8 : Dimens.Space10,
    gapY: isCompact ? Dimens.Space8 : Dimens.Space12,
  });

  const navCenterY = Math.round(navTop + navHeight / 2);
  const chapterNav: LevelSelectionLayout['chapterNav'] = Object.freeze({
    x: Math.round(usableLeft),
    y: navTop,
    width: Math.round(usableWidth),
    height: navHeight,
    prevX: Math.round(usableLeft + navButtonSize / 2),
    nextX: Math.round(usableRight - navButtonSize / 2),
    centerX: Math.round(usableLeft + usableWidth / 2),
    centerY: navCenterY,
    buttonSize: navButtonSize,
  });

  const pagination: LevelSelectionLayout['pagination'] = Object.freeze({
    x: Math.round(usableLeft + navButtonSize + Dimens.Space8),
    y: navTop,
    width: Math.max(100, Math.round(usableWidth - navButtonSize * 2 - Dimens.Space16)),
    height: navHeight,
    dotRadius: isCompact ? 5 : 6,
    dotSpacing: isCompact ? 16 : 20,
    maxVisibleWidth: Math.max(100, Math.round(usableWidth - navButtonSize * 2 - Dimens.Space16)),
  });

  return Object.freeze({
    orientation,
    profile,
    isCompact,
    viewportWidth,
    viewportHeight,
    header,
    chapterBanner,
    chapterArtwork,
    chapterProgress,
    grid,
    chapterNav,
    pagination,
  });
}
