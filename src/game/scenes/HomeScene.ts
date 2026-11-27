import Phaser from 'phaser';
import { HOME_CONFIG } from '../../config/HomeConfig';
import {
  Colors,
  createGameTheme,
  createTextStyle,
  hexToNumber,
  IconButton,
  Modal,
  MotionDurations,
  MotionEasings,
  OutlineButton,
  resolveMotionDuration,
  Typography,
  type GameTheme,
} from '../../design-system';
import type { GamePlatform, Unsubscribe } from '../../platform/contracts/GamePlatform';
import { MotionPreferenceService } from '../../services/MotionPreferenceService';
import type { GameReadinessService } from '../../services/platform/GameReadinessService';
import type { ResponsiveLayoutService } from '../../services/ResponsiveLayoutService';
import { SettingsService } from '../../services/SettingsService';
import type { TutorialPreferenceService } from '../../services/TutorialPreferenceService';
import type { SaveService } from '../../services/persistence/SaveService';
import type { SaveLifecycleStatus } from '../../services/persistence/SaveStatus';
import type { SceneAudioCoordinator } from '../audio/SceneAudioCoordinator';
import { GameBackground } from '../components/environment/GameBackground';
import { CampaignProgressCard } from '../components/home/CampaignProgressCard';
import { ContinueButton } from '../components/home/ContinueButton';
import { GameLogo } from '../components/home/GameLogo';
import { HomeHero } from '../components/home/HomeHero';
import { PracticeModeDialog } from '../components/home/PracticeModeDialog';
import { SaveStatusToastCoordinator } from '../components/persistence/SaveStatusToastCoordinator';
import { SettingsOverlay } from '../components/settings/SettingsOverlay';
import { HomeController } from '../home/HomeController';
import type { HomeOverlayMode, HomeViewState } from '../home/HomeViewState';
import { calculateHomeLayout } from '../layout/HomeLayout';
import { PhaserSceneNavigator } from '../navigation/SceneNavigator';
import type { ProgressionController } from '../progression/ProgressionController';
import { SCENE_KEYS } from './sceneKeys';

export interface HomeSceneOptions {
  /** Development-only initial dialog preview (ignored in production builds). */
  readonly devInitialDialog?: 'practice' | 'settings';
}

/**
 * Production Home Screen for Bottle Shuffle.
 * Presents the playful brand identity, expressive decorative bottle hero, dominant
 * single-tap Play/Continue CTA, Levels & Practice navigation, live CampaignProgressCard,
 * and working Settings access across landscape and portrait viewports.
 */
export class HomeScene extends Phaser.Scene {
  private readonly platform: GamePlatform;
  private readonly progressionController: ProgressionController;
  private readonly sharedMotionPreference?: MotionPreferenceService;
  private readonly sharedSettingsService?: SettingsService;
  private readonly tutorialPreference?: TutorialPreferenceService;
  private readonly audioCoordinator?: SceneAudioCoordinator;
  private readonly saveService?: SaveService;
  private readonly shownSaveWarnings?: Set<SaveLifecycleStatus>;
  private readonly responsiveService?: ResponsiveLayoutService;
  private readonly readinessService?: GameReadinessService;
  private readonly options: HomeSceneOptions;

  private motionPreference?: MotionPreferenceService;
  private ownsMotionPreference = false;
  private settingsService?: SettingsService;
  private ownsSettingsService = false;
  private theme: GameTheme = createGameTheme();

  private controller?: HomeController;
  private navigator?: PhaserSceneNavigator;

  private background?: GameBackground;
  private publisherText?: Phaser.GameObjects.Text;
  private settingsButton?: IconButton;
  private logo?: GameLogo;
  private taglineText?: Phaser.GameObjects.Text;
  private hero?: HomeHero;
  private continueButton?: ContinueButton;
  private levelsButton?: OutlineButton;
  private practiceButton?: OutlineButton;
  private progressCard?: CampaignProgressCard;

  private practiceDialog?: PracticeModeDialog;
  private settingsOverlay?: SettingsOverlay;
  private errorModal?: Modal;
  private saveToastCoordinator?: SaveStatusToastCoordinator;

