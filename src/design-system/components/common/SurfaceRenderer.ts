import type Phaser from 'phaser';
import { Colors, darkenHex, hexToNumber } from '../../tokens/Colors';
import { getElevationStyle, type ElevationLevel } from '../../tokens/Elevation';

export interface SurfaceDrawOptions {
  readonly width: number;
  readonly height: number;
  readonly radius: number;
  readonly fillColor?: string;
  readonly fillAlpha?: number;
  readonly depthColor?: string;
  readonly borderColor?: string;
  readonly borderWidth?: number;
  readonly borderAlpha?: number;
  readonly elevation?: ElevationLevel;
  readonly pressedOffsetY?: number;
  readonly focusRingColor?: string;
}

export function drawElevatedSurface(
  graphics: Phaser.GameObjects.Graphics,
  options: SurfaceDrawOptions,
): void {
  const {
    width,
    height,
    radius,
    fillColor,
    fillAlpha = 1,
    depthColor,
    borderColor,
    borderWidth = 0,
    borderAlpha = 1,
    elevation = 'flat',
    pressedOffsetY = 0,
    focusRingColor,
  } = options;

  graphics.clear();

  const halfW = width / 2;
  const halfH = height / 2;
  const safeRadius = Math.min(radius, Math.floor(Math.min(width, height) / 2));
  const style = getElevationStyle(elevation);
  const bottomDepth = Math.max(0, style.bottomDepth - pressedOffsetY);

  // Drop shadow
  if (style.shadowAlpha > 0 && fillAlpha > 0) {
    const expand = style.shadowExpand;
    const shadowY = style.shadowOffsetY + bottomDepth * 0.35;
    graphics.fillStyle(hexToNumber(Colors.Black), style.shadowAlpha * fillAlpha);
    graphics.fillRoundedRect(
      -halfW - expand,
      -halfH + shadowY,
      width + expand * 2,
      height + expand,
      safeRadius + expand,
    );
  }

  // Tactile bottom depth rim
  if (bottomDepth > 0 && fillColor !== undefined && fillAlpha > 0) {
    const rimHex = depthColor ?? darkenHex(fillColor, 0.28);
    graphics.fillStyle(hexToNumber(rimHex), fillAlpha);
    graphics.fillRoundedRect(
      -halfW,
      -halfH + pressedOffsetY + bottomDepth,
      width,
      height,
      safeRadius,
    );
  }

  // Main surface fill
  if (fillColor !== undefined && fillAlpha > 0) {
    graphics.fillStyle(hexToNumber(fillColor), fillAlpha);
    graphics.fillRoundedRect(-halfW, -halfH + pressedOffsetY, width, height, safeRadius);

    // Subtle top highlight for tactile depth
    if (style.highlightAlpha > 0 && height >= 20) {
      const inset = Math.max(3, safeRadius * 0.35);
      const highlightW = Math.max(0, width - inset * 2);
      if (highlightW > 4) {
        graphics.fillStyle(hexToNumber(Colors.White), style.highlightAlpha * fillAlpha);
        graphics.fillRoundedRect(
          -highlightW / 2,
          -halfH + pressedOffsetY + 2,
          highlightW,
          Math.min(6, height * 0.14),
          Math.min(4, safeRadius),
        );
      }
    }
  }

  // Border
  if (borderColor !== undefined && borderWidth > 0) {
    graphics.lineStyle(borderWidth, hexToNumber(borderColor), borderAlpha);
    graphics.strokeRoundedRect(-halfW, -halfH + pressedOffsetY, width, height, safeRadius);
  }

  // Focus ring
  if (focusRingColor !== undefined) {
    const pad = 4;
    graphics.lineStyle(2, hexToNumber(focusRingColor), 0.95);
    graphics.strokeRoundedRect(
      -halfW - pad,
      -halfH + pressedOffsetY - pad,
      width + pad * 2,
      height + pad * 2,
      safeRadius + pad,
    );
  }
}
