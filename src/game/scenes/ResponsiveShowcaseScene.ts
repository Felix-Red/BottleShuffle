import Phaser from 'phaser';
import type { BottleId } from '../../core';
import { BOTTLE_CATALOG } from '../assets/BottleCatalog';
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
import type { MotionPreferenceService } from '../../services/MotionPreferenceService';
import type { ResponsiveLayoutService } from '../../services/ResponsiveLayoutService';
import { BottleSprite } from '../components/bottles/BottleSprite';
import { BottleRack } from '../components/environment/BottleRack';
import { GameBackground } from '../components/environment/GameBackground';
import { HiddenSequenceRack } from '../components/environment/HiddenSequenceRack';
import { calculateGameplayLayout } from '../layout/GameplayLayout';
import { resolveLayoutProfile } from '../layout/LayoutProfileResolver';
import {
  createViewportMetrics,
  type PartialSafeAreaInsets,
  ZERO_SAFE_AREA,
} from '../layout/ViewportMetrics';
import { SCENE_KEYS } from './sceneKeys';

interface ViewportPreset {
  readonly id: string;
  readonly label: string;
  readonly width: number | null;
  readonly height: number | null;
}

const VIEWPORT_PRESETS: readonly ViewportPreset[] = [
  { id: 'live', label: 'Live', width: null, height: null },
  { id: '320x480', label: '320×480', width: 320, height: 480 },
  { id: '320x568', label: '320×568', width: 320, height: 568 },
  { id: '390x844', label: '390×844', width: 390, height: 844 },
  { id: '568x320', label: '568×320', width: 568, height: 320 },
  { id: '844x390', label: '844×390', width: 844, height: 390 },
  { id: '1024x768', label: '1024×768', width: 1024, height: 768 },
  { id: '1280x720', label: '1280×720', width: 1280, height: 720 },
];

/**
 * Development-only responsive layout diagnostic and visual inspection scene (?scene=responsive).
 * Dynamically imported ONLY under import.meta.env.DEV and excluded from production builds.
 */
export class ResponsiveShowcaseScene extends Phaser.Scene {
  private readonly platform: GamePlatform;
  private readonly responsiveService?: ResponsiveLayoutService;
  private readonly motionPreference?: MotionPreferenceService;

  private theme: GameTheme = createGameTheme();
  private background?: GameBackground;
  private controlsContainer?: Phaser.GameObjects.Container;
  private previewRoot?: Phaser.GameObjects.Container;
  private previewFrameGraphics?: Phaser.GameObjects.Graphics;
  private previewOverlayGraphics?: Phaser.GameObjects.Graphics;
  private previewRack?: BottleRack;
  private previewHiddenRack?: HiddenSequenceRack;
  private previewBottlesLayer?: Phaser.GameObjects.Container;
  private metricsPanelGraphics?: Phaser.GameObjects.Graphics;
  private metricsText?: Phaser.GameObjects.Text;
  private titleText?: Phaser.GameObjects.Text;

  private presetBtn?: PrimaryButton;
  private countDownBtn?: OutlineButton;
  private countUpBtn?: OutlineButton;
  private safeAreaBtn?: OutlineButton;
  private boundsBtn?: OutlineButton;
  private motionBtn?: OutlineButton;

  private presetIndex = 0;
  private bottleCount = 8;
  private simulateSafeArea = false;
  private showDebugBounds = true;

  private unsubscribeResponsive?: Unsubscribe;
  private unsubscribeMotion?: Unsubscribe;

  public constructor(
    platform: GamePlatform,
    responsiveService?: ResponsiveLayoutService,
    motionPreference?: MotionPreferenceService,
  ) {
    super({ key: SCENE_KEYS.RESPONSIVE_SHOWCASE });
    this.platform = platform;
    this.responsiveService = responsiveService;
    this.motionPreference = motionPreference;
  }

