import Phaser from 'phaser';
import { hasMoveLimit, hasTimeLimit } from '../../core';
import { createGameTheme, Dimens, Modal, type GameTheme } from '../../design-system';
import { GAMEPLAY_CONFIG, GAMEPLAY_COPY } from '../../config/GameplayConfig';
import { SETTINGS_CONFIG } from '../../config/SettingsConfig';
import { TUTORIAL_CONFIG } from '../../config/TutorialConfig';
import type { GamePlatform, Unsubscribe } from '../../platform/contracts/GamePlatform';
import type { ChallengeIntroService } from '../../services/ChallengeIntroService';
import { MotionPreferenceService } from '../../services/MotionPreferenceService';
import type { AdService } from '../../services/advertising/AdService';
import type { GameReadinessService } from '../../services/platform/GameReadinessService';
import type { ResponsiveLayoutService } from '../../services/ResponsiveLayoutService';
import { SettingsService } from '../../services/SettingsService';
import type { TutorialPreferenceService } from '../../services/TutorialPreferenceService';
import type { HapticService } from '../../services/haptics/HapticService';
import type { SaveService } from '../../services/persistence/SaveService';
import type { SaveLifecycleStatus } from '../../services/persistence/SaveStatus';
import { playVictoryCelebration } from '../animations/celebration/VictoryCelebration';
import { AnimationCoordinator } from '../animations/core/AnimationCoordinator';
import { resolveAnimationPolicy, type AnimationPolicy } from '../animations/core/AnimationPolicy';
import type { SafeTrajectoryBounds } from '../animations/utils/AnimationCurves';
import { GameplayAudioController } from '../audio/GameplayAudioController';
import type { SceneAudioCoordinator } from '../audio/SceneAudioCoordinator';
import { GameBackground } from '../components/environment/GameBackground';
import { FailureOverlay } from '../components/failure/FailureOverlay';
import { ChallengeIntroOverlay } from '../components/gameplay/ChallengeIntroOverlay';
import { GameplayBoard } from '../components/gameplay/GameplayBoard';
import { GameplayHeader } from '../components/gameplay/GameplayHeader';
import { GameplayHUD } from '../components/gameplay/GameplayHUD';
import { GameplayInstructions } from '../components/gameplay/GameplayInstructions';
import { ExitConfirmation } from '../components/pause/ExitConfirmation';
import { PauseOverlay } from '../components/pause/PauseOverlay';
import { RestartConfirmation } from '../components/pause/RestartConfirmation';
import { SaveStatusToastCoordinator } from '../components/persistence/SaveStatusToastCoordinator';
import { SettingsOverlay } from '../components/settings/SettingsOverlay';
import { TutorialCompletionOverlay } from '../components/tutorial/TutorialCompletionOverlay';
import { TutorialHeader } from '../components/tutorial/TutorialHeader';
import { TutorialInstructionPanel } from '../components/tutorial/TutorialInstructionPanel';
import { TutorialPointer } from '../components/tutorial/TutorialPointer';
import { TutorialSpotlight, type SpotlightRect } from '../components/tutorial/TutorialSpotlight';
import { VictoryOverlay } from '../components/victory/VictoryOverlay';
import { GameplayController } from '../gameplay/GameplayController';
import type { GameplaySceneData } from '../gameplay/GameplaySceneData';
import type {
  GameplayOverlayMode,
  GameplayViewState,
  PendingSwapTransition,
} from '../gameplay/GameplayViewState';
import { calculateGameplayLayout, type GameplayLayout } from '../layout/GameplayLayout';
import { calculateTutorialLayout } from '../layout/TutorialLayout';
import { LevelTransitionCoordinator } from '../navigation/LevelTransitionCoordinator';
import type { ProgressionController } from '../progression/ProgressionController';
import { TutorialController, type TutorialExitReason } from '../tutorial/TutorialController';
import type { TutorialViewState } from '../tutorial/TutorialViewState';
import type { VictoryViewState } from '../victory/VictoryViewState';
import { SCENE_KEYS } from './sceneKeys';

export class GameScene extends Phaser.Scene {
  private readonly platform: GamePlatform;
  private readonly progressionController?: ProgressionController;
  private readonly sharedMotionPreference?: MotionPreferenceService;
  private readonly sharedSettingsService?: SettingsService;
  private readonly tutorialPreference?: TutorialPreferenceService;
  private readonly audioCoordinator?: SceneAudioCoordinator;
  private readonly hapticService?: HapticService;
  private readonly saveService?: SaveService;
  private readonly shownSaveWarnings?: Set<SaveLifecycleStatus>;
  private readonly responsiveService?: ResponsiveLayoutService;
  private readonly readinessService?: GameReadinessService;
  private readonly adService?: AdService;
  private readonly challengeIntroService?: ChallengeIntroService;
  private theme: GameTheme = createGameTheme();
  private policy: AnimationPolicy = resolveAnimationPolicy(false);
  private launchData?: GameplaySceneData;

  private settingsService?: SettingsService;
  private ownsSettingsService = false;
  private motionPreference?: MotionPreferenceService;
  private ownsMotionPreference = false;
  private unsubscribeMotionPreference?: Unsubscribe;
  private coordinator?: AnimationCoordinator;
  private gameplayAudio?: GameplayAudioController;
  private levelTransitionCoordinator?: LevelTransitionCoordinator;

  private controller?: GameplayController;
  private tutorialController?: TutorialController;
  private isTutorialMode = false;

  private background?: GameBackground;
  private outsideTapZone?: Phaser.GameObjects.Zone;
  private header?: GameplayHeader;
  private tutorialHeader?: TutorialHeader;
  private hud?: GameplayHUD;
  private board?: GameplayBoard;
  private instructions?: GameplayInstructions;
  private tutorialSpotlight?: TutorialSpotlight;
  private tutorialPointer?: TutorialPointer;
  private tutorialPanel?: TutorialInstructionPanel;
  private tutorialCompletionOverlay?: TutorialCompletionOverlay;

  private pauseOverlay?: PauseOverlay;
  private settingsOverlay?: SettingsOverlay;
  private restartConfirmation?: RestartConfirmation;
  private exitConfirmation?: ExitConfirmation;
  private tutorialConfirmation?: ExitConfirmation;
  private victoryOverlay?: VictoryOverlay;
  private failureOverlay?: FailureOverlay;
  private challengeIntroOverlay?: ChallengeIntroOverlay;
  private errorModal?: Modal;
  private saveToastCoordinator?: SaveStatusToastCoordinator;

  private timerEvent?: Phaser.Time.TimerEvent;
  private inactivityTimer?: Phaser.Time.TimerEvent;
  private unsubscribePlatformPause?: Unsubscribe;
  private unsubscribePlatformResume?: Unsubscribe;
  private unsubscribeResponsive?: Unsubscribe;
  private activeOverlayMode: GameplayOverlayMode = 'none';
  private lastAttemptId = 1;
  private lastTutorialPuzzleId: string | null = null;
  private lastTutorialLayoutKey = '';

  public constructor(
    platform: GamePlatform,
    progressionController?: ProgressionController,
    defaultLaunchData?: GameplaySceneData,
    motionPreference?: MotionPreferenceService,
    tutorialPreference?: TutorialPreferenceService,
    settingsService?: SettingsService,
    audioCoordinator?: SceneAudioCoordinator,
    hapticService?: HapticService,
    saveService?: SaveService,
    shownSaveWarnings?: Set<SaveLifecycleStatus>,
    responsiveService?: ResponsiveLayoutService,
    readinessService?: GameReadinessService,
    adService?: AdService,
    challengeIntroService?: ChallengeIntroService,
  ) {
    super({ key: SCENE_KEYS.GAME });
    this.platform = platform;
    this.progressionController = progressionController;
    this.launchData = defaultLaunchData;
    this.sharedMotionPreference = motionPreference;
    this.tutorialPreference = tutorialPreference;
    this.sharedSettingsService = settingsService;
    this.audioCoordinator = audioCoordinator;
    this.hapticService = hapticService;
    this.saveService = saveService;
    this.shownSaveWarnings = shownSaveWarnings;
    this.responsiveService = responsiveService;
    this.readinessService = readinessService;
    this.adService = adService;
    this.challengeIntroService = challengeIntroService;
  }

