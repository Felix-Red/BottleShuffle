import { describe, expect, it } from 'vitest';
import { Dimens } from '../../../src/design-system/tokens/Dimens';
import {
  calculateLevelSelectionLayout,
  type RectBounds,
} from '../../../src/game/layout/LevelSelectionLayout';

function rectsOverlap(a: RectBounds, b: RectBounds): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

describe('LevelSelectionLayout', () => {
  const viewports = [
    { name: 'Desktop Landscape 1920x1080', width: 1920, height: 1080, orientation: 'landscape' },
    { name: 'Standard Landscape 1280x720', width: 1280, height: 720, orientation: 'landscape' },
    { name: 'Compact Landscape 844x390', width: 844, height: 390, orientation: 'landscape' },
    { name: 'Wide Portrait 540x960', width: 540, height: 960, orientation: 'portrait' },
    { name: 'Mobile Portrait 390x844', width: 390, height: 844, orientation: 'portrait' },
    { name: 'Compact Portrait 360x640', width: 360, height: 640, orientation: 'portrait' },
  ] as const;

  it('produces finite, non-overlapping regions and valid touch targets across landscape & portrait viewports', () => {
    for (const vp of viewports) {
      for (const levelCount of [5, 10]) {
        const layout = calculateLevelSelectionLayout({
          width: vp.width,
          height: vp.height,
          levelCount,
          chapterCount: 6,
        });

        expect(layout.orientation).toBe(vp.orientation);
        expect(layout.grid.cards).toHaveLength(levelCount);
        expect(layout.grid.cardWidth).toBeGreaterThanOrEqual(Dimens.MinTouchTarget);
        expect(layout.grid.cardHeight).toBeGreaterThanOrEqual(Dimens.MinTouchTarget);
        expect(layout.chapterNav.buttonSize).toBeGreaterThanOrEqual(Dimens.MinTouchTarget);

        // Header does not overlap banner, grid, or bottom nav
        expect(rectsOverlap(layout.header, layout.chapterBanner)).toBe(false);
        expect(rectsOverlap(layout.header, layout.grid)).toBe(false);
        expect(rectsOverlap(layout.header, layout.chapterNav)).toBe(false);

        // Grid does not overlap banner, progress, or bottom nav
        expect(rectsOverlap(layout.grid, layout.chapterBanner)).toBe(false);
        expect(rectsOverlap(layout.grid, layout.chapterProgress)).toBe(false);
        expect(rectsOverlap(layout.grid, layout.chapterNav)).toBe(false);

        // Banner & progress never overlap
        expect(rectsOverlap(layout.chapterBanner, layout.chapterProgress)).toBe(false);

        // Cards follow deterministic left-to-right, top-to-bottom ordering with finite coordinates
        for (let i = 0; i < layout.grid.cards.length; i += 1) {
          const card = layout.grid.cards[i];
          expect(card).toBeDefined();
          if (card === undefined) {
            continue;
          }
          expect(Number.isFinite(card.x)).toBe(true);
          expect(Number.isFinite(card.y)).toBe(true);
          expect(card.index).toBe(i);
          if (i > 0) {
            const prev = layout.grid.cards[i - 1];
            if (prev?.row === card.row) {
              expect(card.x).toBeGreaterThan(prev.x);
            } else if (prev !== undefined) {
              expect(card.y).toBeGreaterThan(prev.y);
            }
          }
        }
      }
    }
  });

  it('enables bounded vertical scrolling automatically for future chapters with many levels', () => {
    const layout = calculateLevelSelectionLayout({
      width: 390,
      height: 844,
      levelCount: 25,
      chapterCount: 8,
    });

    expect(layout.grid.cards).toHaveLength(25);
    expect(layout.grid.scrollNeeded).toBe(true);
    expect(layout.grid.maxScrollY).toBeGreaterThan(0);
    expect(layout.grid.contentHeight).toBeGreaterThan(layout.grid.height);
  });
});
