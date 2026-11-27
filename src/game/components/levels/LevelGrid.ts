import Phaser from 'phaser';
import type { LevelId } from '../../../core';
import {
  Colors,
  DefaultGameTheme,
  hexToNumber,
  LevelCard,
  type GameTheme,
  type LevelCardStatus,
} from '../../../design-system';
import type { LevelSelectionLayout } from '../../layout/LevelSelectionLayout';
import type { LevelCardViewState } from '../../levels/LevelCardViewState';

export interface LevelGridConfig {
  readonly theme?: GameTheme;
  readonly onSelectLevel: (levelId: LevelId) => void;
  readonly onSelectLockedLevel: (levelId: LevelId) => void;
}

/**
 * Responsive level card grid rendering ONLY the active chapter's levels.
 * Supports arbitrary chapter sizes with bounded in-canvas vertical scrolling
 * when a chapter contains more rows than fit in the current viewport.
 */
export class LevelGrid extends Phaser.GameObjects.Container {
  private theme: GameTheme;
  private readonly onSelectLevel: (levelId: LevelId) => void;
  private readonly onSelectLockedLevel: (levelId: LevelId) => void;

  private readonly contentContainer: Phaser.GameObjects.Container;
  private readonly scrollbarGraphics: Phaser.GameObjects.Graphics;
  private maskShape?: Phaser.GameObjects.Graphics;
  private scrollMask?: Phaser.Display.Masks.GeometryMask;

  private readonly cardByLevelId = new Map<LevelId, LevelCard>();
  private renderedLevelIds: readonly LevelId[] = [];
  private latestCards: readonly LevelCardViewState[] = [];
  private accentHex: string = Colors.Brand.Primary;

  private gridLayout?: LevelSelectionLayout['grid'];
  private scrollY = 0;
  private wheelBound = false;
  private dragPointerId: number | null = null;
  private dragStartY = 0;
  private dragStartScrollY = 0;

  public constructor(scene: Phaser.Scene, config: LevelGridConfig) {
    super(scene, 0, 0);
    this.theme = config.theme ?? DefaultGameTheme;
    this.onSelectLevel = config.onSelectLevel;
    this.onSelectLockedLevel = config.onSelectLockedLevel;

    this.contentContainer = scene.add.container(0, 0);
    this.scrollbarGraphics = scene.add.graphics();
    this.add([this.contentContainer, this.scrollbarGraphics]);

    this.bindScrollInput();
    scene.add.existing(this);
  }

  public getColumns(): number {
    return this.gridLayout?.columns ?? 5;
  }

  public getCardByLevelId(levelId: LevelId): LevelCard | undefined {
    return this.cardByLevelId.get(levelId);
  }

  public applyLayout(gridLayout: LevelSelectionLayout['grid']): this {
    this.gridLayout = gridLayout;
    this.setPosition(gridLayout.x, gridLayout.y);
    this.scrollY = Math.max(0, Math.min(gridLayout.maxScrollY, this.scrollY));
    this.updateScrollMask(gridLayout);
    this.syncCardsToLayout();
    this.applyScrollPosition();
    return this;
  }

  public renderChapterLevels(
    cards: readonly LevelCardViewState[],
    accentHex: string,
    resetScroll = false,
  ): this {
    this.latestCards = cards;
    this.accentHex = accentHex;
    if (resetScroll) {
      this.scrollY = 0;
    }

    const sameLevelSet =
      cards.length === this.renderedLevelIds.length &&
      cards.every((c, idx) => c.levelId === this.renderedLevelIds[idx]);

    if (!sameLevelSet) {
      this.rebuildCards(cards);
    } else {
      this.updateExistingCards(cards);
    }

    this.syncCardsToLayout();
    this.ensureFocusedCardVisible(cards);
    this.applyScrollPosition();
    return this;
  }

  public setTheme(theme: GameTheme): this {
    this.theme = theme;
    for (const card of this.cardByLevelId.values()) {
      card.setTheme(theme);
    }
    return this;
  }

  private mapCardStatus(card: LevelCardViewState): LevelCardStatus {
    if (card.status === 'locked') {
      return 'locked';
    }
    if (card.isRecommended) {
      return 'current';
    }
    return card.status;
  }