  private activeOverlayMode: HomeOverlayMode = 'none';
  private entranceTweens: Phaser.Tweens.Tween[] = [];
  private lastKnownCompletedCount: number | null = null;
  private devInitialDialogConsumed = false;

  private unsubscribePlatformPause?: Unsubscribe;
  private unsubscribePlatformResume?: Unsubscribe;
  private unsubscribeMotion?: Unsubscribe;
  private unsubscribeResponsive?: Unsubscribe;

  public constructor(
    platform: GamePlatform,
    progressionController: ProgressionController,
    motionPreference?: MotionPreferenceService,
    options: HomeSceneOptions = {},
    tutorialPreference?: TutorialPreferenceService,
    settingsService?: SettingsService,
    audioCoordinator?: SceneAudioCoordinator,
    saveService?: SaveService,
    shownSaveWarnings?: Set<SaveLifecycleStatus>,
    responsiveService?: ResponsiveLayoutService,
    readinessService?: GameReadinessService,
  ) {
    super({ key: SCENE_KEYS.HOME });
    this.platform = platform;
    this.progressionController = progressionController;
    this.sharedMotionPreference = motionPreference;
    this.sharedSettingsService = settingsService;
    this.options = options;
    this.tutorialPreference = tutorialPreference;
    this.audioCoordinator = audioCoordinator;
    this.saveService = saveService;
    this.shownSaveWarnings = shownSaveWarnings;
    this.responsiveService = responsiveService;
    this.readinessService = readinessService;
  }

