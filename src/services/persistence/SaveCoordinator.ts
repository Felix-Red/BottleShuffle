import type { GamePlatform, Unsubscribe } from '../../platform/contracts/GamePlatform';
import type { ProgressionController } from '../../game/progression/ProgressionController';
import type { ChallengeIntroService } from '../ChallengeIntroService';
import type { SettingsService } from '../SettingsService';
import type { TutorialPreferenceService } from '../TutorialPreferenceService';
import type { SaveService } from './SaveService';

export interface SaveCoordinatorOptions {
  readonly saveService: SaveService;
  readonly progressionController: ProgressionController;
  readonly settingsService: SettingsService;
  readonly tutorialPreference: TutorialPreferenceService;
  readonly challengeIntroService?: ChallengeIntroService;
  readonly platform?: GamePlatform;
}

/**
 * Connects authoritative domain/application services and host lifecycle events to SaveService:
 * - Campaign completions & record improvements -> high-priority immediate save
 * - Last-played level updates -> normal-priority debounced save
 * - Settings changes -> normal-priority debounced save
 * - Tutorial completion / skip -> high-priority immediate save
 * - Platform pause/hide -> best-effort flush; resume -> eligible retry
 */
export class SaveCoordinator {
  private readonly saveService: SaveService;
  private readonly unsubscribers: Unsubscribe[] = [];
  private disposed = false;

  public constructor(options: SaveCoordinatorOptions) {
    this.saveService = options.saveService;

    this.unsubscribers.push(
      options.progressionController.onChange((_state, events) => {
        if (this.disposed || this.saveService.isRestoring() || events.length === 0) {
          return;
        }
        const hasCompletion = events.some(
          (e) =>
            e.type === 'LEVEL_COMPLETED' ||
            e.type === 'CHAPTER_COMPLETED' ||
            e.type === 'CAMPAIGN_COMPLETED',
        );
        const hasImprovement = events.some((e) => e.type === 'LEVEL_RECORD_IMPROVED');
        if (hasCompletion) {
          this.saveService.requestSave('campaign_completion', 'high');
        } else if (hasImprovement) {
          this.saveService.requestSave('record_improved', 'high');
        }
      }),
    );

    this.unsubscribers.push(
      options.progressionController.onLastPlayedChange(() => {
        if (this.disposed || this.saveService.isRestoring()) {
          return;
        }
        this.saveService.requestSave('last_played_changed', 'normal');
      }),
    );

    this.unsubscribers.push(
      options.settingsService.subscribe(() => {
        if (this.disposed || this.saveService.isRestoring()) {
          return;
        }
        this.saveService.requestSave('settings_changed', 'normal');
      }),
    );

    this.unsubscribers.push(
      options.tutorialPreference.onChange(() => {
        if (this.disposed || this.saveService.isRestoring()) {
          return;
        }
        this.saveService.requestSave('tutorial_completion', 'high');
      }),
    );

    if (options.challengeIntroService !== undefined) {
      this.unsubscribers.push(
        options.challengeIntroService.onChange(() => {
          if (this.disposed || this.saveService.isRestoring()) {
            return;
          }
          this.saveService.requestSave('challenge_intro_seen', 'normal');
        }),
      );
    }

    if (options.platform !== undefined) {
      this.unsubscribers.push(
        options.platform.onPause(() => {
          if (!this.disposed) {
            void this.saveService.flush();
          }
        }),
      );
      this.unsubscribers.push(
        options.platform.onResume(() => {
          if (!this.disposed) {
            this.saveService.retryIfEligible();
          }
        }),
      );
    }
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers.length = 0;
  }
}
