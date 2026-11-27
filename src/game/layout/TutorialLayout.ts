import { Dimens } from '../../design-system/tokens/Dimens';
import { calculateGameplayLayout, type GameplayLayout } from './GameplayLayout';
import type { LayoutProfile } from './LayoutProfile';
import { isCompactProfile, resolveLayoutProfile } from './LayoutProfileResolver';
import { createViewportMetrics, type PartialSafeAreaInsets } from './ViewportMetrics';

export interface TutorialLayoutInput {
  readonly width: number;
  readonly height: number;
  readonly bottleCount: number;
  readonly hasActions: boolean;
  readonly showCounterExamples: boolean;
  readonly safeAreaTop?: number;
  readonly safeAreaBottom?: number;
  readonly safeArea?: PartialSafeAreaInsets;
}

export interface TutorialRectBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface TutorialLayout {
  readonly gameplay: GameplayLayout;
  readonly instructionPanel: TutorialRectBounds;
  readonly profile: LayoutProfile;
  readonly isCompact: boolean;
  readonly orientation: 'landscape' | 'portrait';
}

/**
 * Pure responsive layout calculator for Tutorial mode inside GameScene.
 * Reserves dedicated bottom clearance for TutorialInstructionPanel via safeAreaBottom
 * so the inline instruction card NEVER overlaps bottles, hidden compartment, or MatchCounter.
 */
export function calculateTutorialLayout(input: TutorialLayoutInput): TutorialLayout {
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
  const { width: safeW, height: safeH, orientation, safeArea, contentBounds } = viewport;
  const effectiveW = contentBounds.width;
  const effectiveH = contentBounds.height;

  const isCompact =
    isCompactProfile(profile) ||
    (orientation === 'landscape' ? effectiveH <= 460 : effectiveH <= 680 || effectiveW <= 380);
  const isUltraShortLandscape = orientation === 'landscape' && effectiveH < 370;
  const isUltraShortPortrait = orientation === 'portrait' && effectiveH < 540;

  let panelHeight: number;
  if (isUltraShortLandscape) {
    panelHeight = input.showCounterExamples ? 104 : input.hasActions ? 76 : 60;
  } else if (isCompact && orientation === 'landscape') {
    panelHeight = input.showCounterExamples ? 124 : input.hasActions ? 86 : 68;
  } else if (orientation === 'landscape') {
    panelHeight = input.showCounterExamples ? 168 : input.hasActions ? 116 : 92;
  } else if (isUltraShortPortrait) {
    panelHeight = input.showCounterExamples ? 142 : input.hasActions ? 108 : 82;
  } else if (isCompact) {
    panelHeight = input.showCounterExamples ? 164 : input.hasActions ? 124 : 92;
  } else {
    panelHeight = input.showCounterExamples ? 186 : input.hasActions ? 144 : 108;
  }

  const bottomMargin = isCompact ? Dimens.Space6 : Dimens.Space12;
  const reservedBottom = safeArea.bottom + panelHeight + bottomMargin;

  const gameplay = calculateGameplayLayout({
    width: safeW,
    height: safeH,
    bottleCount: input.bottleCount,
    safeArea: {
      top: safeArea.top,
      right: safeArea.right,
      bottom: reservedBottom,
      left: safeArea.left,
    },
  });

  const padX = isCompact ? Dimens.Space12 : Dimens.Space24;
  const panelWidth =
    orientation === 'landscape'
      ? Math.min(720, Math.max(260, effectiveW - padX * 2))
      : Math.min(500, Math.max(248, effectiveW - padX * 2));

  const panelX = Math.round(contentBounds.centerX - panelWidth / 2);
  const panelY = Math.round(contentBounds.bottom - bottomMargin - panelHeight);

  return Object.freeze({
    gameplay,
    instructionPanel: Object.freeze({
      x: panelX,
      y: panelY,
      width: Math.round(panelWidth),
      height: Math.round(panelHeight),
    }),
    profile,
    isCompact,
    orientation,
  });
}
