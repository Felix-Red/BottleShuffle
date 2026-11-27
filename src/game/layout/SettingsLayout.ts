import { computeModalBounds } from '../../design-system/layout/LayoutConstraints';
import type { ViewportOrientation } from '../../design-system/tokens/Breakpoints';
import { Dimens } from '../../design-system/tokens/Dimens';
import type { LayoutProfile } from './LayoutProfile';
import { resolveLayoutProfile } from './LayoutProfileResolver';
import { createViewportMetrics, type PartialSafeAreaInsets } from './ViewportMetrics';

export type SettingsLayoutMode = 'landscape' | 'compact-landscape' | 'portrait';

export interface SettingsRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface SettingsLayoutOptions {
  readonly showHowToPlay: boolean;
  readonly safeArea?: PartialSafeAreaInsets;
}

export interface SettingsLayoutMetrics {
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly orientation: ViewportOrientation;
  readonly profile: LayoutProfile;
  readonly mode: SettingsLayoutMode;
  readonly panelRect: SettingsRect;
  readonly headerTitlePosition: { readonly x: number; readonly y: number };
  readonly closeButtonPosition: { readonly x: number; readonly y: number };
  readonly audioHeadingPosition: { readonly x: number; readonly y: number };
  readonly musicRowRect: SettingsRect;
  readonly sfxRowRect: SettingsRect;
  readonly gameplayHeadingPosition: { readonly x: number; readonly y: number };
  readonly vibrationRowRect: SettingsRect;
  readonly reducedMotionRowRect: SettingsRect;
  readonly helpHeadingPosition: { readonly x: number; readonly y: number };
  readonly howToPlayRowRect: SettingsRect | null;
  readonly aboutRowRect: SettingsRect;
  readonly resetRowRect: SettingsRect;
  readonly doneButtonRect: SettingsRect;
  readonly compactRow: boolean;
  /** True when the body rows exceed the available middle band (e.g. 320x480 portrait). */
  readonly scrollNeeded: boolean;
  /** Panel-local viewport rect (top-left x, y, width, height) for the scrollable body region. */
  readonly bodyViewportRect: SettingsRect;
  readonly bodyContentHeight: number;
  readonly maxScrollY: number;
}

/**
 * Pure, Phaser-free responsive layout calculator for the shared SettingsOverlay.
 * Uses a single-column layout in standard landscape & portrait (with bounded scroll
 * fallback on ultra-short portrait viewports like 320x480 so header + Done stay pinned
 * and every row preserves >= 44px touch height), and a balanced two-column layout on
 * compact landscape viewports (<= 480px tall, including 568x320, 600x340, 844x390).
 */
