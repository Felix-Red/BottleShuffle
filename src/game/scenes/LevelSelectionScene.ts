import Phaser from 'phaser';
import { getChapterVisualTheme, LEVEL_SELECTION_COPY } from '../../config/ChapterVisualConfig';
import {
  Colors,
  createGameTheme,
  hexToNumber,
  Modal,
  Toast,
  type GameTheme,
} from '../../design-system';
import type { GamePlatform, Unsubscribe } from '../../platform/contracts/GamePlatform';
import { MotionPreferenceService } from '../../services/MotionPreferenceService';
import type { GameReadinessService } from '../../services/platform/GameReadinessService';
import type { ResponsiveLayoutService } from '../../services/ResponsiveLayoutService';
import type { TutorialPreferenceService } from '../../services/TutorialPreferenceService';
import type { SceneAudioCoordinator } from '../audio/SceneAudioCoordinator';
import { ChapterTransition } from '../animations/levels/ChapterTransition';
import { LevelCompletionAnimation } from '../animations/levels/LevelCompletionAnimation';
import { LevelUnlockAnimation } from '../animations/levels/LevelUnlockAnimation';
import { GameBackground } from '../components/environment/GameBackground';
import { ChapterArtwork } from '../components/levels/ChapterArtwork';
import { ChapterBanner } from '../components/levels/ChapterBanner';
import { ChapterNavigation } from '../components/levels/ChapterNavigation';
import { ChapterProgress } from '../components/levels/ChapterProgress';
import { LevelGrid } from '../components/levels/LevelGrid';
import { LevelPreviewDialog } from '../components/levels/LevelPreviewDialog';
import { LevelSelectionHeader } from '../components/levels/LevelSelectionHeader';
import {
  calculateLevelSelectionLayout,
  type LevelSelectionLayout,
} from '../layout/LevelSelectionLayout';
import {
  LevelSelectionController,
  type ChapterTransitionDirection,
} from '../levels/LevelSelectionController';
import type { LevelSelectionSceneData } from '../levels/LevelSelectionSceneData';
import type { LevelSelectionViewState } from '../levels/LevelSelectionViewState';
import type { LevelUnlockTracker } from '../levels/LevelUnlockTracker';
import { PhaserSceneNavigator } from '../navigation/SceneNavigator';
import type { ProgressionController } from '../progression/ProgressionController';
import { SCENE_KEYS } from './sceneKeys';

/**
 * Production chapter-based Level Selection screen for Bottle Shuffle.
 * Displays chapter artwork, chapter & campaign progress, interactive level grid,
 * level preview dialogs with real personal best records, restrained unlock & chapter
 * transition animations, and responsive landscape/portrait layouts.
 */
export class LevelSelectionScene extends Phaser.Scene {
  private readonly platform: GamePlatform;
  private readonly progressionController: ProgressionController;
  private readonly unlockTracker?: LevelUnlockTracker;
  private readonly sharedMotionPreference?: MotionPreferenceService;
  private readonly tutorialPreference?: TutorialPreferenceService;
  private readonly audioCoordinator?: SceneAudioCoordinator;
  private readonly responsiveService?: ResponsiveLayoutService;
  private readonly readinessService?: GameReadinessService;
  private defaultData?: LevelSelectionSceneData;
  private activeData?: LevelSelectionSceneData;

  private motionPreference?: MotionPreferenceService;
  private ownsMotionPreference = false;
  private theme: GameTheme = createGameTheme();

  private navigator?: PhaserSceneNavigator;
  private controller?: LevelSelectionController;
  private layout?: LevelSelectionLayout;

  private background?: GameBackground;
  private header?: LevelSelectionHeader;
  private chapterBanner?: ChapterBanner;
  private chapterArtwork?: ChapterArtwork;
  private chapterProgress?: ChapterProgress;
  private levelGrid?: LevelGrid;
  private chapterNav?: ChapterNavigation;
  private previewDialog?: LevelPreviewDialog;
  private toast?: Toast;
  private errorModal?: Modal;

  private chapterTransition?: ChapterTransition;
  private unlockAnimation?: LevelUnlockAnimation;
  private completionAnimation?: LevelCompletionAnimation;

  private lastRenderedChapterId: string | null = null;
  private lastBannerShown: string | null = null;
  private lastErrorShown: string | null = null;
  private devPreviewConsumed = false;