  public create(): void {
    this.activeOverlayMode = 'none';
    this.cameras.main.setBackgroundColor(hexToNumber(Colors.Surface.Background));
    this.cameras.main.resetFX();
    this.audioCoordinator?.enterScene(this, 'menu');

    if (this.sharedSettingsService !== undefined) {
      this.settingsService = this.sharedSettingsService;
      this.ownsSettingsService = false;
    } else {
      this.settingsService = new SettingsService();
      this.ownsSettingsService = true;
    }

    if (this.sharedMotionPreference !== undefined) {
      this.motionPreference = this.sharedMotionPreference;
      this.ownsMotionPreference = false;
    } else {
      this.motionPreference = new MotionPreferenceService(undefined, this.settingsService);
      this.ownsMotionPreference = true;
    }

    this.theme = createGameTheme({ reducedMotion: this.motionPreference.isReducedMotion() });
    this.navigator = new PhaserSceneNavigator(
      this,
      () => this.motionPreference?.isReducedMotion() ?? false,
      this.tutorialPreference,
    );

    this.controller = new HomeController({
      progressionController: this.progressionController,
      navigator: this.navigator,
      callbacks: {
        onViewStateChange: (state) => {
          this.renderViewState(state);
        },
      },
    });

    const initialState = this.controller.getViewState();

    this.background = new GameBackground(this, { depth: -10 });

    this.publisherText = this.add
      .text(
        0,
        0,
        HOME_CONFIG.publisherLabel,
        createTextStyle(Typography.LabelSmall, {
          color: Colors.Text.Disabled,
          scale: 0.86,
        }),
      )
      .setOrigin(0, 0.5);

    this.settingsButton = new IconButton(this, {
      icon: 'settings',
      variant: 'surface',
      theme: this.theme,
      onClick: () => {
        this.audioCoordinator?.playUiClick();
        this.controller?.openSettings();
      },
    });

    this.logo = new GameLogo(this, { theme: this.theme });

    this.taglineText = this.add
      .text(
        0,
        0,
        HOME_CONFIG.tagline,
        createTextStyle(Typography.BodyMedium, {
          color: Colors.Text.Secondary,
          align: 'center',
        }),
      )
      .setOrigin(0.5);

    this.hero = new HomeHero(this, { theme: this.theme });

    this.continueButton = new ContinueButton(this, {
      label: initialState.primaryActionLabel,
      supportingText: initialState.primarySupportingText,
      enabled: initialState.canNavigate,
      theme: this.theme,
      onClick: () => {
        this.audioCoordinator?.playUiClick();
        this.controller?.handlePrimaryAction();
      },
    });

    this.levelsButton = new OutlineButton(this, {
      label: HOME_CONFIG.copy.levelsLabel,
      icon: 'grid',
      theme: this.theme,
      onClick: () => {
        this.audioCoordinator?.playUiClick();
        this.controller?.openLevels();
      },
    });

    this.practiceButton = new OutlineButton(this, {
      label: HOME_CONFIG.copy.practiceLabel,
      icon: 'moves',
      theme: this.theme,
      onClick: () => {
        this.audioCoordinator?.playUiClick();
        this.controller?.openPractice();
      },
    });

    this.progressCard = new CampaignProgressCard(this, {
      theme: this.theme,
      onSelect: () => {
        this.audioCoordinator?.playUiClick();
        this.controller?.openLevels();
      },
    });

    this.practiceDialog = new PracticeModeDialog(this, {
      theme: this.theme,
      onPlayPractice: (difficulty) => {
        this.audioCoordinator?.playUiClick();
        this.controller?.launchPracticePuzzle(difficulty);
      },
      onClose: () => {
        this.audioCoordinator?.playUiBack();
        this.controller?.closeOverlay();
      },
    });

    this.settingsOverlay = new SettingsOverlay(this, {
      settingsService: this.settingsService,
      motionPreference: this.motionPreference,
      origin: 'home',
      vibrationSupported: this.platform.isVibrationSupported?.() ?? false,
      showHowToPlay: true,
      theme: this.theme,
      onHowToPlay: () => {
        this.controller?.launchTutorialReplay();
      },
      onClose: () => {
        this.controller?.closeOverlay();
      },
      onUiClick: () => {
        this.audioCoordinator?.playUiClick();
      },
      onUiBack: () => {
        this.audioCoordinator?.playUiBack();
      },
    });

    this.applyResponsiveLayout(this.scale.width, this.scale.height);

    // Animate progress bar smoothly when returning home with newly completed levels
    const shouldAnimateProgress =
      this.lastKnownCompletedCount !== null &&
      initialState.completedLevelCount > this.lastKnownCompletedCount;

    if (shouldAnimateProgress && this.lastKnownCompletedCount !== null) {
      this.progressCard.applyViewState(
        {
          ...initialState,
          completedLevelCount: this.lastKnownCompletedCount,
        },
        false,
      );
      this.progressCard.applyViewState(initialState, true);
    } else {
      this.progressCard.applyViewState(initialState, false);
    }
    this.lastKnownCompletedCount = initialState.completedLevelCount;

    this.renderViewState(initialState);
    if (this.saveService !== undefined) {
      this.saveToastCoordinator = new SaveStatusToastCoordinator(
        this,
        this.saveService,
        this.theme,
        this.shownSaveWarnings,
      );
    }
    this.playEntranceAnimation();
    this.hero.startAmbient();
    this.bindLifecycle();

    if (
      import.meta.env.DEV &&
      !this.devInitialDialogConsumed &&
      this.options.devInitialDialog !== undefined
    ) {
      this.devInitialDialogConsumed = true;
      if (this.options.devInitialDialog === 'practice') {
        this.controller.openPractice();
      } else {
        this.controller.openSettings();
      }
    }

    if (this.readinessService !== undefined) {
      this.readinessService.markInteractiveSceneReady();
    } else {
      this.platform.notifyGameReady();
    }
  }

  private renderViewState(state: HomeViewState): void {
    this.continueButton?.setActionText(state.primaryActionLabel, state.primarySupportingText);
    this.continueButton?.setEnabled(state.canNavigate);
    this.continueButton?.setFocused(state.focusedControl === 'primary');

    this.levelsButton?.setEnabled(state.canNavigate);
    this.levelsButton?.setFocused(state.focusedControl === 'levels');

    this.practiceButton?.setEnabled(state.canNavigate);
    this.practiceButton?.setFocused(state.focusedControl === 'practice');

    this.settingsButton?.setEnabled(state.canNavigate);
    this.settingsButton?.setFocused(state.focusedControl === 'settings');

    const progressChanged =
      this.lastKnownCompletedCount !== null &&
      state.completedLevelCount !== this.lastKnownCompletedCount;
    if (progressChanged) {
      this.progressCard?.applyViewState(state, true);
      this.lastKnownCompletedCount = state.completedLevelCount;
    }

    this.syncOverlays(state);
  }

