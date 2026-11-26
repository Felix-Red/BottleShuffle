import Phaser from 'phaser';
import {
  Colors,
  ConfirmDialog,
  createGameTheme,
  createTextStyle,
  Dimens,
  Modal,
  TextButton,
  Typography,
  type GameTheme,
} from '../../design-system';
import { GAMEPLAY_CONFIG, GAMEPLAY_COPY } from '../../config/GameplayConfig';
import type { GamePlatform, Unsubscribe } from '../../platform/contracts/GamePlatform';
import { MotionPreferenceService } from '../../services/MotionPreferenceService';
import { playVictoryCelebration } from '../animations/celebration/VictoryCelebration';
import { AnimationCoordinator } from '../animations/core/AnimationCoordinator';
import { resolveAnimationPolicy, type AnimationPolicy } from '../animations/core/AnimationPolicy';
import type { SafeTrajectoryBounds } from '../animations/utils/AnimationCurves';
import { GameBackground } from '../components/environment/GameBackground';
import { GameplayBoard } from '../components/gameplay/GameplayBoard';
import { GameplayHeader } from '../components/gameplay/GameplayHeader';
import { GameplayHUD } from '../components/gameplay/GameplayHUD';
import { GameplayInstructions } from '../components/gameplay/GameplayInstructions';
import { GameplayController } from '../gameplay/GameplayController';
import type { GameplaySceneData } from '../gameplay/GameplaySceneData';
import type {
  GameplayOverlayMode,
  GameplayViewState,
  PendingSwapTransition,
} from '../gameplay/GameplayViewState';
import { calculateGameplayLayout, type GameplayLayout } from '../layout/GameplayLayout';
import { SCENE_KEYS } from './sceneKeys';

export class GameScene extends Phaser.Scene {
  private readonly platform: GamePlatform;
  private theme: GameTheme = createGameTheme();
  private policy: AnimationPolicy = resolveAnimationPolicy(false);
  private launchData?: GameplaySceneData;

  private motionPreference?: MotionPreferenceService;
  private unsubscribeMotionPreference?: Unsubscribe;
  private coordinator?: AnimationCoordinator;

  private controller?: GameplayController;
  private background?: GameBackground;
  private outsideTapZone?: Phaser.GameObjects.Zone;
  private header?: GameplayHeader;
  private hud?: GameplayHUD;
  private board?: GameplayBoard;
  private instructions?: GameplayInstructions;

  private pauseModal?: Modal;
  private restartDialog?: ConfirmDialog;
  private completionModal?: Modal;
  private completionStatsText?: Phaser.GameObjects.Text;
  private errorModal?: Modal;

  private timerEvent?: Phaser.Time.TimerEvent;
  private unsubscribePlatformPause?: Unsubscribe;
  private unsubscribePlatformResume?: Unsubscribe;
  private activeOverlayMode: GameplayOverlayMode = 'none';
  private lastAttemptId = 1;

  public constructor(platform: GamePlatform, defaultLaunchData?: GameplaySceneData) {
    super({ key: SCENE_KEYS.GAME });
    this.platform = platform;
    this.launchData = defaultLaunchData;
  }

  public init(data?: GameplaySceneData): void {
    if (data !== undefined && Object.keys(data).length > 0) {
      this.launchData = data;
    }
  }

  public create(): void {
    this.activeOverlayMode = 'none';
    this.motionPreference = new MotionPreferenceService();
    const initialReducedMotion = this.motionPreference.isReducedMotion();
    this.theme = createGameTheme({ reducedMotion: initialReducedMotion });
    this.policy = resolveAnimationPolicy(initialReducedMotion);
    this.coordinator = new AnimationCoordinator();

    this.background = new GameBackground(this, { depth: -10 });

    this.outsideTapZone = this.add
      .zone(0, 0, this.scale.width, this.scale.height)
      .setOrigin(0)
      .setDepth(-5)
      .setInteractive();
    this.outsideTapZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, this.handleOutsideTap);