  private unsubscribePlatformPause?: Unsubscribe;
  private unsubscribePlatformResume?: Unsubscribe;
  private unsubscribeMotion?: Unsubscribe;
  private unsubscribeResponsive?: Unsubscribe;

  public constructor(
    platform: GamePlatform,
    progressionController: ProgressionController,
    motionPreference?: MotionPreferenceService,
    unlockTracker?: LevelUnlockTracker,
    defaultData?: LevelSelectionSceneData,
    tutorialPreference?: TutorialPreferenceService,
    audioCoordinator?: SceneAudioCoordinator,
    responsiveService?: ResponsiveLayoutService,
    readinessService?: GameReadinessService,
  ) {
    super({ key: SCENE_KEYS.LEVEL_SELECTION });
    this.platform = platform;
    this.progressionController = progressionController;
    this.sharedMotionPreference = motionPreference;
    this.unlockTracker = unlockTracker;
    this.defaultData = defaultData;
    this.tutorialPreference = tutorialPreference;
    this.audioCoordinator = audioCoordinator;
    this.responsiveService = responsiveService;
    this.readinessService = readinessService;
  }

  public init(data?: LevelSelectionSceneData): void {
    if (data !== undefined && Object.keys(data).length > 0) {
      this.activeData = data;
    } else {
      this.activeData = this.defaultData;
    }
  }

  public create(): void {
    this.lastRenderedChapterId = null;
    this.lastBannerShown = null;
    this.lastErrorShown = null;

    this.cameras.main.setBackgroundColor(hexToNumber(Colors.Surface.Background));
    this.cameras.main.resetFX();
    this.audioCoordinator?.enterScene(this, 'menu');

    if (this.sharedMotionPreference !== undefined) {
      this.motionPreference = this.sharedMotionPreference;
      this.ownsMotionPreference = false;
    } else {
      this.motionPreference = new MotionPreferenceService();
      this.ownsMotionPreference = true;
    }

    this.theme = createGameTheme({ reducedMotion: this.motionPreference.isReducedMotion() });
    this.navigator = new PhaserSceneNavigator(
      this,
      () => this.motionPreference?.isReducedMotion() ?? false,
      this.tutorialPreference,
    );

    this.chapterTransition = new ChapterTransition();
    this.unlockAnimation = new LevelUnlockAnimation(this);
    this.completionAnimation = new LevelCompletionAnimation();

    this.controller = new LevelSelectionController({
      progressionController: this.progressionController,
      navigator: this.navigator,
      ...(this.unlockTracker !== undefined ? { unlockTracker: this.unlockTracker } : {}),
      ...(this.activeData !== undefined ? { initialData: this.activeData } : {}),
      callbacks: {
        onChapterChange: (state, direction, token) => {
          this.handleChapterTransition(state, direction, token);
        },
        onViewStateChange: (state) => {
          this.renderViewState(state);
        },
        onLockedLevelAttempt: (message) => {
          this.toast?.show({ message, variant: 'info', durationMs: 2200 });
        },
      },
    });

    this.background = new GameBackground(this, { depth: -10 });

    this.header = new LevelSelectionHeader(this, {
      theme: this.theme,
      onBack: () => {
        this.audioCoordinator?.playUiBack();
        this.controller?.returnToHome();
      },
    });

    this.chapterBanner = new ChapterBanner(this);
    this.chapterArtwork = new ChapterArtwork(this, this.theme);
    this.chapterProgress = new ChapterProgress(this, this.theme);

    this.levelGrid = new LevelGrid(this, {
      theme: this.theme,
      onSelectLevel: (levelId) => {
        this.audioCoordinator?.playUiClick();
        this.controller?.selectLevel(levelId);
      },
      onSelectLockedLevel: (levelId) => {
        this.audioCoordinator?.playUiBack();
        this.controller?.selectLevel(levelId);
      },
    });

    this.chapterNav = new ChapterNavigation(this, {
      theme: this.theme,
      onPrevious: () => {
        this.audioCoordinator?.playUiClick();
        this.controller?.previousChapter();
      },
      onNext: () => {
        this.audioCoordinator?.playUiClick();
        this.controller?.nextChapter();
      },
      onSelectChapter: (chapterId) => {
        this.audioCoordinator?.playUiClick();
        this.controller?.selectChapter(chapterId);
      },
    });

    this.previewDialog = new LevelPreviewDialog(this, {
      theme: this.theme,
      onPlay: () => {
        this.audioCoordinator?.playUiClick();
        this.controller?.launchSelectedLevel();
      },
      onClose: () => {
        this.audioCoordinator?.playUiBack();
        this.controller?.closePreview();
      },
    });

    this.toast = new Toast(this, { theme: this.theme });

    const initialState = this.controller.getViewState();
    this.applyResponsiveLayout(this.scale.width, this.scale.height, initialState);
    this.renderViewState(initialState);
    this.triggerVisibleUnlockAnimations(initialState);
    this.bindLifecycle();

    if (
      import.meta.env.DEV &&
      !this.devPreviewConsumed &&
      this.activeData?.devPreviewLevelId !== undefined
    ) {
      this.devPreviewConsumed = true;
      this.controller.selectLevel(this.activeData.devPreviewLevelId);
    }

    if (this.readinessService !== undefined) {
      this.readinessService.markInteractiveSceneReady();
    } else {
      this.platform.notifyGameReady();
    }
  }

