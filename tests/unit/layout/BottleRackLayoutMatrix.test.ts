import { describe, expect, it } from 'vitest';
import {
  BOTTLE_SOURCE_DIMENSIONS,
  calculateBottleRackLayout,
  type BottleHitRect,
} from '../../../src/game/layout/BottleRackLayout';
import { calculateGameplayLayout } from '../../../src/game/layout/GameplayLayout';

const MATRIX_VIEWPORTS = [
  { label: '320x568', width: 320, height: 568 },
  { label: '360x640', width: 360, height: 640 },
  { label: '390x844', width: 390, height: 844 },
  { label: '430x932', width: 430, height: 932 },
  { label: '568x320', width: 568, height: 320 },
  { label: '640x360', width: 640, height: 360 },
  { label: '844x390', width: 844, height: 390 },
  { label: '932x430', width: 932, height: 430 },
  { label: '768x1024', width: 768, height: 1024 },
  { label: '1024x768', width: 1024, height: 768 },
  { label: '1280x720', width: 1280, height: 720 },
  { label: '1920x1080', width: 1920, height: 1080 },
  { label: '600x340', width: 600, height: 340 },
  { label: '320x480', width: 320, height: 480 },
] as const;

function rectsOverlap(a: BottleHitRect, b: BottleHitRect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

describe('BottleRackLayout full 14-viewport x 3..10 bottle matrix', () => {
  it('fits every bottle count (3..10) strictly inside available bounds with exact 1:2 ratio and non-overlapping hit rects', () => {
    for (const vp of MATRIX_VIEWPORTS) {
      for (let bottleCount = 3; bottleCount <= 10; bottleCount += 1) {
        const gp = calculateGameplayLayout({
          width: vp.width,
          height: vp.height,
          bottleCount,
        });
        const rack = gp.board.rackLayout;
        const ctx = `${vp.label} / ${String(bottleCount)} bottles`;

        expect(rack.bottleCount, ctx).toBe(bottleCount);
        expect(rack.slots, ctx).toHaveLength(bottleCount);
        expect(rack.bottleWidth, ctx).toBeGreaterThanOrEqual(16);
        expect(rack.bottleHeight, ctx).toBe(
          Math.round(rack.bottleWidth / BOTTLE_SOURCE_DIMENSIONS.aspectRatio),
        );
        expect(rack.rackWidth, ctx).toBeLessThanOrEqual(gp.board.rackAvailableWidth + 1);
        expect(rack.rackHeight, ctx).toBeLessThanOrEqual(gp.board.rackAvailableHeight + 1);

        // Verify left-to-right, top-to-bottom deterministic slot index ordering
        for (let i = 0; i < rack.slots.length; i += 1) {
          const slot = rack.slots[i];
          expect(slot?.slotIndex, ctx).toBe(i);
          expect(Number.isFinite(slot?.x), ctx).toBe(true);
          expect(Number.isFinite(slot?.y), ctx).toBe(true);
          if (i > 0) {
            const prev = rack.slots[i - 1];
            if (prev !== undefined && slot !== undefined) {
              if (slot.row === prev.row) {
                expect(slot.x, ctx).toBeGreaterThan(prev.x);
              } else {
                expect(slot.row, ctx).toBeGreaterThan(prev.row);
                expect(slot.y, ctx).toBeGreaterThan(prev.y);
              }
            }
          }
        }

        // Verify zero hit-rect overlap between any pair of slots
        for (let i = 0; i < rack.slots.length; i += 1) {
          for (let j = i + 1; j < rack.slots.length; j += 1) {
            const a = rack.slots[i]?.hitRect;
            const b = rack.slots[j]?.hitRect;
            if (a !== undefined && b !== undefined) {
              expect(rectsOverlap(a, b), `${ctx} slots ${String(i)} & ${String(j)}`).toBe(false);
            }
          }
        }

        // Verify visual bottles stay strictly within gameplay board vertical region (below HUD, above instructions)
        const hudBottom = gp.hud.topY + gp.hud.height;
        const instructionsTop = gp.instructions.y - gp.instructions.height / 2;
        const rackTop = gp.board.rackY - rack.rackHeight / 2;
        const hiddenBottom = gp.board.hiddenRackY + gp.board.hiddenRackHeight / 2;
        expect(rackTop, `${ctx} rackTop vs hudBottom`).toBeGreaterThanOrEqual(hudBottom - 1);
        expect(hiddenBottom, `${ctx} hiddenBottom vs instructionsTop`).toBeLessThanOrEqual(
          instructionsTop + 1,
        );
      }
    }
  });

  it('uses single-row layout in ultra-short compact landscape (568x320) to maximize bottle legibility', () => {
    const rack = calculateBottleRackLayout({
      availableWidth: 544,
      availableHeight: 112,
      bottleCount: 10,
      aspectRatio: 568 / 320,
    });

    expect(rack.rows).toBe(1);
    expect(rack.bottleWidth).toBeGreaterThanOrEqual(38);
    expect(rack.hitWidth).toBeGreaterThanOrEqual(44);
    expect(rack.rackHeight).toBeLessThanOrEqual(112);
  });
});
