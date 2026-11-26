import Phaser from 'phaser';
import type { BottleId } from '../../core';
import { formatMatchDeltaFeedback } from '../../config/GameplayConfig';
import {
  Colors,
  createGameTheme,
  createTextStyle,
  Dimens,
  Modal,
  OutlineButton,
  PrimaryButton,
  SecondaryButton,
  Typography,
  type GameTheme,
} from '../../design-system';
import type { GamePlatform } from '../../platform/contracts/GamePlatform';
import { playVictoryCelebration } from '../animations/celebration/VictoryCelebration';
import { AnimationCoordinator } from '../animations/core/AnimationCoordinator';
import { resolveAnimationPolicy, type AnimationPolicy } from '../animations/core/AnimationPolicy';
import { GameBackground } from '../components/environment/GameBackground';
import { GameplayBoard } from '../components/gameplay/GameplayBoard';
import { GameplayHUD } from '../components/gameplay/GameplayHUD';
import { calculateGameplayLayout, type GameplayLayout } from '../layout/GameplayLayout';
import { SCENE_KEYS } from './sceneKeys';

export interface AnimationShowcaseOptions {
  readonly reducedMotion?: boolean;
  readonly slowMotion?: boolean;
}

const DEMO_SEQUENCE: readonly BottleId[] = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];

/**
 * Development-only animation & interaction feedback showcase (`/?scene=animations`).
 * Excluded from production builds via import.meta.env.DEV dynamic import in src/main.ts.
 */
export class AnimationShowcaseScene extends Phaser.Scene {
  private readonly platform: GamePlatform;
  private reducedMotion: boolean;
  private slowMotion: boolean;
  private forceTwoRows = false;

  private theme: GameTheme = createGameTheme();
  private policy: AnimationPolicy = resolveAnimationPolicy(false);
  private coordinator?: AnimationCoordinator;

  private sequence: BottleId[] = [...DEMO_SEQUENCE];
  private selectedIndex: number | null = null;
  private matchCount = 2;
  private moveCount = 0;
  private feedbackSeq = 0;

  private background?: GameBackground;
  private titleText?: Phaser.GameObjects.Text;
  private statusText?: Phaser.GameObjects.Text;
  private hud?: GameplayHUD;
  private board?: GameplayBoard;
  private controlsContainer?: Phaser.GameObjects.Container;
  private sampleModal?: Modal;

  private reducedBtn?: OutlineButton;
  private slowBtn?: OutlineButton;
  private rowsBtn?: OutlineButton;
  private actionButtons: (OutlineButton | SecondaryButton | PrimaryButton)[] = [];

  public constructor(platform: GamePlatform, options: AnimationShowcaseOptions = {}) {
    super({ key: SCENE_KEYS.ANIMATION_SHOWCASE });
    this.platform = platform;
    this.reducedMotion = options.reducedMotion ?? false;
    this.slowMotion = options.slowMotion ?? false;
  }