  public init(data?: GameplaySceneData): void {
    if (data !== undefined && Object.keys(data).length > 0) {
      this.launchData = data;
    }
  }

  public create(): void {
    this.activeOverlayMode = 'none';
    this.lastTutorialPuzzleId = null;
    this.lastTutorialLayoutKey = '';
    this.isTutorialMode = this.launchData?.mode === 'tutorial';
    this.cameras.main.resetFX();

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
    const initialReducedMotion = this.motionPreference.isReducedMotion();
    this.theme = createGameTheme({ reducedMotion: initialReducedMotion });
    this.policy = resolveAnimationPolicy(initialReducedMotion);
    this.coordinator = new AnimationCoordinator();
    this.audioCoordinator?.enterScene(this, 'gameplay');
    this.gameplayAudio =
      this.audioCoordinator !== undefined
        ? new GameplayAudioController({
            audioService: this.audioCoordinator.getAudioService(),
            ...(this.hapticService !== undefined ? { hapticService: this.hapticService } : {}),
          })
        : undefined;

    this.background = new GameBackground(this, { depth: -10 });

    this.outsideTapZone = this.add
      .zone(0, 0, this.scale.width, this.scale.height)
      .setOrigin(0)
      .setDepth(-5)
      .setInteractive();
    this.outsideTapZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, this.handleOutsideTap);

    if (this.saveService !== undefined) {
      this.saveToastCoordinator = new SaveStatusToastCoordinator(
        this,
        this.saveService,
        this.theme,
        this.shownSaveWarnings,
      );
    }

    if (this.isTutorialMode) {
      this.createTutorialMode();
      return;
    }

