import type Phaser from 'phaser';
import type { DifficultyId, LevelId } from '../../core';
import { HOME_CONFIG } from '../../config/HomeConfig';
import type { TutorialPreferenceService } from '../../services/TutorialPreferenceService';
import type { GameplayReturnDestination, GameplaySceneData } from '../gameplay/GameplaySceneData';
import type { LevelSelectionSceneData } from '../levels/LevelSelectionSceneData';
import { SCENE_KEYS } from '../scenes/sceneKeys';

export interface SceneNavigator {
  isTransitioning(): boolean;
  launchCampaignLevel(levelId: LevelId, returnTo?: GameplayReturnDestination): boolean;
  launchPracticePuzzle(difficulty: DifficultyId): boolean;
  launchTutorialReplay(returnTo?: GameplayReturnDestination): boolean;
  openLevelSelection(data?: LevelSelectionSceneData): boolean;
  returnToHome(): boolean;
  cancelPendingTransition(): void;
}

/**
 * Pure helper centralising the first-time player routing decision (Section 20).
 * Preserves the exact requested campaign destination when offering the tutorial.
 */
export function resolveCampaignLaunchSceneData(
  levelId: LevelId,
  returnTo: GameplayReturnDestination,
  tutorialPreference?: TutorialPreferenceService,
): GameplaySceneData {
  if (tutorialPreference?.shouldOfferFirstTimeTutorial() === true) {
    return {
      mode: 'tutorial',
      tutorialOrigin: 'first_time',
      returnTo,
      nextCampaignLevelId: levelId,
    };
  }
  return {
    mode: 'campaign',
    levelId,
    returnTo,
  };
}

/**
 * Typed Phaser scene navigation wrapper with duplicate-launch prevention,
 * centralised first-time tutorial routing, optional short camera fade transition,
 * and safe recovery if a launch fails.
 */
export class PhaserSceneNavigator implements SceneNavigator {
  private readonly scene: Phaser.Scene;
  private readonly isReducedMotion: () => boolean;
  private readonly tutorialPreference?: TutorialPreferenceService;
  private transitioning = false;
  private transitionTimer?: Phaser.Time.TimerEvent;

  public constructor(
    scene: Phaser.Scene,
    isReducedMotion: () => boolean = () => false,
    tutorialPreference?: TutorialPreferenceService,
  ) {
    this.scene = scene;
    this.isReducedMotion = isReducedMotion;
    this.tutorialPreference = tutorialPreference;
  }

  public isTransitioning(): boolean {
    return this.transitioning;
  }

  public launchCampaignLevel(
    levelId: LevelId,
    returnTo: GameplayReturnDestination = 'home',
  ): boolean {
    const data = resolveCampaignLaunchSceneData(levelId, returnTo, this.tutorialPreference);
    return this.startScene(SCENE_KEYS.GAME, data);
  }

  public launchPracticePuzzle(difficulty: DifficultyId): boolean {
    const data: GameplaySceneData = {
      mode: 'practice',
      difficulty,
      returnTo: 'home',
    };
    return this.startScene(SCENE_KEYS.GAME, data);
  }

  public launchTutorialReplay(returnTo: GameplayReturnDestination = 'home'): boolean {
    const data: GameplaySceneData = {
      mode: 'tutorial',
      tutorialOrigin: 'replay',
      returnTo,
    };
    return this.startScene(SCENE_KEYS.GAME, data);
  }

  public openLevelSelection(data?: LevelSelectionSceneData): boolean {
    return this.startScene(SCENE_KEYS.LEVEL_SELECTION, data);
  }

  public returnToHome(): boolean {
    return this.startScene(SCENE_KEYS.HOME);
  }

  public cancelPendingTransition(): void {
    if (this.transitionTimer !== undefined) {
      this.transitionTimer.remove(false);
      this.transitionTimer = undefined;
    }
    this.transitioning = false;
  }

  private startScene(
    targetKey: string,
    data?: GameplaySceneData | LevelSelectionSceneData,
  ): boolean {
    if (this.transitioning) {
      return false;
    }

    this.transitioning = true;

    const performStart = (): boolean => {
      try {
        this.scene.scene.start(targetKey, data);
        return true;
      } catch {
        this.transitioning = false;
        return false;
      }
    };

    const fadeMs = this.isReducedMotion() ? 0 : HOME_CONFIG.motion.transitionFadeMs;
    if (fadeMs <= 0) {
      return performStart();
    }

    try {
      this.scene.cameras.main.fadeOut(fadeMs, 23, 17, 38);
      this.transitionTimer = this.scene.time.delayedCall(fadeMs, () => {
        this.transitionTimer = undefined;
        performStart();
      });
      return true;
    } catch {
      this.transitioning = false;
      return false;
    }
  }
}