  private renderViewState(state: LevelSelectionViewState): void {
    const chapterChanged = state.selectedChapterId !== this.lastRenderedChapterId;
    if (chapterChanged) {
      this.lastRenderedChapterId = state.selectedChapterId;
      this.applyResponsiveLayout(this.scale.width, this.scale.height, state);
    }

    const visual = getChapterVisualTheme(
      state.currentChapter.chapterId,
      state.currentChapter.bottleCount,
      state.currentChapter.chapterNumber,
    );

    this.header?.setCampaignProgress(
      state.completedCampaignLevels,
      state.totalCampaignLevels,
      state.isCampaignComplete,
      false,
      state.totalEarnedStars,
      state.maxAvailableStars,
    );
    this.header?.setBackEnabled(state.canNavigate);

    this.chapterBanner?.setChapter(state.currentChapter);
    if (chapterChanged) {
      this.chapterArtwork?.setChapter(state.currentChapter);
    }
    this.chapterProgress?.setChapter(state.currentChapter, !chapterChanged);

    this.levelGrid?.renderChapterLevels(state.levelCards, visual.accentHex, chapterChanged);

    this.chapterNav?.updateNavigation({
      chapters: state.chapters,
      selectedIndex: state.selectedChapterIndex,
      canGoPrevious: state.canGoPreviousChapter,
      canGoNext: state.canGoNextChapter,
      enabled: state.canNavigate && state.previewLevel === null,
    });

    this.syncPreviewDialog(state);
    this.syncChapterCompletedBanner(state);
    this.syncErrorModal(state);
  }

  private handleChapterTransition(
    state: LevelSelectionViewState,
    direction: ChapterTransitionDirection,
    token: number,
  ): void {
    this.unlockAnimation?.cancelAll();
    this.completionAnimation?.cancel();
    this.chapterTransition?.cancel();

    // Update bounds & chapter content first so the slide enters with the target chapter
    this.lastRenderedChapterId = state.selectedChapterId;
    this.applyResponsiveLayout(this.scale.width, this.scale.height, state);

    const visual = getChapterVisualTheme(
      state.currentChapter.chapterId,
      state.currentChapter.bottleCount,
      state.currentChapter.chapterNumber,
    );
    this.chapterBanner?.setChapter(state.currentChapter);
    this.chapterArtwork?.setChapter(state.currentChapter);
    this.chapterProgress?.setChapter(state.currentChapter, false);
    this.levelGrid?.renderChapterLevels(state.levelCards, visual.accentHex, true);

    const targets: Phaser.GameObjects.Container[] = [];
    if (this.chapterBanner !== undefined) {
      targets.push(this.chapterBanner);
    }
    if (this.chapterArtwork?.visible) {
      targets.push(this.chapterArtwork);
    }
    if (this.chapterProgress !== undefined) {
      targets.push(this.chapterProgress);
    }
    if (this.levelGrid !== undefined) {
      targets.push(this.levelGrid);
    }

    this.chapterTransition?.play({
      scene: this,
      targets,
      direction,
      reducedMotion: this.theme.reducedMotion,
      token,
      isTokenValid: (t) => this.controller?.isCurrentTransitionToken(t) ?? false,
      onComplete: () => {
        const current = this.controller?.getViewState();
        if (current !== undefined) {
          this.triggerVisibleUnlockAnimations(current);
        }
      },
    });
  }