    this.createStandardGameplayMode();
  }

  private createStandardGameplayMode(): void {
    this.controller = new GameplayController({
      ...(this.launchData !== undefined ? { sceneData: this.launchData } : {}),
      ...(this.progressionController !== undefined
        ? { progressionController: this.progressionController }
        : {}),
      ...(this.challengeIntroService !== undefined
        ? { challengeIntroService: this.challengeIntroService }
        : {}),
      callbacks: {
        onViewStateChange: (viewState) => {
          this.renderViewState(viewState);
        },
        onSwapStarted: (transition) => {
          this.handleSwapStarted(transition);
        },
        onSwapCompleted: (transition) => {
          this.gameplayAudio?.handleSwapReconciled(transition);
        },
        onPlayerGameEvents: (events) => {
          this.gameplayAudio?.handlePlayerGameEvents(events);
        },
        onProgressionEvents: (events) => {
          this.gameplayAudio?.handleProgressionEvents(events, this.lastAttemptId);
        },
        onExitConfirmed: () => {
          this.returnToHome();
        },
        onTutorialConfirmed: () => {
          this.launchTutorialReplayFromGameplay();
        },
      },
    });

    const initialView = this.controller.getViewState();
    this.lastAttemptId = initialView.attemptId;

    if (initialView.overlayMode === 'error') {
      this.showErrorRecoveryModal(
        initialView.errorMessage ?? GAMEPLAY_COPY.errorRecovery.fallbackMessage,
      );
      this.bindSceneLifecycle();
      if (this.readinessService !== undefined) {
        this.readinessService.markInteractiveSceneReady();
      } else {
        this.platform.notifyGameReady();
      }
      return;
    }

    const layout = calculateGameplayLayout({
      width: this.scale.width,
      height: this.scale.height,
      bottleCount: initialView.totalBottleCount,
      showCountdownBar: hasTimeLimit(initialView.challengeMode),
    });

    this.header = new GameplayHeader(this, {
      title: initialView.headerTitle,
      subtitle: initialView.headerSubtitle,
      onPause: () => {
        this.audioCoordinator?.playUiClick();
        this.interruptActiveSwapAndReconcile();
        this.controller?.requestPause();
      },
      onRestart: () => {
        this.audioCoordinator?.playUiClick();
        this.interruptActiveSwapAndReconcile();
        this.controller?.requestRestartConfirmation();
      },
      theme: this.theme,
    });

    this.hud = new GameplayHUD(this, {
      initialMatches: initialView.displayedMatchCount,
      totalBottles: initialView.totalBottleCount,
      initialMoves: initialView.displayedMoveCount,
      initialRemainingMoves: initialView.displayedRemainingMoves,
      initialTime: initialView.formattedTime,
      challengeMode: initialView.challengeMode,
      initialCountdownRatio: initialView.countdownRatio,
      theme: this.theme,
      policy: this.policy,
    });

    this.board = new GameplayBoard(this, {
      initialSequence: initialView.currentSequence,
      layout: layout.board,
      safeBounds: this.computeSafeSwapBounds(layout),
      onSlotTap: (slotIndex) => {
        this.controller?.handleBottleTap(slotIndex);
      },
      theme: this.theme,
      policy: this.policy,
    });

    this.instructions = new GameplayInstructions(this, initialView.instructionText);

    this.levelTransitionCoordinator?.dispose();
    this.levelTransitionCoordinator = new LevelTransitionCoordinator({
      platform: this.platform,
      ...(this.adService !== undefined ? { adService: this.adService } : {}),
      ...(this.progressionController !== undefined
        ? { progressionController: this.progressionController }
        : {}),
      ...(this.saveService !== undefined ? { saveService: this.saveService } : {}),
      onTransitionPendingChange: (pending, statusLabel) => {
        this.victoryOverlay?.setTransitionPending(pending, statusLabel);
      },
      onLaunchCampaignLevel: (levelId) => {
        this.launchCampaignLevel(levelId);
      },
    });

    this.buildOverlays();
    this.applyResponsiveLayout(this.scale.width, this.scale.height);
    this.bindSceneLifecycle();

    this.timerEvent = this.time.addEvent({
      delay: GAMEPLAY_CONFIG.timerPollIntervalMs,
      loop: true,
      callback: this.handleTimerTick,
    });

    this.controller.start();

    if (import.meta.env.DEV && this.launchData?.devVictoryViewState !== undefined) {
      this.victoryOverlay?.open(this.launchData.devVictoryViewState, !this.theme.reducedMotion);
    } else if (import.meta.env.DEV && this.launchData?.devOverlayPreview !== undefined) {
      this.applyDevOverlayPreview(this.launchData.devOverlayPreview);
    }

    if (this.readinessService !== undefined) {
      this.readinessService.markInteractiveSceneReady();
    } else {
      this.platform.notifyGameReady();
    }
  }

  private createTutorialMode(): void {
    const nextLevelId = this.launchData?.nextCampaignLevelId ?? null;
    const nextLevelDef =
      nextLevelId !== null
        ? this.progressionController?.getCatalog().getLevelById(nextLevelId)
        : undefined;

    this.tutorialController = new TutorialController({
      origin: this.launchData?.tutorialOrigin ?? 'first_time',
      returnTo: this.launchData?.returnTo ?? 'home',
      nextCampaignLevelId: nextLevelId,
      nextCampaignLevelNumber: nextLevelDef?.levelNumber ?? null,
      ...(this.tutorialPreference !== undefined
        ? { tutorialPreference: this.tutorialPreference }
        : {}),
      ...(import.meta.env.DEV && this.launchData?.devTutorialStage !== undefined
        ? { initialStage: this.launchData.devTutorialStage }
        : {}),
      callbacks: {
        onViewStateChange: (viewState) => {
          this.renderTutorialViewState(viewState);
        },
        onSwapStarted: (transition) => {
          this.handleTutorialSwapStarted(transition);
        },
        onSwapCompleted: (transition) => {
          this.gameplayAudio?.handleSwapReconciled(transition);
        },
        onPlayerGameEvents: (events) => {
          this.gameplayAudio?.handlePlayerGameEvents(events);
        },
        onExitRequested: (reason) => {
          this.handleTutorialExit(reason);
        },
      },
    });

    const initialView = this.tutorialController.getViewState();
    this.lastAttemptId = initialView.attemptId;
    this.lastTutorialPuzzleId = initialView.activePuzzleId;

    const tutLayout = calculateTutorialLayout({
      width: this.scale.width,
      height: this.scale.height,
      bottleCount: initialView.totalBottleCount,
      hasActions: initialView.primaryActionLabel !== null,
      showCounterExamples: initialView.showCounterExamples,
    });

    this.tutorialHeader = new TutorialHeader(this, {
      totalSteps: initialView.totalSteps,
      theme: this.theme,
      onPause: () => {
        this.audioCoordinator?.playUiClick();
        this.interruptActiveSwapAndReconcile();
        this.tutorialController?.requestPause();
      },
      onRestart: () => {
        this.audioCoordinator?.playUiClick();
        this.interruptActiveSwapAndReconcile();
        this.tutorialController?.requestRestartConfirmation();
      },
      onSkip: () => {
        this.audioCoordinator?.playUiBack();
        this.interruptActiveSwapAndReconcile();
        this.tutorialController?.skipTutorial();
      },
    });

    this.hud = new GameplayHUD(this, {
      initialMatches: initialView.displayedMatchCount,
      totalBottles: initialView.totalBottleCount,
      initialMoves: initialView.displayedMoveCount,
      initialTime: initialView.formattedTime,
      theme: this.theme,
      policy: this.policy,
    });

    this.board = new GameplayBoard(this, {
      initialSequence: initialView.currentSequence,
      layout: tutLayout.gameplay.board,
      safeBounds: this.computeSafeSwapBounds(tutLayout.gameplay),
      onSlotTap: (slotIndex) => {
        this.resetInactivityReminderTimer();
        this.tutorialController?.handleBottleTap(slotIndex);
      },
      theme: this.theme,
      policy: this.policy,
    });

    this.tutorialSpotlight = new TutorialSpotlight(this, this.theme);
    this.tutorialPointer = new TutorialPointer(this, this.theme);
    this.tutorialPanel = new TutorialInstructionPanel(this, {
      theme: this.theme,
      onPrimaryAction: () => {
        this.audioCoordinator?.playUiClick();
        this.tutorialController?.handlePrimaryAction();
      },
      onSecondaryAction: () => {
        this.audioCoordinator?.playUiClick();
        this.tutorialController?.handleSecondaryAction();
      },
    });
    this.tutorialCompletionOverlay = new TutorialCompletionOverlay(this, {
      theme: this.theme,
      onContinue: () => {
        this.audioCoordinator?.playUiClick();
        this.tutorialController?.continueAfterCompletion();
      },
    });

    this.buildTutorialOverlays();
    this.applyResponsiveLayout(this.scale.width, this.scale.height);
    this.bindSceneLifecycle();

    this.timerEvent = this.time.addEvent({
      delay: GAMEPLAY_CONFIG.timerPollIntervalMs,
      loop: true,
      callback: this.handleTimerTick,
    });

    this.tutorialController.start();
    if (this.readinessService !== undefined) {
      this.readinessService.markInteractiveSceneReady();
    } else {
      this.platform.notifyGameReady();
    }
  }

  private buildOverlays(): void {
    this.pauseOverlay = new PauseOverlay(this, {
      theme: this.theme,
      callbacks: {
        onResume: () => {
          this.audioCoordinator?.playUiClick();
          this.controller?.resumeFromPause();
        },
        onRestart: () => {
          this.audioCoordinator?.playUiClick();
          this.controller?.requestRestartConfirmation();
        },
        onSettings: () => {
          this.audioCoordinator?.playUiClick();
          this.controller?.openSettingsFromPause();
        },
        onExit: () => {
          this.audioCoordinator?.playUiBack();
          this.controller?.requestExitConfirmation();
        },
      },
    });

    if (this.settingsService !== undefined && this.motionPreference !== undefined) {
      this.settingsOverlay = new SettingsOverlay(this, {
        settingsService: this.settingsService,
        motionPreference: this.motionPreference,
        origin: 'pause',
        vibrationSupported: this.platform.isVibrationSupported?.() ?? false,
        showHowToPlay: true,
        theme: this.theme,
        onHowToPlay: () => {
          this.controller?.requestTutorialConfirmation();
        },
        onClose: () => {
          this.controller?.closeSettings();
        },
        onUiClick: () => {
          this.audioCoordinator?.playUiClick();
        },
        onUiBack: () => {
          this.audioCoordinator?.playUiBack();
        },
      });
    }

    this.restartConfirmation = new RestartConfirmation(this, {
      theme: this.theme,
      onConfirm: () => {
        this.audioCoordinator?.playUiClick();
        this.coordinator?.resetAttempt();
        this.hud?.clearFeedback();
        this.controller?.confirmRestart();
      },
      onCancel: () => {
        this.audioCoordinator?.playUiBack();
        this.controller?.cancelRestartConfirmation();
      },
    });

    this.exitConfirmation = new ExitConfirmation(this, {
      theme: this.theme,
      onConfirm: () => {
        this.audioCoordinator?.playUiBack();
        this.controller?.confirmExit();
      },
      onCancel: () => {
        this.audioCoordinator?.playUiBack();
        this.controller?.cancelExitConfirmation();
      },
    });

    this.tutorialConfirmation = new ExitConfirmation(this, {
      theme: this.theme,
      title: SETTINGS_CONFIG.tutorialConfirm.title,
      message: SETTINGS_CONFIG.tutorialConfirm.message,
      confirmLabel: SETTINGS_CONFIG.tutorialConfirm.confirmLabel,
      onConfirm: () => {
        this.audioCoordinator?.playUiClick();
        this.controller?.confirmTutorialReplay();
      },
      onCancel: () => {
        this.audioCoordinator?.playUiBack();
        this.controller?.cancelTutorialConfirmation();
      },
    });

    this.victoryOverlay = new VictoryOverlay(this, {
      theme: this.theme,
      callbacks: {
        onPrimaryAction: (victoryState) => {
          this.audioCoordinator?.playUiClick();
          this.gameplayAudio?.stopObsoleteAudio();
          this.handleVictoryPrimaryAction(victoryState);
        },
        onReplay: () => {
          this.audioCoordinator?.playUiClick();
          this.gameplayAudio?.stopObsoleteAudio();
          this.handleVictoryReplay();
        },
        onLevels: (victoryState) => {
          this.audioCoordinator?.playUiClick();
          this.gameplayAudio?.stopObsoleteAudio();
          this.returnToLevelSelection(victoryState.chapterIdForLevels ?? undefined);
        },
        onHome: () => {
          this.audioCoordinator?.playUiBack();
          this.gameplayAudio?.stopObsoleteAudio();
          this.returnToHome();
        },
        onStarRevealed: (starIndex) => {
          this.gameplayAudio?.handleStarRevealed(starIndex);
        },
        onReducedMotionStarsPresented: (earnedStars) => {
          this.gameplayAudio?.handleReducedMotionStarsPresented(earnedStars, this.lastAttemptId);
        },
      },
    });

    this.failureOverlay = new FailureOverlay(this, {
      theme: this.theme,
      onRetry: () => {
        this.audioCoordinator?.playUiClick();
        this.failureOverlay?.close();
        this.coordinator?.resetAttempt();
        this.hud?.clearFeedback();
        this.controller?.confirmRestart();
      },
      onLevels: () => {
        this.audioCoordinator?.playUiClick();
        const chapterId = this.failureOverlay?.getCurrentState()?.chapterIdForLevels ?? undefined;
        this.returnToLevelSelection(chapterId);
      },
      onHome: () => {
        this.audioCoordinator?.playUiBack();
        this.returnToHome();
      },
    });

    this.challengeIntroOverlay = new ChallengeIntroOverlay(this, {
      theme: this.theme,
      onStart: () => {
        this.audioCoordinator?.playUiClick();
        this.controller?.dismissChallengeIntro();
      },
    });
  }

  private buildTutorialOverlays(): void {
    const returnToLevels = this.launchData?.returnTo === 'level_selection';

    this.pauseOverlay = new PauseOverlay(this, {
      theme: this.theme,
      callbacks: {
        onResume: () => {
          this.audioCoordinator?.playUiClick();
          this.tutorialController?.resumeFromPause();
        },
        onRestart: () => {
          this.audioCoordinator?.playUiClick();
          this.tutorialController?.requestRestartConfirmation();
        },
        onSettings: () => {
          this.audioCoordinator?.playUiClick();
          this.tutorialController?.openSettingsFromPause();
        },
        onExit: () => {
          this.audioCoordinator?.playUiBack();
          this.tutorialController?.requestExitConfirmation();
        },
      },
    });

    if (this.settingsService !== undefined && this.motionPreference !== undefined) {
      this.settingsOverlay = new SettingsOverlay(this, {
        settingsService: this.settingsService,
        motionPreference: this.motionPreference,
        origin: 'tutorial',
        vibrationSupported: this.platform.isVibrationSupported?.() ?? false,
        showHowToPlay: false,
        theme: this.theme,
        onClose: () => {
          this.tutorialController?.closeSettings();
        },
        onUiClick: () => {
          this.audioCoordinator?.playUiClick();
        },
        onUiBack: () => {
          this.audioCoordinator?.playUiBack();
        },
      });
    }

    this.restartConfirmation = new RestartConfirmation(this, {
      theme: this.theme,
      message: 'Restart the current tutorial puzzle from the beginning?',
      onConfirm: () => {
        this.audioCoordinator?.playUiClick();
        this.coordinator?.resetAttempt();
        this.hud?.clearFeedback();
        this.tutorialController?.confirmRestart();
      },
      onCancel: () => {
        this.audioCoordinator?.playUiBack();
        this.tutorialController?.cancelRestartConfirmation();
      },
    });

    this.exitConfirmation = new ExitConfirmation(this, {
      theme: this.theme,
      title: 'Leave tutorial?',
      message: returnToLevels
        ? 'You can replay How to Play anytime from Settings.'
        : 'You can replay How to Play anytime from Settings on the Home screen.',
      confirmLabel: returnToLevels
        ? TUTORIAL_CONFIG.copy.exitToLevelsLabel
        : TUTORIAL_CONFIG.copy.exitToHomeLabel,
      onConfirm: () => {
        this.audioCoordinator?.playUiBack();
        this.tutorialController?.confirmExit();
      },
      onCancel: () => {
        this.audioCoordinator?.playUiBack();
        this.tutorialController?.cancelExitConfirmation();
      },
    });
  }

  private applyDevOverlayPreview(preset: 'pause' | 'settings' | 'restart' | 'exit'): void {
    this.controller?.requestPause();
    if (preset === 'settings') {
      this.controller?.openSettingsFromPause();
    } else if (preset === 'restart') {
      this.controller?.requestRestartConfirmation();
    } else if (preset === 'exit') {
      this.controller?.requestExitConfirmation();
    }
  }

  private handleVictoryPrimaryAction(victoryState: VictoryViewState): void {
    switch (victoryState.primaryActionKind) {
      case 'next_level':
        if (victoryState.nextLevelId !== null) {
          if (this.levelTransitionCoordinator !== undefined) {
            const sourceLevelId =
              this.launchData?.mode === 'campaign' ? (this.launchData.levelId ?? null) : null;
            void this.levelTransitionCoordinator
              .requestCampaignNextLevel({
                sourceLevelId,
                destinationLevelId: victoryState.nextLevelId,
                puzzleCompleted: true,
                completionCommitted: true,
                victoryPresented: this.victoryOverlay?.isOpen() === true,
                isChapterBoundary: victoryState.chapterCompletion !== null,
              })
              .then((result) => {
                if (result.status === 'invalid_destination') {
                  this.victoryOverlay?.setTransitionPending(false);
                  this.returnToLevelSelection(victoryState.chapterIdForLevels ?? undefined);
                }
              });
          } else {
            this.launchCampaignLevel(victoryState.nextLevelId);
          }
        } else {
          this.returnToLevelSelection(victoryState.chapterIdForLevels ?? undefined);
        }
        break;
      case 'new_puzzle':
        this.launchNewPracticePuzzle();
        break;
      case 'view_levels':
        this.returnToLevelSelection(victoryState.chapterIdForLevels ?? undefined);
        break;
      case 'replay':
        this.handleVictoryReplay();
        break;
    }
  }

  private handleVictoryReplay(): void {
    this.victoryOverlay?.close();
    this.coordinator?.resetAttempt();
    this.hud?.clearFeedback();
    this.controller?.confirmRestart();
  }

  private openVictoryOverlay(viewState: GameplayViewState): void {
    if (viewState.victory === null) {
      return;
    }
    this.victoryOverlay?.open(viewState.victory, !this.theme.reducedMotion);
  }

  private showErrorRecoveryModal(message: string): void {
    this.errorModal?.destroy();
    this.errorModal = new Modal(this, {
      title: GAMEPLAY_COPY.errorRecovery.title,
      message,
      dismissible: false,
      theme: this.theme,
      primaryAction: {
        label: GAMEPLAY_COPY.errorRecovery.homeLabel,
        closeOnClick: false,
        onClick: () => {
          this.returnToHome();
        },
      },
    });
    this.errorModal.open(false);
  }

  private renderViewState(viewState: GameplayViewState): void {
    if (viewState.attemptId !== this.lastAttemptId) {
      this.lastAttemptId = viewState.attemptId;
      this.coordinator?.resetAttempt();
      this.gameplayAudio?.resetForAttempt(viewState.attemptId);
      this.hud?.clearFeedback();
    }

    this.header?.setControlsEnabled(
      viewState.status === 'playing' && viewState.overlayMode === 'none',
      viewState.overlayMode !== 'error',
    );

    this.hud?.setMatches(viewState.displayedMatchCount, viewState.totalBottleCount, true);
    if (hasMoveLimit(viewState.challengeMode)) {
      this.hud?.setRemainingMoves(viewState.displayedRemainingMoves, true);
    } else {
      this.hud?.setMoveCount(viewState.displayedMoveCount, true);
    }
    if (hasTimeLimit(viewState.challengeMode)) {
      this.hud?.setCountdownState(
        viewState.formattedTime,
        viewState.countdownRatio,
        viewState.countdownUrgency,
      );
    } else {
      this.hud?.setElapsedTime(viewState.formattedTime);
    }
    this.hud?.showMatchFeedback(viewState.matchFeedback);

    this.instructions?.setMessage(
      viewState.instructionText,
      viewState.status === 'completed' && !viewState.isSwapping,
    );

    const shouldReconcileBoard = !viewState.isSwapping;
    this.board?.syncState(
      viewState.currentSequence,
      viewState.selectedSlotIndex,
      viewState.focusedSlotIndex,
      viewState.inputEnabled,
      shouldReconcileBoard,
    );

    this.syncOverlays(viewState);
  }

  private renderTutorialViewState(viewState: TutorialViewState): void {
    if (viewState.attemptId !== this.lastAttemptId) {
      this.lastAttemptId = viewState.attemptId;
      this.coordinator?.resetAttempt();
      this.gameplayAudio?.resetForAttempt(viewState.attemptId);
      this.hud?.clearFeedback();
    }

    const layoutKey = `${String(viewState.totalBottleCount)}|${String(viewState.primaryActionLabel !== null)}|${String(viewState.showCounterExamples)}`;
    const puzzleChanged = viewState.activePuzzleId !== this.lastTutorialPuzzleId;
    if (puzzleChanged || layoutKey !== this.lastTutorialLayoutKey) {
      this.lastTutorialLayoutKey = layoutKey;
      const tutLayout = calculateTutorialLayout({
        width: this.scale.width,
        height: this.scale.height,
        bottleCount: viewState.totalBottleCount,
        hasActions: viewState.primaryActionLabel !== null,
        showCounterExamples: viewState.showCounterExamples,
      });

      this.tutorialHeader?.applyLayout(tutLayout.gameplay.header);
      this.hud?.applyLayout(tutLayout.gameplay.hud);
      this.tutorialPanel?.applyBounds(tutLayout.instructionPanel);

      if (puzzleChanged) {
        this.lastTutorialPuzzleId = viewState.activePuzzleId;
        this.coordinator?.resetAttempt();
        this.hud?.clearFeedback();
        this.board?.loadSequence(
          viewState.currentSequence,
          tutLayout.gameplay.board,
          this.computeSafeSwapBounds(tutLayout.gameplay),
        );
      } else {
        this.board?.applyLayout(
          tutLayout.gameplay.board,
          this.computeSafeSwapBounds(tutLayout.gameplay),
        );
      }
    }

    this.tutorialHeader?.setStep(viewState.stepNumber, viewState.totalSteps, true);
    this.tutorialHeader?.setControlsState({
      pauseEnabled: viewState.overlayMode === 'none' && viewState.stage !== 'completed',
      restartVisible: viewState.canRestart,
      restartEnabled: viewState.canRestart && viewState.overlayMode === 'none',
      skipEnabled: viewState.canSkip,
    });

    this.hud?.setMatches(viewState.displayedMatchCount, viewState.totalBottleCount, !puzzleChanged);
    this.hud?.setMoveCount(viewState.displayedMoveCount, !puzzleChanged);
    this.hud?.setElapsedTime(viewState.formattedTime);
    if (!puzzleChanged) {
      this.hud?.showMatchFeedback(viewState.matchFeedback);
    }

    const shouldReconcileBoard = !viewState.isSwapping;
    this.board?.syncState(
      viewState.currentSequence,
      viewState.selectedSlotIndex,
      viewState.focusedSlotIndex,
      viewState.inputEnabled,
      shouldReconcileBoard,
    );

    this.tutorialPanel?.updateFromState(viewState);
    this.syncTutorialGuidanceVisuals(viewState);
    this.syncTutorialOverlays(viewState);
    this.syncInactivityReminder(viewState);
  }

  private syncTutorialGuidanceVisuals(viewState: TutorialViewState): void {
    this.tutorialSpotlight?.setViewportSize(this.scale.width, this.scale.height);

    let spotlightRect: SpotlightRect | null = null;
    if (viewState.highlight.kind === 'hidden_rack' && this.board !== undefined) {
      spotlightRect = this.board.getHiddenRackScreenBounds();
    } else if (viewState.highlight.kind === 'match_counter' && this.hud !== undefined) {
      spotlightRect = this.hud.getMatchCounterBounds();
    } else if (
      viewState.highlight.kind === 'bottle_slot' &&
      viewState.highlight.slotIndex !== undefined &&
      this.board !== undefined
    ) {
      spotlightRect = this.board.getSlotScreenBounds(viewState.highlight.slotIndex);
    }

    this.tutorialSpotlight?.focusRect(spotlightRect);

    if (viewState.showPointer && viewState.pointerSlotIndex !== null && this.board !== undefined) {
      const slotBounds = this.board.getSlotScreenBounds(viewState.pointerSlotIndex);
      if (slotBounds !== null) {
        this.tutorialPointer?.pointAt(slotBounds.x + slotBounds.width / 2, slotBounds.y);
      } else {
        this.tutorialPointer?.hide();
      }
    } else {
      this.tutorialPointer?.hide();
    }
  }

  private syncOverlays(viewState: GameplayViewState): void {
    const next = viewState.overlayMode;
    if (next === this.activeOverlayMode) {
      return;
    }

    const previous = this.activeOverlayMode;
    this.activeOverlayMode = next;

    const isPauseRelatedOverlay =
      next === 'pause' ||
      next === 'settings' ||
      next === 'restart_confirm' ||
      next === 'exit_confirm' ||
      next === 'tutorial_confirm';
    this.gameplayAudio?.setManualPaused(isPauseRelatedOverlay);

    const pauseShouldStayOpen =
      next === 'pause' ||
      next === 'settings' ||
      next === 'exit_confirm' ||
      next === 'tutorial_confirm' ||
      (next === 'restart_confirm' && this.pauseOverlay?.isOpen() === true);

    if (!pauseShouldStayOpen && this.pauseOverlay?.isOpen()) {
      this.pauseOverlay.close();
    }

    const settingsShouldStayOpen = next === 'settings' || next === 'tutorial_confirm';
    if (!settingsShouldStayOpen && this.settingsOverlay?.isOpen()) {
      this.settingsOverlay.close();
    }

    if (previous === 'restart_confirm' && this.restartConfirmation?.isOpen()) {
      this.restartConfirmation.close();
    }
    if (previous === 'exit_confirm' && this.exitConfirmation?.isOpen()) {
      this.exitConfirmation.close();
    }
    if (previous === 'tutorial_confirm' && this.tutorialConfirmation?.isOpen()) {
      this.tutorialConfirmation.close();
    }
    if (previous === 'completed' && this.victoryOverlay?.isOpen()) {
      this.victoryOverlay.close();
    }
    if (previous === 'failed' && this.failureOverlay?.isOpen()) {
      this.failureOverlay.close();
    }
    if (previous === 'challenge_intro' && this.challengeIntroOverlay?.isOpen()) {
      this.challengeIntroOverlay.close();
    }

    const pausePayload = {
      subtitle: `${viewState.headerTitle} · ${viewState.headerSubtitle}`,
      stats: {
        moves: viewState.moveCount,
        matched: viewState.displayedMatchCount,
        totalBottles: viewState.totalBottleCount,
        formattedTime: viewState.formattedTime,
      },
    };

    if (next === 'challenge_intro') {
      if (viewState.challengeIntro !== null) {
        this.challengeIntroOverlay?.open(viewState.challengeIntro, !this.theme.reducedMotion);
      }
    } else if (next === 'pause') {
      if (this.pauseOverlay?.isOpen() === true) {
        this.pauseOverlay.updateStats(pausePayload);
        this.pauseOverlay.setControlsInteractive(true);
      } else {
        this.pauseOverlay?.open(pausePayload, !this.theme.reducedMotion);
      }
    } else if (next === 'settings') {
      this.pauseOverlay?.setControlsInteractive(false);
      if (this.settingsOverlay?.isOpen() !== true) {
        this.settingsOverlay?.open(!this.theme.reducedMotion);
      }
    } else if (next === 'restart_confirm') {
      this.pauseOverlay?.setControlsInteractive(false);
      this.restartConfirmation?.open();
    } else if (next === 'exit_confirm') {
      this.pauseOverlay?.setControlsInteractive(false);
      this.exitConfirmation?.open();
    } else if (next === 'tutorial_confirm') {
      this.pauseOverlay?.setControlsInteractive(false);
      this.tutorialConfirmation?.open();
    } else if (next === 'completed') {
      this.triggerCompletionCelebrationAndOverlay(viewState);
    } else if (next === 'failed') {
      if (viewState.failure !== null) {
        this.failureOverlay?.open(viewState.failure, !this.theme.reducedMotion);
      }
    }
  }

  private syncTutorialOverlays(viewState: TutorialViewState): void {
    const next = viewState.overlayMode;
    if (next === this.activeOverlayMode) {
      return;
    }

    const previous = this.activeOverlayMode;
    this.activeOverlayMode = next;

    const isPauseRelatedOverlay =
      next === 'pause' ||
      next === 'settings' ||
      next === 'restart_confirm' ||
      next === 'exit_confirm' ||
      next === 'tutorial_confirm';
    this.gameplayAudio?.setManualPaused(isPauseRelatedOverlay);

    const pauseShouldStayOpen =
      next === 'pause' ||
      next === 'settings' ||
      next === 'exit_confirm' ||
      (next === 'restart_confirm' && this.pauseOverlay?.isOpen() === true);

    if (!pauseShouldStayOpen && this.pauseOverlay?.isOpen()) {
      this.pauseOverlay.close();
    }

    if (next !== 'settings' && this.settingsOverlay?.isOpen()) {
      this.settingsOverlay.close();
    }
    if (previous === 'restart_confirm' && this.restartConfirmation?.isOpen()) {
      this.restartConfirmation.close();
    }
    if (previous === 'exit_confirm' && this.exitConfirmation?.isOpen()) {
      this.exitConfirmation.close();
    }
    if (previous === 'completed' && this.tutorialCompletionOverlay?.isOpen()) {
      this.tutorialCompletionOverlay.close();
    }

    const returnToLevels = this.launchData?.returnTo === 'level_selection';
    const pausePayload = {
      subtitle: `How to Play · Step ${String(viewState.stepNumber)} of ${String(viewState.totalSteps)}`,
      stats: {
        moves: viewState.displayedMoveCount,
        matched: viewState.displayedMatchCount,
        totalBottles: viewState.totalBottleCount,
        formattedTime: viewState.formattedTime,
      },
      exitLabel: returnToLevels
        ? TUTORIAL_CONFIG.copy.exitToLevelsLabel
        : TUTORIAL_CONFIG.copy.exitToHomeLabel,
    };

    if (next === 'pause') {
      if (this.pauseOverlay?.isOpen() === true) {
        this.pauseOverlay.updateStats(pausePayload);
        this.pauseOverlay.setControlsInteractive(true);
      } else {
        this.pauseOverlay?.open(pausePayload, !this.theme.reducedMotion);
      }
    } else if (next === 'settings') {
      this.pauseOverlay?.setControlsInteractive(false);
      this.settingsOverlay?.open(!this.theme.reducedMotion);
    } else if (next === 'restart_confirm') {
      this.pauseOverlay?.setControlsInteractive(false);
      this.restartConfirmation?.open();
    } else if (next === 'exit_confirm') {
      this.pauseOverlay?.setControlsInteractive(false);
      this.exitConfirmation?.open();
    } else if (next === 'completed') {
      this.triggerTutorialCompletionCelebration(viewState);
    }
  }

  private syncInactivityReminder(viewState: TutorialViewState): void {
    if (
      viewState.stage === 'independent_puzzle' &&
      viewState.overlayMode === 'none' &&
      !viewState.isSwapping &&
      viewState.guidanceHint === null
    ) {
      if (this.inactivityTimer === undefined) {
        this.resetInactivityReminderTimer();
      }
    } else {
      this.clearInactivityReminderTimer();
    }
  }

  private resetInactivityReminderTimer(): void {
    this.clearInactivityReminderTimer();
    if (!this.isTutorialMode) {
      return;
    }
    const view = this.tutorialController?.getViewState();
    if (view?.stage !== 'independent_puzzle' || view.overlayMode !== 'none') {
      return;
    }
    this.inactivityTimer = this.time.delayedCall(TUTORIAL_CONFIG.inactivityReminderMs, () => {
      this.inactivityTimer = undefined;
      this.tutorialController?.triggerInactivityReminder();
    });
  }

  private clearInactivityReminderTimer(): void {
    if (this.inactivityTimer !== undefined) {
      this.inactivityTimer.remove(false);
      this.inactivityTimer = undefined;
    }
  }

  private triggerCompletionCelebrationAndOverlay(viewState: GameplayViewState): void {
    const attemptAtTrigger = viewState.attemptId;
    this.gameplayAudio?.handleVictoryTriggered(attemptAtTrigger);
    const openVictory = (): void => {
      const current = this.controller?.getViewState();
      if (current?.attemptId !== attemptAtTrigger || current.overlayMode !== 'completed') {
        return;
      }
      this.openVictoryOverlay(current);
    };

    if (
      this.theme.reducedMotion ||
      this.board === undefined ||
      this.hud === undefined ||
      this.coordinator === undefined
    ) {
      openVictory();
      return;
    }

    let stopCelebration: () => void = () => undefined;
    const { finish } = this.coordinator.registerDecorative(() => {
      stopCelebration();
    });

    stopCelebration = playVictoryCelebration({
      scene: this,
      rackBounds: this.board.getRackVisualBounds(),
      matchCounterPosition: this.hud.getMatchCounterPosition(),
      policy: this.policy,
      onReadyForOverlay: openVictory,
      onComplete: finish,
    });
  }

  private triggerTutorialCompletionCelebration(viewState: TutorialViewState): void {
    const attemptAtTrigger = viewState.attemptId;
    this.gameplayAudio?.handleTutorialCompleted(attemptAtTrigger);
    const openOverlay = (): void => {
      const current = this.tutorialController?.getViewState();
      if (current?.attemptId !== attemptAtTrigger || current.overlayMode !== 'completed') {
        return;
      }
      this.tutorialCompletionOverlay?.open(
        current.completionActionLabel,
        !this.theme.reducedMotion,
      );
    };

    if (
      this.theme.reducedMotion ||
      this.board === undefined ||
      this.hud === undefined ||
      this.coordinator === undefined
    ) {
      openOverlay();
      return;
    }

    let stopCelebration: () => void = () => undefined;
    const { finish } = this.coordinator.registerDecorative(() => {
      stopCelebration();
    });

    stopCelebration = playVictoryCelebration({
      scene: this,
      rackBounds: this.board.getRackVisualBounds(),
      matchCounterPosition: this.hud.getMatchCounterPosition(),
      policy: this.policy,
      onReadyForOverlay: openOverlay,
      onComplete: finish,
    });
  }

  private handleSwapStarted(transition: PendingSwapTransition): void {
    const view = this.controller?.getViewState();
    if (view === undefined || this.board === undefined || this.coordinator === undefined) {
      this.controller?.completeSwapTransition(transition.transitionId);
      return;
    }

    this.gameplayAudio?.handleSwapStarted(transition);
    const board = this.board;
    this.coordinator.beginSwap(
      (token) =>
        board.animateSwap(
          transition.firstIndex,
          transition.secondIndex,
          view.currentSequence,
          () => {
            token.complete();
          },
          () => {
            this.gameplayAudio?.handleSwapLanding(transition.transitionId, transition.attemptId);
          },
        ),
      () => {
        this.controller?.completeSwapTransition(transition.transitionId);
      },
    );
  }

  private handleTutorialSwapStarted(transition: PendingSwapTransition): void {
    const view = this.tutorialController?.getViewState();
    if (view === undefined || this.board === undefined || this.coordinator === undefined) {
      this.tutorialController?.completeSwapTransition(transition.transitionId);
      return;
    }

    this.gameplayAudio?.handleSwapStarted(transition);
    const board = this.board;
    this.coordinator.beginSwap(
      (token) =>
        board.animateSwap(
          transition.firstIndex,
          transition.secondIndex,
          view.currentSequence,
          () => {
            token.complete();
          },
          () => {
            this.gameplayAudio?.handleSwapLanding(transition.transitionId, transition.attemptId);
          },
        ),
      () => {
        this.tutorialController?.completeSwapTransition(transition.transitionId);
      },
    );
  }

  private handleTutorialExit(reason: TutorialExitReason): void {
    this.clearInactivityReminderTimer();
    this.coordinator?.dispose();

    const origin = this.launchData?.tutorialOrigin ?? 'first_time';
    const returnTo = this.launchData?.returnTo ?? 'home';
    const nextCampaignLevelId = this.launchData?.nextCampaignLevelId;

    if (
      (reason === 'completed' || reason === 'skipped') &&
      origin === 'first_time' &&
      nextCampaignLevelId !== undefined
    ) {
      const nextData: GameplaySceneData = {
        mode: 'campaign',
        levelId: nextCampaignLevelId,
        returnTo,
      };
      this.scene.restart(nextData);
      return;
    }

    if (returnTo === 'level_selection') {
      this.scene.start(SCENE_KEYS.LEVEL_SELECTION);
    } else {
      this.scene.start(SCENE_KEYS.HOME);
    }
  }

  private interruptActiveSwapAndReconcile(): void {
    const cancelled = this.coordinator?.cancelActiveSwap() ?? false;
    if (this.isTutorialMode) {
      if (cancelled || this.tutorialController?.getViewState().isSwapping) {
        this.tutorialController?.completeSwapTransition();
      }
      return;
    }

    if (cancelled || this.controller?.getViewState().isSwapping) {
      this.controller?.completeSwapTransition();
    }
  }

  private computeSafeSwapBounds(layout: GameplayLayout): SafeTrajectoryBounds {
    const hudBottom = layout.hud.topY + layout.hud.height;
    const instructionsTop = layout.instructions.y - layout.instructions.height / 2;
    return {
      minX: layout.contentBounds.x + Dimens.Space12,
      maxX: Math.max(
        layout.contentBounds.x + Dimens.Space32,
        layout.contentBounds.right - Dimens.Space12,
      ),
      minY: hudBottom + Dimens.Space4,
      maxY: Math.max(hudBottom + 100, instructionsTop - Dimens.Space4),
    };
  }

  private applyResponsiveLayout(width: number, height: number): void {
    const safeW = Math.max(1, width);
    const safeH = Math.max(1, height);
    const safeArea = this.responsiveService?.getViewport().safeArea;

    this.background?.resize(safeW, safeH);
    this.outsideTapZone?.setSize(safeW, safeH);

    if (this.isTutorialMode) {
      const tutView = this.tutorialController?.getViewState();
      if (tutView !== undefined && tutView.totalBottleCount > 0) {
        const tutLayout = calculateTutorialLayout({
          width: safeW,
          height: safeH,
          bottleCount: tutView.totalBottleCount,
          hasActions: tutView.primaryActionLabel !== null,
          showCounterExamples: tutView.showCounterExamples,
          ...(safeArea !== undefined ? { safeArea } : {}),
        });
        this.tutorialHeader?.applyLayout(tutLayout.gameplay.header);
        this.hud?.applyLayout(tutLayout.gameplay.hud);
        this.board?.applyLayout(
          tutLayout.gameplay.board,
          this.computeSafeSwapBounds(tutLayout.gameplay),
        );
        this.tutorialPanel?.applyBounds(tutLayout.instructionPanel);
        this.syncTutorialGuidanceVisuals(tutView);
      }
      this.tutorialCompletionOverlay?.resize(safeW, safeH);
    } else {
      const view = this.controller?.getViewState();
      if (view !== undefined && view.totalBottleCount > 0) {
        const layout = calculateGameplayLayout({
          width: safeW,
          height: safeH,
          bottleCount: view.totalBottleCount,
          showCountdownBar: hasTimeLimit(view.challengeMode),
          ...(safeArea !== undefined ? { safeArea } : {}),
        });

        this.header?.applyLayout(layout.header);
        this.hud?.applyLayout(layout.hud);
        this.board?.applyLayout(layout.board, this.computeSafeSwapBounds(layout));
        this.instructions?.applyLayout(layout.instructions);
      }
      this.victoryOverlay?.resize(safeW, safeH, safeArea);
      this.failureOverlay?.resize(safeW, safeH, safeArea);
      this.challengeIntroOverlay?.resize(safeW, safeH, safeArea);
    }

    this.pauseOverlay?.resize(safeW, safeH, safeArea);
    this.settingsOverlay?.resize(safeW, safeH, safeArea);
    this.restartConfirmation?.resize(safeW, safeH);
    this.exitConfirmation?.resize(safeW, safeH);
    this.tutorialConfirmation?.resize(safeW, safeH);
    this.errorModal?.resize(safeW, safeH, safeArea);
    this.saveToastCoordinator?.resize(safeW, safeH);
  }

  private applyMotionPreference(reducedMotion: boolean): void {
    this.interruptActiveSwapAndReconcile();
    this.theme = createGameTheme({ reducedMotion });
    this.policy = resolveAnimationPolicy(reducedMotion);

    this.header?.setTheme(this.theme);
    this.tutorialHeader?.setTheme(this.theme);
    this.hud?.setTheme(this.theme);
    this.hud?.setPolicy(this.policy);
    this.board?.setTheme(this.theme);
    this.board?.setPolicy(this.policy);
    this.tutorialSpotlight?.setTheme(this.theme);
    this.tutorialPointer?.setTheme(this.theme);
    this.tutorialPanel?.setTheme(this.theme);
    this.tutorialCompletionOverlay?.setTheme(this.theme);
    this.pauseOverlay?.setTheme(this.theme);
    this.settingsOverlay?.setTheme(this.theme);
    this.restartConfirmation?.setTheme(this.theme);
    this.exitConfirmation?.setTheme(this.theme);
    this.tutorialConfirmation?.setTheme(this.theme);
    this.victoryOverlay?.setTheme(this.theme);
    this.failureOverlay?.setTheme(this.theme);
    this.challengeIntroOverlay?.setTheme(this.theme);
    this.errorModal?.setTheme(this.theme);
    this.saveToastCoordinator?.setTheme(this.theme);
  }

  private bindSceneLifecycle(): void {
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown);

    this.unsubscribePlatformPause = this.platform.onPause(this.handlePlatformPause);
    this.unsubscribePlatformResume = this.platform.onResume(this.handlePlatformResume);
    this.unsubscribeMotionPreference = this.motionPreference?.onChange(this.handleMotionChange);
    this.unsubscribeResponsive = this.responsiveService?.subscribe((snapshot) => {
      this.interruptActiveSwapAndReconcile();
      this.applyResponsiveLayout(snapshot.viewport.width, snapshot.viewport.height);
    });

    if (typeof globalThis.window !== 'undefined') {
      const useBrowserVisibility =
        this.platform.getCapabilities?.().useBrowserVisibilityLifecycle ?? true;
      if (useBrowserVisibility) {
        globalThis.window.addEventListener('blur', this.handleWindowBlur);
        globalThis.window.addEventListener('focus', this.handleWindowFocus);
      }
      globalThis.window.addEventListener('keydown', this.handleKeyDown);
    }
  }

  private readonly handleMotionChange = (reducedMotion: boolean): void => {
    this.applyMotionPreference(reducedMotion);
  };

  private readonly handleOutsideTap = (): void => {
    if (this.isTutorialMode) {
      this.tutorialController?.clearSelection();
    } else {
      this.controller?.clearSelection();
    }
  };

  private readonly handleTimerTick = (): void => {
    if (this.isTutorialMode) {
      const updated = this.tutorialController?.pollFormattedTime();
      if (updated !== null && updated !== undefined) {
        this.hud?.setElapsedTime(updated);
      }
      return;
    }

    const update = this.controller?.pollTimer();
    if (update !== null && update !== undefined) {
      if (update.countdownRatio !== null) {
        this.hud?.setCountdownState(
          update.formattedTime,
          update.countdownRatio,
          update.countdownUrgency,
        );
      } else {
        this.hud?.setElapsedTime(update.formattedTime);
      }
    }
  };

  private readonly handleResize = (gameSize: Phaser.Structs.Size): void => {
    this.interruptActiveSwapAndReconcile();
    this.applyResponsiveLayout(gameSize.width, gameSize.height);
  };

  private readonly handlePlatformPause = (): void => {
    this.interruptActiveSwapAndReconcile();
    if (this.isTutorialMode) {
      this.tutorialSpotlight?.setSuspended(true);
      this.tutorialPointer?.setSuspended(true);
      this.clearInactivityReminderTimer();
      this.tutorialController?.handlePlatformSuspend();
    } else {
      this.controller?.handlePlatformSuspend();
    }
  };

  private readonly handlePlatformResume = (): void => {
    if (this.isTutorialMode) {
      this.tutorialSpotlight?.setSuspended(false);
      this.tutorialPointer?.setSuspended(false);
      this.tutorialController?.handlePlatformResume();
      this.resetInactivityReminderTimer();
    } else {
      this.controller?.handlePlatformResume();
    }
  };

  private readonly handleWindowBlur = (): void => {
    this.interruptActiveSwapAndReconcile();
    this.audioCoordinator?.getAudioService().suspend('browser_hidden');
    this.hapticService?.suspend('browser_hidden');
    if (this.isTutorialMode) {
      this.tutorialSpotlight?.setSuspended(true);
      this.tutorialPointer?.setSuspended(true);
      this.clearInactivityReminderTimer();
      this.tutorialController?.handleBrowserHidden();
    } else {
      this.controller?.handleBrowserHidden();
    }
  };

  private readonly handleWindowFocus = (): void => {
    this.audioCoordinator?.getAudioService().resume('browser_hidden');
    this.hapticService?.resume('browser_hidden');
    if (this.isTutorialMode) {
      this.tutorialSpotlight?.setSuspended(false);
      this.tutorialPointer?.setSuspended(false);
      this.tutorialController?.handleBrowserVisible();
      this.resetInactivityReminderTimer();
    } else {
      this.controller?.handleBrowserVisible();
    }
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    if (
      event.key === 'Escape' &&
      this.settingsOverlay?.isOpen() &&
      this.settingsOverlay.hasOpenSubOverlay()
    ) {
      this.settingsOverlay.handleEscapeKey();
      return;
    }

    if (this.isTutorialMode) {
      switch (event.key) {
        case 'ArrowLeft':
          this.tutorialController?.moveKeyboardFocus(-1);
          break;
        case 'ArrowRight':
          this.tutorialController?.moveKeyboardFocus(1);
          break;
        case 'Enter':
        case ' ':
          this.resetInactivityReminderTimer();
          this.tutorialController?.activateKeyboardAction();
          break;
        case 'Escape':
          this.interruptActiveSwapAndReconcile();
          this.tutorialController?.handleEscapeKey();
          break;
        default:
          break;
      }
      return;
    }

    switch (event.key) {
      case 'ArrowLeft':
        this.controller?.moveKeyboardFocus(-1);
        break;
      case 'ArrowRight':
        this.controller?.moveKeyboardFocus(1);
        break;
      case 'Enter':
      case ' ':
        this.controller?.activateFocusedSlot();
        break;
      case 'Escape':
        this.interruptActiveSwapAndReconcile();
        this.controller?.handleEscapeKey();
        break;
      default:
        break;
    }
  };

  private launchCampaignLevel(levelId: string): void {
    void this.saveService?.flush(300);
    this.coordinator?.dispose();
    const nextData: GameplaySceneData = {
      mode: 'campaign',
      levelId,
      ...(this.launchData?.returnTo !== undefined ? { returnTo: this.launchData.returnTo } : {}),
    };
    this.scene.restart(nextData);
  }

  private launchNewPracticePuzzle(): void {
    this.coordinator?.dispose();
    const nextData: GameplaySceneData = {
      mode: 'practice',
      ...(this.launchData?.difficulty !== undefined
        ? { difficulty: this.launchData.difficulty }
        : {}),
      ...(this.launchData?.bottleCount !== undefined
        ? { bottleCount: this.launchData.bottleCount }
        : {}),
      ...(this.launchData?.returnTo !== undefined ? { returnTo: this.launchData.returnTo } : {}),
    };
    this.scene.restart(nextData);
  }

  private returnToLevelSelection(chapterId?: string): void {
    void this.saveService?.flush(300);
    this.coordinator?.dispose();
    const returnFromLevelId = this.launchData?.levelId;
    if (chapterId !== undefined) {
      this.scene.start(SCENE_KEYS.LEVEL_SELECTION, {
        chapterId,
        ...(returnFromLevelId !== undefined ? { returnFromLevelId } : {}),
      });
      return;
    }
    this.scene.start(
      SCENE_KEYS.LEVEL_SELECTION,
      returnFromLevelId !== undefined ? { returnFromLevelId } : undefined,
    );
  }

  private launchTutorialReplayFromGameplay(): void {
    this.coordinator?.dispose();
    const nextData: GameplaySceneData = {
      mode: 'tutorial',
      tutorialOrigin: 'replay',
      returnTo: this.launchData?.returnTo ?? 'home',
    };
    this.scene.restart(nextData);
  }

  private returnToHome(): void {
    void this.saveService?.flush(300);
    this.coordinator?.dispose();
    this.scene.start(SCENE_KEYS.HOME);
  }

  private readonly handleShutdown = (): void => {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize);

    this.timerEvent?.remove(false);
    this.timerEvent = undefined;
    this.clearInactivityReminderTimer();

    this.unsubscribePlatformPause?.();
    this.unsubscribePlatformPause = undefined;
    this.unsubscribePlatformResume?.();
    this.unsubscribePlatformResume = undefined;
    this.unsubscribeMotionPreference?.();
    this.unsubscribeMotionPreference = undefined;
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
      globalThis.window.removeEventListener('blur', this.handleWindowBlur);
      globalThis.window.removeEventListener('focus', this.handleWindowFocus);
      globalThis.window.removeEventListener('keydown', this.handleKeyDown);
    }

    this.levelTransitionCoordinator?.dispose();
    this.levelTransitionCoordinator = undefined;
    this.coordinator?.dispose();
    this.coordinator = undefined;
    this.gameplayAudio?.dispose();
    this.gameplayAudio = undefined;
    this.audioCoordinator?.getAudioService().resume('browser_hidden');
    this.hapticService?.resume('browser_hidden');

    this.outsideTapZone?.removeAllListeners();
    this.outsideTapZone = undefined;
    this.background = undefined;
    this.header = undefined;
    this.tutorialHeader = undefined;
    this.hud = undefined;
    this.board = undefined;
    this.instructions = undefined;
    this.tutorialSpotlight = undefined;
    this.tutorialPointer = undefined;
    this.tutorialPanel = undefined;

    this.controller?.dispose();
    this.controller = undefined;
    this.tutorialController?.dispose();
    this.tutorialController = undefined;

    this.tutorialCompletionOverlay?.destroy();
    this.tutorialCompletionOverlay = undefined;
    this.pauseOverlay?.destroy();
    this.pauseOverlay = undefined;
    this.settingsOverlay?.destroy();
    this.settingsOverlay = undefined;
    this.restartConfirmation?.destroy();
    this.restartConfirmation = undefined;
    this.exitConfirmation?.destroy();
    this.exitConfirmation = undefined;
    this.tutorialConfirmation?.destroy();
    this.tutorialConfirmation = undefined;
    this.victoryOverlay?.destroy();
    this.victoryOverlay = undefined;
    this.failureOverlay?.destroy();
    this.failureOverlay = undefined;
    this.challengeIntroOverlay?.destroy();
    this.challengeIntroOverlay = undefined;
    this.errorModal?.destroy();
    this.errorModal = undefined;
    this.saveToastCoordinator?.dispose();
    this.saveToastCoordinator = undefined;
  };
}