  private rebuildCards(cards: readonly LevelCardViewState[]): void {
    this.contentContainer.removeAll(true);
    this.cardByLevelId.clear();

    const defaultW = this.gridLayout?.cardWidth ?? 108;
    const defaultH = this.gridLayout?.cardHeight ?? 116;

    for (const cardState of cards) {
      const showStars = cardState.status === 'completed' && cardState.bestStarRating !== null;
      const card = new LevelCard(this.scene, {
        x: 0,
        y: 0,
        width: defaultW,
        height: defaultH,
        levelNumber: cardState.levelNumber,
        metaText: cardState.constraintSummary,
        stars: cardState.bestStarRating ?? 0,
        showStars,
        status: this.mapCardStatus(cardState),
        selected: cardState.isSelected,
        focused: cardState.isFocused,
        accentColor: this.accentHex,
        theme: this.theme,
        onSelect: () => {
          this.onSelectLevel(cardState.levelId);
        },
        onLockedSelect: () => {
          this.onSelectLockedLevel(cardState.levelId);
        },
      });
      this.contentContainer.add(card);
      this.cardByLevelId.set(cardState.levelId, card);
    }

    this.renderedLevelIds = cards.map((c) => c.levelId);
  }

  private updateExistingCards(cards: readonly LevelCardViewState[]): void {
    for (const cardState of cards) {
      const card = this.cardByLevelId.get(cardState.levelId);
      if (card === undefined) {
        continue;
      }
      const showStars = cardState.status === 'completed' && cardState.bestStarRating !== null;
      card.setLevelNumber(cardState.levelNumber);
      card.setMetaText(cardState.constraintSummary);
      card.setAccentColor(this.accentHex);
      card.setLevelState(this.mapCardStatus(cardState), cardState.bestStarRating ?? 0, showStars);
      card.setSelected(cardState.isSelected);
      card.setFocused(cardState.isFocused);
    }
  }

  private syncCardsToLayout(): void {
    if (this.gridLayout === undefined) {
      return;
    }
    this.latestCards.forEach((cardState, idx) => {
      const card = this.cardByLevelId.get(cardState.levelId);
      const slot = this.gridLayout?.cards[idx];
      if (card === undefined || slot === undefined) {
        return;
      }
      card.setCardSize(slot.width, slot.height);
      card.setPosition(slot.x, slot.y);
    });
  }

  private ensureFocusedCardVisible(cards: readonly LevelCardViewState[]): void {
    if (!this.gridLayout?.scrollNeeded) {
      return;
    }
    const focusedIdx = cards.findIndex((c) => c.isFocused);
    if (focusedIdx < 0) {
      return;
    }
    const slot = this.gridLayout.cards[focusedIdx];
    if (slot === undefined) {
      return;
    }
    const cardTop = slot.y - slot.height / 2;
    const cardBottom = slot.y + slot.height / 2;
    if (cardTop < this.scrollY) {
      this.scrollY = Math.max(0, cardTop - 8);
    } else if (cardBottom > this.scrollY + this.gridLayout.height) {
      this.scrollY = Math.min(this.gridLayout.maxScrollY, cardBottom - this.gridLayout.height + 8);
    }
  }

  private updateScrollMask(gridLayout: LevelSelectionLayout['grid']): void {
    if (!gridLayout.scrollNeeded) {
      this.contentContainer.clearMask(false);
      this.scrollbarGraphics.clear();
      return;
    }

    if (this.maskShape === undefined) {
      this.maskShape = this.scene.make.graphics({ x: 0, y: 0 }, false);
      this.scrollMask = this.maskShape.createGeometryMask();
    }

    const pad = 8;
    this.maskShape.clear();
    this.maskShape.fillStyle(0xffffff, 1);
    this.maskShape.fillRect(
      gridLayout.x - pad,
      gridLayout.y - pad,
      gridLayout.width + pad * 2,
      gridLayout.height + pad * 2,
    );

    if (this.scrollMask !== undefined) {
      this.contentContainer.setMask(this.scrollMask);
    }
  }