  private triggerVisibleUnlockAnimations(state: LevelSelectionViewState): void {
    const newlyUnlocked = state.levelCards.filter((card) => card.shouldAnimateUnlock);
    if (newlyUnlocked.length === 0) {
      return;
    }

    for (const cardState of newlyUnlocked) {
      const card = this.levelGrid?.getCardByLevelId(cardState.levelId);
      if (card !== undefined) {
        this.unlockAnimation?.playOnCard(card, this.theme.reducedMotion);
      }
    }

    this.audioCoordinator?.playLevelUnlock();

    // Consume immediately so returning or switching chapters never replays the animation
    this.controller?.acknowledgeVisibleUnlocks();
  }

  private syncPreviewDialog(state: LevelSelectionViewState): void {
    if (state.previewLevel === null) {
      if (this.previewDialog?.isOpen() === true) {
        this.previewDialog.close();
      }
      return;
    }

    if (
      this.previewDialog?.isOpen() !== true ||
      this.previewDialog.getCurrentLevelId() !== state.previewLevel.levelId
    ) {
      this.previewDialog?.open(state.previewLevel, !this.theme.reducedMotion);
    }
  }

  private syncChapterCompletedBanner(state: LevelSelectionViewState): void {
    if (
      state.chapterCompletedBanner !== null &&
      state.chapterCompletedBanner !== this.lastBannerShown
    ) {
      this.lastBannerShown = state.chapterCompletedBanner;
      if (this.chapterProgress !== undefined) {
        this.completionAnimation?.playChapterPulse(
          this,
          this.chapterProgress,
          this.theme.reducedMotion,
        );
      }
      this.toast?.show({
        message: state.chapterCompletedBanner,
        variant: 'success',
        durationMs: 3200,
      });
    }
  }

  private syncErrorModal(state: LevelSelectionViewState): void {
    if (state.errorMessage === null) {
      this.lastErrorShown = null;
      if (this.errorModal?.isOpen() === true) {
        this.errorModal.close(false);
      }
      return;
    }

    if (state.errorMessage === this.lastErrorShown) {
      return;
    }
    this.lastErrorShown = state.errorMessage;
    this.errorModal?.destroy();
    this.errorModal = new Modal(this, {
      title: LEVEL_SELECTION_COPY.errorModalTitle,
      message: state.errorMessage,
      dismissible: true,
      theme: this.theme,
      primaryAction: {
        label: LEVEL_SELECTION_COPY.errorDismissLabel,
        closeOnClick: false,
        onClick: () => {
          this.controller?.dismissError();
        },
      },
      onDismiss: () => {
        this.controller?.dismissError();
      },
    });
    this.errorModal.resize(this.scale.width, this.scale.height);
    this.errorModal.open(!this.theme.reducedMotion);
  }

  private applyResponsiveLayout(
    width: number,
    height: number,
    state = this.controller?.getViewState(),
  ): void {
    const safeW = Math.max(1, width);
    const safeH = Math.max(1, height);
    const safeArea = this.responsiveService?.getViewport().safeArea;

    this.chapterTransition?.cancel();
    this.background?.resize(safeW, safeH);

    const layout = calculateLevelSelectionLayout({
      width: safeW,
      height: safeH,
      levelCount: state?.levelCards.length ?? 5,
      chapterCount: state?.totalChapters ?? 6,
      ...(safeArea !== undefined ? { safeArea } : {}),
    });
    this.layout = layout;

    this.header?.applyLayout(layout);
    this.chapterBanner?.applyBounds(layout.chapterBanner);
    this.chapterArtwork?.applyBounds(layout.chapterArtwork);
    this.chapterProgress?.applyBounds(layout.chapterProgress);
    this.levelGrid?.applyLayout(layout.grid);
    this.chapterNav?.applyLayout(layout);

    this.previewDialog?.resize(safeW, safeH);
    this.errorModal?.resize(safeW, safeH, safeArea);
    this.toast?.resize(safeW, safeH);
  }

  private applyMotionPreference(reducedMotion: boolean): void {
    this.chapterTransition?.cancel();
    this.unlockAnimation?.cancelAll();
    this.completionAnimation?.cancel();

    this.theme = createGameTheme({ reducedMotion });
    this.header?.setTheme(this.theme);
    this.chapterArtwork?.setTheme(this.theme);
    this.chapterProgress?.setTheme(this.theme);
    this.levelGrid?.setTheme(this.theme);
    this.chapterNav?.setTheme(this.theme);
    this.previewDialog?.setTheme(this.theme);
    this.toast?.setTheme(this.theme);
    this.errorModal?.setTheme(this.theme);
  }

