import Phaser from 'phaser';
import { APP_METADATA } from '../../config/appConfig';
import { ALL_DIFFICULTY_DEFINITIONS, type DifficultyId } from '../../core';
import {
  Colors,
  createTextStyle,
  DefaultGameTheme,
  Dimens,
  GameCard,
  hexToNumber,
  lightenHex,
  OutlineButton,
  PrimaryButton,
  SecondaryButton,
  Typography,
} from '../../design-system';
import type { GamePlatform } from '../../platform/contracts/GamePlatform';
import { GameBackground } from '../components/environment/GameBackground';
import type { GameplaySceneData } from '../gameplay/GameplaySceneData';
import { SCENE_KEYS } from './sceneKeys';

interface BottleSpec {
  readonly offsetX: number;
  readonly offsetY: number;
  readonly angleDeg: number;
  readonly bodyColor: number;
  readonly labelColor: number;
}

const EMBLEM_BOTTLES: readonly BottleSpec[] = [
  {
    offsetX: -40,
    offsetY: 2,
    angleDeg: -11,
    bodyColor: hexToNumber(Colors.Bottle.Red),
    labelColor: hexToNumber(lightenHex(Colors.Bottle.Red, 0.2)),
  },
  {
    offsetX: 0,
    offsetY: 0,
    angleDeg: 0,
    bodyColor: hexToNumber(Colors.Brand.PrimaryLight),
    labelColor: hexToNumber(lightenHex(Colors.Brand.PrimaryLight, 0.2)),
  },
  {
    offsetX: 40,
    offsetY: 2,
    angleDeg: 11,
    bodyColor: hexToNumber(Colors.Bottle.Green),
    labelColor: hexToNumber(lightenHex(Colors.Bottle.Green, 0.2)),
  },
];

export class HomeScene extends Phaser.Scene {
  private readonly platform: GamePlatform;
  private selectedDifficulty: DifficultyId = 'normal';

  private background?: GameBackground;
  private contentContainer?: Phaser.GameObjects.Container;
  private footerText?: Phaser.GameObjects.Text;

  public constructor(platform: GamePlatform) {
    super({ key: SCENE_KEYS.HOME });
    this.platform = platform;
  }

  public create(): void {
    this.cameras.main.setBackgroundColor(hexToNumber(Colors.Surface.Background));
    this.background = new GameBackground(this, { depth: -10 });

    this.footerText = this.add
      .text(
        0,
        0,
        APP_METADATA.studioLabel,
        createTextStyle(Typography.LabelSmall, {
          color: Colors.Text.Disabled,
          align: 'center',
        }),
      )
      .setOrigin(0.5, 1);

    this.rebuildView(this.scale.width, this.scale.height);

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown);