  private applyScrollPosition(): void {
    if (this.gridLayout === undefined) {
      return;
    }
    this.scrollY = Math.max(0, Math.min(this.gridLayout.maxScrollY, this.scrollY));
    this.contentContainer.setY(-Math.round(this.scrollY));
    this.drawScrollbar();
  }

  private drawScrollbar(): void {
    this.scrollbarGraphics.clear();
    if (!this.gridLayout?.scrollNeeded) {
      return;
    }

    const trackX = this.gridLayout.width + 4;
    const trackH = this.gridLayout.height;
    const ratio = this.gridLayout.height / Math.max(1, this.gridLayout.contentHeight);
    const thumbH = Math.max(28, Math.round(trackH * ratio));
    const scrollProgress =
      this.gridLayout.maxScrollY > 0 ? this.scrollY / this.gridLayout.maxScrollY : 0;
    const thumbY = Math.round(scrollProgress * (trackH - thumbH));

    this.scrollbarGraphics.fillStyle(hexToNumber(Colors.Surface.Border), 0.35);
    this.scrollbarGraphics.fillRoundedRect(trackX, 0, 5, trackH, 2.5);
    this.scrollbarGraphics.fillStyle(hexToNumber(Colors.Brand.PrimaryLight), 0.85);
    this.scrollbarGraphics.fillRoundedRect(trackX, thumbY, 5, thumbH, 2.5);
  }

  private bindScrollInput(): void {
    if (this.wheelBound) {
      return;
    }
    this.wheelBound = true;
    this.scene.input.on(Phaser.Input.Events.POINTER_WHEEL, this.handleWheel);
    this.scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown);
    this.scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove);
    this.scene.input.on(Phaser.Input.Events.POINTER_UP, this.handlePointerUp);
  }

  private isPointerInsideGrid(pointer: Phaser.Input.Pointer): boolean {
    if (this.gridLayout === undefined) {
      return false;
    }
    return (
      pointer.x >= this.gridLayout.x &&
      pointer.x <= this.gridLayout.x + this.gridLayout.width &&
      pointer.y >= this.gridLayout.y &&
      pointer.y <= this.gridLayout.y + this.gridLayout.height
    );
  }

  private readonly handleWheel = (
    pointer: Phaser.Input.Pointer,
    _currentlyOver: Phaser.GameObjects.GameObject[],
    _deltaX: number,
    deltaY: number,
  ): void => {
    if (!this.gridLayout?.scrollNeeded) {
      return;
    }
    if (!this.isPointerInsideGrid(pointer)) {
      return;
    }
    this.scrollY += deltaY * 0.5;
    this.applyScrollPosition();
  };

  private readonly handlePointerDown = (pointer: Phaser.Input.Pointer): void => {
    if (!this.gridLayout?.scrollNeeded) {
      return;
    }
    if (!this.isPointerInsideGrid(pointer)) {
      return;
    }
    this.dragPointerId = pointer.id;
    this.dragStartY = pointer.y;
    this.dragStartScrollY = this.scrollY;
  };

  private readonly handlePointerMove = (pointer: Phaser.Input.Pointer): void => {
    if (this.dragPointerId !== pointer.id || this.gridLayout === undefined) {
      return;
    }
    const delta = this.dragStartY - pointer.y;
    if (Math.abs(delta) > 6) {
      this.scrollY = this.dragStartScrollY + delta;
      this.applyScrollPosition();
    }
  };

  private readonly handlePointerUp = (pointer: Phaser.Input.Pointer): void => {
    if (this.dragPointerId === pointer.id) {
      this.dragPointerId = null;
    }
  };

  public override destroy(fromScene?: boolean): void {
    if (this.wheelBound) {
      this.scene.input.off(Phaser.Input.Events.POINTER_WHEEL, this.handleWheel);
      this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown);
      this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove);
      this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.handlePointerUp);
      this.wheelBound = false;
    }
    this.contentContainer.clearMask(false);
    this.scrollMask?.destroy();
    this.scrollMask = undefined;
    this.maskShape?.destroy();
    this.maskShape = undefined;
    this.cardByLevelId.clear();
    super.destroy(fromScene);
  }
}