    this.controller = new GameplayController({
      ...(this.launchData !== undefined ? { sceneData: this.launchData } : {}),
      callbacks: {
        onViewStateChange: (viewState) => {
          this.renderViewState(viewState);
        },
        onSwapStarted: (transition) => {
          this.handleSwapStarted(transition);
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
      this.platform.notifyGameReady();
      return;
    }

    const layout = calculateGameplayLayout({
      width: this.scale.width,
      height: this.scale.height,
      bottleCount: initialView.totalBottleCount,
    });

    this.header = new GameplayHeader(this, {
      title: initialView.headerTitle,
      subtitle: initialView.headerSubtitle,
      onPause: () => {
        this.interruptActiveSwapAndReconcile();
        this.controller?.requestPause();
      },
      onRestart: () => {
        this.interruptActiveSwapAndReconcile();
        this.controller?.requestRestartConfirmation();
      },
      theme: this.theme,
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
      layout: layout.board,
      safeBounds: this.computeSafeSwapBounds(layout),
      onSlotTap: (slotIndex) => {
        this.controller?.handleBottleTap(slotIndex);
      },
      theme: this.theme,
      policy: this.policy,
    });

    this.instructions = new GameplayInstructions(this, initialView.instructionText);

    this.buildOverlays();
    this.applyResponsiveLayout(this.scale.width, this.scale.height);
    this.bindSceneLifecycle();

    this.timerEvent = this.time.addEvent({
      delay: GAMEPLAY_CONFIG.timerPollIntervalMs,
      loop: true,
      callback: this.handleTimerTick,
    });

    this.controller.start();
    this.platform.notifyGameReady();
  }

  private buildOverlays(): void {
    const pauseHomeContainer = this.add.container(0, 0);
    const pauseHomeButton = new TextButton(this, {
      x: 0,
      y: 0,
      width: 200,
      height: Dimens.ButtonHeightSmall,
      label: GAMEPLAY_COPY.pauseModal.homeLabel,
      theme: this.theme,
      onClick: () => {
        this.returnToHome();
      },
    });
    pauseHomeContainer.add(pauseHomeButton);

    this.pauseModal = new Modal(this, {
      title: GAMEPLAY_COPY.pauseModal.title,
      message: GAMEPLAY_COPY.pauseModal.message,
      content: pauseHomeContainer,
      contentHeight: Dimens.ButtonHeightSmall,
      dismissible: true,
      theme: this.theme,
      primaryAction: {
        label: GAMEPLAY_COPY.pauseModal.resumeLabel,
        closeOnClick: false,
        onClick: () => {
          this.controller?.resumeFromPause();
        },
      },
      secondaryAction: {
        label: GAMEPLAY_COPY.pauseModal.restartLabel,
        closeOnClick: false,
        onClick: () => {
          this.controller?.requestRestartConfirmation();
        },
      },
      onDismiss: () => {
        this.controller?.resumeFromPause();
      },
    });

    this.restartDialog = new ConfirmDialog(this, {
      title: GAMEPLAY_COPY.restartModal.title,
      message: GAMEPLAY_COPY.restartModal.message,
      confirmLabel: GAMEPLAY_COPY.restartModal.confirmLabel,
      cancelLabel: GAMEPLAY_COPY.restartModal.cancelLabel,
      dismissible: true,
      theme: this.theme,
      onConfirm: () => {
        this.coordinator?.resetAttempt();
        this.hud?.clearFeedback();
        this.controller?.confirmRestart();
      },
      onCancel: () => {
        this.controller?.cancelRestartConfirmation();
      },
    });

    const statsContainer = this.add.container(0, 0);
    this.completionStatsText = this.add
      .text(
        0,
        0,
        '',
        createTextStyle(Typography.BodyMedium, {
          color: Colors.Text.Primary,
          align: 'center',
        }),
      )
      .setOrigin(0.5);
    statsContainer.add(this.completionStatsText);

    this.completionModal = new Modal(this, {
      title: GAMEPLAY_COPY.completionModal.title,
      message: 'You deduced the hidden sequence!',
      content: statsContainer,
      contentHeight: 74,
      dismissible: false,
      theme: this.theme,
      primaryAction: {
        label: GAMEPLAY_COPY.completionModal.playAgainLabel,
        closeOnClick: false,
        onClick: () => {
          this.coordinator?.resetAttempt();
          this.hud?.clearFeedback();
          this.controller?.confirmRestart();
        },
      },
      secondaryAction: {
        label: GAMEPLAY_COPY.completionModal.homeLabel,
        closeOnClick: false,
        onClick: () => {
          this.returnToHome();
        },
      },
    });
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
    this.errorModal.open();
  }

  private renderViewState(viewState: GameplayViewState): void {
    // Detect attempt reset (restart) so stale decorative effects & animations clear cleanly
    if (viewState.attemptId !== this.lastAttemptId) {
      this.lastAttemptId = viewState.attemptId;
      this.coordinator?.resetAttempt();
      this.hud?.clearFeedback();
    }

    this.header?.setControlsEnabled(
      viewState.status === 'playing' && viewState.overlayMode === 'none',
      viewState.overlayMode !== 'error',
    );

    this.hud?.setMatches(viewState.displayedMatchCount, viewState.totalBottleCount, true);
    this.hud?.setMoveCount(viewState.displayedMoveCount, true);
    this.hud?.setElapsedTime(viewState.formattedTime);
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

  private syncOverlays(viewState: GameplayViewState): void {
    if (viewState.overlayMode === this.activeOverlayMode) {
      return;
    }

    const previous = this.activeOverlayMode;
    this.activeOverlayMode = viewState.overlayMode;

    if (previous === 'pause' && this.pauseModal?.isOpen()) {
      this.pauseModal.close(false);
    }
    if (previous === 'restart_confirm' && this.restartDialog?.isOpen()) {
      this.restartDialog.close();
    }
    if (previous === 'completed' && this.completionModal?.isOpen()) {
      this.completionModal.close(false);
    }

    if (viewState.overlayMode === 'pause') {
      this.pauseModal?.open();
    } else if (viewState.overlayMode === 'restart_confirm') {
      this.restartDialog?.open();
    } else if (viewState.overlayMode === 'completed') {
      this.triggerCompletionCelebrationAndOverlay(viewState);
    }
  }

  private triggerCompletionCelebrationAndOverlay(viewState: GameplayViewState): void {
    const attemptAtTrigger = viewState.attemptId;
    const openCompletionModal = (): void => {
      const current = this.controller?.getViewState();
      if (current?.attemptId !== attemptAtTrigger || current.overlayMode !== 'completed') {
        return;
      }
      this.completionStatsText?.setText(
        `Matches: ${String(current.displayedMatchCount)}/${String(current.totalBottleCount)}\nMoves: ${String(current.moveCount)}   ·   Time: ${current.formattedTime}`,
      );
      this.completionModal?.resize(this.scale.width, this.scale.height);
      this.completionModal?.open();
    };

    if (this.board === undefined || this.hud === undefined || this.coordinator === undefined) {
      openCompletionModal();
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
      onReadyForOverlay: openCompletionModal,
      onComplete: finish,
    });
  }

  private handleSwapStarted(transition: PendingSwapTransition): void {
    const view = this.controller?.getViewState();
    if (view === undefined || this.board === undefined || this.coordinator === undefined) {
      this.controller?.completeSwapTransition(transition.transitionId);
      return;
    }

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
        ),
      () => {
        this.controller?.completeSwapTransition(transition.transitionId);
      },
    );
  }