export function computeSettingsLayout(
  viewportWidth: number,
  viewportHeight: number,
  options: SettingsLayoutOptions,
): SettingsLayoutMetrics {
  const viewport = createViewportMetrics({
    width: viewportWidth,
    height: viewportHeight,
    ...(options.safeArea !== undefined ? { safeArea: options.safeArea } : {}),
  });
  const profile = resolveLayoutProfile(viewport);

  const isCompactLandscape =
    viewport.orientation === 'landscape' && viewport.effectiveHeight <= 480;
  const mode: SettingsLayoutMode = isCompactLandscape
    ? 'compact-landscape'
    : viewport.orientation === 'portrait'
      ? 'portrait'
      : 'landscape';

  if (mode === 'compact-landscape') {
    const modalBox = computeModalBounds(viewport, { maxWidth: 760, maxHeightRatio: 0.95 });
    const isUltraShort = viewport.effectiveHeight < 370;
    const panelWidth = Math.min(modalBox.width, 760);
    const panelHeight = Math.min(modalBox.maxHeight, isUltraShort ? 304 : 354);
    const padX = isUltraShort ? Dimens.Space12 : Dimens.Space20;
    const padY = isUltraShort ? Dimens.Space10 : Dimens.Space16;
    const colGap = isUltraShort ? Dimens.Space12 : Dimens.Space20;
    const innerW = panelWidth - padX * 2;
    const leftW = Math.round(innerW * 0.54);
    const rightW = innerW - leftW - colGap;
    const leftX = -innerW / 2 + leftW / 2;
    const rightX = innerW / 2 - rightW / 2;

    const topY = -panelHeight / 2 + padY;
    const bottomY = panelHeight / 2 - padY;
    const headerY = topY + (isUltraShort ? 12 : 14);
    const contentTopY = headerY + (isUltraShort ? 20 : 26);

    const headingH = isUltraShort ? 13 : 16;
    const headingGap = isUltraShort ? 2 : 4;
    const rowGap = isUltraShort ? 4 : 6;
    const groupGap = isUltraShort ? 6 : 10;

    // Fit 4 toggle rows cleanly in left column with minimum 44px touch targets when height allows
    const availLeftH = bottomY - contentTopY;
    const maxToggleRowH = Math.floor(
      (availLeftH - headingH * 2 - headingGap * 2 - rowGap * 2 - groupGap) / 4,
    );
    const rowH = Math.min(48, Math.max(44, maxToggleRowH));

    // Left column: Audio (Music + SFX) + Gameplay (Vibration + Reduced Motion)
    const audioHeadingY = contentTopY + headingH / 2;
    const musicY = audioHeadingY + headingH / 2 + headingGap + rowH / 2;
    const sfxY = musicY + rowH + rowGap;

    const gameplayHeadingY = sfxY + rowH / 2 + groupGap + headingH / 2;
    const vibrationY = gameplayHeadingY + headingH / 2 + headingGap + rowH / 2;
    const reducedMotionY = vibrationY + rowH + rowGap;

    // Right column: Help (How to Play?, About, Reset) + Done button
    const helpHeadingY = contentTopY + headingH / 2;
    let cursorRightY = helpHeadingY + headingH / 2 + headingGap;
    const doneH = 44;
    const doneY = bottomY - doneH / 2;
    const navCount = (options.showHowToPlay ? 1 : 0) + 2;
    const availNavH = doneY - doneH / 2 - Dimens.Space6 - cursorRightY;
    const maxNavRowH = Math.floor((availNavH - rowGap * (navCount - 1)) / navCount);
    const navRowH = Math.min(46, Math.max(44, maxNavRowH));

    let howToPlayRowRect: SettingsRect | null = null;
    if (options.showHowToPlay) {
      howToPlayRowRect = {
        x: Math.round(rightX),
        y: Math.round(cursorRightY + navRowH / 2),
        width: rightW,
        height: navRowH,
      };
      cursorRightY += navRowH + rowGap;
    }

    const aboutY = cursorRightY + navRowH / 2;
    cursorRightY += navRowH + rowGap;
    const resetY = cursorRightY + navRowH / 2;

    const bodyTop = contentTopY;
    const bodyHeight = Math.max(120, bottomY - bodyTop);

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
      headerTitlePosition: { x: Math.round(-innerW / 2), y: Math.round(headerY) },
      closeButtonPosition: { x: Math.round(innerW / 2 - 14), y: Math.round(headerY) },
      audioHeadingPosition: { x: Math.round(-innerW / 2), y: Math.round(audioHeadingY) },
      musicRowRect: { x: Math.round(leftX), y: Math.round(musicY), width: leftW, height: rowH },
      sfxRowRect: { x: Math.round(leftX), y: Math.round(sfxY), width: leftW, height: rowH },
      gameplayHeadingPosition: { x: Math.round(-innerW / 2), y: Math.round(gameplayHeadingY) },
      vibrationRowRect: {
        x: Math.round(leftX),
        y: Math.round(vibrationY),
        width: leftW,
        height: rowH,
      },
      reducedMotionRowRect: {
        x: Math.round(leftX),
        y: Math.round(reducedMotionY),
        width: leftW,
        height: rowH,
      },
      helpHeadingPosition: {
        x: Math.round(rightX - rightW / 2),
        y: Math.round(helpHeadingY),
      },
      howToPlayRowRect,
      aboutRowRect: {
        x: Math.round(rightX),
        y: Math.round(aboutY),
        width: rightW,
        height: navRowH,
      },
      resetRowRect: {
        x: Math.round(rightX),
        y: Math.round(resetY),
        width: rightW,
        height: navRowH,
      },
      doneButtonRect: { x: Math.round(rightX), y: Math.round(doneY), width: rightW, height: doneH },
      compactRow: true,
      scrollNeeded: false,
      bodyViewportRect: {
        x: Math.round(-innerW / 2),
        y: Math.round(bodyTop),
        width: innerW,
        height: Math.round(bodyHeight),
      },
      bodyContentHeight: Math.round(bodyHeight),
      maxScrollY: 0,
    };
  }

  // Single-column layout for standard landscape & portrait
  const isPortrait = mode === 'portrait';
  const isTight = viewport.effectiveHeight <= 680;
  const modalBox = computeModalBounds(viewport, {
    maxWidth: isPortrait ? 456 : 520,
    maxHeightRatio: 0.94,
  });

  const panelWidth = modalBox.width;
  const padX = isPortrait ? (panelWidth < 330 ? Dimens.Space12 : Dimens.Space20) : Dimens.Space24;
  const padY = isTight ? Dimens.Space12 : Dimens.Space20;
  const contentW = panelWidth - padX * 2;
  const leftEdge = -contentW / 2;

  const headerH = isTight ? 30 : 34;
  const headingH = 16;
  const toggleRowH = isTight ? 48 : 54;
  const navRowH = isTight ? 44 : 48;
  const rowGap = isTight ? 6 : 8;
  const sectionGap = isTight ? 10 : 14;
  const doneH = Math.max(44, isTight ? 46 : 50);

  const navRowsCount = (options.showHowToPlay ? 1 : 0) + 2;
  const computeBodyHeight = (tH: number, nH: number, sGap: number, rGap: number): number =>
    headingH +
    4 +
    tH * 2 +
    rGap +
    sGap +
    headingH +
    4 +
    tH * 2 +
    rGap +
    sGap +
    headingH +
    4 +
    nH * navRowsCount +
    rGap * (navRowsCount - 1);

  const naturalBodyH = computeBodyHeight(toggleRowH, navRowH, sectionGap, rowGap);
  const chromeHeight = padY * 2 + headerH + sectionGap * 2 + doneH;
  const totalNeededH = chromeHeight + naturalBodyH;

  const maxPanelH = modalBox.maxHeight;
  const panelHeight = Math.min(maxPanelH, totalNeededH);

  // Gently tighten row heights down to >= 44px before enabling bounded vertical scroll
  const overflow = Math.max(0, totalNeededH - panelHeight);
  const shrinkPerRow = overflow > 0 ? Math.ceil(overflow / (4 + navRowsCount + 1)) : 0;
  const finalToggleH = Math.max(44, toggleRowH - shrinkPerRow);
  const finalNavH = Math.max(44, navRowH - shrinkPerRow);
  const finalSectionGap = overflow > 0 ? Math.max(6, sectionGap - 4) : sectionGap;
  const finalRowGap = overflow > 0 ? Math.max(4, rowGap - 2) : rowGap;

  const headerY = -panelHeight / 2 + padY + headerH / 2;
  const doneY = panelHeight / 2 - padY - doneH / 2;

  const bodyViewportTop = Math.round(headerY + headerH / 2 + finalSectionGap);
  const bodyViewportBottom = Math.round(doneY - doneH / 2 - finalSectionGap);
  const bodyViewportHeight = Math.max(120, bodyViewportBottom - bodyViewportTop);
  const bodyContentHeight = computeBodyHeight(
    finalToggleH,
    finalNavH,
    finalSectionGap,
    finalRowGap,
  );
  const scrollNeeded = bodyContentHeight > bodyViewportHeight + 2;
  const maxScrollY = scrollNeeded ? Math.max(0, bodyContentHeight - bodyViewportHeight) : 0;

  let cursorY = bodyViewportTop;

  const audioHeadingY = cursorY + headingH / 2;
  cursorY += headingH + 4;
  const musicY = cursorY + finalToggleH / 2;
  cursorY += finalToggleH + finalRowGap;
  const sfxY = cursorY + finalToggleH / 2;
  cursorY += finalToggleH + finalSectionGap;

  const gameplayHeadingY = cursorY + headingH / 2;
  cursorY += headingH + 4;
  const vibrationY = cursorY + finalToggleH / 2;
  cursorY += finalToggleH + finalRowGap;
  const reducedMotionY = cursorY + finalToggleH / 2;
  cursorY += finalToggleH + finalSectionGap;

  const helpHeadingY = cursorY + headingH / 2;
  cursorY += headingH + 4;

  let howToPlayRowRect: SettingsRect | null = null;
  if (options.showHowToPlay) {
    howToPlayRowRect = {
      x: 0,
      y: Math.round(cursorY + finalNavH / 2),
      width: contentW,
      height: finalNavH,
    };
    cursorY += finalNavH + finalRowGap;
  }

  const aboutY = cursorY + finalNavH / 2;
  cursorY += finalNavH + finalRowGap;
  const resetY = cursorY + finalNavH / 2;

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
    headerTitlePosition: { x: Math.round(leftEdge), y: Math.round(headerY) },
    closeButtonPosition: { x: Math.round(contentW / 2 - 14), y: Math.round(headerY) },
    audioHeadingPosition: { x: Math.round(leftEdge), y: Math.round(audioHeadingY) },
    musicRowRect: { x: 0, y: Math.round(musicY), width: contentW, height: finalToggleH },
    sfxRowRect: { x: 0, y: Math.round(sfxY), width: contentW, height: finalToggleH },
    gameplayHeadingPosition: { x: Math.round(leftEdge), y: Math.round(gameplayHeadingY) },
    vibrationRowRect: { x: 0, y: Math.round(vibrationY), width: contentW, height: finalToggleH },
    reducedMotionRowRect: {
      x: 0,
      y: Math.round(reducedMotionY),
      width: contentW,
      height: finalToggleH,
    },
    helpHeadingPosition: { x: Math.round(leftEdge), y: Math.round(helpHeadingY) },
    howToPlayRowRect,
    aboutRowRect: { x: 0, y: Math.round(aboutY), width: contentW, height: finalNavH },
    resetRowRect: { x: 0, y: Math.round(resetY), width: contentW, height: finalNavH },
    doneButtonRect: { x: 0, y: Math.round(doneY), width: contentW, height: doneH },
    compactRow: isTight || overflow > 0,
    scrollNeeded,
    bodyViewportRect: {
      x: Math.round(leftEdge),
      y: bodyViewportTop,
      width: contentW,
      height: bodyViewportHeight,
    },
    bodyContentHeight,
    maxScrollY,
  };
}