  public create(): void {
    this.cameras.main.setBackgroundColor(hexToNumber(Colors.Surface.Background));
    this.theme = createGameTheme({
      reducedMotion: this.motionPreference?.isReducedMotion() ?? false,
    });

    this.background = new GameBackground(this, { depth: -10 });

    this.titleText = this.add
      .text(
        0,
        0,
        'Responsive Layout Diagnostics (DEV)',
        createTextStyle(Typography.TitleMedium, {
          color: Colors.Text.Primary,
        }),
      )
      .setOrigin(0, 0.5);

    this.controlsContainer = this.add.container(0, 0);

    this.presetBtn = new PrimaryButton(this, {
      label: 'Preset: Live',
      width: 146,
      height: 44,
      theme: this.theme,
      onClick: () => {
        this.presetIndex = (this.presetIndex + 1) % VIEWPORT_PRESETS.length;
        this.rebuildSceneLayout();
      },
    });

    this.countDownBtn = new OutlineButton(this, {
      label: '- Bottles',
      width: 102,
      height: 44,
      theme: this.theme,
      onClick: () => {
        this.bottleCount = Math.max(3, this.bottleCount - 1);
        this.rebuildSceneLayout();
      },
    });

    this.countUpBtn = new OutlineButton(this, {
      label: '+ Bottles',
      width: 102,
      height: 44,
      theme: this.theme,
      onClick: () => {
        this.bottleCount = Math.min(10, this.bottleCount + 1);
        this.rebuildSceneLayout();
      },
    });

    this.safeAreaBtn = new OutlineButton(this, {
      label: 'Safe: Off',
      width: 108,
      height: 44,
      theme: this.theme,
      onClick: () => {
        this.simulateSafeArea = !this.simulateSafeArea;
        this.rebuildSceneLayout();
      },
    });

    this.boundsBtn = new OutlineButton(this, {
      label: 'Bounds: On',
      width: 118,
      height: 44,
      theme: this.theme,
      onClick: () => {
        this.showDebugBounds = !this.showDebugBounds;
        this.rebuildSceneLayout();
      },
    });

    this.motionBtn = new OutlineButton(this, {
      label: 'Motion: Full',
      width: 122,
      height: 44,
      theme: this.theme,
      onClick: () => {
        const next = !(this.motionPreference?.isReducedMotion() ?? this.theme.reducedMotion);
        this.motionPreference?.setOverride(next);
        this.theme = createGameTheme({ reducedMotion: next });
        this.rebuildSceneLayout();
      },
    });

    this.controlsContainer.add([
      this.presetBtn,
      this.countDownBtn,
      this.countUpBtn,
      this.safeAreaBtn,
      this.boundsBtn,
      this.motionBtn,
    ]);

    this.metricsPanelGraphics = this.add.graphics();
    this.metricsText = this.add
      .text(
        0,
        0,
        '',
        createTextStyle(Typography.LabelSmall, {
          color: Colors.Text.Secondary,
          scale: 0.9,
        }),
      )
      .setOrigin(0, 0);

    this.previewRoot = this.add.container(0, 0);
    this.previewFrameGraphics = this.add.graphics();
    this.previewBottlesLayer = this.add.container(0, 0);
    this.previewOverlayGraphics = this.add.graphics();
    this.previewRoot.add([
      this.previewFrameGraphics,
      this.previewBottlesLayer,
      this.previewOverlayGraphics,
    ]);

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown);

    this.unsubscribeResponsive = this.responsiveService?.subscribe(() => {
      this.rebuildSceneLayout();
    });
    this.unsubscribeMotion = this.motionPreference?.onChange((reduced) => {
      this.theme = createGameTheme({ reducedMotion: reduced });
      this.rebuildSceneLayout();
    });

