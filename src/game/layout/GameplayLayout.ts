import { Dimens } from '../../design-system/tokens/Dimens';
import {
  calculateBottleRackLayout,
  type BottleRackLayoutResult,
} from '../components/environment/bottleLayout';

export interface GameplayLayoutInput {
  readonly width: number;
  readonly height: number;
  readonly bottleCount: number;
  readonly safeAreaTop?: number;
  readonly safeAreaBottom?: number;
}

export interface GameplayHeaderLayout {
  readonly width: number;
  readonly height: number;
  readonly y: number;
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
  readonly isCompact: boolean;
  readonly header: GameplayHeaderLayout;
  readonly hud: GameplayHudLayout;
  readonly board: GameplayBoardLayout;
  readonly instructions: GameplayInstructionsLayout;
  readonly modalBounds: { readonly width: number; readonly height: number };
}

const MIN_VIEWPORT = 280;

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
  const width = Math.max(MIN_VIEWPORT, Number.isFinite(input.width) ? input.width : 1280);
  const height = Math.max(MIN_VIEWPORT, Number.isFinite(input.height) ? input.height : 720);
  const safeTop = Math.max(0, input.safeAreaTop ?? 0);
  const safeBottom = Math.max(0, input.safeAreaBottom ?? 0);

  const orientation: 'landscape' | 'portrait' = width >= height ? 'landscape' : 'portrait';
  const isCompact = width < 640 || height < 480;
  const isShortLandscape = orientation === 'landscape' && height < 460;
  const isShortPortrait = orientation === 'portrait' && height < 700;
  const centerX = Math.round(width / 2);
  const padX = isCompact ? Dimens.ScreenPaddingCompact : Dimens.ScreenPadding;
  const contentWidth = Math.max(240, width - padX * 2);

  const headerHeight = isCompact ? Dimens.HeaderHeightCompact : Dimens.HeaderHeight;
  const header: GameplayHeaderLayout = {
    width,
    height: headerHeight,
    y: safeTop,
  };

  const instructionsHeight = isShortLandscape || isShortPortrait ? 22 : isCompact ? 34 : 42;
  const instructionsBottomMargin =
    isShortLandscape || isShortPortrait ? Dimens.Space4 : Dimens.Space6;
  const instructionsY = Math.round(
    height - safeBottom - instructionsHeight / 2 - instructionsBottomMargin,
  );
  const instructions: GameplayInstructionsLayout = {
    x: centerX,
    y: instructionsY,
    height: instructionsHeight,
    maxWidth: Math.min(640, contentWidth),
  };

  if (orientation === 'landscape') {
    const hudScale = isShortLandscape ? 0.8 : 1;
    const hudTopY =
      safeTop +
      headerHeight +
      (isShortLandscape ? Dimens.Space4 : isCompact ? Dimens.Space8 : Dimens.Space16);
    const hudHeight = isShortLandscape ? 72 : isCompact ? 96 : 112;
    const hudCenterY = Math.round(hudTopY + hudHeight / 2);

    const matchCounterWidth = Math.min(
      isCompact ? 300 : 380,
      Math.max(220, Math.round(contentWidth * 0.4)),
    );
    const sideSpace = Math.max(
      120,
      (Math.min(1080, contentWidth) - matchCounterWidth * hudScale) / 2 - Dimens.Space20,
    );
    const statWidth = Math.min(
      isCompact ? 156 : 186,
      Math.max(118, Math.floor(sideSpace / hudScale)),
    );
    const statHeight = isCompact ? 68 : 78;

    const clusterGap = isShortLandscape ? Dimens.Space12 : Dimens.Space20;
    const halfCluster = (matchCounterWidth / 2 + statWidth / 2) * hudScale + clusterGap;

    const hud: GameplayHudLayout = {
      orientation: 'landscape',
      scale: hudScale,
      topY: hudTopY,
      height: hudHeight,
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
        hudTopY + hudHeight + (isShortLandscape ? Dimens.Space2 : Dimens.Space8),
      ),
    };

    const boardTopY =
      hudTopY +
      hudHeight +
      (isShortLandscape ? Dimens.Space8 : isCompact ? Dimens.Space12 : Dimens.Space20);
    const boardBottomY =
      instructionsY - instructionsHeight / 2 - (isShortLandscape ? Dimens.Space6 : Dimens.Space10);
    const totalBoardHeight = Math.max(140, boardBottomY - boardTopY);
    const rackAvailableWidth = Math.min(1140, contentWidth);

    const showHiddenLabel = !isShortLandscape;
    const estimatedHiddenH = estimateHiddenCompartmentHeight(
      1,
      rackAvailableWidth,
      input.bottleCount,
      showHiddenLabel,
    );
    const rackGap = isShortLandscape ? Dimens.Space16 : Dimens.Space20;
    const rackVerticalSpacing = Dimens.Space24;
    const rackAvailableHeight = Math.max(
      115,
      totalBoardHeight - estimatedHiddenH * (isShortLandscape ? 0.78 : 1) - rackGap,
    );

    const rackLayout = calculateBottleRackLayout({
      availableWidth: rackAvailableWidth,
      availableHeight: rackAvailableHeight,
      bottleCount: input.bottleCount,
      aspectRatio: width / height,
      verticalSpacing: rackVerticalSpacing,
      maxBottleWidth: isShortLandscape ? 54 : isCompact ? 74 : 98,
      maxBottleHeight: isShortLandscape ? 108 : isCompact ? 148 : 196,
    });

    const hiddenRows: 1 | 2 = rackLayout.rows === 2 ? 2 : 1;
    const hiddenRackWidth = Math.min(rackAvailableWidth, rackLayout.rackWidth);
    const rawHiddenHeight = estimateHiddenCompartmentHeight(
      hiddenRows,
      hiddenRackWidth,
      rackLayout.bottleCount,
      showHiddenLabel,
    );
    const maxHiddenHeight = Math.max(40, totalBoardHeight - rackLayout.rackHeight - rackGap);
    const targetMaxScale = isShortLandscape ? 0.78 : 1;
    const hiddenScale = Math.min(targetMaxScale, maxHiddenHeight / rawHiddenHeight);
    const hiddenRackHeight = Math.round(rawHiddenHeight * hiddenScale);

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
      isCompact,
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
  const hudScale = isShortPortrait ? 0.82 : 1;
  const hudTopY = safeTop + headerHeight + (isShortPortrait ? Dimens.Space6 : Dimens.Space12);
  const matchCounterWidth = Math.min(440, contentWidth);
  const matchCounterY = Math.round(hudTopY + 46 * hudScale);
  const feedbackY = Math.round(matchCounterY + 54 * hudScale);

  const statHeight = isCompact ? 62 : 70;
  const statGap = isShortPortrait ? Dimens.Space8 : Dimens.Space12;
  const statWidth = Math.min(
    206,
    Math.max(124, Math.floor((matchCounterWidth - statGap) / (2 * hudScale))),
  );
  const statsRowY = Math.round(
    feedbackY + (isShortPortrait ? 12 : 18) + (statHeight * hudScale) / 2,
  );
  const hudBottomY = Math.round(statsRowY + (statHeight * hudScale) / 2);

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
  };

  const boardTopY = hudBottomY + (isShortPortrait ? Dimens.Space8 : Dimens.Space16);
  const boardBottomY =
    instructionsY - instructionsHeight / 2 - (isShortPortrait ? Dimens.Space6 : Dimens.Space8);
  const totalBoardHeight = Math.max(180, boardBottomY - boardTopY);
  const rackAvailableWidth = Math.min(540, contentWidth);

  const showHiddenLabel = !isShortPortrait;
  const tentativeRows: 1 | 2 = input.bottleCount >= 6 ? 2 : 1;
  const estimatedHiddenH = estimateHiddenCompartmentHeight(
    tentativeRows,
    rackAvailableWidth,
    input.bottleCount,
    showHiddenLabel,
  );
  const rackGap = isShortPortrait ? Dimens.Space12 : Dimens.Space16;
  const rackVerticalSpacing = isShortPortrait ? Dimens.Space16 : Dimens.Space32;
  const rackAvailableHeight = Math.max(
    130,
    totalBoardHeight - estimatedHiddenH * (isShortPortrait ? 0.85 : 1) - rackGap,
  );

  const rackLayout = calculateBottleRackLayout({
    availableWidth: rackAvailableWidth,
    availableHeight: rackAvailableHeight,
    bottleCount: input.bottleCount,
    aspectRatio: width / height,
    verticalSpacing: rackVerticalSpacing,
    maxBottleWidth: isShortPortrait ? 50 : 84,
    maxBottleHeight: isShortPortrait ? 100 : 168,
  });

  const hiddenRows: 1 | 2 = rackLayout.rows === 2 ? 2 : 1;
  const hiddenRackWidth = Math.min(rackAvailableWidth, rackLayout.rackWidth);
  const rawHiddenHeight = estimateHiddenCompartmentHeight(
    hiddenRows,
    hiddenRackWidth,
    rackLayout.bottleCount,
    showHiddenLabel,
  );
  const maxHiddenHeight = Math.max(48, totalBoardHeight - rackLayout.rackHeight - rackGap);
  const hiddenScale = Math.min(1, maxHiddenHeight / rawHiddenHeight);
  const hiddenRackHeight = Math.round(rawHiddenHeight * hiddenScale);

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
    isCompact,
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