  private interruptActiveSwapAndReconcile(): void {
    const cancelled = this.coordinator?.cancelActiveSwap() ?? false;
    if (cancelled || this.controller?.getViewState().isSwapping) {
      this.controller?.completeSwapTransition();
    }
  }

  private computeSafeSwapBounds(layout: GameplayLayout): SafeTrajectoryBounds {
    const hudBottom = layout.hud.topY + layout.hud.height;
    const instructionsTop = layout.instructions.y - layout.instructions.height / 2;
    return {
      minX: Dimens.Space16,
      maxX: Math.max(Dimens.Space32, layout.width - Dimens.Space16),
      minY: hudBottom + Dimens.Space4,
      maxY: Math.max(hudBottom + 120, instructionsTop - Dimens.Space4),
    };
  }

  private applyResponsiveLayout(width: number, height: number): void {
    const safeW = Math.max(1, width);
    const safeH = Math.max(1, height);

    this.background?.resize(safeW, safeH);
    this.outsideTapZone?.setSize(safeW, safeH);

    const view = this.controller?.getViewState();
    if (view !== undefined && view.totalBottleCount > 0) {
      const layout = calculateGameplayLayout({
        width: safeW,
        height: safeH,
        bottleCount: view.totalBottleCount,
      });

      this.header?.applyLayout(layout.header);
      this.hud?.applyLayout(layout.hud);
      this.board?.applyLayout(layout.board, this.computeSafeSwapBounds(layout));
      this.instructions?.applyLayout(layout.instructions);
    }

    this.pauseModal?.resize(safeW, safeH);
    this.restartDialog?.resize(safeW, safeH);
    this.completionModal?.resize(safeW, safeH);
    this.errorModal?.resize(safeW, safeH);
  }

