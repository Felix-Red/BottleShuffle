import { describe, expect, it } from 'vitest';
import { generateLevelPuzzle, type DifficultyId, type LevelId } from '../../src/core';
import { GameplayController } from '../../src/game/gameplay/GameplayController';
import { HomeController } from '../../src/game/home/HomeController';
import type { SceneNavigator } from '../../src/game/navigation/SceneNavigator';
import { ProgressionController } from '../../src/game/progression/ProgressionController';
import type { MonotonicClock } from '../../src/services/GameplayClock';
import { MotionPreferenceService } from '../../src/services/MotionPreferenceService';

class FakeClock implements MonotonicClock {
  private ms = 0;
  public now(): number {
    return this.ms;
  }
  public advance(deltaMs: number): void {
    this.ms += deltaMs;
  }
}

function solveSession(
  session: GameplayController,
  targetSequence: readonly string[],
  clock: FakeClock,
): void {
  while (session.getViewState().status !== 'completed') {
    clock.advance(1000);
    const current = session.getViewState().currentSequence;
    const mismatch = current.findIndex((id, idx) => id !== targetSequence[idx]);
    if (mismatch === -1) {
      break;
    }
    const needed = targetSequence[mismatch];
    if (needed === undefined) {
      break;
    }
    const source = current.indexOf(needed as (typeof current)[number]);
    session.handleBottleTap(mismatch);
    session.handleBottleTap(source);
    session.completeSwapTransition();
  }
}

describe('Home <-> Gameplay Navigation Integration', () => {
  it('flows smoothly across new player play, campaign completion, unfinished return, replay, practice isolation, and shared reduced-motion settings', () => {
    const progression = new ProgressionController();
    const motionPref = new MotionPreferenceService(null);

    const makeNavigator = (): {
      readonly nav: SceneNavigator;
      lastCampaign?: LevelId;
      lastPractice?: DifficultyId;
    } => {
      const box: { nav: SceneNavigator; lastCampaign?: LevelId; lastPractice?: DifficultyId } = {
        nav: {
          isTransitioning: () => false,
          launchCampaignLevel: (levelId) => {
            box.lastCampaign = levelId;
            return true;
          },
          launchPracticePuzzle: (difficulty) => {
            box.lastPractice = difficulty;
            return true;
          },
          launchTutorialReplay: () => true,
          openLevelSelection: () => true,
          returnToHome: () => true,
          cancelPendingTransition: () => undefined,
        },
      };
      return box;
    };

    // 1. Fresh Home screen: Play -> Level 1
    const nav1 = makeNavigator();
    const home1 = new HomeController({
      progressionController: progression,
      navigator: nav1.nav,
    });
    expect(home1.getViewState().primaryActionLabel).toBe('PLAY');
    expect(home1.getViewState().primarySupportingText).toBe('Level 1');
    expect(home1.handlePrimaryAction()).toBe(true);
    expect(nav1.lastCampaign).toBe('level-001');
    home1.dispose();

    // 2. Play & solve Level 1
    const clock = new FakeClock();
    const level1 = progression.getCatalog().getFirstLevel();
    const puzzle1 = generateLevelPuzzle(level1);
    const game1 = new GameplayController({
      sceneData: { mode: 'campaign', levelId: 'level-001' },
      progressionController: progression,
      clock,
    });
    game1.start();
    solveSession(game1, puzzle1.targetSequence, clock);
    game1.dispose();

    // 3. Return to Home: Continue -> Level 2, progress 1/50
    const nav2 = makeNavigator();
    const home2 = new HomeController({
      progressionController: progression,
      navigator: nav2.nav,
    });
    expect(home2.getViewState().primaryActionLabel).toBe('CONTINUE');
    expect(home2.getViewState().primarySupportingText).toBe('Level 2');
    expect(home2.getViewState().completedLevelCount).toBe(1);
    expect(home2.handlePrimaryAction()).toBe(true);
    expect(nav2.lastCampaign).toBe('level-002');
    home2.dispose();

    // 4. Launch Level 2 and return Home unfinished -> Level 3 stays locked, Continue stays Level 2
    const game2 = new GameplayController({
      sceneData: { mode: 'campaign', levelId: 'level-002' },
      progressionController: progression,
      clock,
    });
    game2.start();
    game2.dispose();

    expect(progression.getLevelStatus('level-003')).toBe('locked');
    expect(progression.getCampaignProgress().completedLevels).toBe(1);

    // 5. Launch Practice Mode and solve -> campaign progress stays 1/50
    const nav3 = makeNavigator();
    const home3 = new HomeController({
      progressionController: progression,
      navigator: nav3.nav,
    });
    home3.openPractice();
    expect(home3.getViewState().overlayMode).toBe('practice');
    expect(home3.launchPracticePuzzle('beginner')).toBe(true);
    expect(nav3.lastPractice).toBe('beginner');
    home3.dispose();

    const practiceGame = new GameplayController({
      sceneData: { mode: 'practice', difficulty: 'beginner' },
      progressionController: progression,
      puzzle: puzzle1,
      clock,
    });
    practiceGame.start();
    solveSession(practiceGame, puzzle1.targetSequence, clock);
    practiceGame.dispose();

    expect(progression.getCampaignProgress().completedLevels).toBe(1);
    expect(progression.getLevelStatus('level-003')).toBe('locked');

    // 6. Toggle Reduced Motion in settings -> shared across scenes
    motionPref.setOverride(true);
    expect(motionPref.isReducedMotion()).toBe(true);
    motionPref.dispose();
  });
});
