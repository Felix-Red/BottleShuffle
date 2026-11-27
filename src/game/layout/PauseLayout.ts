import { computeModalBounds } from '../../design-system/layout/LayoutConstraints';
import type { ViewportOrientation } from '../../design-system/tokens/Breakpoints';
import { Dimens } from '../../design-system/tokens/Dimens';
import type { LayoutProfile } from './LayoutProfile';
import { resolveLayoutProfile } from './LayoutProfileResolver';
import { createViewportMetrics, type PartialSafeAreaInsets } from './ViewportMetrics';

export type PauseLayoutMode = 'landscape' | 'compact-landscape' | 'portrait';

export interface PausePoint {
  readonly x: number;
  readonly y: number;
}

export interface PauseRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface PauseLayoutMetrics {
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly orientation: ViewportOrientation;
  readonly profile: LayoutProfile;
  readonly mode: PauseLayoutMode;
  readonly panelRect: PauseRect;
  readonly iconPosition: PausePoint;
  readonly iconRadius: number;
  readonly titlePosition: PausePoint;
  readonly subtitlePosition: PausePoint;
  readonly statsRect: PauseRect;
  readonly resumeButtonRect: PauseRect;
  readonly restartButtonRect: PauseRect;
  readonly settingsButtonRect: PauseRect;
  readonly exitButtonRect: PauseRect;
}

/**
 * Pure, Phaser-free responsive layout calculator for PauseOverlay.
 * Adapts smoothly across all 5 layout profiles and the 14-viewport verification
 * matrix (320x480 through 1920x1080) with touch targets >= 44px.
 */
