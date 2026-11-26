import { describe, expect, it } from 'vitest';
import {
  BOTTLE_SOURCE_DIMENSIONS,
  calculateBottleRackLayout,
  clampRackBottleCount,
} from '../../src/game/components/environment/bottleLayout';

describe('BottleRack responsive layout calculations', () => {
  it('lays out 3 bottles in a single centred row respecting max display bounds', () => {
    const layout = calculateBottleRackLayout({
      availableWidth: 1120,
      availableHeight: 340,
      bottleCount: 3,
      aspectRatio: 16 / 9,
      maxBottleWidth: 100,
    });

    expect(layout.bottleCount).toBe(3);
    expect(layout.rows).toBe(1);
    expect(layout.columns).toBe(3);
    expect(layout.bottleWidth).toBeLessThanOrEqual(100);
    expect(layout.bottleHeight).toBe(
      Math.round(layout.bottleWidth / BOTTLE_SOURCE_DIMENSIONS.aspectRatio),
    );
    expect(layout.slots.map((s) => s.slotIndex)).toEqual([0, 1, 2]);
    expect(layout.slots[0]?.x).toBeLessThan(layout.slots[1]?.x ?? 0);
    expect(layout.slots[1]?.x).toBeLessThan(layout.slots[2]?.x ?? 0);
  });

  it('lays out 5 bottles in a single row in landscape and comfortable portrait viewports', () => {
    const landscape = calculateBottleRackLayout({
      availableWidth: 1000,
      availableHeight: 300,
      bottleCount: 5,
      aspectRatio: 16 / 9,
    });
    expect(landscape.rows).toBe(1);
    expect(landscape.slots).toHaveLength(5);

    const portrait = calculateBottleRackLayout({
      availableWidth: 390,
      availableHeight: 360,
      bottleCount: 5,
      aspectRatio: 390 / 844,
    });
    expect(portrait.rows).toBe(1);
    expect(portrait.slots).toHaveLength(5);
    expect(portrait.bottleWidth).toBeGreaterThanOrEqual(48);
  });

  it('lays out 10 bottles in 1 horizontal row in landscape', () => {
    const layout = calculateBottleRackLayout({
      availableWidth: 1160,
      availableHeight: 320,
      bottleCount: 10,
      aspectRatio: 1280 / 720,
    });

    expect(layout.orientation).toBe('landscape');
    expect(layout.rows).toBe(1);
    expect(layout.columns).toBe(10);
    expect(layout.slots).toHaveLength(10);
    expect(layout.bottleWidth).toBeGreaterThanOrEqual(48);
    expect(layout.rackWidth).toBeLessThanOrEqual(1160);

    for (let i = 1; i < layout.slots.length; i += 1) {
      expect(layout.slots[i]?.slotIndex).toBe(i);
      expect(layout.slots[i]?.x).toBeGreaterThan(layout.slots[i - 1]?.x ?? -Infinity);
    }
  });

  it('lays out 10 bottles in 2 rows of 5 in portrait while preserving left-to-right, top-to-bottom slot ordering', () => {
    const layout = calculateBottleRackLayout({
      availableWidth: 420,
      availableHeight: 420,
      bottleCount: 10,
      aspectRatio: 390 / 844,
    });

    expect(layout.orientation).toBe('portrait');
    expect(layout.rows).toBe(2);
    expect(layout.columns).toBe(5);
    expect(layout.rowLayouts).toHaveLength(2);
    expect(layout.rowLayouts[0]?.count).toBe(5);
    expect(layout.rowLayouts[1]?.count).toBe(5);
    expect(layout.slots.map((s) => s.slotIndex)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

    // Top row left-to-right
    for (let i = 1; i < 5; i += 1) {
      expect(layout.slots[i]?.row).toBe(0);
      expect(layout.slots[i]?.x).toBeGreaterThan(layout.slots[i - 1]?.x ?? -Infinity);
    }
    // Bottom row below top row and left-to-right
    expect(layout.slots[5]?.row).toBe(1);
    expect(layout.slots[5]?.y).toBeGreaterThan(layout.slots[0]?.y ?? -Infinity);
    for (let i = 6; i < 10; i += 1) {
      expect(layout.slots[i]?.row).toBe(1);
      expect(layout.slots[i]?.x).toBeGreaterThan(layout.slots[i - 1]?.x ?? -Infinity);
    }
  });

  it('handles invalid layout inputs safely and clamps bottle counts and dimensions', () => {
    expect(clampRackBottleCount(0)).toBe(3);
    expect(clampRackBottleCount(-10)).toBe(3);
    expect(clampRackBottleCount(25)).toBe(10);
    expect(clampRackBottleCount(Number.NaN)).toBe(3);

    const layout = calculateBottleRackLayout({
      availableWidth: Number.NaN,
      availableHeight: -200,
      bottleCount: 99,
      aspectRatio: 0,
      minInteractionSize: 48,
      maxBottleWidth: 80,
    });

    expect(layout.bottleCount).toBe(10);
    expect(layout.bottleWidth).toBeGreaterThan(0);
    expect(layout.bottleWidth).toBeLessThanOrEqual(80);
    expect(layout.bottleHeight).toBeGreaterThan(0);
    expect(layout.slots).toHaveLength(10);
  });
});
