import Phaser from 'phaser';
import type { CounterDemoExample } from '../../../core';
import {
  Colors,
  createTextStyle,
  DefaultGameTheme,
  Dimens,
  drawElevatedSurface,
  hexToNumber,
  OutlineButton,
  PrimaryButton,
  SemanticShapes,
  Typography,
  type GameTheme,
} from '../../../design-system';
import type { TutorialRectBounds } from '../../layout/TutorialLayout';
import type { TutorialViewState } from '../../tutorial/TutorialViewState';

export interface TutorialInstructionPanelConfig {
  readonly theme?: GameTheme;
  readonly onPrimaryAction: () => void;
  readonly onSecondaryAction: () => void;
}

/**
 * Reusable inline instruction panel anchored below the gameplay board.
 * Displays concise step title, 1–2 sentence guidance, validated MatchCalculator
 * outcome pills during Stage 4, gentle hint copy, and optional action buttons.
 */
export class TutorialInstructionPanel extends Phaser.GameObjects.Container {
  private theme: GameTheme;
  private panelWidth = 640;
  private panelHeight = 112;

  private readonly surfaceGraphics: Phaser.GameObjects.Graphics;
  private readonly pillsGraphics: Phaser.GameObjects.Graphics;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly descriptionText: Phaser.GameObjects.Text;
  private readonly hintText: Phaser.GameObjects.Text;
  private readonly pillsContainer: Phaser.GameObjects.Container;
  private readonly primaryButton: PrimaryButton;
  private readonly secondaryButton: OutlineButton;

  private lastState: TutorialViewState | null = null;
  private lastPillsSignature = '';

  public constructor(scene: Phaser.Scene, config: TutorialInstructionPanelConfig) {
    super(scene, 0, 0);

    this.theme = config.theme ?? DefaultGameTheme;
    this.setDepth(520);

    this.surfaceGraphics = scene.add.graphics();
    this.pillsGraphics = scene.add.graphics();
    this.pillsContainer = scene.add.container(0, 0);

    this.titleText = scene.add
      .text(
        0,
        0,
        '',
        createTextStyle(Typography.TitleLarge, {
          color: Colors.Brand.Secondary,
          align: 'center',
        }),
      )
      .setOrigin(0.5);

    this.descriptionText = scene.add
      .text(
        0,
        0,
        '',
        createTextStyle(Typography.BodySmall, {
          color: Colors.Text.Primary,
          align: 'center',
        }),
      )
      .setOrigin(0.5);

    this.hintText = scene.add
      .text(
        0,
        0,
        '',
        createTextStyle(Typography.LabelSmall, {
          color: Colors.Brand.Secondary,
          align: 'center',
          scale: 0.88,
        }),
      )
      .setOrigin(0.5)
      .setVisible(false);

    this.primaryButton = new PrimaryButton(scene, {
      label: "Let's try",
      width: 170,
      height: Dimens.ButtonHeightSmall,
      theme: this.theme,
      onClick: config.onPrimaryAction,
    });
    this.primaryButton.setVisible(false);

    this.secondaryButton = new OutlineButton(scene, {
      label: 'Demo swap',
      width: 146,
      height: Dimens.ButtonHeightSmall,
      theme: this.theme,
      onClick: config.onSecondaryAction,
    });
    this.secondaryButton.setVisible(false);

    this.add([
      this.surfaceGraphics,
      this.pillsGraphics,
      this.pillsContainer,
      this.titleText,
      this.descriptionText,
      this.hintText,
      this.secondaryButton,
      this.primaryButton,
    ]);

    scene.add.existing(this);
  }

  public applyBounds(bounds: TutorialRectBounds): this {
    this.panelWidth = Math.max(256, bounds.width);
    this.panelHeight = Math.max(64, bounds.height);
    this.setPosition(
      Math.round(bounds.x + bounds.width / 2),
      Math.round(bounds.y + bounds.height / 2),
    );
    this.layoutPanel();
    return this;
  }

