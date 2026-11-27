import { resolveLayoutProfile } from '../../game/layout/LayoutProfileResolver';
import type { ViewportMetrics } from '../../game/layout/ViewportMetrics';
import { getResponsiveTokens } from './ResponsiveTokens';

export interface ModalConstraintsInput {
  readonly preferredWidth?: number;
  readonly minWidth?: number;
  readonly maxWidth?: number;
  readonly maxHeightRatio?: number;
}

export interface ModalLayoutBounds {
  readonly centerX: number;
  readonly centerY: number;
  readonly width: number;
  readonly maxHeight: number;
  readonly padding: number;
  readonly contentWidth: number;
  readonly buttonHeight: number;
}

/**
 * Shared modal boundary constraints guaranteeing every dialog and overlay fits
 * cleanly inside safe effective viewport bounds across all 5 layout profiles.
 */
export function computeModalBounds(
  viewport: ViewportMetrics,
  options: ModalConstraintsInput = {},
): ModalLayoutBounds {
  const profile = resolveLayoutProfile(viewport);
  const tokens = getResponsiveTokens(profile);
  const outerPadX = Math.min(tokens.screenPaddingX, 24);
  const outerPadY = Math.min(tokens.screenPaddingY, 20);

  const availWidth = Math.max(240, viewport.effectiveWidth - outerPadX * 2);
  const availHeight = Math.max(220, viewport.effectiveHeight - outerPadY * 2);

  const minW = Math.min(availWidth, options.minWidth ?? 268);
  const maxW = Math.min(availWidth, options.maxWidth ?? tokens.modalMaxWidth);
  const preferredW = options.preferredWidth ?? maxW;
  const width = Math.round(Math.max(minW, Math.min(maxW, preferredW)));

  const maxHeightRatio = options.maxHeightRatio ?? 0.94;
  const maxHeight = Math.round(Math.max(220, Math.min(availHeight, availHeight * maxHeightRatio)));
  const padding = width < 320 || maxHeight < 360 ? 14 : tokens.modalPadding;

  return Object.freeze({
    centerX: viewport.contentBounds.centerX,
    centerY: viewport.contentBounds.centerY,
    width,
    maxHeight,
    padding,
    contentWidth: Math.max(180, width - padding * 2),
    buttonHeight: tokens.secondaryButtonHeight,
  });
}