export function computePauseLayout(
  viewportWidth: number,
  viewportHeight: number,
  safeArea?: PartialSafeAreaInsets,
): PauseLayoutMetrics {
  const viewport = createViewportMetrics({
    width: viewportWidth,
    height: viewportHeight,
    ...(safeArea !== undefined ? { safeArea } : {}),
  });
  const profile = resolveLayoutProfile(viewport);

  const isCompactLandscape =
    viewport.orientation === 'landscape' && viewport.effectiveHeight <= 480;
  const mode: PauseLayoutMode = isCompactLandscape
    ? 'compact-landscape'
    : viewport.orientation === 'portrait'
      ? 'portrait'
      : 'landscape';

  if (mode === 'compact-landscape') {
    const modalBox = computeModalBounds(viewport, { maxWidth: 740, maxHeightRatio: 0.94 });
    const isUltraShort = viewport.effectiveHeight < 370;
    const panelWidth = Math.min(modalBox.width, 740);
    const panelHeight = Math.min(modalBox.maxHeight, isUltraShort ? 292 : 316);
    const padX = isUltraShort ? Dimens.Space16 : Dimens.Space20;
    const padY = isUltraShort ? Dimens.Space12 : Dimens.Space20;
    const colGap = isUltraShort ? Dimens.Space16 : Dimens.Space20;
    const innerW = panelWidth - padX * 2;
    const leftW = Math.round(innerW * 0.4);
    const rightW = innerW - leftW - colGap;
    const leftX = -innerW / 2 + leftW / 2;
    const rightX = innerW / 2 - rightW / 2;

    const topY = -panelHeight / 2 + padY;
    const bottomY = panelHeight / 2 - padY;

    const iconRadius = isUltraShort ? 18 : 22;
    const iconY = topY + iconRadius + 2;
    const titleY = iconY + iconRadius + (isUltraShort ? 18 : 24);
    const subtitleY = titleY + (isUltraShort ? 22 : 28);
    const statsH = isUltraShort ? 60 : 68;
    const statsY = bottomY - statsH / 2 - 2;

    const primaryH = isUltraShort ? 46 : 48;
    const secondaryH = 44;
    const exitH = 44;
    const btnGap = isUltraShort ? Dimens.Space8 : Dimens.Space12;

    const resumeY = topY + primaryH / 2 + 4;
    const secRowY = resumeY + primaryH / 2 + btnGap + secondaryH / 2;
    const secGap = Dimens.Space10;
    const secBtnW = Math.floor((rightW - secGap) / 2);
    const restartX = rightX - rightW / 2 + secBtnW / 2;
    const settingsX = rightX + rightW / 2 - secBtnW / 2;
    const exitY = Math.min(bottomY - exitH / 2, secRowY + secondaryH / 2 + btnGap + exitH / 2);

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
      iconPosition: { x: Math.round(leftX), y: Math.round(iconY) },
      iconRadius,
      titlePosition: { x: Math.round(leftX), y: Math.round(titleY) },
      subtitlePosition: { x: Math.round(leftX), y: Math.round(subtitleY) },
      statsRect: {
        x: Math.round(leftX),
        y: Math.round(statsY),
        width: leftW,
        height: statsH,
      },
      resumeButtonRect: {
        x: Math.round(rightX),
        y: Math.round(resumeY),
        width: rightW,
        height: primaryH,
      },
      restartButtonRect: {
        x: Math.round(restartX),
        y: Math.round(secRowY),
        width: secBtnW,
        height: secondaryH,
      },
      settingsButtonRect: {
        x: Math.round(settingsX),
        y: Math.round(secRowY),
        width: secBtnW,
        height: secondaryH,
      },
      exitButtonRect: {
        x: Math.round(rightX),
        y: Math.round(exitY),
        width: rightW,
        height: exitH,
      },
    };
  }

  const isPortrait = mode === 'portrait';
  const isUltraTight = viewport.effectiveHeight < 540;
  const isTight = viewport.effectiveHeight <= 660;
  const modalBox = computeModalBounds(viewport, {
    maxWidth: isPortrait ? 420 : 456,
    maxHeightRatio: 0.94,
  });
  const panelWidth = modalBox.width;
  const padX = isUltraTight ? Dimens.Space16 : Dimens.Space24;
  const padY = isUltraTight ? Dimens.Space12 : isTight ? Dimens.Space20 : Dimens.Space24;
  const contentW = panelWidth - padX * 2;

  const iconRadius = isUltraTight ? 18 : isTight ? 22 : 26;
  const statsH = isUltraTight ? 56 : isTight ? 62 : 68;
  const primaryH = Math.max(44, isUltraTight ? 46 : isTight ? 48 : 52);
  const secondaryH = Math.max(44, isUltraTight ? 44 : 46);
  const exitH = 44;
  const gap = isUltraTight ? Dimens.Space8 : isTight ? Dimens.Space10 : Dimens.Space12;

  const panelHeight = Math.min(
    modalBox.maxHeight,
    padY * 2 +
      iconRadius * 2 +
      (isUltraTight ? 26 : 32) +
      (isUltraTight ? 18 : 22) +
      statsH +
      primaryH +
      secondaryH +
      exitH +
      gap * 6,
  );

  let cursorY = -panelHeight / 2 + padY;

  const iconY = cursorY + iconRadius;
  cursorY += iconRadius * 2 + gap;

  const titleY = cursorY + (isUltraTight ? 12 : 14);
  cursorY += (isUltraTight ? 24 : 28) + 4;

  const subtitleY = cursorY + (isUltraTight ? 9 : 10);
  cursorY += (isUltraTight ? 18 : 20) + gap;

  const statsY = cursorY + statsH / 2;

  const bottomY = panelHeight / 2 - padY;
  const exitY = bottomY - exitH / 2;
  const secRowY = exitY - exitH / 2 - gap - secondaryH / 2;
  const resumeY = secRowY - secondaryH / 2 - gap - primaryH / 2;

  const secGap = isUltraTight ? Dimens.Space8 : Dimens.Space10;
  const secBtnW = Math.floor((contentW - secGap) / 2);

  return {
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
    orientation: viewport.orientation,
    profile,
    mode,
    panelRect: {
      x: modalBox.centerX,
      y: modalBox.centerY,
      width: panelWidth,
      height: panelHeight,
    },
    iconPosition: { x: 0, y: Math.round(iconY) },
    iconRadius,
    titlePosition: { x: 0, y: Math.round(titleY) },
    subtitlePosition: { x: 0, y: Math.round(subtitleY) },
    statsRect: {
      x: 0,
      y: Math.round(statsY),
      width: contentW,
      height: statsH,
    },
    resumeButtonRect: {
      x: 0,
      y: Math.round(resumeY),
      width: contentW,
      height: primaryH,
    },
    restartButtonRect: {
      x: Math.round(-contentW / 2 + secBtnW / 2),
      y: Math.round(secRowY),
      width: secBtnW,
      height: secondaryH,
    },
    settingsButtonRect: {
      x: Math.round(contentW / 2 - secBtnW / 2),
      y: Math.round(secRowY),
      width: secBtnW,
      height: secondaryH,
    },
    exitButtonRect: {
      x: 0,
      y: Math.round(exitY),
      width: Math.min(contentW, 240),
      height: exitH,
    },
  };
}