    this.rebuildSceneLayout();
    this.platform.notifyGameReady();
  }

  private readonly handleResize = (): void => {
    this.rebuildSceneLayout();
  };

  private rebuildSceneLayout(): void {
    const canvasW = Math.max(320, this.scale.width);
    const canvasH = Math.max(320, this.scale.height);
    this.background?.resize(canvasW, canvasH);

    const preset = VIEWPORT_PRESETS[this.presetIndex] ?? VIEWPORT_PRESETS[0];
    const simW = preset?.width ?? canvasW;
    const simH = preset?.height ?? canvasH;
    const isPortraitSim = simH > simW;

    const liveViewport = this.responsiveService?.getViewport();
    const safeArea: PartialSafeAreaInsets = this.simulateSafeArea
      ? isPortraitSim
        ? { top: 44, right: 0, bottom: 34, left: 0 }
        : { top: 0, right: 44, bottom: 21, left: 44 }
      : (liveViewport?.safeArea ?? ZERO_SAFE_AREA);

    const viewport = createViewportMetrics({
      width: simW,
      height: simH,
      devicePixelRatio:
        liveViewport?.devicePixelRatio ??
        (typeof globalThis.window !== 'undefined' ? globalThis.window.devicePixelRatio : 1),
      safeArea,
    });
    const profile = resolveLayoutProfile(viewport);
    const gameplayLayout = calculateGameplayLayout({
      width: viewport.width,
      height: viewport.height,
      bottleCount: this.bottleCount,
      safeArea: viewport.safeArea,
    });

    // Update control labels
    this.presetBtn?.setLabel(`Preset: ${preset?.label ?? 'Live'}`);
    this.safeAreaBtn?.setLabel(this.simulateSafeArea ? 'Safe: Notch' : 'Safe: Live');
    this.boundsBtn?.setLabel(this.showDebugBounds ? 'Bounds: On' : 'Bounds: Off');
    this.motionBtn?.setLabel(this.theme.reducedMotion ? 'Motion: Red.' : 'Motion: Full');

    // Layout top diagnostic toolbar cleanly for both wide and narrow canvases
    const padX = canvasW < 500 ? Dimens.Space10 : Dimens.Space16;
    const compact = canvasW < 700 || canvasH < 460;
    this.titleText?.setPosition(padX, compact ? 16 : 22);

    const buttons = [
      this.presetBtn,
      this.countDownBtn,
      this.countUpBtn,
      this.safeAreaBtn,
      this.boundsBtn,
      this.motionBtn,
    ];
    let btnCursorX = padX;
    let btnCursorY = compact ? 52 : 62;
    const btnGap = Dimens.Space8;
    const btnRowH = 48;

    for (const btn of buttons) {
      if (btn === undefined) {
        continue;
      }
      const w = btn.width;
      if (btnCursorX + w > canvasW - padX && btnCursorX > padX) {
        btnCursorX = padX;
        btnCursorY += btnRowH;
      }
      btn.setPosition(Math.round(btnCursorX + w / 2), Math.round(btnCursorY));
      btnCursorX += w + btnGap;
    }

    const toolbarBottom = btnCursorY + 28;
    const metricsH = compact ? 74 : 62;
    const metricsW = Math.max(240, canvasW - padX * 2);
    const metricsY = toolbarBottom + 4;

    if (this.metricsPanelGraphics !== undefined) {
      this.metricsPanelGraphics.clear();
      this.metricsPanelGraphics.setPosition(padX + metricsW / 2, metricsY + metricsH / 2);
      drawElevatedSurface(this.metricsPanelGraphics, {
        width: metricsW,
        height: metricsH,
        radius: SemanticShapes.Card,
        fillColor: Colors.Surface.Surface,
        borderColor: Colors.Surface.Border,
        borderWidth: Dimens.BorderThin,
        elevation: 'low',
      });
    }

    const rack = gameplayLayout.board.rackLayout;
    const summaryLines = [
      `Viewport: ${String(viewport.width)}×${String(viewport.height)} (${viewport.orientation})  |  Profile: ${profile}  |  DPR: ${viewport.devicePixelRatio.toFixed(1)}→${viewport.effectiveDpr.toFixed(1)}×`,
      `Content: ${String(viewport.effectiveWidth)}×${String(viewport.effectiveHeight)}  |  Safe(T/R/B/L): ${String(viewport.safeArea.top)}/${String(viewport.safeArea.right)}/${String(viewport.safeArea.bottom)}/${String(viewport.safeArea.left)}`,
      `Bottles: ${String(rack.bottleCount)} (${String(rack.rows)}r×${String(rack.columns)}c)  |  Visual: ${String(rack.bottleWidth)}×${String(rack.bottleHeight)}px  |  Hit: ${String(rack.hitWidth)}×${String(rack.hitHeight)}px`,
    ];
    this.metricsText?.setText(summaryLines.join('\n'));
    this.metricsText?.setWordWrapWidth(metricsW - Dimens.Space16, true);
    this.metricsText?.setPosition(padX + Dimens.Space10, metricsY + 8);

    // Compute scaled preview stage region
    const stageTop = metricsY + metricsH + Dimens.Space10;
    const stageAvailW = Math.max(200, canvasW - padX * 2);
    const stageAvailH = Math.max(120, canvasH - stageTop - Dimens.Space10);
    const previewScale = Math.min(1, stageAvailW / viewport.width, stageAvailH / viewport.height);
    const scaledW = viewport.width * previewScale;
    const scaledH = viewport.height * previewScale;
    const stageOriginX = Math.round((canvasW - scaledW) / 2);
    const stageOriginY = Math.round(stageTop + (stageAvailH - scaledH) / 2);

    this.previewRoot?.setPosition(stageOriginX, stageOriginY);
    this.previewRoot?.setScale(previewScale);

    // Rebuild live BottleRack + BottleSprites + HiddenSequenceRack inside the simulated viewport
    this.previewRack?.destroy();
    this.previewHiddenRack?.destroy();
    this.previewBottlesLayer?.removeAll(true);

    if (this.previewFrameGraphics !== undefined) {
      this.previewFrameGraphics.clear();
      this.previewFrameGraphics.fillStyle(hexToNumber(Colors.Surface.Background), 0.96);
      this.previewFrameGraphics.fillRect(0, 0, viewport.width, viewport.height);
      this.previewFrameGraphics.lineStyle(2, hexToNumber(Colors.Brand.PrimaryLight), 0.9);
      this.previewFrameGraphics.strokeRect(0, 0, viewport.width, viewport.height);

      // Visualize safe-area bands in translucent amber
      const sa = viewport.safeArea;
      this.previewFrameGraphics.fillStyle(hexToNumber(Colors.Brand.Secondary), 0.2);
      if (sa.top > 0) {
        this.previewFrameGraphics.fillRect(0, 0, viewport.width, sa.top);
      }
      if (sa.bottom > 0) {
        this.previewFrameGraphics.fillRect(
          0,
          viewport.height - sa.bottom,
          viewport.width,
          sa.bottom,
        );
      }
      if (sa.left > 0) {
        this.previewFrameGraphics.fillRect(0, 0, sa.left, viewport.height);
      }
      if (sa.right > 0) {
        this.previewFrameGraphics.fillRect(viewport.width - sa.right, 0, sa.right, viewport.height);
      }
    }

    const sequence: BottleId[] = BOTTLE_CATALOG.slice(0, this.bottleCount).map((entry) => entry.id);
    const board = gameplayLayout.board;

    this.previewHiddenRack = new HiddenSequenceRack(this, {
      x: board.hiddenRackX,
      y: board.hiddenRackY,
      slotCount: sequence.length,
      availableWidth: board.hiddenRackWidth,
      rows: board.hiddenRows,
      showLabel: board.showHiddenLabel,
      theme: this.theme,
    });
    this.previewHiddenRack.setScale(board.hiddenScale);

    this.previewRack = new BottleRack(this, {
      x: board.rackX,
      y: board.rackY,
      bottleCount: sequence.length,
      availableWidth: board.rackAvailableWidth,
      availableHeight: board.rackAvailableHeight,
      aspectRatio: viewport.effectiveWidth / viewport.effectiveHeight,
      verticalSpacing: board.rackVerticalSpacing,
      maxBottleWidth: board.rackLayout.bottleWidth,
      maxBottleHeight: board.rackLayout.bottleHeight,
    });

    this.previewBottlesLayer?.add([this.previewHiddenRack, this.previewRack]);

    for (let i = 0; i < sequence.length; i += 1) {
      const bottleId = sequence[i];
      if (bottleId === undefined) {
        continue;
      }
      const pos = this.previewRack.getSlotWorldPosition(i);
      const sprite = new BottleSprite(this, {
        bottleId,
        x: pos.x,
        y: pos.y,
        width: rack.bottleWidth,
        height: rack.bottleHeight,
        hitWidth: rack.hitWidth,
        hitHeight: rack.hitHeight,
        interactive: false,
        theme: this.theme,
      });
      this.previewBottlesLayer?.add(sprite);
    }

    // Draw layout regions and non-overlapping hit targets overlay
    if (this.previewOverlayGraphics !== undefined) {
      this.previewOverlayGraphics.clear();
      if (this.showDebugBounds) {
        // Header band
        this.previewOverlayGraphics.lineStyle(1.5, hexToNumber(Colors.Semantic.Info), 0.75);
        this.previewOverlayGraphics.strokeRect(
          gameplayLayout.contentBounds.x,
          gameplayLayout.header.y,
          gameplayLayout.contentBounds.width,
          gameplayLayout.header.height,
        );
        // HUD band
        this.previewOverlayGraphics.strokeRect(
          gameplayLayout.contentBounds.x,
          gameplayLayout.hud.topY,
          gameplayLayout.contentBounds.width,
          gameplayLayout.hud.height,
        );
        // Instructions band
        this.previewOverlayGraphics.strokeRect(
          gameplayLayout.instructions.x - gameplayLayout.instructions.maxWidth / 2,
          gameplayLayout.instructions.y - gameplayLayout.instructions.height / 2,
          gameplayLayout.instructions.maxWidth,
          gameplayLayout.instructions.height,
        );
        // Bottle hit rects (green)
        this.previewOverlayGraphics.lineStyle(1.5, hexToNumber(Colors.Semantic.Success), 0.85);
        for (const slot of rack.slots) {
          this.previewOverlayGraphics.strokeRect(
            board.rackX + slot.hitRect.x,
            board.rackY + slot.hitRect.y,
            slot.hitRect.width,
            slot.hitRect.height,
          );
        }
      }
    }
  }

  private readonly handleShutdown = (): void => {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize);
    this.unsubscribeResponsive?.();
    this.unsubscribeResponsive = undefined;
    this.unsubscribeMotion?.();
    this.unsubscribeMotion = undefined;
    this.previewRack?.destroy();
    this.previewHiddenRack?.destroy();
  };
}
