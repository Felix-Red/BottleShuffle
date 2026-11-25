import Phaser from 'phaser';
import {
  Colors,
  ConfirmDialog,
  createGameTheme,
  createTextStyle,
  DefaultGameTheme,
  Dimens,
  drawElevatedSurface,
  GameCard,
  GameHeader,
  GamePanel,
  hexToNumber,
  IconButton,
  LevelCard,
  LoadingIndicator,
  MatchCounter,
  Modal,
  MotionPresets,
  OutlineButton,
  PrimaryButton,
  ProgressBar,
  resolveLayoutContext,
  resolveMotionDuration,
  SecondaryButton,
  SemanticShapes,
  StarRating,
  StatCard,
  TextButton,
  Toast,
  ToggleSwitch,
  Typography,
  type ElevationLevel,
  type GameTheme,
  type TypographyRole,
} from '../../design-system';
import type { GamePlatform } from '../../platform/contracts/GamePlatform';
import { SCENE_KEYS } from './sceneKeys';

export type ShowcasePageId =
  'colors' | 'typography' | 'buttons' | 'cards' | 'indicators' | 'overlays';

interface ShowcaseTabSpec {
  readonly id: ShowcasePageId;
  readonly label: string;
}

const SHOWCASE_TABS: readonly ShowcaseTabSpec[] = [
  { id: 'colors', label: 'Colours' },
  { id: 'typography', label: 'Type' },
  { id: 'buttons', label: 'Buttons' },
  { id: 'cards', label: 'Cards' },
  { id: 'indicators', label: 'Indicators' },
  { id: 'overlays', label: 'Overlays' },
];

const SHOWCASE_CANVAS_LANDSCAPE = { width: 1080, height: 540 } as const;
const SHOWCASE_CANVAS_PORTRAIT = { width: 520, height: 760 } as const;

export function parseShowcasePageParam(raw: string | null): ShowcasePageId {
  if (raw === null) {
    return 'colors';
  }
  const normalized = raw.toLowerCase();
  const match = SHOWCASE_TABS.find((tab) => tab.id === normalized);
  return match?.id ?? 'colors';
}

export class ComponentShowcaseScene extends Phaser.Scene {
  private readonly platform: GamePlatform;
  private theme: GameTheme = DefaultGameTheme;

  // Persistent interactive state preserved across viewport resizes
  private activePage: ShowcasePageId;
  private matchCount = 3;
  private readonly matchTotal = 10;
  private progressValue = 60;
  private starValue = 2;
  private soundEnabled = true;
  private musicEnabled = true;
  private reducedMotion = false;
  private buttonsDisabled = false;
  private buttonsLoading = false;
  private buttonsFocused = false;
  private buttonClicks = 0;

  private header?: GameHeader;
  private tabBarContainer?: Phaser.GameObjects.Container;
  private pageContainer?: Phaser.GameObjects.Container;
  private toast?: Toast;
  private demoModal?: Modal;
  private confirmDialog?: ConfirmDialog;
  private activeMotionTweens: Phaser.Tweens.Tween[] = [];

  public constructor(platform: GamePlatform, initialPage: ShowcasePageId = 'colors') {
    super({ key: SCENE_KEYS.SHOWCASE });
    this.platform = platform;
    this.activePage = initialPage;
  }

  public create(): void {
    this.cameras.main.setBackgroundColor(hexToNumber(Colors.Surface.Background));

    this.header = new GameHeader(this, {
      title: 'Design System Showcase',
      subtitle: 'Development inspection view',
      onBack: () => {
        this.scene.start(SCENE_KEYS.HOME);
      },
      trailingAction: {
        icon: 'sparkles',
        onClick: () => {
          this.reducedMotion = !this.reducedMotion;
          this.theme = createGameTheme({ reducedMotion: this.reducedMotion });
          this.toast?.setTheme(this.theme);
          this.demoModal?.setTheme(this.theme);
          this.confirmDialog?.setTheme(this.theme);
          this.header?.setTheme(this.theme);
          this.toast?.show({
            message: this.reducedMotion ? 'Reduced motion enabled' : 'Standard motion enabled',
            variant: 'info',
          });
          this.renderAll();
        },
      },
      theme: this.theme,
    });

    this.toast = new Toast(this, { position: 'bottom', theme: this.theme });

    this.demoModal = new Modal(this, {
      title: 'Reusable Modal',
      message:
        'Background interaction is blocked while active. Try tapping outside or using the actions below.',
      dismissible: true,
      theme: this.theme,
      primaryAction: {
        label: 'Got It',
        onClick: () => {
          this.toast?.show({ message: 'Modal primary action confirmed', variant: 'success' });
        },
      },
      secondaryAction: {
        label: 'Dismiss',
        onClick: () => {
          this.toast?.show({ message: 'Modal dismissed', variant: 'info' });
        },
      },
      onDismiss: () => {
        this.toast?.show({ message: 'Modal closed via backdrop/close button', variant: 'info' });
      },
    });

    this.confirmDialog = new ConfirmDialog(this, {
      title: 'Restart Level?',
      message: 'Your current bottle arrangement and move count will reset to the starting state.',
      confirmLabel: 'Restart',
      cancelLabel: 'Keep Playing',
      theme: this.theme,
      onConfirm: () => {
        this.toast?.show({ message: 'Confirmed restart action', variant: 'warning' });
      },
      onCancel: () => {
        this.toast?.show({ message: 'Cancelled restart action', variant: 'info' });
      },
    });

    this.renderAll();

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown);