  public updateFromState(state: TutorialViewState): this {
    this.lastState = state;
    const visible =
      state.stage !== 'completed' && state.stage !== 'skipped' && state.overlayMode === 'none';
    this.setVisible(visible);
    if (!visible) {
      return this;
    }

    this.titleText.setText(state.title);
    this.descriptionText.setText(state.description);

    const hasHint = state.guidanceHint !== null && state.guidanceHint.length > 0;
    this.hintText.setVisible(hasHint);
    if (state.guidanceHint !== null && state.guidanceHint.length > 0) {
      this.hintText.setText(state.guidanceHint);
    }

    this.primaryButton.setVisible(state.primaryActionLabel !== null);
    if (state.primaryActionLabel !== null) {
      this.primaryButton.setLabel(state.primaryActionLabel);
      this.primaryButton.setEnabled(!state.isSwapping);
    }

    this.secondaryButton.setVisible(state.secondaryActionLabel !== null);
    if (state.secondaryActionLabel !== null) {
      this.secondaryButton.setLabel(state.secondaryActionLabel);
      this.secondaryButton.setEnabled(!state.isSwapping);
    }

    this.layoutPanel();
    return this;
  }

  public setTheme(theme: GameTheme): this {
    this.theme = theme;
    this.primaryButton.setTheme(theme);
    this.secondaryButton.setTheme(theme);
    return this;
  }

  private layoutPanel(): void {
    const state = this.lastState;
    const compact = this.panelHeight <= 96 || this.panelWidth < 400;
    const hasPrimary = state !== null && state.primaryActionLabel !== null;
    const hasSecondary = state !== null && state.secondaryActionLabel !== null;
    const showPills = state?.showCounterExamples === true;
    const hasHint = state !== null && state.guidanceHint !== null && state.guidanceHint.length > 0;

    drawElevatedSurface(this.surfaceGraphics, {
      width: this.panelWidth,
      height: this.panelHeight,
      radius: SemanticShapes.Card,
      fillColor: Colors.Surface.ElevatedSurface,
      fillAlpha: 0.96,
      borderColor: Colors.Brand.PrimaryLight,
      borderWidth: Dimens.BorderMedium,
      elevation: 'medium',
    });

    const horizontalActionLayout =
      !showPills && hasPrimary && !hasSecondary && this.panelWidth >= 520 && !compact;

    const btnH = compact ? 38 : Dimens.ButtonHeightSmall;

    if (horizontalActionLayout) {
      const btnW = 148;
      const textAreaW = Math.max(180, this.panelWidth - btnW - Dimens.Space48);
      const textCenterX = -btnW / 2 - Dimens.Space8;

      this.titleText.setScale(0.94);
      this.titleText.setPosition(textCenterX, -18);

      this.descriptionText.setWordWrapWidth(textAreaW, true);
      this.descriptionText.setScale(0.96);
      this.descriptionText.setPosition(textCenterX, 14);

      this.primaryButton.setButtonSize(btnW, btnH);
      this.primaryButton.setPosition(this.panelWidth / 2 - Dimens.Space16 - btnW / 2, 0);
      this.pillsGraphics.clear();
      this.pillsContainer.removeAll(true);
      this.lastPillsSignature = '';
      return;
    }

    const innerW = Math.max(220, this.panelWidth - Dimens.Space32);
    this.titleText.setScale(compact ? 0.78 : 0.9);
    this.descriptionText.setWordWrapWidth(innerW, true);
    this.descriptionText.setScale(compact ? 0.84 : 0.94);

    if (showPills) {
      const topY = -this.panelHeight / 2 + (compact ? 16 : 20);
      this.titleText.setPosition(0, topY);
      this.descriptionText.setPosition(0, topY + (compact ? 22 : 28));

      const pillsY = topY + (compact ? 48 : 64);
      this.renderCounterExamplePills(
        state.counterExamples,
        state.activeCounterExampleId,
        innerW,
        pillsY,
        compact,
      );

      const btnY = this.panelHeight / 2 - btnH / 2 - (compact ? 8 : 12);
      const primaryW = Math.min(186, Math.floor(innerW * 0.52));
      const secondaryW = Math.min(144, Math.floor(innerW * 0.42));
      const gap = Dimens.Space10;
      const totalBtnW = primaryW + secondaryW + gap;
      this.secondaryButton.setButtonSize(secondaryW, btnH);
      this.secondaryButton.setPosition(-totalBtnW / 2 + secondaryW / 2, btnY);
      this.primaryButton.setButtonSize(primaryW, btnH);
      this.primaryButton.setPosition(totalBtnW / 2 - primaryW / 2, btnY);
      return;
    }

    this.pillsGraphics.clear();
    this.pillsContainer.removeAll(true);
    this.lastPillsSignature = '';

    if (hasPrimary) {
      const topY = -this.panelHeight / 2 + (compact ? 18 : 22);
      this.titleText.setPosition(0, topY);
      this.descriptionText.setPosition(0, topY + (compact ? 24 : 30));
      const btnW = Math.min(200, innerW);
      this.primaryButton.setButtonSize(btnW, btnH);
      this.primaryButton.setPosition(0, this.panelHeight / 2 - btnH / 2 - (compact ? 8 : 12));
      return;
    }

    // Guidance-only panel (Stages 2, 3, 5)
    if (hasHint) {
      this.titleText.setPosition(0, -this.panelHeight * 0.25);
      this.descriptionText.setPosition(0, 2);
      this.hintText.setWordWrapWidth(innerW, true);
      this.hintText.setPosition(0, this.panelHeight * 0.28);
    } else {
      this.titleText.setPosition(0, -14);
      this.descriptionText.setPosition(0, 14);
    }
  }