  private syncOverlays(state: HomeViewState): void {
    if (state.overlayMode === this.activeOverlayMode) {
      return;
    }

    const previous = this.activeOverlayMode;
    this.activeOverlayMode = state.overlayMode;

    if (previous === 'practice' && this.practiceDialog?.isOpen()) {
      this.practiceDialog.close();
    }
    if (previous === 'settings' && this.settingsOverlay?.isOpen()) {
      this.settingsOverlay.close();
    }
    if (previous === 'error' && this.errorModal?.isOpen()) {
      this.errorModal.close(false);
    }

    if (state.overlayMode === 'practice') {
      this.practiceDialog?.open();
    } else if (state.overlayMode === 'settings') {
      this.settingsOverlay?.open(!this.theme.reducedMotion);
    } else if (state.overlayMode === 'error') {
      this.openErrorModal(state.errorMessage ?? 'Something went wrong. Please try again.');
    }
  }

  private openErrorModal(message: string): void {
    this.errorModal?.destroy();
    this.errorModal = new Modal(this, {
      title: HOME_CONFIG.copy.errorTitle,
      message,
      dismissible: true,
      theme: this.theme,
      primaryAction: {
        label: HOME_CONFIG.copy.cancelLabel,
        closeOnClick: false,
        onClick: () => {
          this.audioCoordinator?.playUiBack();
          this.controller?.closeOverlay();
        },
      },
      onDismiss: () => {
        this.audioCoordinator?.playUiBack();
        this.controller?.closeOverlay();
      },
    });
    this.errorModal.resize(this.scale.width, this.scale.height);
    this.errorModal.open();
  }

  private applyResponsiveLayout(width: number, height: number): void {
    const safeW = Math.max(1, width);
    const safeH = Math.max(1, height);
    const safeArea = this.responsiveService?.getViewport().safeArea;

    this.background?.resize(safeW, safeH);

    const layout = calculateHomeLayout({
      width: safeW,
      height: safeH,
      ...(safeArea !== undefined ? { safeArea } : {}),
    });

    this.publisherText?.setPosition(layout.publisher.x, layout.publisher.y);
    this.publisherText?.setVisible(layout.publisher.visible);

    this.settingsButton?.setPosition(layout.settings.x, layout.settings.y);

    this.logo?.setPosition(layout.logo.x, layout.logo.y);
    this.logo?.setTargetScale(layout.logo.scale);

    this.taglineText?.setPosition(layout.tagline.x, layout.tagline.y);
    this.taglineText?.setVisible(layout.tagline.visible);
    this.taglineText?.setWordWrapWidth(layout.tagline.maxWidth, true);

    this.hero?.applyBounds(layout.hero);

    this.continueButton?.setButtonSize(layout.primaryButton.width, layout.primaryButton.height);
    this.continueButton?.setPosition(layout.primaryButton.x, layout.primaryButton.y);

    this.levelsButton?.setButtonSize(layout.levelsButton.width, layout.levelsButton.height);
    this.levelsButton?.setPosition(layout.levelsButton.x, layout.levelsButton.y);

    this.practiceButton?.setButtonSize(layout.practiceButton.width, layout.practiceButton.height);
    this.practiceButton?.setPosition(layout.practiceButton.x, layout.practiceButton.y);

    this.progressCard?.setCardSize(layout.progressCard.width, layout.progressCard.height);
    this.progressCard?.setPosition(layout.progressCard.x, layout.progressCard.y);

    this.practiceDialog?.resize(safeW, safeH);
    this.settingsOverlay?.resize(safeW, safeH, safeArea);
    this.errorModal?.resize(safeW, safeH, safeArea);
    this.saveToastCoordinator?.resize(safeW, safeH);
  }

