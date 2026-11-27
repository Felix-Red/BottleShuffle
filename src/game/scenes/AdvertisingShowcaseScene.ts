import Phaser from 'phaser';
import {
  DEVELOPMENT_MONETIZATION_CONFIG,
  MONETIZATION_COPY,
} from '../../config/MonetizationConfig';
import type { AdPlacement, AdRequestOutcome, RewardedAdOutcome } from '../../core';
import {
  Colors,
  createGameTheme,
  createTextStyle,
  Dimens,
  drawElevatedSurface,
  hexToNumber,
  OutlineButton,
  PrimaryButton,
  SemanticShapes,
  Typography,
  type GameTheme,
} from '../../design-system';
import type {
  AdvertisingCapabilities,
  AdvertisingProvider,
} from '../../platform/contracts/AdvertisingProvider';
import type {
  AudioChangeCallback,
  GamePlatform,
  LifecycleCallback,
  Unsubscribe,
} from '../../platform/contracts/GamePlatform';
import { AdService } from '../../services/advertising/AdService';
import type { AdServiceDiagnosticSnapshot } from '../../services/advertising/AdRequestState';
import { RewardedAdService } from '../../services/advertising/RewardedAdService';
import { GameBackground } from '../components/environment/GameBackground';
import { LevelTransitionCoordinator } from '../navigation/LevelTransitionCoordinator';

export const ADVERTISING_SHOWCASE_SCENE_KEY = 'AdvertisingShowcaseScene';

type SimulatedInterstitialMode = 'completed' | 'unavailable' | 'failed';
type SimulatedRewardedMode = 'earned' | 'not_earned' | 'failed';

/**
 * Isolated synthetic platform wrapper used exclusively inside AdvertisingShowcaseScene.
 * Allows simulating host pause/resume without disturbing the real browser platform.
 */
class IsolatedShowcaseHostPlatform implements GamePlatform {
  public readonly name = 'dev-isolated-host';
  private readonly pauseListeners = new Set<LifecycleCallback>();
  private readonly resumeListeners = new Set<LifecycleCallback>();
  private readonly audioListeners = new Set<AudioChangeCallback>();
  private hostPaused = false;

  public initialize(): Promise<void> {
    return Promise.resolve();
  }
  public notifyFirstFrameReady(): void {
    // No-op in isolated simulation.
  }
  public notifyGameReady(): void {
    // No-op in isolated simulation.
  }
  public loadData(): Promise<string | null> {
    return Promise.resolve(null);
  }
  public saveData(): Promise<void> {
    return Promise.resolve();
  }
  public isAudioEnabled(): boolean {
    return true;
  }
  public isHostPaused(): boolean {
    return this.hostPaused;
  }
  public simulatePause(): void {
    if (this.hostPaused) {
      return;
    }
    this.hostPaused = true;
    for (const listener of [...this.pauseListeners]) {
      listener();
    }
  }
  public simulateResume(): void {
    if (!this.hostPaused) {
      return;
    }
    this.hostPaused = false;
    for (const listener of [...this.resumeListeners]) {
      listener();
    }
  }
  public onAudioEnabledChange(callback: AudioChangeCallback): Unsubscribe {
    this.audioListeners.add(callback);
    return () => {
      this.audioListeners.delete(callback);
    };
  }
  public onPause(callback: LifecycleCallback): Unsubscribe {
    this.pauseListeners.add(callback);
    return () => {
      this.pauseListeners.delete(callback);
    };
  }
  public onResume(callback: LifecycleCallback): Unsubscribe {
    this.resumeListeners.add(callback);
    return () => {
      this.resumeListeners.delete(callback);
    };
  }
  public dispose(): void {
    this.pauseListeners.clear();
    this.resumeListeners.clear();
    this.audioListeners.clear();
  }
}

/**
 * Isolated in-scene mock advertising provider for ?scene=ads.
 * Never contacts any real advertising network and is excluded from production builds
 * because AdvertisingShowcaseScene is dynamically imported only inside `if (import.meta.env.DEV)`.
 */
class IsolatedShowcaseAdProvider implements AdvertisingProvider {
  public readonly name = 'dev-mock-provider';

  public interstitialMode: SimulatedInterstitialMode = 'completed';
  public rewardedMode: SimulatedRewardedMode = 'earned';
  public responseDelayMs = 0;

