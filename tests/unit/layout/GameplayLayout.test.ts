import { describe, expect, it } from 'vitest';
import { calculateGameplayLayout } from '../../../src/game/layout/GameplayLayout';

describe('GameplayLayout', () => {
  it('computes clean landscape layouts for 3, 5, and 10 bottles at 1280x720 and 1920x1080', () => {
    for (const [w, h] of [
      [1280, 720],
      [1920, 1080],
    ] as const) {
      for (const count of [3, 5, 10]) {
        const layout = calculateGameplayLayout({ width: w, height: h, bottleCount: count });

        expect(layout.orientation).toBe('landscape');
        expect(layout.board.rackLayout.rows).toBe(1);
        expect(layout.board.rackLayout.slots).toHaveLength(count);
        expect(layout.board.hiddenRows).toBe(1);
        expect(layout.hud.moveCounterX).toBeLessThan(layout.hud.matchCounterX);
        expect(layout.hud.timerX).toBeGreaterThan(layout.hud.matchCounterX);
        expect(layout.board.hiddenRackY).toBeGreaterThan(layout.board.rackY);
        expect(layout.instructions.y).toBeGreaterThan(layout.board.hiddenRackY);
        expect(layout.instructions.y).toBeLessThan(h);
        expect(layout.modalBounds).toEqual({ width: w, height: h });
      }
    }
  });

  it('computes portrait 2x5 layouts for 10 bottles at 390x844 and 360x640 with consistent cross-row slot order', () => {
    for (const [w, h] of [
      [390, 844],
      [360, 640],
    ] as const) {
      const layout = calculateGameplayLayout({ width: w, height: h, bottleCount: 10 });

      expect(layout.orientation).toBe('portrait');
      expect(layout.board.rackLayout.rows).toBe(2);
      expect(layout.board.rackLayout.columns).toBe(5);
      expect(layout.board.hiddenRows).toBe(2);
      expect(layout.board.rackLayout.slots.map((s) => s.slotIndex)).toEqual([
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
      ]);

      // Portrait HUD stacks MatchCounter above Move & Timer row
      expect(layout.hud.moveCounterY).toBeGreaterThan(layout.hud.matchCounterY);
      expect(layout.hud.moveCounterY).toBe(layout.hud.timerY);
      expect(layout.hud.moveCounterX).toBeLessThan(layout.hud.timerX);
      expect(layout.board.rackLayout.bottleWidth).toBeGreaterThanOrEqual(48);
    }
  });

  it('adapts safely without overlap on compact landscape and small portrait mobile viewports', () => {
    for (const [w, h] of [
      [844, 390],
      [360, 640],
      [390, 844],
      [540, 960],
      [1280, 720],
    ] as const) {
      const layout = calculateGameplayLayout({ width: w, height: h, bottleCount: 10 });

      expect(layout.board.rackLayout.slots).toHaveLength(10);
      expect(layout.board.rackLayout.bottleWidth).toBeGreaterThanOrEqual(48);

      const rackTop = layout.board.rackY - layout.board.rackLayout.rackHeight / 2;
      const rackBottom = layout.board.rackY + layout.board.rackLayout.rackHeight / 2;
      const hiddenTop = layout.board.hiddenRackY - layout.board.hiddenRackHeight / 2;
      const hiddenBottom = layout.board.hiddenRackY + layout.board.hiddenRackHeight / 2;
      const instructionsTop = layout.instructions.y - layout.instructions.height / 2;
      const instructionsBottom = layout.instructions.y + layout.instructions.height / 2;

      expect(layout.hud.topY).toBeGreaterThanOrEqual(layout.header.y + layout.header.height);
      expect(rackTop).toBeGreaterThanOrEqual(layout.hud.topY + layout.hud.height);
      expect(hiddenTop).toBeGreaterThanOrEqual(rackBottom);
      expect(hiddenBottom).toBeLessThanOrEqual(instructionsTop);
      expect(instructionsBottom).toBeLessThanOrEqual(h);
    }
  });
});
