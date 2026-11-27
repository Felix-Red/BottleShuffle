import { describe, expect, it } from 'vitest';
import { calculateGameplayLayout } from '../../../src/game/layout/GameplayLayout';
import { calculateHomeLayout } from '../../../src/game/layout/HomeLayout';
import { calculateLevelSelectionLayout } from '../../../src/game/layout/LevelSelectionLayout';
import { computePauseLayout } from '../../../src/game/layout/PauseLayout';
import { computeSettingsLayout } from '../../../src/game/layout/SettingsLayout';
import { calculateTutorialLayout } from '../../../src/game/layout/TutorialLayout';
import { computeVictoryLayout } from '../../../src/game/layout/VictoryLayout';

const ALL_14_VIEWPORTS = [
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

describe('Screen layout calculators across the 14-viewport verification matrix', () => {
  it('keeps HomeLayout controls inside safe viewport bounds with >= 44px touch targets across all 14 viewports', () => {
    for (const vp of ALL_14_VIEWPORTS) {
      const safeArea =
        vp.height > vp.width
          ? { top: 20, bottom: 16, left: 0, right: 0 }
          : { top: 0, bottom: 10, left: 20, right: 20 };
      const layout = calculateHomeLayout({ width: vp.width, height: vp.height, safeArea });

      expect(layout.primaryButton.height, vp.label).toBeGreaterThanOrEqual(44);
      expect(layout.levelsButton.height, vp.label).toBeGreaterThanOrEqual(44);
      expect(layout.practiceButton.height, vp.label).toBeGreaterThanOrEqual(44);
      expect(layout.settings.size, vp.label).toBeGreaterThanOrEqual(44);

      const progressBottom = layout.progressCard.y + layout.progressCard.height / 2;
      expect(progressBottom, `${vp.label} progressBottom`).toBeLessThanOrEqual(
        layout.contentBounds.bottom + 1,
      );
      expect(
        layout.levelsButton.x + layout.levelsButton.width / 2,
        `${vp.label} levels vs practice`,
      ).toBeLessThan(layout.practiceButton.x - layout.practiceButton.width / 2);
    }
  });

  it('keeps LevelSelectionLayout header, chapter summary, grid, and nav non-overlapping across all 14 viewports', () => {
    for (const vp of ALL_14_VIEWPORTS) {
      const layout = calculateLevelSelectionLayout({
        width: vp.width,
        height: vp.height,
        levelCount: 10,
        chapterCount: 6,
      });

      expect(layout.grid.cardWidth, vp.label).toBeGreaterThanOrEqual(44);
      expect(layout.grid.cardHeight, vp.label).toBeGreaterThanOrEqual(44);
      expect(layout.chapterNav.buttonSize, vp.label).toBeGreaterThanOrEqual(44);
      expect(layout.header.y + layout.header.height, vp.label).toBeLessThanOrEqual(layout.grid.y);
      expect(layout.grid.y + layout.grid.height, vp.label).toBeLessThanOrEqual(layout.chapterNav.y);
    }
  });

  it('keeps TutorialLayout instruction panel below gameplay board without overlap across all 14 viewports', () => {
    for (const vp of ALL_14_VIEWPORTS) {
      const layout = calculateTutorialLayout({
        width: vp.width,
        height: vp.height,
        bottleCount: 4,
        hasActions: true,
        showCounterExamples: false,
      });

      expect(
        layout.instructionPanel.y + layout.instructionPanel.height,
        vp.label,
      ).toBeLessThanOrEqual(vp.height);
      expect(layout.instructionPanel.width, vp.label).toBeLessThanOrEqual(vp.width);
      const hiddenBottom =
        layout.gameplay.board.hiddenRackY + layout.gameplay.board.hiddenRackHeight / 2;
      expect(hiddenBottom, `${vp.label} hidden vs tutorial panel`).toBeLessThanOrEqual(
        layout.instructionPanel.y + 1,
      );
    }
  });

  it('keeps VictoryLayout, PauseLayout, and SettingsLayout inside viewport bounds with >= 44px controls across all 14 viewports', () => {
    for (const vp of ALL_14_VIEWPORTS) {
      const victory = computeVictoryLayout(vp.width, vp.height, {
        hasOptimalBadge: true,
        hasPersonalBest: true,
        hasMilestoneBanner: true,
        isCampaignComplete: false,
        secondaryActionCount: 3,
      });
      expect(victory.panelRect.width, `${vp.label} victory W`).toBeLessThanOrEqual(vp.width);
      expect(victory.panelRect.height, `${vp.label} victory H`).toBeLessThanOrEqual(vp.height);
      expect(victory.primaryButtonRect.height, `${vp.label} victory CTA`).toBeGreaterThanOrEqual(
        44,
      );
      for (const sec of victory.secondaryButtonRects) {
        expect(sec.height, `${vp.label} victory sec`).toBeGreaterThanOrEqual(44);
      }

      const pause = computePauseLayout(vp.width, vp.height);
      expect(pause.panelRect.width, `${vp.label} pause W`).toBeLessThanOrEqual(vp.width);
      expect(pause.panelRect.height, `${vp.label} pause H`).toBeLessThanOrEqual(vp.height);
      expect(pause.resumeButtonRect.height, `${vp.label} pause resume`).toBeGreaterThanOrEqual(44);
      expect(pause.restartButtonRect.height, `${vp.label} pause restart`).toBeGreaterThanOrEqual(
        44,
      );
      expect(pause.settingsButtonRect.height, `${vp.label} pause settings`).toBeGreaterThanOrEqual(
        44,
      );
      expect(pause.exitButtonRect.height, `${vp.label} pause exit`).toBeGreaterThanOrEqual(44);

      const settings = computeSettingsLayout(vp.width, vp.height, { showHowToPlay: true });
      expect(settings.panelRect.width, `${vp.label} settings W`).toBeLessThanOrEqual(vp.width);
      expect(settings.panelRect.height, `${vp.label} settings H`).toBeLessThanOrEqual(vp.height);
      expect(settings.musicRowRect.height, `${vp.label} settings music`).toBeGreaterThanOrEqual(44);
      expect(settings.doneButtonRect.height, `${vp.label} settings done`).toBeGreaterThanOrEqual(
        44,
      );

      // On ultra-short embedded portrait (320x480), Settings switches cleanly to bounded vertical scroll
      if (vp.label === '320x480') {
        expect(settings.scrollNeeded).toBe(true);
        expect(settings.maxScrollY).toBeGreaterThan(0);
      } else if (vp.label === '568x320') {
        expect(settings.mode).toBe('compact-landscape');
        expect(settings.scrollNeeded).toBe(false);
      }
    }
  });

  it('keeps GameplayLayout HUD cards inside content bounds even on narrow compact landscape (568x320)', () => {
    const layout = calculateGameplayLayout({
      width: 568,
      height: 320,
      bottleCount: 8,
      safeArea: { left: 20, right: 20, top: 0, bottom: 10 },
    });

    const moveLeft = layout.hud.moveCounterX - (layout.hud.statWidth * layout.hud.scale) / 2;
    const timerRight = layout.hud.timerX + (layout.hud.statWidth * layout.hud.scale) / 2;
    expect(moveLeft).toBeGreaterThanOrEqual(layout.contentBounds.x);
    expect(timerRight).toBeLessThanOrEqual(layout.contentBounds.right);
  });
});