  public interstitialRequestCount = 0;
  public rewardedRequestCount = 0;
  public activeRequestCount = 0;
  public lastPlacement: AdPlacement | null = null;
  public lastRewardId: string | null = null;

  private disposed = false;

  public getCapabilities(): AdvertisingCapabilities {
    return Object.freeze({
      interstitialSupported: !this.disposed,
      rewardedSupported: !this.disposed,
      requestsEnabled: !this.disposed,
    });
  }

  public async requestInterstitial(placement: AdPlacement): Promise<AdRequestOutcome> {
    this.interstitialRequestCount += 1;
    this.activeRequestCount += 1;
    this.lastPlacement = placement;

    if (this.responseDelayMs > 0) {
      await new Promise<void>((resolve) => {
        globalThis.setTimeout(resolve, this.responseDelayMs);
      });
    }

    this.activeRequestCount = Math.max(0, this.activeRequestCount - 1);

    if (this.interstitialMode === 'unavailable') {
      return {
        adType: 'interstitial',
        placement,
        status: 'unavailable',
        reason: 'mock_interstitial_unavailable',
        error: {
          category: 'api_unavailable',
          sdkErrorType: 'API_UNAVAILABLE',
          message: 'Simulated ad unavailability.',
        },
      };
    }

    if (this.interstitialMode === 'failed') {
      return {
        adType: 'interstitial',
        placement,
        status: 'failed',
        reason: 'mock_interstitial_rejected',
        error: {
          category: 'request_rejected',
          sdkErrorType: 'UNKNOWN',
          message: 'Simulated SDK rejection.',
        },
      };
    }

    return {
      adType: 'interstitial',
      placement,
      status: 'request_completed',
      reason: 'mock_interstitial_settled',
    };
  }

  public async requestRewarded(
    rewardId: string,
    placement: AdPlacement,
  ): Promise<RewardedAdOutcome> {
    this.rewardedRequestCount += 1;
    this.activeRequestCount += 1;
    this.lastPlacement = placement;
    this.lastRewardId = rewardId;

    if (this.responseDelayMs > 0) {
      await new Promise<void>((resolve) => {
        globalThis.setTimeout(resolve, this.responseDelayMs);
      });
    }

    this.activeRequestCount = Math.max(0, this.activeRequestCount - 1);

    if (this.rewardedMode === 'not_earned') {
      return {
        adType: 'rewarded',
        placement,
        rewardId,
        status: 'reward_not_earned',
        rewardEarned: false,
        reason: 'mock_reward_not_earned',
      };
    }

    if (this.rewardedMode === 'failed') {
      return {
        adType: 'rewarded',
        placement,
        rewardId,
        status: 'failed',
        rewardEarned: false,
        reason: 'mock_reward_rejected',
        error: {
          category: 'request_rejected',
          sdkErrorType: 'UNKNOWN',
          message: 'Simulated rewarded SDK rejection.',
        },
      };
    }

    return {
      adType: 'rewarded',
      placement,
      rewardId,
      status: 'reward_earned',
      rewardEarned: true,
      reason: 'mock_reward_earned',
    };
  }

  public resetCounters(): void {
    this.interstitialRequestCount = 0;
    this.rewardedRequestCount = 0;
    this.activeRequestCount = 0;
    this.lastPlacement = null;
    this.lastRewardId = null;
    this.interstitialMode = 'completed';
    this.rewardedMode = 'earned';
    this.responseDelayMs = 0;
  }

  public dispose(): void {
    this.disposed = true;
  }
}

interface DiagnosticActionDef {
  readonly label: string;
  readonly primary?: boolean;
  readonly onClick: () => void;
}

/**
 * Development-only advertising diagnostics scene (?scene=ads).
 * Operates strictly on isolated synthetic progression, navigation, and mock
 * advertising providers — never mutates real player saves or campaign records.
 *
 * Dynamically imported only inside `if (import.meta.env.DEV)` and excluded from
 * production builds.
 */
export class AdvertisingShowcaseScene extends Phaser.Scene {
  private readonly realPlatform: GamePlatform;
  private readonly theme: GameTheme = createGameTheme();

  private simPlatform?: IsolatedShowcaseHostPlatform;
  private mockProvider?: IsolatedShowcaseAdProvider;
  private adService?: AdService;
  private rewardedService?: RewardedAdService;
  private transitionCoordinator?: LevelTransitionCoordinator;
  private unsubscribeAd?: Unsubscribe;

