import Phaser from 'phaser';
import {
  Colors,
  createGameTheme,
  createTextStyle,
  DefaultGameTheme,
  Dimens,
  GameCard,
  GameHeader,
  hexToNumber,
  IconButton,
  MatchCounter,
  OutlineButton,
  PrimaryButton,
  resolveLayoutContext,
  SecondaryButton,
  Toast,
  Typography,
  type BottleColorId,
  type GameTheme,
} from '../../design-system';
import type { GamePlatform } from '../../platform/contracts/GamePlatform';
import { BOTTLE_CATALOG, BOTTLE_IDS, getBottleMetadata } from '../assets/BottleCatalog';
import { BottleSprite, type BottleVisualState } from '../components/bottles/BottleSprite';
import { BottleRack } from '../components/environment/BottleRack';
import { GameBackground } from '../components/environment/GameBackground';
import { HiddenSequenceRack } from '../components/environment/HiddenSequenceRack';
import { SCENE_KEYS } from './sceneKeys';

export type AssetShowcasePageId = 'environment' | 'collection' | 'states' | 'rack';

interface TabSpec {
  readonly id: AssetShowcasePageId;
  readonly label: string;
}

const ASSET_TABS: readonly TabSpec[] = [
  { id: 'environment', label: 'Environment' },
  { id: 'collection', label: '10 Bottles' },
  { id: 'states', label: 'States' },
  { id: 'rack', label: 'Rack & Hidden' },
];

const RACK_COUNT_PRESETS: readonly number[] = [3, 4, 5, 6, 8, 10];

export function parseAssetShowcasePageParam(raw: string | null): AssetShowcasePageId {
  if (raw === null) {
    return 'environment';
  }
  const normalized = raw.toLowerCase();
  const found = ASSET_TABS.find((tab) => tab.id === normalized);
  return found?.id ?? 'environment';
}

export class AssetShowcaseScene extends Phaser.Scene {
  private readonly platform: GamePlatform;
  private theme: GameTheme = DefaultGameTheme;

  // Interactive showcase state preserved across resizes
  private activePage: AssetShowcasePageId;
  private reducedMotion = false;
  private selectedEnvBottleId: BottleColorId | null = 'purple';
  private demoMatchCount = 3;
  private rackBottleCount = 10;
  private rackShowEmptySlot = false;
  private rackHighlightSlot = false;

  private background?: GameBackground;
  private header?: GameHeader;
  private tabBar?: Phaser.GameObjects.Container;
  private contentStage?: Phaser.GameObjects.Container;
  private toast?: Toast;

  public constructor(platform: GamePlatform, initialPage: AssetShowcasePageId = 'environment') {
    super({ key: SCENE_KEYS.ASSET_SHOWCASE });
    this.platform = platform;
    this.activePage = initialPage;
  }