  private applyMotionPreference(reducedMotion: boolean): void {
    this.interruptActiveSwapAndReconcile();
    this.theme = createGameTheme({ reducedMotion });
    this.policy = resolveAnimationPolicy(reducedMotion);

    this.header?.setTheme(this.theme);
    this.hud?.setTheme(this.theme);
    this.hud?.setPolicy(this.policy);
    this.board?.setTheme(this.theme);
    this.board?.setPolicy(this.policy);
    this.pauseModal?.setTheme(this.theme);
    this.restartDialog?.setTheme(this.theme);
    this.completionModal?.setTheme(this.theme);
    this.errorModal?.setTheme(this.theme);
  }

  private bindSceneLifecycle(): void {
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown);

    this.unsubscribePlatformPause = this.platform.onPause(this.handlePlatformPause);
    this.unsubscribePlatformResume = this.platform.onResume(this.handlePlatformResume);
    this.unsubscribeMotionPreference = this.motionPreference?.onChange(this.handleMotionChange);

    if (typeof globalThis.window !== 'undefined') {
      globalThis.window.addEventListener('blur', this.handleWindowBlur);
      globalThis.window.addEventListener('focus', this.handleWindowFocus);
      globalThis.window.addEventListener('keydown', this.handleKeyDown);
    }
  }

  private readonly handleMotionChange = (reducedMotion: boolean): void => {
    this.applyMotionPreference(reducedMotion);
  };

  private readonly handleOutsideTap = (): void => {
    this.controller?.clearSelection();
  };

  private readonly handleTimerTick = (): void => {
    const updated = this.controller?.pollFormattedTime();
    if (updated !== null && updated !== undefined) {
      this.hud?.setElapsedTime(updated);
    }
  };

  private readonly handleResize = (gameSize: Phaser.Structs.Size): void => {
    this.interruptActiveSwapAndReconcile();
    this.applyResponsiveLayout(gameSize.width, gameSize.height);
  };

  private readonly handlePlatformPause = (): void => {
    this.interruptActiveSwapAndReconcile();
    this.controller?.handlePlatformSuspend();
  };

  private readonly handlePlatformResume = (): void => {
    this.controller?.handlePlatformResume();
  };

  private readonly handleWindowBlur = (): void => {
    this.interruptActiveSwapAndReconcile();
    this.controller?.handlePlatformSuspend();
  };

  private readonly handleWindowFocus = (): void => {
    this.controller?.handlePlatformResume();
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.metaKey || event.ctrlKey || event.altKey) {
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

  private returnToHome(): void {
    this.coordinator?.dispose();
    this.scene.start(SCENE_KEYS.HOME);
  }

  private readonly handleShutdown = (): void => {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize);

    this.timerEvent?.remove(false);
    this.timerEvent = undefined;

    this.unsubscribePlatformPause?.();
    this.unsubscribePlatformPause = undefined;
    this.unsubscribePlatformResume?.();
    this.unsubscribePlatformResume = undefined;
    this.unsubscribeMotionPreference?.();
    this.unsubscribeMotionPreference = undefined;
    this.motionPreference?.dispose();
    this.motionPreference = undefined;

    if (typeof globalThis.window !== 'undefined') {
      globalThis.window.removeEventListener('blur', this.handleWindowBlur);
      globalThis.window.removeEventListener('focus', this.handleWindowFocus);
      globalThis.window.removeEventListener('keydown', this.handleKeyDown);
    }

    this.coordinator?.dispose();
    this.coordinator = undefined;

    this.outsideTapZone?.removeAllListeners();
    this.controller?.dispose();
    this.controller = undefined;

    this.pauseModal?.destroy();
    this.restartDialog?.destroy();
    this.completionModal?.destroy();
    this.errorModal?.destroy();
  };
}
