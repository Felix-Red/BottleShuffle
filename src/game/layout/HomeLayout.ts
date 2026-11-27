import { getResponsiveTokens } from '../../design-system/layout/ResponsiveTokens';
import { Dimens } from '../../design-system/tokens/Dimens';
import type { LayoutProfile } from './LayoutProfile';
import { isCompactProfile, resolveLayoutProfile } from './LayoutProfileResolver';
import {
  createViewportMetrics,
  type ContentBounds,
  type PartialSafeAreaInsets,
} from './ViewportMetrics';

export interface HomeLayoutInput {
  readonly width: number;
  readonly height: number;
  readonly safeAreaTop?: number;
  readonly safeAreaBottom?: number;
  readonly safeArea?: PartialSafeAreaInsets;
}

export interface RectCenter {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface HomeLayout {
  readonly width: number;
  readonly height: number;
  readonly orientation: 'landscape' | 'portrait';
  readonly profile: LayoutProfile;
  readonly isCompact: boolean;
  readonly contentBounds: ContentBounds;
  readonly publisher: { readonly x: number; readonly y: number; readonly visible: boolean };
  readonly settings: { readonly x: number; readonly y: number; readonly size: number };
  readonly logo: {
    readonly x: number;
    readonly y: number;
    readonly scale: number;
    readonly height: number;
  };
  readonly tagline: {
    readonly x: number;
    readonly y: number;
    readonly maxWidth: number;
    readonly visible: boolean;
  };
  readonly hero: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly bottleHeight: number;
    readonly simplified: boolean;
    readonly visible: boolean;
  };
  readonly primaryButton: RectCenter;
  readonly levelsButton: RectCenter;
  readonly practiceButton: RectCenter;
  readonly progressCard: RectCenter;
}

/**
 * Pure, Phaser-free responsive layout calculation for the production Home screen.
 * Guarantees non-overlapping, touch-friendly layouts across all 5 layout profiles
 * and the full 14-viewport verification matrix (320x480 through 1920x1080).
 */