  public create(): void {
    this.background = new GameBackground(this, { depth: -10 });

    this.header = new GameHeader(this, {
      title: 'Asset Showcase',
      subtitle: 'Bottles, shelves & visual environment',
      onBack: () => {
        this.scene.start(SCENE_KEYS.HOME);
      },
      trailingAction: {
        icon: 'sparkles',
        onClick: () => {
          this.reducedMotion = !this.reducedMotion;
          this.theme = createGameTheme({ reducedMotion: this.reducedMotion });
          this.header?.setTheme(this.theme);
          this.toast?.setTheme(this.theme);
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

    this.renderAll();

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown);

    this.platform.notifyGameReady();
  }

  private renderAll(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const ctx = resolveLayoutContext(width, height);

    this.background?.resize(ctx.width, ctx.height);

    const headerHeight = ctx.isCompact ? Dimens.HeaderHeightCompact : Dimens.HeaderHeight;
    this.header?.resize(ctx.width, headerHeight);
    this.header?.setPosition(0, 0);

    const tabBarHeight = this.buildTabBar(ctx.width, headerHeight);
    this.buildContentStage(ctx.width, ctx.height, headerHeight + tabBarHeight);
    this.toast?.resize(ctx.width, ctx.height);
  }

  private buildTabBar(viewportWidth: number, topY: number): number {
    this.tabBar?.destroy();
    const bar = this.add.container(0, topY);
    this.tabBar = bar;

    const compact = viewportWidth < 600;
    const tabHeight = 42;
    const barHeight = compact ? 98 : 58;
    const bg = this.add.graphics();
    bg.fillStyle(hexToNumber(Colors.Surface.Background), 0.72);
    bg.fillRect(0, 0, viewportWidth, barHeight);
    bg.lineStyle(Dimens.BorderThin, hexToNumber(Colors.Surface.Border), 0.45);
    bg.beginPath();
    bg.moveTo(0, barHeight);
    bg.lineTo(viewportWidth, barHeight);
    bg.strokePath();
    bar.add(bg);

    const cols = compact ? 2 : ASSET_TABS.length;
    const padX = compact ? Dimens.Space12 : Dimens.Space24;
    const gap = Dimens.Space8;
    const totalW = Math.min(760, viewportWidth - padX * 2);
    const tabW = Math.floor((totalW - gap * (cols - 1)) / cols);
    const startX = (viewportWidth - (tabW * cols + gap * (cols - 1))) / 2;

    ASSET_TABS.forEach((tab, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      const cx = startX + col * (tabW + gap) + tabW / 2;
      const cy = compact ? 26 + row * (tabHeight + Dimens.Space6) : barHeight / 2;
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

    return barHeight;
  }

  private selectPage(page: AssetShowcasePageId): void {
    if (this.activePage === page) {
      return;
    }
    this.activePage = page;
    this.renderAll();
  }

  private buildContentStage(
    viewportWidth: number,
    viewportHeight: number,
    topOffset: number,
  ): void {
    this.contentStage?.destroy();
    const stage = this.add.container(0, 0);
    this.contentStage = stage;

    const availW = Math.max(280, viewportWidth - Dimens.Space24);
    const availH = Math.max(240, viewportHeight - topOffset - Dimens.Space16);
    const centerX = viewportWidth / 2;
    const centerY = topOffset + availH / 2;
    const isPortrait = viewportWidth < viewportHeight;

    switch (this.activePage) {
      case 'environment':
        this.renderEnvironmentPreview(stage, centerX, topOffset, availW, availH, isPortrait);
        break;
      case 'collection':
        this.renderBottleCollection(stage, centerX, centerY, availW, availH, isPortrait);
        break;
      case 'states':
        this.renderInteractionStates(stage, centerX, centerY, availW, availH, isPortrait);
        break;
      case 'rack':
        this.renderRackDemo(stage, centerX, topOffset, availW, availH, isPortrait);
        break;
    }
  }

  /**
   * Full visual environment preview: background, demo MatchCounter, 10 bottles on wooden shelf,
   * and concealed 10-slot hidden compartment. Demo match count is completely independent of bottle positions.
   */
  private renderEnvironmentPreview(
    stage: Phaser.GameObjects.Container,
    centerX: number,
    topOffset: number,
    availW: number,
    availH: number,
    isPortrait: boolean,
  ): void {
    const counterWidth = Math.min(isPortrait ? 320 : 380, availW - 120);
    const counterY = topOffset + 62;

    const matchCounter = new MatchCounter(this, {
      x: centerX,
      y: counterY,
      width: counterWidth,
      label: 'CORRECT MATCHES · DEMO',
      matched: this.demoMatchCount,
      total: 10,
      theme: this.theme,
    });

    const decBtn = new IconButton(this, {
      x: centerX - counterWidth / 2 - 34,
      y: counterY,
      icon: 'minus',
      variant: 'surface',
      theme: this.theme,
      onClick: () => {
        this.demoMatchCount = Math.max(0, this.demoMatchCount - 1);
        matchCounter.setMatches(this.demoMatchCount, 10, true);
      },
    });

    const incBtn = new IconButton(this, {
      x: centerX + counterWidth / 2 + 34,
      y: counterY,
      icon: 'plus',
      variant: 'primary',
      theme: this.theme,
      onClick: () => {
        this.demoMatchCount = Math.min(10, this.demoMatchCount + 1);
        matchCounter.setMatches(this.demoMatchCount, 10, true);
      },
    });

    stage.add([matchCounter, decBtn, incBtn]);

    const rackMaxW = Math.min(1120, availW);
    const rackAvailableH = isPortrait ? Math.max(220, availH * 0.46) : Math.max(170, availH * 0.44);

    const rack = new BottleRack(this, {
      x: centerX,
      y: 0,
      bottleCount: 10,
      availableWidth: rackMaxW,
      availableHeight: rackAvailableH,
      aspectRatio: availW / availH,
      maxBottleWidth: isPortrait ? 78 : 96,
      maxBottleHeight: isPortrait ? 156 : 192,
    });

    const layout = rack.getLayout();
    const hiddenRows: 1 | 2 = layout.rows === 2 ? 2 : 1;
    const hiddenRack = new HiddenSequenceRack(this, {
      x: centerX,
      y: 0,
      slotCount: 10,
      availableWidth: Math.min(rackMaxW, layout.rackWidth),
      rows: hiddenRows,
      showLabel: true,
      label: 'SECRET SEQUENCE',
      theme: this.theme,
    });

    const hiddenBounds = hiddenRack.getCompartmentBounds();
    const rackAndHiddenGap = isPortrait ? Dimens.Space20 : Dimens.Space24;
    const remainingTop = counterY + 62;
    const remainingH = Math.max(200, topOffset + availH - remainingTop);
    const totalBlockH = layout.rackHeight + rackAndHiddenGap + hiddenBounds.height + 28;
    const blockStartY = remainingTop + Math.max(12, (remainingH - totalBlockH) / 2);

    const rackCenterY = blockStartY + layout.rackHeight / 2;
    rack.setPosition(centerX, rackCenterY);

    const hiddenCenterY =
      rackCenterY + layout.rackHeight / 2 + rackAndHiddenGap + hiddenBounds.height / 2;
    hiddenRack.setPosition(centerX, hiddenCenterY);

    stage.add([hiddenRack, rack]);

    const bottleSprites: BottleSprite[] = [];

    BOTTLE_IDS.forEach((bottleId, slotIndex) => {
      const slotPos = rack.getSlotWorldPosition(slotIndex);
      rack.setSlotOccupied(slotIndex, true);

      const sprite = new BottleSprite(this, {
        bottleId,
        x: slotPos.x,
        y: slotPos.y,
        width: layout.bottleWidth,
        height: layout.bottleHeight,
        selected: this.selectedEnvBottleId === bottleId,
        theme: this.theme,
        onInteract: (clickedId) => {
          this.selectedEnvBottleId = this.selectedEnvBottleId === clickedId ? null : clickedId;
          for (const item of bottleSprites) {
            item.setSelected(item.getBottleId() === this.selectedEnvBottleId, true);
          }
          const meta = getBottleMetadata(clickedId);
          this.toast?.show({
            message:
              this.selectedEnvBottleId === clickedId
                ? `Selected ${meta.accessibleLabel}`
                : `Deselected ${meta.displayName} bottle`,
            variant: 'info',
            durationMs: 1600,
          });
        },
      });
      bottleSprites.push(sprite);
      stage.add(sprite);
    });
  }

  /** Displays all 10 bottles with names, hex tokens, and accessibility symbols. */
  private renderBottleCollection(
    stage: Phaser.GameObjects.Container,
    centerX: number,
    centerY: number,
    availW: number,
    availH: number,
    isPortrait: boolean,
  ): void {
    const virtualW = isPortrait ? 500 : 1060;
    const virtualH = isPortrait ? 690 : 510;
    const scale = Math.min(1.1, availW / virtualW, availH / virtualH);

    const group = this.add.container(centerX, centerY);
    group.setScale(scale);
    stage.add(group);

    const cols = isPortrait ? 2 : 5;
    const rows = Math.ceil(BOTTLE_CATALOG.length / cols);
    const cardW = isPortrait ? 232 : 196;
    const cardH = isPortrait ? 124 : 236;
    const gapX = 14;
    const gapY = 14;

    const totalW = cols * cardW + (cols - 1) * gapX;
    const totalH = rows * cardH + (rows - 1) * gapY;
    const startX = -totalW / 2 + cardW / 2;
    const startY = -totalH / 2 + cardH / 2;

    BOTTLE_CATALOG.forEach((entry, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = startX + col * (cardW + gapX);
      const y = startY + row * (cardH + gapY);

      const card = new GameCard(this, {
        x,
        y,
        width: cardW,
        height: cardH,
        elevation: 'low',
        theme: this.theme,
      });

      if (isPortrait) {
        const bottle = new BottleSprite(this, {
          bottleId: entry.id,
          x: -cardW / 2 + 44,
          y: 44,
          width: 44,
          height: 88,
          interactive: false,
          theme: this.theme,
        });
        const name = this.add
          .text(
            -cardW / 2 + 82,
            -22,
            entry.displayName,
            createTextStyle(Typography.TitleMedium, { color: Colors.Text.Primary }),
          )
          .setOrigin(0, 0.5);
        const sym = this.add
          .text(
            -cardW / 2 + 82,
            4,
            `Symbol: ${entry.symbolLabel}`,
            createTextStyle(Typography.LabelSmall, { color: Colors.Brand.PrimaryLight }),
          )
          .setOrigin(0, 0.5);
        const hex = this.add
          .text(
            -cardW / 2 + 82,
            26,
            entry.colorHex,
            createTextStyle(Typography.LabelSmall, { color: Colors.Text.Secondary, scale: 0.9 }),
          )
          .setOrigin(0, 0.5);
        card.addContent([bottle, name, sym, hex]);
      } else {
        const bottle = new BottleSprite(this, {
          bottleId: entry.id,
          x: 0,
          y: 34,
          width: 68,
          height: 136,
          interactive: false,
          theme: this.theme,
        });
        const name = this.add
          .text(
            0,
            62,
            entry.displayName,
            createTextStyle(Typography.TitleMedium, {
              color: Colors.Text.Primary,
              align: 'center',
            }),
          )
          .setOrigin(0.5);
        const meta = this.add
          .text(
            0,
            88,
            `${entry.symbolLabel} · ${entry.colorHex}`,
            createTextStyle(Typography.LabelSmall, {
              color: Colors.Text.Secondary,
              align: 'center',
              scale: 0.88,
            }),
          )
          .setOrigin(0.5);
        card.addContent([bottle, name, meta]);
      }

      group.add(card);
    });
  }

  /** Demonstrates all 6 BottleSprite interaction states side-by-side. */
  private renderInteractionStates(
    stage: Phaser.GameObjects.Container,
    centerX: number,
    centerY: number,
    availW: number,
    availH: number,
    isPortrait: boolean,
  ): void {
    const virtualW = isPortrait ? 500 : 1060;
    const virtualH = isPortrait ? 690 : 490;
    const scale = Math.min(1.1, availW / virtualW, availH / virtualH);

    const group = this.add.container(centerX, centerY);
    group.setScale(scale);
    stage.add(group);

    const stateItems: readonly {
      readonly state: BottleVisualState;
      readonly bottleId: BottleColorId;
      readonly title: string;
      readonly caption: string;
    }[] = [
      { state: 'default', bottleId: 'red', title: 'Default', caption: 'Resting on shelf' },
      { state: 'hovered', bottleId: 'blue', title: 'Hovered', caption: 'Subtle lift + scale' },
      { state: 'pressed', bottleId: 'green', title: 'Pressed', caption: 'Tactile press dip' },
      { state: 'selected', bottleId: 'purple', title: 'Selected', caption: 'Gold outline + lift' },
      { state: 'swapping', bottleId: 'orange', title: 'Swapping', caption: 'Elevated + trail' },
      { state: 'disabled', bottleId: 'teal', title: 'Disabled', caption: 'Muted, no clicks' },
    ];

    const cols = isPortrait ? 2 : 3;
    const rows = Math.ceil(stateItems.length / cols);
    const cardW = isPortrait ? 232 : 326;
    const cardH = isPortrait ? 210 : 226;
    const gapX = 16;
    const gapY = 16;

    const totalW = cols * cardW + (cols - 1) * gapX;
    const totalH = rows * cardH + (rows - 1) * gapY;
    const startX = -totalW / 2 + cardW / 2;
    const startY = -totalH / 2 + cardH / 2;

    stateItems.forEach((item, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = startX + col * (cardW + gapX);
      const y = startY + row * (cardH + gapY);

      const card = new GameCard(this, {
        x,
        y,
        width: cardW,
        height: cardH,
        elevation: 'low',
        theme: this.theme,
      });

      const bottle = new BottleSprite(this, {
        bottleId: item.bottleId,
        x: 0,
        y: 48,
        width: 58,
        height: 116,
        enabled: item.state !== 'disabled',
        interactive: item.state === 'disabled' || item.state === 'default',
        theme: this.theme,
        onInteract: () => {
          this.toast?.show({
            message: `Interacted with ${item.title} bottle`,
            variant: 'info',
            durationMs: 1500,
          });
        },
      });
      bottle.setForcedVisualState(item.state, false);

      const title = this.add
        .text(
          0,
          72,
          item.title,
          createTextStyle(Typography.TitleMedium, {
            color: Colors.Text.Primary,
            align: 'center',
          }),
        )
        .setOrigin(0.5);

      const caption = this.add
        .text(
          0,
          94,
          item.caption,
          createTextStyle(Typography.LabelSmall, {
            color: Colors.Text.Secondary,
            align: 'center',
            scale: 0.9,
          }),
        )
        .setOrigin(0.5);

      card.addContent([bottle, title, caption]);
      group.add(card);
    });
  }

  /** Interactive BottleRack + HiddenSequenceRack count switcher (3, 4, 5, 6, 8, 10). */
  private renderRackDemo(
    stage: Phaser.GameObjects.Container,
    centerX: number,
    topOffset: number,
    availW: number,
    availH: number,
    isPortrait: boolean,
  ): void {
    const controlsY = topOffset + 34;
    const btnGap = 8;
    const presetBtnW = isPortrait ? 48 : 66;
    const totalPresetW =
      RACK_COUNT_PRESETS.length * presetBtnW + (RACK_COUNT_PRESETS.length - 1) * btnGap;
    const presetStartX = centerX - totalPresetW / 2 + presetBtnW / 2;

    RACK_COUNT_PRESETS.forEach((count, index) => {
      const x = presetStartX + index * (presetBtnW + btnGap);
      const isSelected = count === this.rackBottleCount;
      const btn = isSelected
        ? new SecondaryButton(this, {
            x,
            y: controlsY,
            width: presetBtnW,
            height: 44,
            label: String(count),
            theme: this.theme,
            onClick: () => {
              this.rackBottleCount = count;
              this.renderAll();
            },
          })
        : new OutlineButton(this, {
            x,
            y: controlsY,
            width: presetBtnW,
            height: 44,
            label: String(count),
            theme: this.theme,
            onClick: () => {
              this.rackBottleCount = count;
              this.renderAll();
            },
          });
      stage.add(btn);
    });

    const toggleRowY = controlsY + 54;
    const emptyBtn = new OutlineButton(this, {
      x: centerX - 96,
      y: toggleRowY,
      width: 180,
      height: 44,
      label: this.rackShowEmptySlot ? 'Fill Last Slot' : 'Show Empty Slot',
      theme: this.theme,
      onClick: () => {
        this.rackShowEmptySlot = !this.rackShowEmptySlot;
        this.renderAll();
      },
    });
    const highlightBtn = new OutlineButton(this, {
      x: centerX + 96,
      y: toggleRowY,
      width: 180,
      height: 44,
      label: this.rackHighlightSlot ? 'Clear Highlight' : 'Highlight Slot 1',
      theme: this.theme,
      onClick: () => {
        this.rackHighlightSlot = !this.rackHighlightSlot;
        this.renderAll();
      },
    });
    stage.add([emptyBtn, highlightBtn]);

    const rackMaxW = Math.min(1080, availW);
    const rackAvailableH = isPortrait ? Math.max(200, availH * 0.44) : Math.max(170, availH * 0.44);

    const rack = new BottleRack(this, {
      x: centerX,
      y: 0,
      bottleCount: this.rackBottleCount,
      availableWidth: rackMaxW,
      availableHeight: rackAvailableH,
      aspectRatio: availW / availH,
      maxBottleWidth: isPortrait ? 82 : 100,
      maxBottleHeight: isPortrait ? 164 : 200,
    });

    const layout = rack.getLayout();
    const hiddenRows: 1 | 2 = layout.rows === 2 ? 2 : 1;
    const hiddenRack = new HiddenSequenceRack(this, {
      x: centerX,
      y: 0,
      slotCount: this.rackBottleCount,
      availableWidth: Math.min(rackMaxW, layout.rackWidth),
      rows: hiddenRows,
      showLabel: true,
      label: `SECRET SEQUENCE · ${String(this.rackBottleCount)} SLOTS (${String(layout.rows)} ROW${layout.rows > 1 ? 'S' : ''})`,
      theme: this.theme,
    });

    const hiddenBounds = hiddenRack.getCompartmentBounds();
    const gap = isPortrait ? Dimens.Space16 : Dimens.Space24;
    const remainingTop = toggleRowY + 40;
    const remainingH = Math.max(200, topOffset + availH - remainingTop);
    const totalBlockH = layout.rackHeight + gap + hiddenBounds.height + 28;
    const blockStartY = remainingTop + Math.max(10, (remainingH - totalBlockH) / 2);

    const rackCenterY = blockStartY + layout.rackHeight / 2;
    rack.setPosition(centerX, rackCenterY);

    const hiddenCenterY = rackCenterY + layout.rackHeight / 2 + gap + hiddenBounds.height / 2;
    hiddenRack.setPosition(centerX, hiddenCenterY);

    stage.add([hiddenRack, rack]);

    for (let i = 0; i < this.rackBottleCount; i += 1) {
      const isLastEmpty = this.rackShowEmptySlot && i === this.rackBottleCount - 1;
      rack.setSlotOccupied(i, !isLastEmpty);
      rack.setSlotHighlighted(i, this.rackHighlightSlot && i === 0);

      if (isLastEmpty) {
        continue;
      }

      const bottleId = BOTTLE_IDS[i];
      if (bottleId === undefined) {
        continue;
      }
      const pos = rack.getSlotWorldPosition(i);
      const sprite = new BottleSprite(this, {
        bottleId,
        x: pos.x,
        y: pos.y,
        width: layout.bottleWidth,
        height: layout.bottleHeight,
        theme: this.theme,
        onInteract: (clickedId) => {
          const meta = getBottleMetadata(clickedId);
          this.toast?.show({
            message: `Slot ${String(i + 1)}: ${meta.accessibleLabel}`,
            variant: 'info',
            durationMs: 1400,
          });
        },
      });
      stage.add(sprite);
    }
  }

  private readonly handleResize = (): void => {
    this.renderAll();
  };

  private readonly handleShutdown = (): void => {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize);
    this.toast?.destroy();
  };
}
