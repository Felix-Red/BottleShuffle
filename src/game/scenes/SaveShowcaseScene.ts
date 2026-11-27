import Phaser from 'phaser';
import { PERSISTENCE_CONFIG } from '../../config/PersistenceConfig';
import {
  calculateScoreBreakdown,
  calculateStarRating,
  CURRENT_SAVE_SCHEMA_VERSION,
  SAVE_GAME_ID,
} from '../../core';
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
import type { GamePlatform, Unsubscribe } from '../../platform/contracts/GamePlatform';
import { InMemorySaveStorage } from '../../platform/memory/InMemorySaveStorage';
import { SettingsService } from '../../services/SettingsService';
import { TutorialPreferenceService } from '../../services/TutorialPreferenceService';
import { SaveCoordinator } from '../../services/persistence/SaveCoordinator';
import { SaveService } from '../../services/persistence/SaveService';
import type { SaveStatusSnapshot } from '../../services/persistence/SaveStatus';
import { GameBackground } from '../components/environment/GameBackground';
import { ProgressionController } from '../progression/ProgressionController';
import { SCENE_KEYS } from './sceneKeys';

interface DiagnosticActionDef {
  readonly label: string;
  readonly primary?: boolean;
  readonly onClick: () => void;
}

const VALID_SAMPLE_FIXTURE = JSON.stringify({
  schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
  gameId: SAVE_GAME_ID,
  revision: 7,
  updatedAt: '2026-11-27T10:00:00.000Z',
  progression: {
    completedLevels: {
      'level-001': {
        completionCount: 2,
        bestMoveCount: 2,
        bestElapsedMs: 14200,
        bestScore: 1000,
        bestStarRating: 3,
        scoringPolicyVersion: 1,
      },
      'level-002': {
        completionCount: 1,
        bestMoveCount: 4,
        bestElapsedMs: 24800,
        bestScore: 860,
        bestStarRating: 2,
        scoringPolicyVersion: 1,
      },
    },
    lastPlayedLevelId: 'level-002',
  },
  settings: {
    musicEnabled: false,
    soundEffectsEnabled: true,
    vibrationEnabled: false,
    motionPreference: 'reduced',
  },
  tutorial: {
    status: 'completed',
    completed: true,
  },
});

const PARTIALLY_INVALID_FIXTURE = JSON.stringify({
  schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
  gameId: SAVE_GAME_ID,
  revision: 4,
  updatedAt: '2026-11-27T10:05:00.000Z',
  progression: {
    completedLevels: {
      'level-001': {
        completionCount: 1,
        bestMoveCount: 2,
        bestElapsedMs: 12000,
        bestScore: 1000,
        bestStarRating: 3,
        scoringPolicyVersion: 1,
      },
    },
    lastPlayedLevelId: 'level-001',
  },
  settings: {
    musicEnabled: 'broken-string',
    soundEffectsEnabled: true,
    vibrationEnabled: false,
    motionPreference: 'invalid-mode',
  },
  tutorial: {
    status: 'completed',
    completed: true,
  },
});

const FUTURE_SCHEMA_FIXTURE = JSON.stringify({
  schemaVersion: 99,
  gameId: SAVE_GAME_ID,
  revision: 42,
  updatedAt: '2028-01-01T00:00:00.000Z',
  progression: { completedLevels: {}, lastPlayedLevelId: null },
  settings: {
    musicEnabled: true,
    soundEffectsEnabled: true,
    vibrationEnabled: false,
    motionPreference: 'system',
  },
  tutorial: { status: 'completed', completed: true },
});

/**
 * Development-only persistence diagnostics scene (?scene=save).
 * Runs strictly against an isolated InMemorySaveStorage instance so destructive
 * failure, corruption, migration, and reset simulations NEVER modify player LocalStorage.
 *
 * Dynamically imported only inside `if (import.meta.env.DEV)` and excluded from
 * production builds.
 */
export class SaveShowcaseScene extends Phaser.Scene {
  private readonly platform: GamePlatform;
  private readonly theme: GameTheme = createGameTheme();

  private storage?: InMemorySaveStorage;
  private progression?: ProgressionController;
  private settings?: SettingsService;
  private tutorial?: TutorialPreferenceService;
  private saveService?: SaveService;
  private saveCoordinator?: SaveCoordinator;
  private unsubscribeStatus?: Unsubscribe;