export function calculateHomeLayout(input: HomeLayoutInput): HomeLayout {
  const viewport = createViewportMetrics({
    width: input.width,
    height: input.height,
    safeArea: {
      top: input.safeArea?.top ?? input.safeAreaTop ?? 0,
      right: input.safeArea?.right ?? 0,
      bottom: input.safeArea?.bottom ?? input.safeAreaBottom ?? 0,
      left: input.safeArea?.left ?? 0,
    },
  });

  const profile = resolveLayoutProfile(viewport);
  const tokens = getResponsiveTokens(profile);
  const { width, height, orientation, safeArea, contentBounds } = viewport;
  const effectiveW = contentBounds.width;
  const effectiveH = contentBounds.height;

  const isCompact = isCompactProfile(profile) || effectiveW < 640 || effectiveH < 480;
  const padX = isCompact ? Dimens.ScreenPaddingCompact : tokens.screenPaddingX;
  const settingsSize = Math.max(Dimens.MinTouchTarget, tokens.minTouchTarget);
  const settingsX = Math.round(contentBounds.right - padX - settingsSize / 2);
  const settingsTopGap =
    effectiveH < 370 ? Dimens.Space6 : isCompact ? Dimens.Space10 : Dimens.Space20;
  const settingsY = Math.round(safeArea.top + settingsTopGap + settingsSize / 2);

  if (orientation === 'landscape') {
    const isShort = effectiveH < 460;
    const isUltraShort = effectiveH < 360;
    const usableW = Math.min(tokens.maxContentWidth, effectiveW - padX * 2);
    const originLeft = Math.round(contentBounds.x + (effectiveW - usableW) / 2);

    const leftColWidth = Math.round(usableW * (isShort ? 0.56 : 0.49));
    const colGap = isShort ? Dimens.Space16 : Dimens.Space32;
    const rightColWidth = Math.max(160, usableW - leftColWidth - colGap);

    const leftCenterX = Math.round(originLeft + leftColWidth / 2);
    const rightCenterX = Math.round(originLeft + usableW - rightColWidth / 2);

    const controlWidth = Math.min(isShort ? 360 : 410, leftColWidth - Dimens.Space8);
    const logoScale = isUltraShort
      ? 0.56
      : isShort
        ? 0.66
        : Math.min(1.06, Math.max(0.76, Math.min(controlWidth / 390, effectiveH / 680)));
    const logoHeight = Math.round(108 * logoScale);

    const showTagline = !isShort || effectiveH >= 365;
    const taglineH = showTagline ? (isShort ? 20 : 26) : 0;
    const primaryH = isUltraShort ? 50 : isShort ? 56 : 74;
    const secondaryH = isUltraShort ? 44 : isShort ? 46 : 52;
    const secondaryGap = isUltraShort ? Dimens.Space8 : Dimens.Space12;
    const secondaryW = Math.floor((controlWidth - secondaryGap) / 2);
    const progressH = isUltraShort ? 64 : isShort ? 74 : 96;

    const gapLogoToTag = showTagline ? (isShort ? 4 : 8) : 0;
    const gapTagToPrimary = isUltraShort ? 8 : isShort ? 12 : 26;
    const gapPrimaryToSec = isUltraShort ? 8 : isShort ? 10 : 14;
    const gapSecToProg = isUltraShort ? 8 : isShort ? 10 : 18;

    const stackHeight =
      logoHeight +
      gapLogoToTag +
      taglineH +
      gapTagToPrimary +
      primaryH +
      gapPrimaryToSec +
      secondaryH +
      gapSecToProg +
      progressH;

    const usableTop =
      safeArea.top + (isUltraShort ? Dimens.Space8 : isShort ? Dimens.Space10 : Dimens.Space24);
    const usableBottom =
      contentBounds.bottom -
      (isUltraShort ? Dimens.Space8 : isShort ? Dimens.Space10 : Dimens.Space24);
    const stackTop = Math.round(
      usableTop + Math.max(0, (usableBottom - usableTop - stackHeight) / 2),
    );

    const logoY = Math.round(stackTop + logoHeight / 2);
    const taglineY = Math.round(stackTop + logoHeight + gapLogoToTag + taglineH / 2);
    const primaryY = Math.round(
      stackTop + logoHeight + gapLogoToTag + taglineH + gapTagToPrimary + primaryH / 2,
    );
    const secondaryY = Math.round(primaryY + primaryH / 2 + gapPrimaryToSec + secondaryH / 2);
    const progressY = Math.round(secondaryY + secondaryH / 2 + gapSecToProg + progressH / 2);

    const heroHeight = Math.min(
      isUltraShort ? 176 : isShort ? 220 : 420,
      Math.max(116, usableBottom - usableTop - (isUltraShort ? 36 : isShort ? 48 : 80)),
    );
    const heroWidth = Math.min(520, rightColWidth);
    const heroBottleHeight = Math.min(
      isUltraShort ? 120 : isShort ? 150 : 246,
      Math.max(82, Math.round(Math.min(heroHeight * 0.68, (heroWidth / 3.4) * 2))),
    );
    const heroY = Math.round((usableTop + usableBottom) / 2 + (isShort ? 10 : 16));

    return {
      width,
      height,
      orientation,
      profile,
      isCompact,
      contentBounds,
      publisher: {
        x: originLeft + Dimens.Space4,
        y: settingsY,
        visible: !isShort || effectiveH >= 380,
      },
      settings: {
        x: settingsX,
        y: settingsY,
        size: settingsSize,
      },
      logo: {
        x: leftCenterX,
        y: logoY,
        scale: logoScale,
        height: logoHeight,
      },
      tagline: {
        x: leftCenterX,
        y: taglineY,
        maxWidth: controlWidth,
        visible: showTagline,
      },
      hero: {
        x: rightCenterX,
        y: heroY,
        width: heroWidth,
        height: heroHeight,
        bottleHeight: heroBottleHeight,
        simplified: isShort,
        visible: true,
      },
      primaryButton: {
        x: leftCenterX,
        y: primaryY,
        width: controlWidth,
        height: primaryH,
      },
      levelsButton: {
        x: Math.round(leftCenterX - secondaryW / 2 - secondaryGap / 2),
        y: secondaryY,
        width: secondaryW,
        height: secondaryH,
      },
      practiceButton: {
        x: Math.round(leftCenterX + secondaryW / 2 + secondaryGap / 2),
        y: secondaryY,
        width: secondaryW,
        height: secondaryH,
      },
      progressCard: {
        x: leftCenterX,
        y: progressY,
        width: controlWidth,
        height: progressH,
      },
    };
  }

  // Portrait layout: Top bar -> Logo -> Tagline -> Hero -> Primary CTA -> Levels + Practice -> CampaignProgressCard
  const isShortPortrait = effectiveH < 700;
  const isUltraShortPortrait = effectiveH < 540;
  const centerX = contentBounds.centerX;
  const controlWidth = Math.min(440, effectiveW - padX * 2);

  const topBarBottom = settingsY + settingsSize / 2;
  const bottomLimit =
    contentBounds.bottom -
    (isUltraShortPortrait ? Dimens.Space8 : isShortPortrait ? Dimens.Space12 : Dimens.Space20);

  const logoScale = isUltraShortPortrait
    ? Math.min(0.56, controlWidth / 410)
    : isShortPortrait
      ? Math.min(0.74, controlWidth / 390)
      : Math.min(0.96, controlWidth / 390);
  const logoHeight = Math.round(108 * logoScale);
  const showTagline = !isUltraShortPortrait;
  const taglineH = showTagline ? (isShortPortrait ? 20 : 24) : 0;
  const primaryH = isUltraShortPortrait ? 52 : isShortPortrait ? 58 : 72;
  const secondaryH = isUltraShortPortrait ? 44 : isShortPortrait ? 46 : 52;
  const secondaryGap = isUltraShortPortrait ? Dimens.Space8 : Dimens.Space12;
  const secondaryW = Math.floor((controlWidth - secondaryGap) / 2);
  const progressH = isUltraShortPortrait ? 66 : isShortPortrait ? 80 : 94;

  const gap1 = showTagline ? (isShortPortrait ? 4 : 8) : 0; // logo -> tagline
  const gap2 = isUltraShortPortrait ? 6 : isShortPortrait ? 10 : 16; // tagline -> hero
  const gap3 = isUltraShortPortrait ? 8 : isShortPortrait ? 12 : 20; // hero -> primary
  const gap4 = isUltraShortPortrait ? 8 : isShortPortrait ? 10 : 12; // primary -> secondary
  const gap5 = isUltraShortPortrait ? 8 : isShortPortrait ? 10 : 16; // secondary -> progress

  const topClearance = isUltraShortPortrait ? Dimens.Space4 : Dimens.Space8;
  const availableVertical = Math.max(240, bottomLimit - (topBarBottom + topClearance));

  const controlsOnlyHeight =
    logoHeight + gap1 + taglineH + gap3 + primaryH + gap4 + secondaryH + gap5 + progressH;
  const remainingForHero = availableVertical - (controlsOnlyHeight + gap2);

  const heroVisible = remainingForHero >= 64;
  const heroHeight = heroVisible
    ? Math.min(isUltraShortPortrait ? 116 : isShortPortrait ? 168 : 260, remainingForHero)
    : 0;
  const heroBottleHeight = heroVisible
    ? Math.min(
        isUltraShortPortrait ? 92 : isShortPortrait ? 122 : 184,
        Math.max(54, Math.round(Math.min(heroHeight * 0.78, (controlWidth / 3.4) * 2))),
      )
    : 54;

  const totalBlockH = controlsOnlyHeight + (heroVisible ? gap2 + heroHeight : 0);
  const startY = Math.round(
    topBarBottom + topClearance + Math.max(0, (availableVertical - totalBlockH) / 2),
  );

  const logoY = Math.round(startY + logoHeight / 2);
  const taglineY = Math.round(startY + logoHeight + gap1 + taglineH / 2);
  const heroY = heroVisible
    ? Math.round(startY + logoHeight + gap1 + taglineH + gap2 + heroHeight / 2)
    : Math.round(startY + logoHeight + gap1 + taglineH);
  const primaryY = heroVisible
    ? Math.round(heroY + heroHeight / 2 + gap3 + primaryH / 2)
    : Math.round(startY + logoHeight + gap1 + taglineH + gap3 + primaryH / 2);
  const secondaryY = Math.round(primaryY + primaryH / 2 + gap4 + secondaryH / 2);
  const progressY = Math.round(secondaryY + secondaryH / 2 + gap5 + progressH / 2);

  return {
    width,
    height,
    orientation,
    profile,
    isCompact,
    contentBounds,
    publisher: {
      x: contentBounds.x + padX + Dimens.Space4,
      y: settingsY,
      visible: true,
    },
    settings: {
      x: settingsX,
      y: settingsY,
      size: settingsSize,
    },
    logo: {
      x: centerX,
      y: logoY,
      scale: logoScale,
      height: logoHeight,
    },
    tagline: {
      x: centerX,
      y: taglineY,
      maxWidth: controlWidth,
      visible: showTagline,
    },
    hero: {
      x: centerX,
      y: heroY,
      width: controlWidth,
      height: heroHeight,
      bottleHeight: heroBottleHeight,
      simplified: isShortPortrait,
      visible: heroVisible,
    },
    primaryButton: {
      x: centerX,
      y: primaryY,
      width: controlWidth,
      height: primaryH,
    },
    levelsButton: {
      x: Math.round(centerX - secondaryW / 2 - secondaryGap / 2),
      y: secondaryY,
      width: secondaryW,
      height: secondaryH,
    },
    practiceButton: {
      x: Math.round(centerX + secondaryW / 2 + secondaryGap / 2),
      y: secondaryY,
      width: secondaryW,
      height: secondaryH,
    },
    progressCard: {
      x: centerX,
      y: progressY,
      width: controlWidth,
      height: progressH,
    },
  };
}