  private bindLifecycle(): void {
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown);

    this.unsubscribePlatformPause = this.platform.onPause(this.handleSuspend);
    this.unsubscribePlatformResume = this.platform.onResume(this.handleResume);
    this.unsubscribeMotion = this.motionPreference?.onChange(this.handleMotionChange);
    this.unsubscribeResponsive = this.responsiveService?.subscribe((snapshot) => {
      this.applyResponsiveLayout(snapshot.viewport.width, snapshot.viewport.height);
    });

    if (typeof globalThis.window !== 'undefined') {
      const useBrowserVisibility =
        this.platform.getCapabilities?.().useBrowserVisibilityLifecycle ?? true;
      if (useBrowserVisibility) {
        globalThis.window.addEventListener('blur', this.handleSuspend);
        globalThis.window.addEventListener('focus', this.handleResume);
      }
      globalThis.window.addEventListener('keydown', this.handleKeyDown);
    }
  }

  private readonly handleResize = (gameSize: Phaser.Structs.Size): void => {
    this.applyResponsiveLayout(gameSize.width, gameSize.height);
  };

  private readonly handleSuspend = (): void => {
    this.chapterArtwork?.setSuspended(true);
    this.controller?.setSuspended(true);
  };

  private readonly handleResume = (): void => {
    this.chapterArtwork?.setSuspended(false);
    this.controller?.setSuspended(false);
  };

  private readonly handleMotionChange = (reducedMotion: boolean): void => {
    this.applyMotionPreference(reducedMotion);
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    const cols = this.layout?.grid.columns ?? this.levelGrid?.getColumns() ?? 5;

    switch (event.key) {
      case 'ArrowLeft':
        this.controller?.moveGridFocus(-1, 0, cols);
        break;
      case 'ArrowRight':
        this.controller?.moveGridFocus(1, 0, cols);
        break;
      case 'ArrowUp':
        this.controller?.moveGridFocus(0, -1, cols);
        break;
      case 'ArrowDown':
        this.controller?.moveGridFocus(0, 1, cols);
        break;
      case '[':
      case 'PageUp':
        this.controller?.previousChapter();
        break;
      case ']':
      case 'PageDown':
        this.controller?.nextChapter();
        break;
      case 'Enter':
      case ' ':
        this.controller?.activateFocusedLevel();
        break;
      case 'Escape':
        this.controller?.handleEscapeKey();
        break;
      default:
        break;
    }
  };

  private readonly handleShutdown = (): void => {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize);

    this.chapterTransition?.cancel();
    this.chapterTransition = undefined;
    this.unlockAnimation?.cancelAll();
    this.unlockAnimation = undefined;
    this.completionAnimation?.cancel();
    this.completionAnimation = undefined;

    this.unsubscribePlatformPause?.();
    this.unsubscribePlatformPause = undefined;
    this.unsubscribePlatformResume?.();
    this.unsubscribePlatformResume = undefined;
    this.unsubscribeMotion?.();
    this.unsubscribeMotion = undefined;
    this.unsubscribeResponsive?.();
    this.unsubscribeResponsive = undefined;

    if (this.ownsMotionPreference) {
      this.motionPreference?.dispose();
    }
    this.motionPreference = undefined;

    if (typeof globalThis.window !== 'undefined') {
      globalThis.window.removeEventListener('blur', this.handleSuspend);
      globalThis.window.removeEventListener('focus', this.handleResume);
      globalThis.window.removeEventListener('keydown', this.handleKeyDown);
    }

    this.chapterArtwork?.stopAmbient();
    this.background = undefined;
    this.header = undefined;
    this.chapterBanner = undefined;
    this.chapterArtwork = undefined;
    this.chapterProgress = undefined;
    this.levelGrid = undefined;
    this.chapterNav = undefined;
    this.controller?.dispose();
    this.controller = undefined;
    this.navigator?.cancelPendingTransition();
    this.navigator = undefined;

    this.previewDialog?.destroy();
    this.previewDialog = undefined;
    this.errorModal?.destroy();
    this.errorModal = undefined;
    this.toast?.destroy();
    this.toast = undefined;
  };
}