  private background?: GameBackground;
  private headerTitle?: Phaser.GameObjects.Text;
  private summaryPanel?: Phaser.GameObjects.Graphics;
  private summaryHeading?: Phaser.GameObjects.Text;
  private summaryBody?: Phaser.GameObjects.Text;
  private eventLogText?: Phaser.GameObjects.Text;

  private actionsPanel?: Phaser.GameObjects.Graphics;
  private actionsHeading?: Phaser.GameObjects.Text;
  private actionButtons: (PrimaryButton | OutlineButton)[] = [];

  private lastEventMessage = 'Isolated in-memory storage active — real player storage untouched.';

  public constructor(platform: GamePlatform) {
    super({ key: SCENE_KEYS.SAVE_SHOWCASE });
    this.platform = platform;
  }

  public create(): void {
    this.cameras.main.setBackgroundColor(hexToNumber(Colors.Surface.Background));

    // Isolated diagnostic stack (zero impact on real browser LocalStorage)
    this.storage = new InMemorySaveStorage();
    this.progression = new ProgressionController();
    this.settings = new SettingsService();
    this.tutorial = new TutorialPreferenceService();
    this.saveService = new SaveService({
      storage: this.storage,
      targets: {
        progressionController: this.progression,
        settingsService: this.settings,
        tutorialPreference: this.tutorial,
      },
      normalDebounceMs: 300,
    });
    this.saveCoordinator = new SaveCoordinator({
      saveService: this.saveService,
      progressionController: this.progression,
      settingsService: this.settings,
      tutorialPreference: this.tutorial,
    });

    this.background = new GameBackground(this, { depth: -10 });

    this.headerTitle = this.add
      .text(
        0,
        0,
        'Save-Data Diagnostics (DEV — Isolated Storage)',
        createTextStyle(Typography.HeadlineSmall, { color: Colors.Text.Primary }),
      )
      .setOrigin(0, 0.5);

    this.summaryPanel = this.add.graphics();
    this.summaryHeading = this.add
      .text(
        0,
        0,
        'LIVE SAVE SNAPSHOT & STATUS',
        createTextStyle(Typography.LabelSmall, { color: Colors.Text.Secondary }),
      )
      .setOrigin(0, 0.5);

    this.summaryBody = this.add
      .text(
        0,
        0,
        '',
        createTextStyle(Typography.BodySmall, {
          color: Colors.Text.Primary,
        }),
      )
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
        'SIMULATIONS & CONTROLS (ISOLATED IN-MEMORY)',
        createTextStyle(Typography.LabelSmall, { color: Colors.Text.Secondary }),
      )
      .setOrigin(0, 0.5);