  private background?: GameBackground;
  private headerTitle?: Phaser.GameObjects.Text;
  private summaryPanel?: Phaser.GameObjects.Graphics;
  private summaryHeading?: Phaser.GameObjects.Text;
  private summaryBody?: Phaser.GameObjects.Text;
  private eventLogText?: Phaser.GameObjects.Text;
  private actionsPanel?: Phaser.GameObjects.Graphics;
  private actionsHeading?: Phaser.GameObjects.Text;
  private actionButtons: (PrimaryButton | OutlineButton)[] = [];

  private syntheticLevelNumber = 1;
  private syntheticLaunchCount = 0;
  private syntheticRewardCount = 0;
  private lastEventMessage =
    'Isolated synthetic diagnostics active — real campaign progress and storage untouched.';

  public constructor(realPlatform: GamePlatform) {
    super({ key: ADVERTISING_SHOWCASE_SCENE_KEY });
    this.realPlatform = realPlatform;
  }

  public create(): void {
    this.cameras.main.setBackgroundColor(hexToNumber(Colors.Surface.Background));
    this.initIsolatedStack();

    this.background = new GameBackground(this, { depth: -10 });

    this.headerTitle = this.add
      .text(
        0,
        0,
        'Advertising Diagnostics (DEV — Isolated Mock)',
        createTextStyle(Typography.HeadlineSmall, { color: Colors.Text.Primary }),
      )
      .setOrigin(0, 0.5);

    this.summaryPanel = this.add.graphics();
    this.summaryHeading = this.add
      .text(
        0,
        0,
        'LIVE ADVERTISING & TRANSITION STATE',
        createTextStyle(Typography.LabelSmall, { color: Colors.Text.Secondary }),
      )
      .setOrigin(0, 0.5);

    this.summaryBody = this.add
      .text(0, 0, '', createTextStyle(Typography.BodySmall, { color: Colors.Text.Primary }))
      .setOrigin(0, 0);

    this.eventLogText = this.add
      .text(
        0,
        0,
        this.lastEventMessage,
        createTextStyle(Typography.LabelSmall, {
          color: Colors.Brand.Secondary,
          scale: 0.9,
        }),
      )
      .setOrigin(0, 0);

    this.actionsPanel = this.add.graphics();
    this.actionsHeading = this.add
      .text(
        0,
        0,
        'SIMULATIONS & CONTROLS (SYNTHETIC CONTEXT)',
        createTextStyle(Typography.LabelSmall, { color: Colors.Text.Secondary }),
      )
      .setOrigin(0, 0.5);

    const actions: readonly DiagnosticActionDef[] = [
      {
        label: 'Sim Eligible Next Lv',
        primary: true,
        onClick: () => {
          this.runSimulatedNextLevelTransition('completed', 0);
        },
      },
      {
        label: 'Sim Ineligible Pause',
        onClick: () => {
          void this.adService
            ?.requestInterstitial({
              mode: 'campaign',
              trigger: 'pause',
              puzzleCompleted: false,
              completionCommitted: false,
              victoryPresented: false,
              sourceLevelId: 'level-001',
              destinationLevelId: 'level-002',
              destinationAccessible: true,
              isChapterBoundary: false,
            })
            .then((outcome) => {
              this.recordEvent(`Ineligible pause -> ${outcome.status} (${outcome.reason})`);
            });
        },
      },
      {
        label: 'Req Interstitial OK',
        onClick: () => {
          if (this.mockProvider !== undefined) {
            this.mockProvider.interstitialMode = 'completed';
            this.mockProvider.responseDelayMs = 0;
          }
          void this.adService
            ?.requestInterstitial({
              mode: 'campaign',
              trigger: 'next_level',
              puzzleCompleted: true,
              completionCommitted: true,
              victoryPresented: true,
              sourceLevelId: 'level-001',
              destinationLevelId: 'level-002',
              destinationAccessible: true,
              isChapterBoundary: false,
            })
            .then((outcome) => {
              this.recordEvent(`Direct interstitial -> ${outcome.status} (${outcome.reason})`);
            });
        },
      },
      {
        label: 'Sim Ad Unavailable',
        onClick: () => {
          this.runSimulatedNextLevelTransition('unavailable', 0);
        },
      },
      {
        label: 'Sim Ad Rejected',
        onClick: () => {
          this.runSimulatedNextLevelTransition('failed', 0);
        },
      },
      {
        label: 'Sim Delayed (1.5s)',
        onClick: () => {
          this.runSimulatedNextLevelTransition('completed', 1500);
        },
      },
      {
        label: 'Reward (Earned)',
        onClick: () => {
          this.runSimulatedRewarded('earned');
        },
      },
      {
        label: 'Reward (Not Earned)',
        onClick: () => {
          this.runSimulatedRewarded('not_earned');
        },
      },
      {
        label: 'Reward (Failed)',
        onClick: () => {
          this.runSimulatedRewarded('failed');
        },
      },
      {
        label: 'Sim Host Pause',
        onClick: () => {
          this.simPlatform?.simulatePause();
          this.recordEvent('Simulated host onPause -> navigation & grants suspended.');
        },
      },
      {
        label: 'Sim Host Resume',
        onClick: () => {
          this.simPlatform?.simulateResume();
          this.recordEvent('Simulated host onResume -> pending transitions/grants resumed.');
        },
      },
      {
        label: 'Reset Diagnostics',
        onClick: () => {
          this.resetIsolatedStack();
          this.recordEvent('Isolated diagnostics stack reset to clean state.');
        },
      },
    ];

    this.actionButtons = actions.map((action) =>
      action.primary
        ? new PrimaryButton(this, {
            label: action.label,
            theme: this.theme,
            onClick: action.onClick,
          })
        : new OutlineButton(this, {
            label: action.label,
            theme: this.theme,
            onClick: action.onClick,
          }),
    );

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown);

