import { describe, expect, it } from 'vitest';
import { calculateHomeLayout } from '../../../src/game/layout/HomeLayout';

describe('HomeLayout', () => {
  it('computes non-overlapping landscape layouts across 1920x1080, 1280x720, and 844x390', () => {
    for (const [w, h] of [
      [1920, 1080],
      [1280, 720],
      [844, 390],
    ] as const) {
      const layout = calculateHomeLayout({ width: w, height: h });

      expect(layout.orientation).toBe('landscape');
      expect(layout.primaryButton.height).toBeGreaterThanOrEqual(48);
      expect(layout.levelsButton.height).toBeGreaterThanOrEqual(44);
      expect(layout.practiceButton.height).toBeGreaterThanOrEqual(44);
      expect(layout.settings.size).toBeGreaterThanOrEqual(48);

      // Left column stays strictly to the left of right-side hero artwork
      const primaryRight = layout.primaryButton.x + layout.primaryButton.width / 2;
      const heroLeft = layout.hero.x - layout.hero.width / 2;
      expect(primaryRight).toBeLessThanOrEqual(heroLeft + 8);

      // Vertical non-overlap inside left action stack
      const logoBottom = layout.logo.y + layout.logo.height / 2;
      const primaryTop = layout.primaryButton.y - layout.primaryButton.height / 2;
      const primaryBottom = layout.primaryButton.y + layout.primaryButton.height / 2;
      const secTop = layout.levelsButton.y - layout.levelsButton.height / 2;
      const secBottom = layout.levelsButton.y + layout.levelsButton.height / 2;
      const progTop = layout.progressCard.y - layout.progressCard.height / 2;
      const progBottom = layout.progressCard.y + layout.progressCard.height / 2;

      expect(logoBottom).toBeLessThanOrEqual(primaryTop);
      expect(primaryBottom).toBeLessThanOrEqual(secTop);
      expect(secBottom).toBeLessThanOrEqual(progTop);
      expect(progBottom).toBeLessThanOrEqual(h);

      // Secondary buttons sit cleanly side by side without overlapping
      expect(layout.levelsButton.x + layout.levelsButton.width / 2).toBeLessThan(
        layout.practiceButton.x - layout.practiceButton.width / 2,
      );
    }
  });

  it('computes non-overlapping portrait layouts across 540x960, 390x844, and 360x640', () => {
    for (const [w, h] of [
      [540, 960],
      [390, 844],
      [360, 640],
    ] as const) {
      const layout = calculateHomeLayout({ width: w, height: h });

      expect(layout.orientation).toBe('portrait');
      expect(layout.primaryButton.height).toBeGreaterThanOrEqual(48);
      expect(layout.levelsButton.height).toBeGreaterThanOrEqual(44);
      expect(layout.practiceButton.height).toBeGreaterThanOrEqual(44);

      const settingsBottom = layout.settings.y + layout.settings.size / 2;
      const logoTop = layout.logo.y - layout.logo.height / 2;
      const heroTop = layout.hero.y - layout.hero.height / 2;
      const heroBottom = layout.hero.y + layout.hero.height / 2;
      const primaryTop = layout.primaryButton.y - layout.primaryButton.height / 2;
      const primaryBottom = layout.primaryButton.y + layout.primaryButton.height / 2;
      const secTop = layout.levelsButton.y - layout.levelsButton.height / 2;
      const secBottom = layout.levelsButton.y + layout.levelsButton.height / 2;
      const progTop = layout.progressCard.y - layout.progressCard.height / 2;
      const progBottom = layout.progressCard.y + layout.progressCard.height / 2;

      expect(logoTop).toBeGreaterThanOrEqual(settingsBottom);
      expect(heroTop).toBeGreaterThan(layout.tagline.y);
      expect(primaryTop).toBeGreaterThanOrEqual(heroBottom);
      expect(secTop).toBeGreaterThanOrEqual(primaryBottom);
      expect(progTop).toBeGreaterThanOrEqual(secBottom);
      expect(progBottom).toBeLessThanOrEqual(h);
    }
  });
});