  public create(): void {
    this.coordinator = new AnimationCoordinator();
    this.syncPolicy();

    this.background = new GameBackground(this, { depth: -10 });

    this.titleText = this.add
      .text(
        0,
        0,
        'ANIMATION SHOWCASE  ·  TASK 07',
        createTextStyle(Typography.LabelMedium, {
          color: Colors.Brand.Secondary,
          align: 'center',
        }),
      )
      .setOrigin(0.5, 0);

    this.statusText = this.add
      .text(
        0,
        0,
        '',
        createTextStyle(Typography.BodySmall, {
          color: Colors.Text.Secondary,
          align: 'center',
        }),
      )
      .setOrigin(0.5, 0);

    this.hud = new GameplayHUD(this, {
      initialMatches: this.matchCount,
      totalBottles: this.sequence.length,
      initialMoves: this.moveCount,
      initialTime: '00:12',
      theme: this.theme,
      policy: this.policy,
    });

    const initialLayout = this.computeShowcaseLayout(this.scale.width, this.scale.height);
    this.board = new GameplayBoard(this, {
      initialSequence: this.sequence,
      layout: initialLayout.board,
      onSlotTap: (slotIndex) => {
        this.handleBottleTap(slotIndex);
      },
      theme: this.theme,
      policy: this.policy,
    });

    this.buildControls();
    this.buildModal();
    this.updateStatusBanner();
    this.applyLayout(this.scale.width, this.scale.height);

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown);
    this.platform.notifyGameReady();
  }

  private buildControls(): void {
    this.controlsContainer = this.add.container(0, 0);
    this.actionButtons = [];

    const mkSecondary = (label: string, onClick: () => void): SecondaryButton =>
      new SecondaryButton(this, {
        label,
        width: 146,
        height: 40,
        theme: this.theme,
        onClick,
      });

    const mkOutline = (label: string, onClick: () => void): OutlineButton =>
      new OutlineButton(this, {
        label,
        width: 146,
        height: 40,
        theme: this.theme,
        onClick,
      });

    const btnAdjacent = mkSecondary('Adjacent Swap', () => {
      this.triggerSwap(1, 2);
    });
    const btnLong = mkSecondary('Long Swap', () => {
      this.triggerSwap(0, this.sequence.length - 1);
    });
    const btnCross = mkSecondary('Cross-Row Swap', () => {
      if (!this.forceTwoRows) {
        this.forceTwoRows = true;
        this.applyLayout(this.scale.width, this.scale.height);
      }
      this.triggerSwap(0, this.sequence.length - 1);
    });
    const btnPlus = mkOutline('Match +2', () => {
      this.previewMatchDelta(2);
    });
    const btnMinus = mkOutline('Match -1', () => {
      this.previewMatchDelta(-1);
    });
    const btnNeutral = mkOutline('No Change', () => {
      this.previewMatchDelta(0);
    });
    const btnCelebrate = new PrimaryButton(this, {
      label: 'Celebrate',
      width: 146,
      height: 40,
      theme: this.theme,
      onClick: () => {
        this.previewCelebration();
      },
    });
    const btnModal = mkOutline('Modal Preview', () => {
      this.sampleModal?.open();
    });

    this.reducedBtn = mkOutline('Reduced: OFF', () => {
      this.reducedMotion = !this.reducedMotion;
      this.syncPolicy();
      this.updateStatusBanner();
    });
    this.slowBtn = mkOutline('Slow-Mo: 1.0x', () => {
      this.slowMotion = !this.slowMotion;
      this.syncPolicy();
      this.updateStatusBanner();
    });
    this.rowsBtn = mkOutline('Rack: Auto', () => {
      this.forceTwoRows = !this.forceTwoRows;
      this.updateStatusBanner();
      this.applyLayout(this.scale.width, this.scale.height);
    });

    this.actionButtons = [
      btnAdjacent,
      btnLong,
      btnCross,
      btnPlus,
      btnMinus,
      btnNeutral,
      btnCelebrate,
      btnModal,
      this.reducedBtn,
      this.slowBtn,
      this.rowsBtn,
    ];

    this.controlsContainer.add(this.actionButtons);
  }

  private buildModal(): void {
    this.sampleModal = new Modal(this, {
      title: 'Modal Transition Preview',
      message:
        'Entrance fades the backdrop while scaling cleanly from 0.96 to 1.00 (250ms ease-out). Dismissal fades out over 150ms.',
      dismissible: true,
      theme: this.theme,
      primaryAction: {
        label: 'Close',
        onClick: () => undefined,
      },
    });
  }

  private syncPolicy(): void {
    const timeScale = this.slowMotion ? 0.35 : 1;
    this.theme = createGameTheme({ reducedMotion: this.reducedMotion });
    this.policy = resolveAnimationPolicy(this.reducedMotion, timeScale);

    this.hud?.setTheme(this.theme);
    this.hud?.setPolicy(this.policy);
    this.board?.setTheme(this.theme);
    this.board?.setPolicy(this.policy);
    this.sampleModal?.setTheme(this.theme);
    for (const button of this.actionButtons) {
      button.setTheme(this.theme);
    }
  }

  private updateStatusBanner(): void {
    this.reducedBtn?.setLabel(`Reduced: ${this.reducedMotion ? 'ON' : 'OFF'}`);
    this.slowBtn?.setLabel(`Slow-Mo: ${this.slowMotion ? '0.35x' : '1.0x'}`);
    this.rowsBtn?.setLabel(`Rack: ${this.forceTwoRows ? '2 Rows' : 'Auto'}`);

    const totalSwapMs =
      this.policy.swapAnticipationMs + this.policy.swapMovementMs + this.policy.bottleLandingMs;
    this.statusText?.setText(
      `Swap: ${String(totalSwapMs)}ms · Reduced: ${this.reducedMotion ? 'ON' : 'OFF'} · Slow-Mo: ${this.slowMotion ? '0.35x' : '1.0x'} · Tap bottles or buttons below`,
    );
  }

  private handleBottleTap(slotIndex: number): void {
    if (this.coordinator?.isSwapActive()) {
      return;
    }

    if (this.selectedIndex === null) {
      this.selectedIndex = slotIndex;
      this.board?.syncState(this.sequence, this.selectedIndex, null, true, false);
      return;
    }

    if (this.selectedIndex === slotIndex) {
      this.selectedIndex = null;
      this.board?.syncState(this.sequence, null, null, true, false);
      return;
    }

    const first = this.selectedIndex;
    this.selectedIndex = null;
    this.triggerSwap(first, slotIndex);
  }

  private triggerSwap(firstIndex: number, secondIndex: number): void {
    if (this.board === undefined || this.coordinator === undefined) {
      return;
    }
    if (this.coordinator.isSwapActive() || firstIndex === secondIndex) {
      return;
    }

    this.selectedIndex = null;
    const next = [...this.sequence];
    const first = next[firstIndex];
    const second = next[secondIndex];
    if (first === undefined || second === undefined) {
      return;
    }
    next[firstIndex] = second;
    next[secondIndex] = first;
    this.sequence = next;

    this.board.syncState(this.sequence, null, null, false, false);

    const board = this.board;
    this.coordinator.beginSwap(
      (token) =>
        board.animateSwap(firstIndex, secondIndex, this.sequence, () => {
          token.complete();
        }),
      () => {
        this.moveCount += 1;
        this.hud?.setMoveCount(this.moveCount, true);
        this.previewMatchDelta(1);
        this.board?.syncState(this.sequence, null, null, true, true);
      },
    );
  }

  private previewMatchDelta(delta: number): void {
    const nextMatches = Math.min(this.sequence.length, Math.max(0, this.matchCount + delta));
    const effectiveDelta = delta === 0 ? 0 : nextMatches - this.matchCount;
    this.matchCount = nextMatches;
    this.moveCount += 1;

    this.hud?.setMatches(this.matchCount, this.sequence.length, true);
    this.hud?.setMoveCount(this.moveCount, true);

    const formatted = formatMatchDeltaFeedback(effectiveDelta);
    this.feedbackSeq += 1;
    this.hud?.showMatchFeedback({
      text: formatted.text,
      tone: formatted.tone,
      sequenceId: this.feedbackSeq,
    });
  }

  private previewCelebration(): void {
    if (this.board === undefined || this.hud === undefined || this.coordinator === undefined) {
      return;
    }
    this.matchCount = this.sequence.length;
    this.hud.setMatches(this.matchCount, this.sequence.length, true);

    let stopFn: () => void = () => undefined;
    const { finish } = this.coordinator.registerDecorative(() => {
      stopFn();
    });

    stopFn = playVictoryCelebration({
      scene: this,
      rackBounds: this.board.getRackVisualBounds(),
      matchCounterPosition: this.hud.getMatchCounterPosition(),
      policy: this.policy,
      onComplete: finish,
    });
  }

  private computeShowcaseLayout(width: number, height: number): GameplayLayout {
    const isNarrow = width < 720;
    const effectiveWidth = this.forceTwoRows ? Math.min(width, 460) : width;
    const base = calculateGameplayLayout({
      width: effectiveWidth,
      height: Math.max(480, height - (isNarrow ? 172 : 110)),
      bottleCount: this.sequence.length,
      safeAreaTop: isNarrow ? 20 : 0,
    });

    // Re-center horizontally inside the actual viewport when simulating a 2-row rack
    const centerX = Math.round(width / 2);
    const dx = centerX - base.board.centerX;
    return {
      ...base,
      hud: {
        ...base.hud,
        matchCounterX: base.hud.matchCounterX + dx,
        moveCounterX: base.hud.moveCounterX + dx,
        timerX: base.hud.timerX + dx,
        feedbackX: base.hud.feedbackX + dx,
      },
      board: {
        ...base.board,
        centerX,
        rackX: centerX,
        hiddenRackX: centerX,
      },
    };
  }

  private applyLayout(width: number, height: number): void {
    this.coordinator?.cancelActiveSwap();
    this.background?.resize(width, height);

    const centerX = Math.round(width / 2);
    this.titleText?.setPosition(centerX, Dimens.Space12);
    this.statusText?.setPosition(centerX, Dimens.Space32);
    this.statusText?.setWordWrapWidth(Math.max(260, width - Dimens.Space32), true);

    const layout = this.computeShowcaseLayout(width, height);
    this.hud?.applyLayout(layout.hud);
    this.board?.applyLayout(layout.board, {
      minX: Dimens.Space16,
      maxX: width - Dimens.Space16,
      minY: layout.hud.topY + layout.hud.height,
      maxY: height - 120,
    });

    // Lay out control buttons cleanly in 2 rows near the bottom of the canvas
    if (this.controlsContainer !== undefined && this.actionButtons.length > 0) {
      const gap = Dimens.Space8;
      const cols = width < 720 ? 3 : 6;
      const btnW = Math.min(
        152,
        Math.max(96, Math.floor((width - Dimens.Space32 - gap * (cols - 1)) / cols)),
      );
      const btnH = 38;
      const rows = Math.ceil(this.actionButtons.length / cols);
      const blockH = rows * btnH + (rows - 1) * gap;
      const startY = height - Dimens.Space16 - blockH + btnH / 2;

      for (let i = 0; i < this.actionButtons.length; i += 1) {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const countInRow = Math.min(cols, this.actionButtons.length - row * cols);
        const rowW = countInRow * btnW + (countInRow - 1) * gap;
        const startX = centerX - rowW / 2 + btnW / 2;
        const button = this.actionButtons[i];
        button?.setButtonSize(btnW, btnH);
        button?.setPosition(
          Math.round(startX + col * (btnW + gap)),
          Math.round(startY + row * (btnH + gap)),
        );
      }
    }

    this.sampleModal?.resize(width, height);
  }

  private readonly handleResize = (gameSize: Phaser.Structs.Size): void => {
    this.applyLayout(gameSize.width, gameSize.height);
  };

  private readonly handleShutdown = (): void => {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize);
    this.coordinator?.dispose();
    this.coordinator = undefined;
    this.sampleModal?.destroy();
  };
}