    this.applyLayout(this.scale.width, this.scale.height);
    if (this.adService !== undefined) {
      this.renderDiagnostics(this.adService.getDiagnosticSnapshot());
    }
    this.realPlatform.notifyGameReady();
  }

  private initIsolatedStack(): void {
    this.simPlatform = new IsolatedShowcaseHostPlatform();
    this.mockProvider = new IsolatedShowcaseAdProvider();
    this.adService = new AdService({
      provider: this.mockProvider,
      platform: this.simPlatform,
      config: DEVELOPMENT_MONETIZATION_CONFIG,
    });
    this.rewardedService = new RewardedAdService({
      adService: this.adService,
      platform: this.simPlatform,
    });
    this.transitionCoordinator = new LevelTransitionCoordinator({
      platform: this.simPlatform,
      adService: this.adService,
      isDestinationAccessible: () => true,
      onTransitionPendingChange: (pending, label) => {
        if (pending && label !== undefined) {
          this.recordEvent(`Transition pending: "${label}"`);
        }
      },
      onLaunchCampaignLevel: (levelId, txId) => {
        this.syntheticLaunchCount += 1;
        this.syntheticLevelNumber = (this.syntheticLevelNumber % 50) + 1;
        this.recordEvent(
          `Synthetic launch #${String(this.syntheticLaunchCount)} -> ${levelId} (tx #${String(txId)})`,
        );
      },
    });
    this.unsubscribeAd = this.adService.subscribe((snapshot) => {
      this.renderDiagnostics(snapshot);
    });
  }

  private resetIsolatedStack(): void {
    this.unsubscribeAd?.();
    this.transitionCoordinator?.dispose();
    this.rewardedService?.dispose();
    this.adService?.dispose();
    this.mockProvider?.dispose();
    this.simPlatform?.dispose();
    this.syntheticLevelNumber = 1;
    this.syntheticLaunchCount = 0;
    this.syntheticRewardCount = 0;
    this.initIsolatedStack();
  }

  private runSimulatedNextLevelTransition(mode: SimulatedInterstitialMode, delayMs: number): void {
    if (this.mockProvider === undefined || this.transitionCoordinator === undefined) {
      return;
    }
    this.mockProvider.interstitialMode = mode;
    this.mockProvider.responseDelayMs = delayMs;

    const srcNum = this.syntheticLevelNumber;
    const dstNum = (srcNum % 50) + 1;
    const srcId = `level-${String(srcNum).padStart(3, '0')}`;
    const dstId = `level-${String(dstNum).padStart(3, '0')}`;

    this.recordEvent(
      `Starting synthetic transition ${srcId} -> ${dstId} (mode=${mode}, delay=${String(delayMs)}ms)...`,
    );

    void this.transitionCoordinator
      .requestCampaignNextLevel({
        sourceLevelId: srcId,
        destinationLevelId: dstId,
        puzzleCompleted: true,
        completionCommitted: true,
        victoryPresented: true,
        isChapterBoundary: srcNum % 8 === 0,
      })
      .then((res) => {
        this.recordEvent(
          `Transition ${res.status} (launched=${res.launched ? 'YES' : 'NO'}, ad=${res.adOutcome?.status ?? 'none'})`,
        );
      });
  }

  private runSimulatedRewarded(mode: SimulatedRewardedMode): void {
    if (this.mockProvider === undefined || this.rewardedService === undefined) {
      return;
    }
    this.mockProvider.rewardedMode = mode;
    this.mockProvider.responseDelayMs = 0;

    void this.rewardedService
      .requestOptionalReward({
        rewardId: MONETIZATION_COPY.reservedRewardIds.devSyntheticReward,
        explicitUserOptIn: true,
        isDevelopmentSimulation: true,
        onGrantReward: (grant) => {
          this.syntheticRewardCount += 1;
          this.recordEvent(
            `Synthetic reward granted (#${String(this.syntheticRewardCount)}, tx=${grant.transactionId})`,
          );
        },
      })
      .then((res) => {
        if (!res.rewardGranted) {
          this.recordEvent(
            `Synthetic reward not granted -> ${res.outcome.status}${res.deferredUntilResume ? ' (deferred until resume)' : ''}`,
          );
        }
      });
  }

  private recordEvent(message: string): void {
    this.lastEventMessage = message;
    this.eventLogText?.setText(message);
    if (this.adService !== undefined) {
      this.renderDiagnostics(this.adService.getDiagnosticSnapshot());
    }
  }

  private renderDiagnostics(snapshot: AdServiceDiagnosticSnapshot): void {
    const realCaps = this.realPlatform.getCapabilities?.();
    const activeTx = this.transitionCoordinator?.getActiveTransition() ?? null;
    const deferredGrants = this.rewardedService?.getPendingDeferredGrantCount() ?? 0;

    const lines = [
      `Active Platform: ${this.realPlatform.name} (Real Ads: ${realCaps?.advertisingEnabled ? 'ENABLED' : 'NO-OP / OFF'})`,
      `Mock Provider: ${snapshot.providerName}   |   Caps: Int=${snapshot.capabilities.interstitialSupported ? 'YES' : 'NO'} · Rew=${snapshot.capabilities.rewardedSupported ? 'YES' : 'NO'}`,
      `Policy: Interstitial=NextLv/Chapter ONLY · Prod Rewarded UI=DISABLED`,
      `Request State: ${snapshot.state.toUpperCase()}   |   Host Suspended: ${snapshot.hostSuspended ? 'YES' : 'NO'}`,
      `Last Outcome: ${snapshot.lastOutcome !== null ? `${snapshot.lastOutcome.status} (${snapshot.lastOutcome.reason})` : 'None'}`,
      `Active Transition: ${activeTx !== null ? `#${String(activeTx.transitionId)} -> ${activeTx.destinationLevelId}${activeTx.awaitingResume ? ' (WAIT RESUME)' : ''}` : 'None'}   |   Launches: ${String(this.syntheticLaunchCount)}`,
      `Mock Counters: Interstitial=${String(this.mockProvider?.interstitialRequestCount ?? 0)} · Rewarded=${String(this.mockProvider?.rewardedRequestCount ?? 0)} · Active=${String(this.mockProvider?.activeRequestCount ?? 0)}`,
      `Synthetic Rewards: ${String(this.syntheticRewardCount)} granted (${String(deferredGrants)} deferred)   |   Last Placement: ${this.mockProvider?.lastPlacement ?? 'none'}`,
    ];

    this.summaryBody?.setText(lines.join('\n'));
  }

  private applyLayout(width: number, height: number): void {
    const safeW = Math.max(320, width);
    const safeH = Math.max(480, height);
    const isPortrait = safeH > safeW;
    const pad = isPortrait ? Dimens.Space12 : Dimens.Space20;

    this.background?.resize(safeW, safeH);

    const headerY = pad + 18;
    this.headerTitle?.setText(
      isPortrait ? 'Ads Diagnostics (DEV)' : 'Advertising Diagnostics (DEV — Isolated Mock)',
    );
    this.headerTitle?.setPosition(pad, headerY);

    const bodyTop = headerY + 34;
    const bodyW = safeW - pad * 2;
    const bodyH = Math.max(260, safeH - bodyTop - pad);

    if (isPortrait) {
      const gap = Dimens.Space12;
      const summaryH = Math.min(315, Math.round(bodyH * 0.45));
      const actionsH = Math.max(220, bodyH - summaryH - gap);
      this.layoutSummaryPanel(pad, bodyTop, bodyW, summaryH, true);
      this.layoutActionsPanel(pad, bodyTop + summaryH + gap, bodyW, actionsH, 2);
    } else {
      const gap = Dimens.Space16;
      const leftW = Math.round(bodyW * 0.48);
      const rightW = bodyW - leftW - gap;
      this.layoutSummaryPanel(pad, bodyTop, leftW, bodyH, false);
      this.layoutActionsPanel(pad + leftW + gap, bodyTop, rightW, bodyH, 2);
    }
  }

  private layoutSummaryPanel(x: number, y: number, w: number, h: number, compact: boolean): void {
    if (this.summaryPanel !== undefined) {
      this.summaryPanel.setPosition(x + w / 2, y + h / 2);
      drawElevatedSurface(this.summaryPanel, {
        width: w,
        height: h,
        radius: SemanticShapes.Card,
        fillColor: Colors.Surface.ElevatedSurface,
        borderColor: Colors.Surface.Border,
        borderWidth: Dimens.BorderThin,
        elevation: 'medium',
      });
    }

    const innerPad = 14;
    const innerW = w - innerPad * 2;
    this.summaryHeading?.setPosition(x + innerPad, y + 18);
    this.summaryBody?.setStyle(
      createTextStyle(Typography.BodySmall, {
        color: Colors.Text.Primary,
        scale: compact ? 0.78 : 1,
        minFontSize: 11,
      }),
    );
    this.summaryBody?.setPosition(x + innerPad, y + 34);
    this.summaryBody?.setWordWrapWidth(innerW, true);
    this.summaryBody?.setLineSpacing(compact ? 2 : 9);

    this.eventLogText?.setPosition(x + innerPad, y + h - (compact ? 36 : 42));
    this.eventLogText?.setWordWrapWidth(innerW, true);
  }

  private layoutActionsPanel(x: number, y: number, w: number, h: number, cols: number): void {
    if (this.actionsPanel !== undefined) {
      this.actionsPanel.setPosition(x + w / 2, y + h / 2);
      drawElevatedSurface(this.actionsPanel, {
        width: w,
        height: h,
        radius: SemanticShapes.Card,
        fillColor: Colors.Surface.ElevatedSurface,
        borderColor: Colors.Surface.Border,
        borderWidth: Dimens.BorderThin,
        elevation: 'medium',
      });
    }

    const innerPad = 14;
    const innerW = w - innerPad * 2;
    this.actionsHeading?.setPosition(x + innerPad, y + 20);

    const gridTop = y + 40;
    const rows = Math.ceil(this.actionButtons.length / cols);
    const availH = Math.max(180, h - 52);
    const gapX = 10;
    const gapY = 8;
    const btnW = Math.floor((innerW - gapX * (cols - 1)) / cols);
    const btnH = Math.max(32, Math.min(48, Math.floor((availH - gapY * (rows - 1)) / rows)));

    this.actionButtons.forEach((btn, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const bx = x + innerPad + col * (btnW + gapX) + btnW / 2;
      const by = gridTop + row * (btnH + gapY) + btnH / 2;
      btn.setButtonSize(btnW, btnH);
      btn.setPosition(bx, by);
    });
  }

  private readonly handleResize = (gameSize: Phaser.Structs.Size): void => {
    this.applyLayout(gameSize.width, gameSize.height);
  };

  private readonly handleShutdown = (): void => {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize);
    this.unsubscribeAd?.();
    this.unsubscribeAd = undefined;
    this.transitionCoordinator?.dispose();
    this.transitionCoordinator = undefined;
    this.rewardedService?.dispose();
    this.rewardedService = undefined;
    this.adService?.dispose();
    this.adService = undefined;
    this.mockProvider?.dispose();
    this.mockProvider = undefined;
    this.simPlatform?.dispose();
    this.simPlatform = undefined;

    this.background = undefined;
    this.headerTitle = undefined;
    this.summaryPanel = undefined;
    this.summaryHeading = undefined;
    this.summaryBody = undefined;
    this.eventLogText = undefined;
    this.actionsPanel = undefined;
    this.actionsHeading = undefined;
    this.actionButtons = [];
  };
}
