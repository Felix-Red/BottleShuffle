import type Phaser from 'phaser';
import { hexToNumber } from '../../tokens/Colors';

export type DesignIconName =
  | 'back'
  | 'close'
  | 'play'
  | 'restart'
  | 'settings'
  | 'sound'
  | 'mute'
  | 'lock'
  | 'check'
  | 'star'
  | 'trophy'
  | 'clock'
  | 'moves'
  | 'info'
  | 'warning'
  | 'error'
  | 'plus'
  | 'minus'
  | 'sparkles';

function drawStarPolygon(
  graphics: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
  points = 5,
): void {
  const vertices: { x: number; y: number }[] = [];
  const step = Math.PI / points;
  let angle = -Math.PI / 2;

  for (let i = 0; i < points * 2; i += 1) {
    const r = i % 2 === 0 ? outerRadius : innerRadius;
    vertices.push({
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
    });
    angle += step;
  }

  graphics.fillPoints(vertices, true);
}

export function drawIcon(
  graphics: Phaser.GameObjects.Graphics,
  icon: DesignIconName,
  cx: number,
  cy: number,
  size: number,
  colorHex: string,
  alpha = 1,
): void {
  const color = hexToNumber(colorHex);
  const r = size * 0.45;
  const stroke = Math.max(2, size * 0.11);

  graphics.fillStyle(color, alpha);
  graphics.lineStyle(stroke, color, alpha);

  switch (icon) {
    case 'back': {
      graphics.beginPath();
      graphics.moveTo(cx + r * 0.35, cy - r * 0.72);
      graphics.lineTo(cx - r * 0.42, cy);
      graphics.lineTo(cx + r * 0.35, cy + r * 0.72);
      graphics.strokePath();
      break;
    }
    case 'close': {
      const d = r * 0.65;
      graphics.beginPath();
      graphics.moveTo(cx - d, cy - d);
      graphics.lineTo(cx + d, cy + d);
      graphics.moveTo(cx + d, cy - d);
      graphics.lineTo(cx - d, cy + d);
      graphics.strokePath();
      break;
    }
    case 'play': {
      graphics.fillTriangle(
        cx - r * 0.48,
        cy - r * 0.72,
        cx - r * 0.48,
        cy + r * 0.72,
        cx + r * 0.78,
        cy,
      );
      break;
    }
    case 'restart': {
      graphics.beginPath();
      graphics.arc(cx, cy, r * 0.72, -Math.PI * 0.25, Math.PI * 1.45, false);
      graphics.strokePath();
      graphics.fillTriangle(
        cx + r * 0.3,
        cy - r * 0.95,
        cx + r * 0.85,
        cy - r * 0.45,
        cx + r * 0.18,
        cy - r * 0.35,
      );
      break;
    }
    case 'settings': {
      graphics.strokeCircle(cx, cy, r * 0.42);
      for (let i = 0; i < 6; i += 1) {
        const a = (i * Math.PI) / 3;
        const x1 = cx + Math.cos(a) * r * 0.56;
        const y1 = cy + Math.sin(a) * r * 0.56;
        const x2 = cx + Math.cos(a) * r * 0.88;
        const y2 = cy + Math.sin(a) * r * 0.88;
        graphics.beginPath();
        graphics.moveTo(x1, y1);
        graphics.lineTo(x2, y2);
        graphics.strokePath();
      }
      break;
    }
    case 'sound':
    case 'mute': {
      graphics.fillRect(cx - r * 0.82, cy - r * 0.32, r * 0.45, r * 0.64);
      graphics.fillTriangle(
        cx - r * 0.42,
        cy - r * 0.32,
        cx - r * 0.42,
        cy + r * 0.32,
        cx + r * 0.12,
        cy - r * 0.72,
      );
      graphics.fillTriangle(
        cx - r * 0.42,
        cy + r * 0.32,
        cx + r * 0.12,
        cy + r * 0.72,
        cx + r * 0.12,
        cy - r * 0.72,
      );
      if (icon === 'sound') {
        graphics.beginPath();
        graphics.arc(cx + r * 0.2, cy, r * 0.4, -Math.PI * 0.32, Math.PI * 0.32, false);
        graphics.strokePath();
        graphics.beginPath();
        graphics.arc(cx + r * 0.2, cy, r * 0.7, -Math.PI * 0.32, Math.PI * 0.32, false);
        graphics.strokePath();
      } else {
        graphics.beginPath();
        graphics.moveTo(cx + r * 0.32, cy - r * 0.38);
        graphics.lineTo(cx + r * 0.88, cy + r * 0.38);
        graphics.moveTo(cx + r * 0.88, cy - r * 0.38);
        graphics.lineTo(cx + r * 0.32, cy + r * 0.38);
        graphics.strokePath();
      }
      break;
    }
    case 'lock': {
      graphics.fillRoundedRect(
        cx - r * 0.66,
        cy - r * 0.08,
        r * 1.32,
        r * 1.0,
        Math.max(2, r * 0.22),
      );
      graphics.beginPath();
      graphics.arc(cx, cy - r * 0.14, r * 0.44, Math.PI, 0, false);
      graphics.strokePath();
      break;
    }
    case 'check': {
      graphics.beginPath();
      graphics.moveTo(cx - r * 0.68, cy + r * 0.02);
      graphics.lineTo(cx - r * 0.14, cy + r * 0.56);
      graphics.lineTo(cx + r * 0.72, cy - r * 0.52);
      graphics.strokePath();
      break;
    }
    case 'star': {
      drawStarPolygon(graphics, cx, cy, r * 0.92, r * 0.42, 5);
      break;
    }
    case 'trophy': {
      graphics.fillRoundedRect(
        cx - r * 0.56,
        cy - r * 0.74,
        r * 1.12,
        r * 0.86,
        Math.max(2, r * 0.28),
      );
      graphics.fillRect(cx - r * 0.14, cy + r * 0.1, r * 0.28, r * 0.46);
      graphics.fillRoundedRect(
        cx - r * 0.46,
        cy + r * 0.54,
        r * 0.92,
        r * 0.24,
        Math.max(2, r * 0.12),
      );
      graphics.beginPath();
      graphics.arc(cx - r * 0.62, cy - r * 0.34, r * 0.28, Math.PI * 0.5, Math.PI * 1.5, false);
      graphics.strokePath();
      graphics.beginPath();
      graphics.arc(cx + r * 0.62, cy - r * 0.34, r * 0.28, -Math.PI * 0.5, Math.PI * 0.5, false);
      graphics.strokePath();
      break;
    }
    case 'clock': {
      graphics.strokeCircle(cx, cy, r * 0.78);
      graphics.beginPath();
      graphics.moveTo(cx, cy - r * 0.45);
      graphics.lineTo(cx, cy);
      graphics.lineTo(cx + r * 0.38, cy + r * 0.22);
      graphics.strokePath();
      break;
    }
    case 'moves': {
      graphics.beginPath();
      graphics.moveTo(cx - r * 0.72, cy - r * 0.32);
      graphics.lineTo(cx + r * 0.56, cy - r * 0.32);
      graphics.moveTo(cx + r * 0.26, cy - r * 0.64);
      graphics.lineTo(cx + r * 0.62, cy - r * 0.32);
      graphics.lineTo(cx + r * 0.26, cy);
      graphics.moveTo(cx + r * 0.72, cy + r * 0.32);
      graphics.lineTo(cx - r * 0.56, cy + r * 0.32);
      graphics.moveTo(cx - r * 0.26, cy);
      graphics.lineTo(cx - r * 0.62, cy + r * 0.32);
      graphics.lineTo(cx - r * 0.26, cy + r * 0.64);
      graphics.strokePath();
      break;
    }
    case 'info': {
      graphics.strokeCircle(cx, cy, r * 0.8);
      graphics.fillCircle(cx, cy - r * 0.34, Math.max(1.5, stroke * 0.55));
      graphics.beginPath();
      graphics.moveTo(cx, cy - r * 0.04);
      graphics.lineTo(cx, cy + r * 0.46);
      graphics.strokePath();
      break;
    }
    case 'warning': {
      graphics.beginPath();
      graphics.moveTo(cx, cy - r * 0.82);
      graphics.lineTo(cx + r * 0.82, cy + r * 0.68);
      graphics.lineTo(cx - r * 0.82, cy + r * 0.68);
      graphics.closePath();
      graphics.strokePath();
      graphics.beginPath();
      graphics.moveTo(cx, cy - r * 0.24);
      graphics.lineTo(cx, cy + r * 0.18);
      graphics.strokePath();
      graphics.fillCircle(cx, cy + r * 0.44, Math.max(1.5, stroke * 0.5));
      break;
    }
    case 'error': {
      graphics.strokeCircle(cx, cy, r * 0.8);
      const d = r * 0.36;
      graphics.beginPath();
      graphics.moveTo(cx - d, cy - d);
      graphics.lineTo(cx + d, cy + d);
      graphics.moveTo(cx + d, cy - d);
      graphics.lineTo(cx - d, cy + d);
      graphics.strokePath();
      break;
    }
    case 'plus': {
      const d = r * 0.66;
      graphics.beginPath();
      graphics.moveTo(cx - d, cy);
      graphics.lineTo(cx + d, cy);
      graphics.moveTo(cx, cy - d);
      graphics.lineTo(cx, cy + d);
      graphics.strokePath();
      break;
    }
    case 'minus': {
      const d = r * 0.66;
      graphics.beginPath();
      graphics.moveTo(cx - d, cy);
      graphics.lineTo(cx + d, cy);
      graphics.strokePath();
      break;
    }
    case 'sparkles': {
      drawStarPolygon(graphics, cx, cy, r * 0.88, r * 0.24, 4);
      break;
    }
  }
}