    const actions: readonly DiagnosticActionDef[] = [
      {
        label: 'Complete Next Lv',
        primary: true,
        onClick: () => {
          this.simulateNextLevelCompletion();
        },
      },
      {
        label: 'Toggle Music',
        onClick: () => {
          const cur = this.settings?.getSettings().musicEnabled ?? true;
          this.settings?.setMusicEnabled(!cur);
          this.recordEvent(`Music toggled -> ${!cur ? 'ON' : 'OFF'} (normal 300ms debounce)`);
        },
      },
      {
        label: 'Save Now',
        onClick: () => {
          const queued = this.saveService?.requestSave('manual', 'high') ?? false;
          this.recordEvent(
            queued ? 'High-priority save requested.' : 'No unsaved changes or writes blocked.',
          );
        },
      },
      {
        label: 'Flush Pending',
        onClick: () => {
          void this.saveService?.flush().then((ok) => {
            this.recordEvent(`Flush completed -> ${ok ? 'DURABLE' : 'UNSAVED / BLOCKED'}`);
          });
        },
      },
      {
        label: 'Load Valid Fixture',
        onClick: () => {
          this.storage?.setAvailable(true);
          this.storage?.setFailAllSaves(null);
          this.storage?.setSaveDelayMs(0);
          this.storage?.seedPayload(VALID_SAMPLE_FIXTURE);
          void this.saveService?.initialise().then((res) => {
            this.recordEvent(`Loaded valid fixture -> outcome: ${res.outcome}`);
          });
        },
      },
      {
        label: 'Sim Missing Save',
        onClick: () => {
          this.storage?.setAvailable(true);
          this.storage?.setFailAllSaves(null);
          this.storage?.seedPayload(null);
          void this.saveService?.initialise().then((res) => {
            this.recordEvent(`Simulated missing save -> outcome: ${res.outcome}`);
          });
        },
      },
      {
        label: 'Sim Corrupted JSON',
        onClick: () => {
          this.storage?.setAvailable(true);
          this.storage?.seedPayload('{ broken json !!!');
          void this.saveService?.initialise().then((res) => {
            this.recordEvent(`Simulated corrupt JSON -> ${res.outcome} (auto-writes blocked)`);
          });
        },
      },
      {
        label: 'Sim Invalid Settings',
        onClick: () => {
          this.storage?.setAvailable(true);
          this.storage?.seedPayload(PARTIALLY_INVALID_FIXTURE);
          void this.saveService?.initialise().then((res) => {
            this.recordEvent(
              `Partial recovery -> ${res.outcome} (${String(res.repairs.length)} repairs)`,
            );
          });
        },
      },
      {
        label: 'Sim Future v99',
        onClick: () => {
          this.storage?.setAvailable(true);
          this.storage?.seedPayload(FUTURE_SCHEMA_FIXTURE);
          void this.saveService?.initialise().then((res) => {
            this.recordEvent(`Future schema -> ${res.outcome} (payload preserved)`);
          });
        },
      },
      {
        label: 'Sim Write Failure',
        onClick: () => {
          this.storage?.setAvailable(true);
          this.storage?.setFailNextSave('STORAGE_QUOTA_EXCEEDED');
          const cur = this.settings?.getSettings().soundEffectsEnabled ?? true;
          this.settings?.setSoundEffectsEnabled(!cur);
          void this.saveService?.flush().then(() => {
            this.recordEvent('Simulated quota failure -> in-memory progress preserved');
          });
        },
      },
      {
        label: 'Sim Delayed Write',
        onClick: () => {
          this.storage?.setAvailable(true);
          this.storage?.setFailAllSaves(null);
          this.storage?.setSaveDelayMs(750);
          const cur = this.settings?.getSettings().musicEnabled ?? true;
          this.settings?.setMusicEnabled(!cur);
          this.saveService?.requestSave('manual', 'high');
          this.recordEvent('Started 750ms delayed save...');
        },
      },
      {
        label: 'Reset Dev Save',
        onClick: () => {
          this.storage?.setAvailable(true);
          this.storage?.setFailAllSaves(null);
          this.storage?.setSaveDelayMs(0);
          void this.saveService?.resetStorageForFreshStart().then(() => {
            this.recordEvent('Isolated dev storage reset to clean defaults.');
          });
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

    this.unsubscribeStatus = this.saveService.subscribe((snapshot) => {
      this.renderDiagnostics(snapshot);
    });

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown);

    void this.saveService.initialise().then(() => {
      if (this.saveService !== undefined) {
        this.renderDiagnostics(this.saveService.getStatus());
      }
    });

    this.applyLayout(this.scale.width, this.scale.height);
    this.renderDiagnostics(this.saveService.getStatus());
    this.platform.notifyGameReady();
  }

  private simulateNextLevelCompletion(): void {
    if (this.progression === undefined) {
      return;
    }
    const next = this.progression.getRecommendedNextLevel();
    if (next.status !== 'available') {
      this.recordEvent('All 50 campaign levels already completed in dev session.');
      return;
    }
    const level = next.level;
    const begin = this.progression.beginCampaignAttempt(level.id);
    if (!begin.accepted) {
      return;
    }
    const minSwaps = Math.max(2, level.bottleCount - 2);
    const breakdown = calculateScoreBreakdown({
      difficulty: level.difficulty,
      actualMoves: minSwaps,
      minimumRequiredSwaps: minSwaps,
    });
    const stars = calculateStarRating(minSwaps, minSwaps);
    this.progression.completeActiveAttempt({
      attemptId: begin.attempt.attemptId,
      levelId: level.id,
      moveCount: minSwaps,
      elapsedMs: 14500,
      score: breakdown.totalScore,
      starRating: stars,
      scoringPolicyVersion: breakdown.scoringPolicyVersion,
    });
    this.recordEvent(
      `Completed ${level.id} (${String(stars)}★, ${String(breakdown.totalScore)} pts)`,
    );
  }

  private recordEvent(message: string): void {
    this.lastEventMessage = message;
    this.eventLogText?.setText(message);
    if (this.saveService !== undefined) {
      this.renderDiagnostics(this.saveService.getStatus());
    }
  }

  private renderDiagnostics(snapshot: SaveStatusSnapshot): void {
    if (
      this.progression === undefined ||
      this.settings === undefined ||
      this.tutorial === undefined ||
      this.saveService === undefined
    ) {
      return;
    }

    const summary = this.progression.getCampaignAchievementSummary();
    const settings = this.settings.getSettings();
    const preview = this.saveService.getSerializedPreview();
    const budgetPct = ((preview.bytes / PERSISTENCE_CONFIG.sizeTargetBytes) * 100).toFixed(1);
    const writeCount = this.storage?.getWriteCount() ?? 0;

    const lines = [
      `Status: ${snapshot.status.toUpperCase()}   |   Durable: ${snapshot.isDurable ? 'YES' : 'NO'}`,
      `Schema Version: v${String(snapshot.schemaVersion)}   |   Auto-Write Blocked: ${snapshot.autoWriteBlocked ? 'YES' : 'NO'}`,
      `Revision: ${String(snapshot.currentRevision)} (Last Saved: ${String(snapshot.lastSavedRevision)})   |   Unsaved: ${snapshot.hasUnsavedChanges ? 'YES' : 'NO'}`,
      `Serialized Size: ${String(preview.bytes)} B (${budgetPct}% of 32 KiB)   |   Writes: ${String(writeCount)}`,
      `Campaign: ${String(summary.completedLevels)}/${String(summary.totalLevels)} levels   |   Stars: ${String(summary.totalEarnedStars)}/${String(summary.maxAvailableStars)}`,
      `Settings: Music ${settings.musicEnabled ? 'ON' : 'OFF'} · SFX ${settings.soundEffectsEnabled ? 'ON' : 'OFF'} · Vib ${settings.vibrationEnabled ? 'ON' : 'OFF'} · Motion ${settings.motionPreference}`,
      `Tutorial: ${this.tutorial.getStatus()}   |   Last Saved At: ${snapshot.lastSavedAt ?? 'Never'}`,
    ];

    if (snapshot.repairs.length > 0) {
      lines.push(`Repairs (${String(snapshot.repairs.length)}): ${snapshot.repairs[0] ?? ''}`);
    }
    if (snapshot.lastErrorCode !== null) {
      lines.push(`Last Error: ${snapshot.lastErrorCode} — ${snapshot.lastErrorMessage ?? ''}`);
    }

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
      isPortrait ? 'Save Diagnostics (DEV)' : 'Save-Data Diagnostics (DEV — Isolated Storage)',
    );
    this.headerTitle?.setPosition(pad, headerY);

    const bodyTop = headerY + 34;
    const bodyW = safeW - pad * 2;
    const bodyH = Math.max(260, safeH - bodyTop - pad);

    if (isPortrait) {
      const gap = Dimens.Space12;
      const summaryH = Math.min(270, Math.round(bodyH * 0.4));
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
    this.summaryHeading?.setPosition(x + innerPad, y + 20);
    this.summaryBody?.setPosition(x + innerPad, y + 40);
    this.summaryBody?.setWordWrapWidth(innerW, true);
    this.summaryBody?.setLineSpacing(compact ? 4 : 9);

    this.eventLogText?.setPosition(x + innerPad, y + h - (compact ? 34 : 42));
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
    this.unsubscribeStatus?.();
    this.unsubscribeStatus = undefined;

    this.saveCoordinator?.dispose();
    this.saveCoordinator = undefined;
    this.saveService?.dispose();
    this.saveService = undefined;
    this.storage?.dispose();
    this.storage = undefined;
    this.settings?.dispose();
    this.settings = undefined;
    this.tutorial?.dispose();
    this.tutorial = undefined;
    this.progression = undefined;

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