    this.platform.notifyGameReady();
  }

  private renderAll(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const ctx = resolveLayoutContext(width, height);

    const headerHeight = ctx.isCompact ? Dimens.HeaderHeightCompact : Dimens.HeaderHeight;
    this.header?.resize(ctx.width, headerHeight);
    this.header?.setPosition(0, 0);

    this.buildTabBar(ctx.width, headerHeight);
    this.buildActivePage(ctx.width, ctx.height, headerHeight);

    this.toast?.resize(ctx.width, ctx.height);
    this.demoModal?.resize(ctx.width, ctx.height);
    this.confirmDialog?.resize(ctx.width, ctx.height);
  }

  private buildTabBar(viewportWidth: number, headerHeight: number): void {
    this.tabBarContainer?.destroy();
    const bar = this.add.container(0, headerHeight);
    this.tabBarContainer = bar;

    const compact = viewportWidth < 720;
    const tabHeight = 44;
    const barHeight = compact ? 104 : 60;
    const bg = this.add.graphics();
    bg.fillStyle(hexToNumber(Colors.Surface.Background), 0.95);
    bg.fillRect(0, 0, viewportWidth, barHeight);
    bg.lineStyle(Dimens.BorderThin, hexToNumber(Colors.Surface.Border), 0.45);
    bg.beginPath();
    bg.moveTo(0, barHeight);
    bg.lineTo(viewportWidth, barHeight);
    bg.strokePath();
    bar.add(bg);

    const cols = compact ? 3 : SHOWCASE_TABS.length;
    const padX = compact ? Dimens.Space12 : Dimens.Space24;
    const gap = Dimens.Space8;
    const totalW = Math.min(960, viewportWidth - padX * 2);
    const tabW = Math.floor((totalW - gap * (cols - 1)) / cols);
    const startX = (viewportWidth - (tabW * cols + gap * (cols - 1))) / 2;

    SHOWCASE_TABS.forEach((tab, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      const cx = startX + col * (tabW + gap) + tabW / 2;
      const cy = compact ? 28 + row * (tabHeight + Dimens.Space6) : barHeight / 2;
      const isActive = tab.id === this.activePage;

      const button = isActive
        ? new PrimaryButton(this, {
            x: cx,
            y: cy,
            width: tabW,
            height: tabHeight,
            label: tab.label,
            theme: this.theme,
            onClick: () => {
              this.selectPage(tab.id);
            },
          })
        : new OutlineButton(this, {
            x: cx,
            y: cy,
            width: tabW,
            height: tabHeight,
            label: tab.label,
            theme: this.theme,
            onClick: () => {
              this.selectPage(tab.id);
            },
          });

      bar.add(button);
    });
  }

  private selectPage(page: ShowcasePageId): void {
    if (this.activePage === page) {
      return;
    }
    this.activePage = page;
    this.renderAll();
  }

  private buildActivePage(
    viewportWidth: number,
    viewportHeight: number,
    headerHeight: number,
  ): void {
    this.clearMotionTweens();
    this.pageContainer?.destroy();

    const compact = viewportWidth < 720;
    const tabBarHeight = compact ? 104 : 60;
    const topEdge = headerHeight + tabBarHeight + Dimens.Space12;
    const availW = Math.max(260, viewportWidth - Dimens.Space24);
    const availH = Math.max(220, viewportHeight - topEdge - Dimens.Space16);

    const isPortraitLayout = viewportWidth < 760;
    const virtualW = isPortraitLayout
      ? SHOWCASE_CANVAS_PORTRAIT.width
      : SHOWCASE_CANVAS_LANDSCAPE.width;
    const virtualH = isPortraitLayout
      ? SHOWCASE_CANVAS_PORTRAIT.height
      : SHOWCASE_CANVAS_LANDSCAPE.height;

    const scale = Math.min(1.15, availW / virtualW, availH / virtualH);
    const stage = this.add.container(viewportWidth / 2, topEdge + availH / 2);
    stage.setScale(scale);
    this.pageContainer = stage;

    switch (this.activePage) {
      case 'colors':
        this.renderColorsPage(stage, isPortraitLayout);
        break;
      case 'typography':
        this.renderTypographyPage(stage, isPortraitLayout);
        break;
      case 'buttons':
        this.renderButtonsPage(stage, isPortraitLayout);
        break;
      case 'cards':
        this.renderCardsPage(stage, isPortraitLayout);
        break;
      case 'indicators':
        this.renderIndicatorsPage(stage, isPortraitLayout);
        break;
      case 'overlays':
        this.renderOverlaysPage(stage, isPortraitLayout);
        break;
    }
  }

  private addSectionTitle(
    parent: Phaser.GameObjects.Container,
    x: number,
    y: number,
    text: string,
  ): void {
    const label = this.add
      .text(
        x,
        y,
        text,
        createTextStyle(Typography.LabelMedium, {
          color: Colors.Text.Secondary,
        }),
      )
      .setOrigin(0, 0.5);
    parent.add(label);
  }

  private renderColorsPage(stage: Phaser.GameObjects.Container, portrait: boolean): void {
    const coreSwatches: readonly { readonly name: string; readonly hex: string }[] = [
      { name: 'Primary', hex: Colors.Brand.Primary },
      { name: 'Primary Lt', hex: Colors.Brand.PrimaryLight },
      { name: 'Primary Dk', hex: Colors.Brand.PrimaryDark },
      { name: 'Secondary', hex: Colors.Brand.Secondary },
      { name: 'Background', hex: Colors.Surface.Background },
      { name: 'Surface', hex: Colors.Surface.Surface },
      { name: 'Elevated', hex: Colors.Surface.ElevatedSurface },
      { name: 'Border', hex: Colors.Surface.Border },
      { name: 'Success', hex: Colors.Semantic.Success },
      { name: 'Warning', hex: Colors.Semantic.Warning },
      { name: 'Error', hex: Colors.Semantic.Error },
      { name: 'Info', hex: Colors.Semantic.Info },
    ];

    const startX = portrait ? -235 : -510;
    const cols = portrait ? 3 : 6;
    const tileW = portrait ? 148 : 162;
    const tileH = 72;
    const gapX = 12;
    const gapY = 12;

    this.addSectionTitle(stage, startX, portrait ? -350 : -245, 'BRAND, SURFACE & SEMANTIC TOKENS');

    coreSwatches.forEach((swatch, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (tileW + gapX) + tileW / 2;
      const y = (portrait ? -295 : -190) + row * (tileH + gapY);

      const card = new GameCard(this, {
        x,
        y,
        width: tileW,
        height: tileH,
        elevation: 'low',
        theme: this.theme,
      });

      const chip = this.add.graphics();
      chip.fillStyle(hexToNumber(swatch.hex), 1);
      chip.fillRoundedRect(-tileW / 2 + 12, -20, 40, 40, 10);
      chip.lineStyle(1, hexToNumber(Colors.White), 0.25);
      chip.strokeRoundedRect(-tileW / 2 + 12, -20, 40, 40, 10);

      const nameText = this.add
        .text(
          -tileW / 2 + 60,
          -10,
          swatch.name,
          createTextStyle(Typography.LabelSmall, { color: Colors.Text.Primary }),
        )
        .setOrigin(0, 0.5);

      const hexText = this.add
        .text(
          -tileW / 2 + 60,
          12,
          swatch.hex,
          createTextStyle(Typography.LabelSmall, {
            color: Colors.Text.Secondary,
            scale: 0.85,
          }),
        )
        .setOrigin(0, 0.5);

      card.addContent([chip, nameText, hexText]);
      stage.add(card);
    });

    const bottleTitleY = portrait ? 45 : 22;
    this.addSectionTitle(
      stage,
      startX,
      bottleTitleY,
      'BOTTLE PALETTE (10 COLOURS + ACCESSIBILITY SYMBOLS)',
    );

    const bCols = portrait ? 2 : 5;
    const bTileW = portrait ? 228 : 196;
    const bTileH = portrait ? 56 : 76;

    Colors.BottleTokens.forEach((token, i) => {
      const col = i % bCols;
      const row = Math.floor(i / bCols);
      const x = startX + col * (bTileW + gapX) + bTileW / 2;
      const y = bottleTitleY + (portrait ? 50 : 62) + row * (bTileH + 10);

      const card = new GameCard(this, {
        x,
        y,
        width: bTileW,
        height: bTileH,
        backgroundColor: Colors.Surface.ElevatedSurface,
        elevation: 'low',
        theme: this.theme,
      });

      const dot = this.add.graphics();
      dot.fillStyle(hexToNumber(token.hex), 1);
      dot.fillCircle(-bTileW / 2 + 28, 0, 16);
      dot.lineStyle(2, hexToNumber(Colors.White), 0.35);
      dot.strokeCircle(-bTileW / 2 + 28, 0, 16);

      const name = this.add
        .text(
          -bTileW / 2 + 54,
          -10,
          `${token.label} · ${token.hex}`,
          createTextStyle(Typography.LabelSmall, { color: Colors.Text.Primary, scale: 0.92 }),
        )
        .setOrigin(0, 0.5);

      const meta = this.add
        .text(
          -bTileW / 2 + 54,
          11,
          `${token.symbol} / ${token.pattern}`,
          createTextStyle(Typography.LabelSmall, { color: Colors.Text.Secondary, scale: 0.82 }),
        )
        .setOrigin(0, 0.5);

      card.addContent([dot, name, meta]);
      stage.add(card);
    });
  }

  private renderTypographyPage(stage: Phaser.GameObjects.Container, portrait: boolean): void {
    const roles: readonly { readonly role: TypographyRole; readonly sample: string }[] = [
      { role: 'Display', sample: 'Display' },
      { role: 'HeadlineLarge', sample: 'Headline Large' },
      { role: 'HeadlineMedium', sample: 'Headline Medium' },
      { role: 'HeadlineSmall', sample: 'Headline Small' },
      { role: 'TitleLarge', sample: 'Title Large — Level 12' },
      { role: 'TitleMedium', sample: 'Title Medium — Match Progress' },
      { role: 'BodyLarge', sample: 'Body Large — Swap bottles to match.' },
      { role: 'BodyMedium', sample: 'Body Medium — Hidden target sequence.' },
      { role: 'BodySmall', sample: 'Body Small — Supporting guidance text.' },
      { role: 'LabelLarge', sample: 'LABEL LARGE · PRIMARY ACTION' },
      { role: 'LabelMedium', sample: 'LABEL MEDIUM · SECTION HEADER' },
      { role: 'LabelSmall', sample: 'LABEL SMALL · METADATA TAG' },
    ];

    const panelW = portrait ? 484 : 1020;
    const panelH = portrait ? 710 : 510;
    const card = new GameCard(this, {
      x: 0,
      y: 0,
      width: panelW,
      height: panelH,
      elevation: 'low',
      theme: this.theme,
    });
    stage.add(card);

    const cols = portrait ? 1 : 2;
    const colW = portrait ? panelW - 48 : (panelW - 76) / 2;
    const rowsPerCol = Math.ceil(roles.length / cols);

    roles.forEach((entry, index) => {
      const token = Typography[entry.role];
      const col = Math.floor(index / rowsPerCol);
      const row = index % rowsPerCol;
      const baseX = -panelW / 2 + 28 + col * (colW + 28);
      const stepY = portrait ? 54 : 76;
      const baseY = -panelH / 2 + 52 + row * stepY;

      const sampleScale = portrait ? 0.56 : 0.72;
      const sample = this.add
        .text(
          baseX,
          baseY,
          entry.sample,
          createTextStyle(token, {
            color: index < 5 ? Colors.Text.Primary : Colors.Text.Secondary,
            scale: sampleScale,
          }),
        )
        .setOrigin(0, 0.5);

      const meta = this.add
        .text(
          baseX + colW,
          baseY,
          `${String(token.fontSize)}px / ${String(token.fontWeight)}`,
          createTextStyle(Typography.LabelSmall, {
            color: Colors.Brand.PrimaryLight,
            align: 'right',
            scale: 0.88,
          }),
        )
        .setOrigin(1, 0.5);

      card.addContent([sample, meta]);
    });
  }

  private renderButtonsPage(stage: Phaser.GameObjects.Container, portrait: boolean): void {
    const leftX = portrait ? -235 : -500;
    this.addSectionTitle(
      stage,
      leftX,
      portrait ? -345 : -235,
      `INTERACTIVE BUTTONS · CLICKS: ${String(this.buttonClicks)}`,
    );

    const notifyClick = (label: string): void => {
      this.buttonClicks += 1;
      this.toast?.show({
        message: `Clicked ${label} (#${String(this.buttonClicks)})`,
        variant: 'success',
      });
      this.renderAll();
    };

    const btnW = portrait ? 210 : 225;
    const commonFlags = {
      enabled: !this.buttonsDisabled,
      loading: this.buttonsLoading,
      theme: this.theme,
    };

    const primary = new PrimaryButton(this, {
      x: portrait ? -115 : -370,
      y: portrait ? -280 : -165,
      width: btnW,
      label: 'Play Level',
      icon: 'play',
      ...commonFlags,
      onClick: () => {
        notifyClick('PrimaryButton');
      },
    }).setFocused(this.buttonsFocused);

    const secondary = new SecondaryButton(this, {
      x: portrait ? 115 : -120,
      y: portrait ? -280 : -165,
      width: btnW,
      label: 'Daily Bonus',
      icon: 'star',
      ...commonFlags,
      onClick: () => {
        notifyClick('SecondaryButton');
      },
    }).setFocused(this.buttonsFocused);

    const outline = new OutlineButton(this, {
      x: portrait ? -115 : 130,
      y: portrait ? -205 : -165,
      width: btnW,
      label: 'Restart',
      icon: 'restart',
      ...commonFlags,
      onClick: () => {
        notifyClick('OutlineButton');
      },
    }).setFocused(this.buttonsFocused);

    const textBtn = new TextButton(this, {
      x: portrait ? 115 : 375,
      y: portrait ? -205 : -165,
      width: portrait ? 210 : 185,
      label: 'How To Play',
      icon: 'info',
      ...commonFlags,
      onClick: () => {
        notifyClick('TextButton');
      },
    }).setFocused(this.buttonsFocused);

    stage.add([primary, secondary, outline, textBtn]);

    // Icon buttons row
    const iconSectionY = portrait ? -125 : -65;
    this.addSectionTitle(stage, leftX, iconSectionY, 'ICON BUTTON VARIANTS & STATES');

    const iconConfigs: readonly {
      readonly icon: 'settings' | 'sound' | 'restart' | 'back' | 'play';
      readonly variant: 'surface' | 'primary' | 'secondary' | 'ghost';
      readonly label: string;
    }[] = [
      { icon: 'play', variant: 'primary', label: 'Primary Icon' },
      { icon: 'restart', variant: 'secondary', label: 'Secondary Icon' },
      { icon: 'settings', variant: 'surface', label: 'Surface Icon' },
      { icon: 'sound', variant: 'ghost', label: 'Ghost Icon' },
    ];

    iconConfigs.forEach((cfg, idx) => {
      const iconBtn = new IconButton(this, {
        x: leftX + 36 + idx * 76,
        y: iconSectionY + 52,
        icon: cfg.icon,
        variant: cfg.variant,
        ...commonFlags,
        onClick: () => {
          notifyClick(cfg.label);
        },
      }).setFocused(this.buttonsFocused);
      stage.add(iconBtn);
    });

    // Dedicated static Disabled & Loading showcase cards
    const staticY = portrait ? 20 : 65;
    this.addSectionTitle(stage, leftX, staticY, 'DEDICATED DISABLED & LOADING EXAMPLES');

    const disabledBtn = new PrimaryButton(this, {
      x: portrait ? -115 : -370,
      y: staticY + 56,
      width: btnW,
      label: 'Disabled',
      enabled: false,
      theme: this.theme,
      onClick: () => {
        notifyClick('Should Not Fire');
      },
    });

    const loadingBtn = new SecondaryButton(this, {
      x: portrait ? 115 : -120,
      y: staticY + 56,
      width: btnW,
      label: 'Loading',
      loading: true,
      theme: this.theme,
      onClick: () => {
        notifyClick('Should Not Fire');
      },
    });

    stage.add([disabledBtn, loadingBtn]);

    // Interactive state controls card
    const controlsCard = new GameCard(this, {
      x: portrait ? 0 : 250,
      y: portrait ? 230 : 120,
      width: portrait ? 460 : 460,
      height: 196,
      elevation: 'low',
      theme: this.theme,
    });

    const toggleDisabled = new ToggleSwitch(this, {
      x: 0,
      y: -52,
      width: 390,
      label: 'Disable top buttons',
      value: this.buttonsDisabled,
      theme: this.theme,
      onChange: (val) => {
        this.buttonsDisabled = val;
        this.renderAll();
      },
    });

    const toggleLoading = new ToggleSwitch(this, {
      x: 0,
      y: 0,
      width: 390,
      label: 'Loading state on top buttons',
      value: this.buttonsLoading,
      theme: this.theme,
      onChange: (val) => {
        this.buttonsLoading = val;
        this.renderAll();
      },
    });

    const toggleFocus = new ToggleSwitch(this, {
      x: 0,
      y: 52,
      width: 390,
      label: 'Show focus ring',
      value: this.buttonsFocused,
      theme: this.theme,
      onChange: (val) => {
        this.buttonsFocused = val;
        this.renderAll();
      },
    });

    controlsCard.addContent([toggleDisabled, toggleLoading, toggleFocus]);
    stage.add(controlsCard);
  }

  private renderCardsPage(stage: Phaser.GameObjects.Container, portrait: boolean): void {
    const leftX = portrait ? -235 : -500;
    this.addSectionTitle(stage, leftX, portrait ? -350 : -245, 'GAME CARDS (ELEVATION LEVELS)');

    const levels: readonly ElevationLevel[] = ['flat', 'low', 'medium', 'high'];
    levels.forEach((level, idx) => {
      const col = portrait ? idx % 2 : idx;
      const row = portrait ? Math.floor(idx / 2) : 0;
      const cardW = portrait ? 226 : 235;
      const cardH = portrait ? 82 : 102;
      const x = leftX + col * (cardW + 16) + cardW / 2;
      const y = (portrait ? -285 : -172) + row * (cardH + 14);

      const card = new GameCard(this, {
        x,
        y,
        width: cardW,
        height: cardH,
        backgroundColor: level === 'high' ? Colors.Surface.ElevatedSurface : Colors.Surface.Surface,
        elevation: level,
        theme: this.theme,
      });

      const title = this.add
        .text(
          0,
          -12,
          `Elevation: ${level.toUpperCase()}`,
          createTextStyle(Typography.LabelMedium, { color: Colors.Text.Primary }),
        )
        .setOrigin(0.5);
      const sub = this.add
        .text(
          0,
          14,
          'Rounded surface + depth',
          createTextStyle(Typography.LabelSmall, { color: Colors.Text.Secondary, scale: 0.9 }),
        )
        .setOrigin(0.5);

      card.addContent([title, sub]);
      stage.add(card);
    });

    const levelSectionY = portrait ? -115 : -78;
    this.addSectionTitle(stage, leftX, levelSectionY, 'LEVEL CARDS (ALL STATES)');

    const levelSpecs: readonly {
      readonly num: number;
      readonly status: 'completed' | 'current' | 'unlocked' | 'locked';
      readonly stars: number;
    }[] = [
      { num: 1, status: 'completed', stars: 3 },
      { num: 2, status: 'completed', stars: 2 },
      { num: 3, status: 'current', stars: 0 },
      { num: 4, status: 'unlocked', stars: 0 },
      { num: 5, status: 'locked', stars: 0 },
    ];

    levelSpecs.forEach((spec, idx) => {
      const col = portrait ? idx % 3 : idx;
      const row = portrait ? Math.floor(idx / 3) : 0;
      const x = leftX + 60 + col * (portrait ? 156 : 132);
      const y = levelSectionY + 74 + row * 126;

      const tile = new LevelCard(this, {
        x,
        y,
        levelNumber: spec.num,
        status: spec.status,
        stars: spec.stars,
        theme: this.theme,
        onSelect: (levelNum) => {
          this.toast?.show({
            message: `Selected Level ${String(levelNum)} (${spec.status})`,
            variant: 'info',
          });
        },
      });
      stage.add(tile);
    });

    const statSectionY = portrait ? 185 : 105;
    this.addSectionTitle(stage, leftX, statSectionY, 'STAT CARDS');

    const statSpecs: readonly {
      readonly icon: 'clock' | 'moves' | 'trophy' | 'star';
      readonly label: string;
      readonly value: string;
      readonly accent: string;
    }[] = [
      { icon: 'clock', label: 'ELAPSED TIME', value: '01:42', accent: Colors.Semantic.Info },
      { icon: 'moves', label: 'TOTAL MOVES', value: '14', accent: Colors.Brand.PrimaryLight },
      { icon: 'trophy', label: 'COMPLETED', value: '12 / 30', accent: Colors.Semantic.Success },
      { icon: 'star', label: 'PERSONAL BEST', value: '6 Moves', accent: Colors.Brand.Secondary },
    ];

    statSpecs.forEach((spec, idx) => {
      const col = portrait ? idx % 2 : idx;
      const row = portrait ? Math.floor(idx / 2) : 0;
      const cardW = portrait ? 228 : 238;
      const x = leftX + col * (cardW + 14) + cardW / 2;
      const y = statSectionY + 62 + row * 98;

      const stat = new StatCard(this, {
        x,
        y,
        width: cardW,
        icon: spec.icon,
        label: spec.label,
        value: spec.value,
        accentColor: spec.accent,
        theme: this.theme,
      });
      stage.add(stat);
    });
  }

  private renderIndicatorsPage(stage: Phaser.GameObjects.Container, portrait: boolean): void {
    const leftX = portrait ? -235 : -500;
    this.addSectionTitle(
      stage,
      leftX,
      portrait ? -350 : -245,
      'MATCH COUNTER (INCREASE / DECREASE)',
    );

    const matchCounter = new MatchCounter(this, {
      x: portrait ? 0 : -255,
      y: portrait ? -275 : -168,
      width: portrait ? 464 : 480,
      matched: this.matchCount,
      total: this.matchTotal,
      theme: this.theme,
    });
    stage.add(matchCounter);

    const setMatch = (next: number): void => {
      this.matchCount = Math.min(this.matchTotal, Math.max(0, next));
      matchCounter.setMatches(this.matchCount, this.matchTotal, true);
    };

    const matchCtrlY = portrait ? -194 : -84;
    const matchStartX = portrait ? -190 : -450;
    const matchMinus = new IconButton(this, {
      x: matchStartX,
      y: matchCtrlY,
      icon: 'minus',
      variant: 'surface',
      theme: this.theme,
      onClick: () => {
        setMatch(this.matchCount - 1);
      },
    });
    const matchPlus = new IconButton(this, {
      x: matchStartX + 60,
      y: matchCtrlY,
      icon: 'plus',
      variant: 'primary',
      theme: this.theme,
      onClick: () => {
        setMatch(this.matchCount + 1);
      },
    });
    const preset0 = new OutlineButton(this, {
      x: matchStartX + 148,
      y: matchCtrlY,
      width: 78,
      height: 46,
      label: '0/10',
      theme: this.theme,
      onClick: () => {
        setMatch(0);
      },
    });
    const preset7 = new OutlineButton(this, {
      x: matchStartX + 236,
      y: matchCtrlY,
      width: 78,
      height: 46,
      label: '7/10',
      theme: this.theme,
      onClick: () => {
        setMatch(7);
      },
    });
    const preset10 = new SecondaryButton(this, {
      x: matchStartX + 332,
      y: matchCtrlY,
      width: 92,
      height: 46,
      label: '10/10',
      theme: this.theme,
      onClick: () => {
        setMatch(10);
      },
    });
    stage.add([matchMinus, matchPlus, preset0, preset7, preset10]);

    // Progress bars + Stars + Loading
    const rightColX = portrait ? 0 : 255;
    const progCardY = portrait ? -35 : -138;
    const progCard = new GameCard(this, {
      x: rightColX,
      y: progCardY,
      width: portrait ? 464 : 475,
      height: 196,
      elevation: 'low',
      theme: this.theme,
    });

    const progTitle = this.add
      .text(
        -205,
        -70,
        'PROGRESS BARS (CONTINUOUS & SEGMENTED)',
        createTextStyle(Typography.LabelSmall, { color: Colors.Text.Secondary }),
      )
      .setOrigin(0, 0.5);

    const continuousBar = new ProgressBar(this, {
      x: 0,
      y: -30,
      width: 410,
      height: 14,
      value: this.progressValue,
      max: 100,
      variant: 'continuous',
      fillColor: Colors.Brand.PrimaryLight,
      theme: this.theme,
    });

    const segmentedBar = new ProgressBar(this, {
      x: 0,
      y: 8,
      width: 410,
      height: 14,
      value: Math.round((this.progressValue / 100) * 6),
      max: 6,
      segments: 6,
      variant: 'segmented',
      fillColor: Colors.Brand.Secondary,
      theme: this.theme,
    });

    const updateProgress = (delta: number): void => {
      this.progressValue = Math.min(100, Math.max(0, this.progressValue + delta));
      continuousBar.setProgress(this.progressValue, 100, true);
      segmentedBar.setProgress(Math.round((this.progressValue / 100) * 6), 6, true);
    };

    const progDec = new OutlineButton(this, {
      x: -74,
      y: 56,
      width: 124,
      height: 44,
      label: '-20%',
      theme: this.theme,
      onClick: () => {
        updateProgress(-20);
      },
    });
    const progInc = new PrimaryButton(this, {
      x: 74,
      y: 56,
      width: 124,
      height: 44,
      label: '+20%',
      theme: this.theme,
      onClick: () => {
        updateProgress(20);
      },
    });

    progCard.addContent([progTitle, continuousBar, segmentedBar, progDec, progInc]);
    stage.add(progCard);

    // StarRating & LoadingIndicator card
    const lowerLeftCard = new GameCard(this, {
      x: portrait ? 0 : -255,
      y: portrait ? 132 : 120,
      width: portrait ? 464 : 480,
      height: portrait ? 110 : 210,
      elevation: 'low',
      theme: this.theme,
    });

    const starRating = new StarRating(this, {
      x: portrait ? -110 : -115,
      y: portrait ? -18 : -32,
      rating: this.starValue,
      starSize: 32,
      spacing: Dimens.Space8,
      theme: this.theme,
    });

    const cycleStars = new OutlineButton(this, {
      x: portrait ? -110 : -115,
      y: portrait ? 28 : 42,
      width: 170,
      height: 44,
      label: `Stars: ${String(this.starValue)} / 3`,
      theme: this.theme,
      onClick: () => {
        this.starValue = (this.starValue + 1) % 4;
        starRating.setRating(this.starValue, true);
        cycleStars.setLabel(`Stars: ${String(this.starValue)} / 3`);
      },
    });

    const spinner = new LoadingIndicator(this, {
      x: portrait ? 120 : 120,
      y: portrait ? -18 : -32,
      radius: 20,
      theme: this.theme,
    });

    const spinnerLabel = this.add
      .text(
        portrait ? 120 : 120,
        portrait ? 28 : 42,
        'LoadingIndicator',
        createTextStyle(Typography.LabelSmall, { color: Colors.Text.Secondary }),
      )
      .setOrigin(0.5);

    lowerLeftCard.addContent([starRating, cycleStars, spinner, spinnerLabel]);
    stage.add(lowerLeftCard);

    // Toggle switches card
    const togglesCard = new GameCard(this, {
      x: rightColX,
      y: portrait ? 286 : 120,
      width: portrait ? 464 : 475,
      height: portrait ? 172 : 210,
      elevation: 'low',
      theme: this.theme,
    });

    const soundToggle = new ToggleSwitch(this, {
      x: 0,
      y: portrait ? -54 : -66,
      width: 400,
      label: 'Sound Effects',
      value: this.soundEnabled,
      theme: this.theme,
      onChange: (val) => {
        this.soundEnabled = val;
        this.toast?.show({ message: `Sound ${val ? 'On' : 'Off'}`, variant: 'info' });
      },
    });

    const musicToggle = new ToggleSwitch(this, {
      x: 0,
      y: portrait ? -18 : -22,
      width: 400,
      label: 'Background Music',
      value: this.musicEnabled,
      theme: this.theme,
      onChange: (val) => {
        this.musicEnabled = val;
        this.toast?.show({ message: `Music ${val ? 'On' : 'Off'}`, variant: 'info' });
      },
    });

    const reducedToggle = new ToggleSwitch(this, {
      x: 0,
      y: portrait ? 18 : 22,
      width: 400,
      label: 'Reduced Motion',
      value: this.reducedMotion,
      theme: this.theme,
      onChange: (val) => {
        this.reducedMotion = val;
        this.theme = createGameTheme({ reducedMotion: val });
        this.renderAll();
      },
    });

    const disabledToggle = new ToggleSwitch(this, {
      x: 0,
      y: portrait ? 54 : 66,
      width: 400,
      label: 'Disabled Preference',
      value: true,
      enabled: false,
      theme: this.theme,
    });

    togglesCard.addContent([soundToggle, musicToggle, reducedToggle, disabledToggle]);
    stage.add(togglesCard);
  }

  private renderOverlaysPage(stage: Phaser.GameObjects.Container, portrait: boolean): void {
    // Modal & ConfirmDialog panel
    const overlayPanel = new GamePanel(this, {
      x: portrait ? 0 : -255,
      y: portrait ? -230 : -118,
      width: portrait ? 464 : 480,
      height: 210,
      elevation: 'low',
      theme: this.theme,
    });

    const overlayHeading = this.add
      .text(
        0,
        -68,
        'MODALS & CONFIRMATION DIALOGS',
        createTextStyle(Typography.LabelMedium, { color: Colors.Text.Secondary }),
      )
      .setOrigin(0.5);

    const openModalBtn = new PrimaryButton(this, {
      x: -108,
      y: 8,
      width: 196,
      label: 'Open Modal',
      theme: this.theme,
      onClick: () => {
        this.demoModal?.open();
      },
    });

    const openConfirmBtn = new SecondaryButton(this, {
      x: 108,
      y: 8,
      width: 196,
      label: 'Confirm Dialog',
      theme: this.theme,
      onClick: () => {
        this.confirmDialog?.open();
      },
    });

    const overlayHint = this.add
      .text(
        0,
        66,
        'Modals block underlying canvas clicks while open',
        createTextStyle(Typography.LabelSmall, { color: Colors.Text.Secondary }),
      )
      .setOrigin(0.5);

    overlayPanel.addContent([overlayHeading, openModalBtn, openConfirmBtn, overlayHint]);
    stage.add(overlayPanel);

    // Toast panel
    const toastPanel = new GamePanel(this, {
      x: portrait ? 0 : 255,
      y: portrait ? 10 : -118,
      width: portrait ? 464 : 480,
      height: 210,
      elevation: 'low',
      theme: this.theme,
    });

    const toastHeading = this.add
      .text(
        0,
        -68,
        'TOAST NOTIFICATIONS',
        createTextStyle(Typography.LabelMedium, { color: Colors.Text.Secondary }),
      )
      .setOrigin(0.5);

    const toastSuccess = new OutlineButton(this, {
      x: -108,
      y: -12,
      width: 190,
      height: 46,
      label: 'Success Toast',
      icon: 'check',
      theme: this.theme,
      onClick: () => {
        this.toast?.show({ message: 'Level progress saved!', variant: 'success' });
      },
    });
    const toastInfo = new OutlineButton(this, {
      x: 108,
      y: -12,
      width: 190,
      height: 46,
      label: 'Info Toast',
      icon: 'info',
      theme: this.theme,
      onClick: () => {
        this.toast?.show({ message: 'Swap two bottles to test a guess.', variant: 'info' });
      },
    });
    const toastWarn = new OutlineButton(this, {
      x: -108,
      y: 48,
      width: 190,
      height: 46,
      label: 'Warning Toast',
      icon: 'warning',
      theme: this.theme,
      onClick: () => {
        this.toast?.show({
          message: 'Reduced motion skips decorative bounces.',
          variant: 'warning',
        });
      },
    });
    const toastErr = new OutlineButton(this, {
      x: 108,
      y: 48,
      width: 190,
      height: 46,
      label: 'Error Toast',
      icon: 'error',
      theme: this.theme,
      onClick: () => {
        this.toast?.show({ message: 'Unable to complete action right now.', variant: 'error' });
      },
    });

    toastPanel.addContent([toastHeading, toastSuccess, toastInfo, toastWarn, toastErr]);
    stage.add(toastPanel);

    // Motion & GamePanel demonstration
    const motionPanel = new GamePanel(this, {
      x: 0,
      y: portrait ? 248 : 132,
      width: portrait ? 464 : 990,
      height: portrait ? 210 : 210,
      elevation: 'low',
      theme: this.theme,
    });

    const motionTitle = this.add
      .text(
        0,
        -72,
        `MOTION PRESETS (${this.reducedMotion ? 'REDUCED MOTION ON' : 'STANDARD'})`,
        createTextStyle(Typography.LabelMedium, { color: Colors.Text.Secondary }),
      )
      .setOrigin(0.5);

    const previewTarget = this.add.container(portrait ? 0 : -260, portrait ? -10 : 12);
    const previewGfx = this.add.graphics();
    drawElevatedSurface(previewGfx, {
      width: 180,
      height: 76,
      radius: SemanticShapes.Card,
      fillColor: Colors.Brand.Primary,
      depthColor: Colors.Brand.PrimaryDark,
      elevation: 'medium',
    });
    const previewLabel = this.add
      .text(
        0,
        0,
        'Motion Target',
        createTextStyle(Typography.LabelLarge, { color: Colors.Text.OnPrimary }),
      )
      .setOrigin(0.5);
    previewTarget.add([previewGfx, previewLabel]);

    const playScaleIn = new OutlineButton(this, {
      x: portrait ? -115 : 30,
      y: portrait ? 62 : 12,
      width: 145,
      height: 46,
      label: 'Scale In',
      theme: this.theme,
      onClick: () => {
        this.triggerPreviewMotion(previewTarget, 'scaleIn');
      },
    });
    const playSuccess = new PrimaryButton(this, {
      x: portrait ? 0 : 195,
      y: portrait ? 62 : 12,
      width: 145,
      height: 46,
      label: 'Success Pop',
      theme: this.theme,
      onClick: () => {
        this.triggerPreviewMotion(previewTarget, 'success');
      },
    });
    const playError = new SecondaryButton(this, {
      x: portrait ? 115 : 360,
      y: portrait ? 62 : 12,
      width: 145,
      height: 46,
      label: 'Error Shake',
      theme: this.theme,
      onClick: () => {
        this.triggerPreviewMotion(previewTarget, 'error');
      },
    });

    if (portrait) {
      playScaleIn.setButtonSize(134, 44).setPosition(-146, 62);
      playSuccess.setButtonSize(134, 44).setPosition(0, 62);
      playError.setButtonSize(134, 44).setPosition(146, 62);
    }

    motionPanel.addContent([motionTitle, previewTarget, playScaleIn, playSuccess, playError]);
    stage.add(motionPanel);
  }

  private triggerPreviewMotion(
    target: Phaser.GameObjects.Container,
    kind: 'scaleIn' | 'success' | 'error',
  ): void {
    this.clearMotionTweens();
    const baseX = target.x;

    if (kind === 'scaleIn') {
      const dur = resolveMotionDuration(MotionPresets.ScaleIn.duration, this.theme.reducedMotion);
      if (dur === 0) {
        target.setScale(1).setAlpha(1);
        return;
      }
      target.setScale(0.75).setAlpha(0.2);
      this.activeMotionTweens.push(
        this.scene.scene.tweens.add({
          targets: target,
          scaleX: 1,
          scaleY: 1,
          alpha: 1,
          duration: dur,
          ease: MotionPresets.ScaleIn.ease,
        }),
      );
      return;
    }

    if (kind === 'success') {
      const dur = resolveMotionDuration(
        MotionPresets.SuccessFeedback.duration,
        this.theme.reducedMotion,
      );
      if (dur === 0) {
        target.setScale(1);
        return;
      }
      target.setScale(1);
      this.activeMotionTweens.push(
        this.scene.scene.tweens.add({
          targets: target,
          scaleX: 1.14,
          scaleY: 1.14,
          duration: Math.round(dur * 0.45),
          yoyo: true,
          ease: MotionPresets.SuccessFeedback.ease,
        }),
      );
      return;
    }

    const dur = resolveMotionDuration(
      MotionPresets.ErrorFeedback.duration,
      this.theme.reducedMotion,
    );
    if (dur === 0) {
      return;
    }
    this.activeMotionTweens.push(
      this.scene.scene.tweens.add({
        targets: target,
        x: baseX + 10,
        duration: 50,
        yoyo: true,
        repeat: 2,
        ease: MotionPresets.ErrorFeedback.ease,
        onComplete: () => {
          target.setX(baseX);
        },
      }),
    );
  }

  private clearMotionTweens(): void {
    for (const tween of this.activeMotionTweens) {
      tween.stop();
    }
    this.activeMotionTweens = [];
  }

  private readonly handleResize = (): void => {
    this.renderAll();
  };

  private readonly handleShutdown = (): void => {
    this.clearMotionTweens();
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize);
    this.demoModal?.destroy();
    this.confirmDialog?.destroy();
    this.toast?.destroy();
  };
}