    this.platform.notifyGameReady();
  }

  private rebuildView(width: number, height: number): void {
    const safeW = Math.max(300, width);
    const safeH = Math.max(300, height);
    const isPortrait = safeW < safeH;

    this.background?.resize(safeW, safeH);
    this.contentContainer?.destroy();

    const virtualW = isPortrait ? 460 : 820;
    const virtualH = isPortrait ? 700 : 560;
    const availW = safeW - Dimens.Space32;
    const availH = safeH - Dimens.Space64;
    const scale = Math.min(1.1, availW / virtualW, availH / virtualH);

    const container = this.add.container(safeW / 2, safeH / 2 - 12 * scale);
    container.setScale(scale);
    this.contentContainer = container;

    const emblem = this.buildEmblem();
    emblem.setPosition(0, isPortrait ? -246 : -190);

    const titleText = this.add
      .text(
        0,
        isPortrait ? -144 : -92,
        APP_METADATA.title,
        createTextStyle(Typography.HeadlineLarge, {
          color: Colors.Text.Primary,
          align: 'center',
        }),
      )
      .setOrigin(0.5);

    const subtitleText = this.add
      .text(
        0,
        isPortrait ? -96 : -44,
        APP_METADATA.buildLabel,
        createTextStyle(Typography.BodyMedium, {
          color: Colors.Text.Secondary,
          align: 'center',
        }),
      )
      .setOrigin(0.5);

    const selectorCard = this.buildDifficultySelector(isPortrait);
    selectorCard.setPosition(0, isPortrait ? 78 : 74);

    const playButton = new PrimaryButton(this, {
      x: 0,
      y: isPortrait ? 268 : 226,
      width: isPortrait ? 320 : 280,
      height: Dimens.ButtonHeightLarge,
      label: 'Play Puzzle',
      icon: 'play',
      theme: DefaultGameTheme,
      onClick: () => {
        this.launchSelectedDifficulty();
      },
    });

    container.add([emblem, titleText, subtitleText, selectorCard, playButton]);

    if (this.footerText !== undefined) {
      this.footerText.setPosition(safeW / 2, safeH - Math.max(16, 22 * scale));
      this.footerText.setScale(Math.max(0.8, Math.min(1, scale)));
    }
  }

  private buildDifficultySelector(isPortrait: boolean): GameCard {
    const cols = isPortrait ? 2 : 3;
    const rows = Math.ceil(ALL_DIFFICULTY_DEFINITIONS.length / cols);
    const btnW = isPortrait ? 184 : 210;
    const btnH = 54;
    const gapX = Dimens.Space12;
    const gapY = Dimens.Space12;

    const gridW = cols * btnW + (cols - 1) * gapX;
    const gridH = rows * btnH + (rows - 1) * gapY;
    const cardW = gridW + Dimens.Space40;
    const cardH = gridH + 74;

    const card = new GameCard(this, {
      width: cardW,
      height: cardH,
      elevation: 'low',
      theme: DefaultGameTheme,
    });

    const heading = this.add
      .text(
        0,
        -cardH / 2 + 28,
        'SELECT DIFFICULTY',
        createTextStyle(Typography.LabelSmall, {
          color: Colors.Text.Secondary,
          align: 'center',
        }),
      )
      .setOrigin(0.5);
    card.addContent(heading);

    const startX = -gridW / 2 + btnW / 2;
    const startY = -gridH / 2 + btnH / 2 + 16;

    ALL_DIFFICULTY_DEFINITIONS.forEach((def, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = startX + col * (btnW + gapX);
      const y = startY + row * (btnH + gapY);
      const label = `${def.displayName} (${String(def.bottleCount)})`;
      const isSelected = def.id === this.selectedDifficulty;

      const button = isSelected
        ? new SecondaryButton(this, {
            x,
            y,
            width: btnW,
            height: btnH,
            label,
            theme: DefaultGameTheme,
            onClick: () => {
              this.selectDifficulty(def.id);
            },
          })
        : new OutlineButton(this, {
            x,
            y,
            width: btnW,
            height: btnH,
            label,
            theme: DefaultGameTheme,
            onClick: () => {
              this.selectDifficulty(def.id);
            },
          });

      card.addContent(button);
    });

    return card;
  }

  private selectDifficulty(difficulty: DifficultyId): void {
    if (this.selectedDifficulty === difficulty) {
      return;
    }
    this.selectedDifficulty = difficulty;
    this.rebuildView(this.scale.width, this.scale.height);
  }

  private launchSelectedDifficulty(): void {
    const sceneData: GameplaySceneData = {
      difficulty: this.selectedDifficulty,
    };
    this.scene.start(SCENE_KEYS.GAME, sceneData);
  }

  private buildEmblem(): Phaser.GameObjects.Container {
    const emblem = this.add.container(0, 0);

    const backdrop = this.add.graphics();
    backdrop.fillStyle(hexToNumber(Colors.Surface.Surface), 1);
    backdrop.fillCircle(0, 0, 72);
    emblem.add(backdrop);

    for (const spec of EMBLEM_BOTTLES) {
      emblem.add(this.createBottleGraphic(spec));
    }

    return emblem;
  }

  private createBottleGraphic(spec: BottleSpec): Phaser.GameObjects.Graphics {
    const graphics = this.add.graphics({ x: spec.offsetX, y: spec.offsetY });
    graphics.setAngle(spec.angleDeg);
    graphics.setScale(0.84);

    graphics.fillStyle(spec.bodyColor, 1);
    graphics.fillRoundedRect(-20, -14, 40, 74, 10);
    graphics.fillTriangle(-20, -10, 20, -10, 9, -30);
    graphics.fillTriangle(-20, -10, -9, -30, 9, -30);
    graphics.fillRoundedRect(-8, -56, 16, 30, 4);

    graphics.fillStyle(hexToNumber(Colors.Text.Primary), 1);
    graphics.fillRoundedRect(-9, -68, 18, 13, 3);

    graphics.fillStyle(spec.labelColor, 0.9);
    graphics.fillRoundedRect(-12, 6, 24, 30, 4);

    return graphics;
  }

  private readonly handleResize = (gameSize: Phaser.Structs.Size): void => {
    this.rebuildView(gameSize.width, gameSize.height);
  };

  private readonly handleShutdown = (): void => {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize);
  };
}
