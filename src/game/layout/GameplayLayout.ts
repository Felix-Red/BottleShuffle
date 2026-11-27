import { getResponsiveTokens } from '../../design-system/layout/ResponsiveTokens';
import { Dimens } from '../../design-system/tokens/Dimens';
import {
  calculateBottleRackLayout,
  type BottleRackLayoutResult,
} from '../components/environment/bottleLayout';
import type { LayoutProfile } from './LayoutProfile';
import { isCompactProfile, resolveLayoutProfile } from './LayoutProfileResolver';
import {
  createViewportMetrics,
  type ContentBounds,
  type PartialSafeAreaInsets,
} from './ViewportMetrics';

export interface GameplayLayoutInput {
  readonly width: number;
  readonly height: number;
  readonly bottleCount: number;
  readonly showCountdownBar?: boolean;
  readonly safeAreaTop?: number;
  readonly safeAreaBottom?: number;
  readonly safeArea?: PartialSafeAreaInsets;
}

export interface GameplayHeaderLayout {
  readonly width: number;
  readonly height: number;
  readonly y: number;
  readonly leftInset?: number;
  readonly rightInset?: number;
}

export interface GameplayHudLayout {
  readonly orientation: 'landscape' | 'portrait';
  readonly scale: number;
  readonly topY: number;
  readonly height: number;
  readonly matchCounterX: number;
  readonly matchCounterY: number;
  readonly matchCounterWidth: number;
  readonly moveCounterX: number;
  readonly moveCounterY: number;
  readonly timerX: number;
  readonly timerY: number;
  readonly statWidth: number;
  readonly statHeight: number;
  readonly feedbackX: number;
  readonly feedbackY: number;
  readonly countdownBar: {
    readonly visible: boolean;
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
}

export interface GameplayBoardLayout {
  readonly centerX: number;
  readonly rackX: number;
  readonly rackY: number;
  readonly rackAvailableWidth: number;
  readonly rackAvailableHeight: number;
  readonly rackVerticalSpacing: number;
  readonly rackLayout: BottleRackLayoutResult;
  readonly hiddenRackX: number;
  readonly hiddenRackY: number;
  readonly hiddenRackWidth: number;
  readonly hiddenRackHeight: number;
  readonly hiddenScale: number;
  readonly showHiddenLabel: boolean;
  readonly hiddenRows: 1 | 2;
}

export interface GameplayInstructionsLayout {
  readonly x: number;
  readonly y: number;
  readonly height: number;
  readonly maxWidth: number;
}

export interface GameplayLayout {
  readonly width: number;
  readonly height: number;
  readonly orientation: 'landscape' | 'portrait';
  readonly profile: LayoutProfile;
  readonly isCompact: boolean;
  readonly contentBounds: ContentBounds;
  readonly header: GameplayHeaderLayout;
  readonly hud: GameplayHudLayout;
  readonly board: GameplayBoardLayout;
  readonly instructions: GameplayInstructionsLayout;
  readonly modalBounds: { readonly width: number; readonly height: number };
}

function estimateHiddenCompartmentHeight(
  rows: 1 | 2,
  availableWidth: number,
  count: number,
  includeCaption: boolean,
): number {
  const maxCols = rows === 1 ? count : Math.ceil(count / 2);
  const gapX = availableWidth < 520 ? Dimens.Space6 : Dimens.Space10;
  const usableW = Math.max(160, availableWidth - Dimens.Space32);
  const maxSlotW = Math.floor((usableW - gapX * (maxCols - 1)) / maxCols);
  const slotW = Math.min(82, Math.max(40, maxSlotW));
  const slotH = Math.min(64, Math.max(40, Math.round(slotW * 0.78)));
  const innerH = rows * slotH + (rows - 1) * Dimens.Space8;
  return innerH + Dimens.Space24 + (includeCaption ? Dimens.Space24 : 0);
}

export function calculateGameplayLayout(input: GameplayLayoutInput): GameplayLayout {
  const mergedSafeArea: PartialSafeAreaInsets = {
    top: input.safeArea?.top ?? input.safeAreaTop ?? 0,
    right: input.safeArea?.right ?? 0,
    bottom: input.safeArea?.bottom ?? input.safeAreaBottom ?? 0,
    left: input.safeArea?.left ?? 0,
  };

  const viewport = createViewportMetrics({
    width: input.width,
    height: input.height,
    safeArea: mergedSafeArea,
  });
  const profile = resolveLayoutProfile(viewport);
  const tokens = getResponsiveTokens(profile);

  const { width, height, orientation, safeArea, contentBounds } = viewport;
  const effectiveW = contentBounds.width;
  const effectiveH = contentBounds.height;

  const isCompact = isCompactProfile(profile) || effectiveW < 640 || effectiveH < 480;
  const isShortLandscape = orientation === 'landscape' && effectiveH < 460;
  const isUltraShortLandscape = orientation === 'landscape' && effectiveH < 370;
  const isShortPortrait = orientation === 'portrait' && effectiveH < 700;
  const isUltraShortPortrait = orientation === 'portrait' && effectiveH < 560;

  const centerX = contentBounds.centerX;
  const padX = isCompact ? Dimens.ScreenPaddingCompact : tokens.screenPaddingX;
  const contentWidth = Math.max(220, Math.min(tokens.maxContentWidth, effectiveW - padX * 2));

  const headerHeight = isUltraShortLandscape
    ? 44
    : isShortLandscape
      ? 48
      : isCompact
        ? Dimens.HeaderHeightCompact
        : tokens.headerHeight;
  const header: GameplayHeaderLayout = {
    width,
    height: headerHeight,
    y: safeArea.top,
    leftInset: safeArea.left,
    rightInset: safeArea.right,
  };

  const instructionsHeight =
    isUltraShortLandscape || isUltraShortPortrait
      ? 18
      : isShortLandscape || isShortPortrait
        ? 22
        : isCompact
          ? 34
          : 42;
  const instructionsBottomMargin =
    isShortLandscape || isShortPortrait ? Dimens.Space4 : Dimens.Space6;
  const instructionsY = Math.round(
    contentBounds.bottom - instructionsHeight / 2 - instructionsBottomMargin,
  );
  const instructions: GameplayInstructionsLayout = {
    x: centerX,
    y: instructionsY,
    height: instructionsHeight,
    maxWidth: Math.min(640, contentWidth),
  };

  if (orientation === 'landscape') {
    const hudScale = isUltraShortLandscape ? 0.68 : isShortLandscape ? 0.78 : 1;
    const hudTopY =
      safeArea.top +
      headerHeight +
      (isUltraShortLandscape
        ? Dimens.Space2
        : isShortLandscape
          ? Dimens.Space4
          : isCompact
            ? Dimens.Space8
            : Dimens.Space16);
    const hudHeight = isUltraShortLandscape ? 54 : isShortLandscape ? 68 : isCompact ? 94 : 110;
    const hudCenterY = Math.round(hudTopY + hudHeight / 2);

    const maxClusterW = Math.min(1080, contentWidth);
    const clusterGap = isUltraShortLandscape
      ? Dimens.Space8
      : isShortLandscape
        ? Dimens.Space12
        : Dimens.Space20;

    // Guarantee MatchCounter + 2 side stat cards never exceed maxClusterW horizontally
    const matchCounterWidth = Math.min(
      isCompact ? 290 : 380,
      Math.max(196, Math.round((maxClusterW * 0.42) / hudScale)),
    );
    const scaledMatchW = matchCounterWidth * hudScale;
    const availablePerSide = Math.max(88, (maxClusterW - scaledMatchW) / 2 - clusterGap);
    const statWidth = Math.min(
      isCompact ? 156 : 186,
      Math.max(106, Math.floor(availablePerSide / hudScale)),
    );
    const statHeight = isUltraShortLandscape ? 60 : isCompact ? 68 : 78;
    const halfCluster = (matchCounterWidth / 2 + statWidth / 2) * hudScale + clusterGap;

    const showCountdownBar = input.showCountdownBar === true;
    const countdownBarHeight = isUltraShortLandscape ? 8 : isShortLandscape ? 9 : 11;
    const countdownBarGap = isShortLandscape ? Dimens.Space4 : Dimens.Space6;
    const countdownExtraH = showCountdownBar ? countdownBarGap + countdownBarHeight : 0;
    const countdownBarWidth = Math.min(
      maxClusterW,
      Math.round(scaledMatchW + (statWidth * hudScale + clusterGap) * 2),
    );
    const countdownBarY = Math.round(
      hudTopY + hudHeight + countdownBarGap + countdownBarHeight / 2,
    );

    const hud: GameplayHudLayout = {
      orientation: 'landscape',
      scale: hudScale,
      topY: hudTopY,
      height: hudHeight + countdownExtraH,
      matchCounterX: centerX,
      matchCounterY: hudCenterY,
      matchCounterWidth,
      moveCounterX: Math.round(centerX - halfCluster),
      moveCounterY: hudCenterY,
      timerX: Math.round(centerX + halfCluster),
      timerY: hudCenterY,
      statWidth,
      statHeight,
      feedbackX: centerX,
      feedbackY: Math.round(
        hudTopY + hudHeight + countdownExtraH + (isShortLandscape ? Dimens.Space2 : Dimens.Space8),
      ),
      countdownBar: {
        visible: showCountdownBar,
        x: centerX,
        y: countdownBarY,
        width: countdownBarWidth,
        height: countdownBarHeight,
      },
    };

    const boardTopY =
      hudTopY +
      hud.height +
      (isUltraShortLandscape
        ? Dimens.Space4
        : isShortLandscape
          ? Dimens.Space8
          : isCompact
            ? Dimens.Space12
            : Dimens.Space20);
    const boardBottomY =
      instructionsY - instructionsHeight / 2 - (isShortLandscape ? Dimens.Space4 : Dimens.Space10);
    const totalBoardHeight = Math.max(116, boardBottomY - boardTopY);
    const rackAvailableWidth = Math.min(1140, contentWidth);

    const showHiddenLabel = !isShortLandscape;
    const rackGap = isUltraShortLandscape
      ? Dimens.Space8
      : isShortLandscape
        ? Dimens.Space12
        : Dimens.Space20;
    const rackVerticalSpacing = isShortLandscape ? Dimens.Space12 : tokens.rackVerticalSpacing;

    const targetHiddenScale = isUltraShortLandscape ? 0.56 : isShortLandscape ? 0.72 : 1;
    const rawSingleRowHiddenH = estimateHiddenCompartmentHeight(
      1,
      rackAvailableWidth,
      input.bottleCount,
      showHiddenLabel,
    );
    const reservedHiddenH = Math.round(
      Math.min(rawSingleRowHiddenH * targetHiddenScale, totalBoardHeight * 0.34),
    );
    const rackAvailableHeight = Math.max(82, totalBoardHeight - reservedHiddenH - rackGap);

    const rackLayout = calculateBottleRackLayout({
      availableWidth: rackAvailableWidth,
      availableHeight: rackAvailableHeight,
      bottleCount: input.bottleCount,
      aspectRatio: effectiveW / effectiveH,
      horizontalSpacing: tokens.bottleSlotSpacing,
      verticalSpacing: rackVerticalSpacing,
      maxBottleWidth: isUltraShortLandscape ? 48 : isShortLandscape ? 58 : isCompact ? 74 : 98,
      maxBottleHeight: isUltraShortLandscape ? 96 : isShortLandscape ? 116 : isCompact ? 148 : 196,
    });

    const hiddenRows: 1 | 2 = rackLayout.rows === 2 ? 2 : 1;
    const hiddenRackWidth = Math.min(rackAvailableWidth, rackLayout.rackWidth);
    const rawHiddenHeight = estimateHiddenCompartmentHeight(
      hiddenRows,
      hiddenRackWidth,
      rackLayout.bottleCount,
      showHiddenLabel,
    );
    const maxHiddenHeight = Math.max(32, totalBoardHeight - rackLayout.rackHeight - rackGap);
    const hiddenScale = Math.min(targetHiddenScale, maxHiddenHeight / rawHiddenHeight);
    const hiddenRackHeight = Math.min(maxHiddenHeight, Math.round(rawHiddenHeight * hiddenScale));

    const combinedH = rackLayout.rackHeight + rackGap + hiddenRackHeight;
    const blockStartY = boardTopY + Math.max(0, (totalBoardHeight - combinedH) / 2);
    const rackY = Math.round(blockStartY + rackLayout.rackHeight / 2);
    const captionOffset = showHiddenLabel ? (Dimens.Space24 * hiddenScale) / 2 : 0;
    const hiddenRackY = Math.round(
      rackY + rackLayout.rackHeight / 2 + rackGap + hiddenRackHeight / 2 - captionOffset,
    );

    return {
      width,
      height,
      orientation,
      profile,
      isCompact,
      contentBounds,
      header,
      hud,
      board: {
        centerX,
        rackX: centerX,
        rackY,
        rackAvailableWidth,
        rackAvailableHeight,
        rackVerticalSpacing,
        rackLayout,
        hiddenRackX: centerX,
        hiddenRackY,
        hiddenRackWidth,
        hiddenRackHeight,
        hiddenScale,
        showHiddenLabel,
        hiddenRows,
      },
      instructions,
      modalBounds: { width, height },
    };
  }

  // Portrait layout: Header -> MatchCounter -> Move + Timer row -> BottleRack -> HiddenCompartment -> Instructions
  const hudScale = isUltraShortPortrait ? 0.74 : isShortPortrait ? 0.82 : 1;
  const hudTopY =
    safeArea.top +
    headerHeight +
    (isUltraShortPortrait ? Dimens.Space4 : isShortPortrait ? Dimens.Space6 : Dimens.Space12);
  const matchCounterWidth = Math.min(440, Math.round(contentWidth / hudScale));
  const matchCounterY = Math.round(hudTopY + 42 * hudScale);
  const feedbackY = Math.round(matchCounterY + (isUltraShortPortrait ? 44 : 52) * hudScale);

  const statHeight = isUltraShortPortrait ? 52 : isCompact ? 60 : 70;
  const statGap = isShortPortrait ? Dimens.Space8 : Dimens.Space12;
  const maxScaledRowW = Math.min(440, contentWidth);
  const statWidth = Math.min(
    206,
    Math.max(114, Math.floor((maxScaledRowW - statGap) / (2 * hudScale))),
  );
  const statsRowY = Math.round(
    feedbackY +
      (isUltraShortPortrait ? 8 : isShortPortrait ? 12 : 18) +
      (statHeight * hudScale) / 2,
  );
  const showCountdownBar = input.showCountdownBar === true;
  const countdownBarHeight = isUltraShortPortrait ? 8 : isShortPortrait ? 9 : 11;
  const countdownBarGap = isShortPortrait ? Dimens.Space6 : Dimens.Space8;
  const statsBottomY = Math.round(statsRowY + (statHeight * hudScale) / 2);
  const countdownBarY = Math.round(statsBottomY + countdownBarGap + countdownBarHeight / 2);
  const hudBottomY = showCountdownBar
    ? Math.round(countdownBarY + countdownBarHeight / 2)
    : statsBottomY;

  const hud: GameplayHudLayout = {
    orientation: 'portrait',
    scale: hudScale,
    topY: hudTopY,
    height: hudBottomY - hudTopY,
    matchCounterX: centerX,
    matchCounterY,
    matchCounterWidth,
    moveCounterX: Math.round(centerX - (statWidth * hudScale) / 2 - statGap / 2),
    moveCounterY: statsRowY,
    timerX: Math.round(centerX + (statWidth * hudScale) / 2 + statGap / 2),
    timerY: statsRowY,
    statWidth,
    statHeight,
    feedbackX: centerX,
    feedbackY,
    countdownBar: {
      visible: showCountdownBar,
      x: centerX,
      y: countdownBarY,
      width: maxScaledRowW,
      height: countdownBarHeight,
    },
  };

  const boardTopY =
    hudBottomY +
    (isUltraShortPortrait ? Dimens.Space6 : isShortPortrait ? Dimens.Space8 : Dimens.Space16);
  const boardBottomY =
    instructionsY -
    instructionsHeight / 2 -
    (isUltraShortPortrait ? Dimens.Space4 : isShortPortrait ? Dimens.Space6 : Dimens.Space8);
  const totalBoardHeight = Math.max(136, boardBottomY - boardTopY);
  const rackAvailableWidth = Math.min(540, contentWidth);

  const showHiddenLabel = !isShortPortrait;
  const tentativeRows: 1 | 2 = input.bottleCount >= 6 ? 2 : 1;
  const rawTentativeHiddenH = estimateHiddenCompartmentHeight(
    tentativeRows,
    rackAvailableWidth,
    input.bottleCount,
    showHiddenLabel,
  );
  const targetHiddenScale = isUltraShortPortrait ? 0.62 : isShortPortrait ? 0.82 : 1;
  const rackGap = isUltraShortPortrait
    ? Dimens.Space8
    : isShortPortrait
      ? Dimens.Space12
      : Dimens.Space16;
  const rackVerticalSpacing = isUltraShortPortrait
    ? Dimens.Space10
    : isShortPortrait
      ? Dimens.Space16
      : tokens.rackVerticalSpacing;

  const reservedHiddenH = Math.round(
    Math.min(rawTentativeHiddenH * targetHiddenScale, totalBoardHeight * 0.34),
  );
  const rackAvailableHeight = Math.max(88, totalBoardHeight - reservedHiddenH - rackGap);

  const rackLayout = calculateBottleRackLayout({
    availableWidth: rackAvailableWidth,
    availableHeight: rackAvailableHeight,
    bottleCount: input.bottleCount,
    aspectRatio: effectiveW / effectiveH,
    horizontalSpacing: tokens.bottleSlotSpacing,
    verticalSpacing: rackVerticalSpacing,
    maxBottleWidth: isUltraShortPortrait ? 44 : isShortPortrait ? 52 : 84,
    maxBottleHeight: isUltraShortPortrait ? 88 : isShortPortrait ? 104 : 168,
  });

  const hiddenRows: 1 | 2 = rackLayout.rows === 2 ? 2 : 1;
  const hiddenRackWidth = Math.min(rackAvailableWidth, rackLayout.rackWidth);
  const rawHiddenHeight = estimateHiddenCompartmentHeight(
    hiddenRows,
    hiddenRackWidth,
    rackLayout.bottleCount,
    showHiddenLabel,
  );
  const maxHiddenHeight = Math.max(36, totalBoardHeight - rackLayout.rackHeight - rackGap);
  const hiddenScale = Math.min(targetHiddenScale, maxHiddenHeight / rawHiddenHeight);
  const hiddenRackHeight = Math.min(maxHiddenHeight, Math.round(rawHiddenHeight * hiddenScale));

  const combinedH = rackLayout.rackHeight + rackGap + hiddenRackHeight;
  const blockStartY = boardTopY + Math.max(0, (totalBoardHeight - combinedH) / 2);
  const rackY = Math.round(blockStartY + rackLayout.rackHeight / 2);
  const captionOffset = showHiddenLabel ? (Dimens.Space24 * hiddenScale) / 2 : 0;
  const hiddenRackY = Math.round(
    rackY + rackLayout.rackHeight / 2 + rackGap + hiddenRackHeight / 2 - captionOffset,
  );

  return {
    width,
    height,
    orientation,
    profile,
    isCompact,
    contentBounds,
    header,
    hud,
    board: {
      centerX,
      rackX: centerX,
      rackY,
      rackAvailableWidth,
      rackAvailableHeight,
      rackVerticalSpacing,
      rackLayout,
      hiddenRackX: centerX,
      hiddenRackY,
      hiddenRackWidth,
      hiddenRackHeight,
      hiddenScale,
      showHiddenLabel,
      hiddenRows,
    },
    instructions,
    modalBounds: { width, height },
  };
}