  /**
   * Restrained, non-blocking entrance animation. Controls stay immediately interactive
   * even while decorative elements fade gently into view; skipped cleanly in reduced motion.
   */
  private playEntranceAnimation(): void {
    this.stopEntranceTweens();
    this.logo?.playEntrance();

    const duration = resolveMotionDuration(MotionDurations.Normal, this.theme.reducedMotion);
    if (duration === 0) {
      return;
    }

    const targets: (Phaser.GameObjects.Container | Phaser.GameObjects.Text | undefined)[] = [
      this.taglineText,
      this.hero,
      this.continueButton,
      this.levelsButton,
      this.practiceButton,
      this.progressCard,
    ];

    targets.forEach((target, idx) => {
      if (target === undefined) {
        return;
      }
      target.setAlpha(0);
      const tween = this.tweens.add({
        targets: target,
        alpha: 1,
        duration,
        delay: Math.min(220, idx * HOME_CONFIG.motion.staggerDelayMs),
        ease: MotionEasings.EaseOut,
      });
      this.entranceTweens.push(tween);
    });
  }

  private stopEntranceTweens(): void {
    for (const tween of this.entranceTweens) {
      tween.stop();
    }
    this.entranceTweens = [];

    this.taglineText?.setAlpha(1);
    this.hero?.setAlpha(1);
    this.continueButton?.setAlpha(1);
    this.levelsButton?.setAlpha(1);
    this.practiceButton?.setAlpha(1);
    this.progressCard?.setAlpha(1);
  }

  private applyMotionPreference(reducedMotion: boolean): void {
    this.stopEntranceTweens();
    this.theme = createGameTheme({ reducedMotion });

    this.logo?.setTheme(this.theme);
    this.hero?.setTheme(this.theme);
    this.continueButton?.setTheme(this.theme);
    this.levelsButton?.setTheme(this.theme);
    this.practiceButton?.setTheme(this.theme);
    this.settingsButton?.setTheme(this.theme);
    this.progressCard?.setTheme(this.theme);
    this.practiceDialog?.setTheme(this.theme);
    this.settingsOverlay?.setTheme(this.theme);
    this.errorModal?.setTheme(this.theme);
    this.saveToastCoordinator?.setTheme(this.theme);
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
    this.hero?.setSuspended(true);
    this.controller?.setSuspended(true);
  };

  private readonly handleResume = (): void => {
    this.hero?.setSuspended(false);
    this.controller?.setSuspended(false);
  };

  private readonly handleMotionChange = (reducedMotion: boolean): void => {
    this.applyMotionPreference(reducedMotion);
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        this.controller?.moveFocus(1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        this.controller?.moveFocus(-1);
        break;
      case 'Enter':
      case ' ':
        this.controller?.activateFocusedControl();
        break;
      case 'Escape':
        if (this.settingsOverlay?.isOpen() && this.settingsOverlay.hasOpenSubOverlay()) {
          this.settingsOverlay.handleEscapeKey();
        } else {
          this.controller?.handleEscapeKey();
        }
        break;
      default:
        break;
    }
  };

  private readonly handleShutdown = (): void => {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize);
    this.stopEntranceTweens();

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
    if (this.ownsSettingsService) {
      this.settingsService?.dispose();
    }
    this.settingsService = undefined;

    if (typeof globalThis.window !== 'undefined') {
      globalThis.window.removeEventListener('blur', this.handleSuspend);
      globalThis.window.removeEventListener('focus', this.handleResume);
      globalThis.window.removeEventListener('keydown', this.handleKeyDown);
    }

    this.hero?.stopAmbient();
    this.background = undefined;
    this.publisherText = undefined;
    this.settingsButton = undefined;
    this.logo = undefined;
    this.taglineText = undefined;
    this.hero = undefined;
    this.continueButton = undefined;
    this.levelsButton = undefined;
    this.practiceButton = undefined;
    this.progressCard = undefined;

    this.controller?.dispose();
    this.controller = undefined;
    this.navigator?.cancelPendingTransition();
    this.navigator = undefined;

    this.practiceDialog?.destroy();
    this.practiceDialog = undefined;
    this.settingsOverlay?.destroy();
    this.settingsOverlay = undefined;
    this.errorModal?.destroy();
    this.errorModal = undefined;
    this.saveToastCoordinator?.dispose();
    this.saveToastCoordinator = undefined;
  };
}