  private renderCounterExamplePills(
    examples: readonly CounterDemoExample[],
    activeId: CounterDemoExample['id'] | null,
    innerW: number,
    y: number,
    compact: boolean,
  ): void {
    const signature = `${examples.map((e) => `${e.id}:${String(e.matchesBefore)}-${String(e.matchesAfter)}`).join('|')}|${String(activeId)}|${String(innerW)}|${String(y)}|${String(compact)}`;
    if (signature === this.lastPillsSignature) {
      return;
    }
    this.lastPillsSignature = signature;

    this.pillsGraphics.clear();
    this.pillsContainer.removeAll(true);

    const count = examples.length;
    if (count === 0) {
      return;
    }

    const gap = compact ? 6 : 10;
    const pillW = Math.floor((innerW - gap * (count - 1)) / count);
    const pillH = compact ? 24 : 28;
    const startX = -((count * pillW + (count - 1) * gap) / 2) + pillW / 2;

    examples.forEach((example, idx) => {
      const cx = Math.round(startX + idx * (pillW + gap));
      const isActive = example.id === activeId;
      const accent =
        example.delta > 0
          ? Colors.Semantic.Success
          : example.delta < 0
            ? Colors.Semantic.Error
            : Colors.Text.Secondary;

      this.pillsGraphics.fillStyle(hexToNumber(Colors.Surface.Background), isActive ? 0.95 : 0.72);
      this.pillsGraphics.fillRoundedRect(cx - pillW / 2, y - pillH / 2, pillW, pillH, 10);
      this.pillsGraphics.lineStyle(
        isActive ? Dimens.BorderMedium : Dimens.BorderThin,
        hexToNumber(accent),
        isActive ? 0.95 : 0.55,
      );
      this.pillsGraphics.strokeRoundedRect(cx - pillW / 2, y - pillH / 2, pillW, pillH, 10);

      const deltaText =
        example.delta > 0
          ? `+${String(example.delta)}`
          : example.delta < 0
            ? String(example.delta)
            : '±0';
      const label = compact
        ? `${deltaText} (${String(example.matchesBefore)}→${String(example.matchesAfter)})`
        : `${example.label}: ${String(example.matchesBefore)}→${String(example.matchesAfter)}`;

      const text = this.scene.add
        .text(
          cx,
          y,
          label,
          createTextStyle(Typography.LabelSmall, {
            color: accent,
            align: 'center',
            scale: compact ? 0.72 : 0.82,
            minFontSize: 10,
          }),
        )
        .setOrigin(0.5);
      this.pillsContainer.add(text);
    });
  }
}
