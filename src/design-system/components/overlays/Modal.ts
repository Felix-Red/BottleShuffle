import Phaser from 'phaser';
import {
  createViewportMetrics,
  type PartialSafeAreaInsets,
} from '../../../game/layout/ViewportMetrics';
import { computeModalBounds } from '../../layout/LayoutConstraints';
import { DefaultGameTheme, type GameTheme } from '../../theme/GameTheme';
import { Colors, darkenHex, hexToNumber, lightenHex } from '../../tokens/Colors';
import { Dimens } from '../../tokens/Dimens';
import { MotionPresets, resolveMotionDuration } from '../../tokens/Motion';
import { SemanticShapes } from '../../tokens/Shapes';
import { createTextStyle, Typography } from '../../tokens/Typography';
import { BaseButton } from '../buttons/BaseButton';
import { IconButton } from '../buttons/IconButton';
import { OutlineButton } from '../buttons/OutlineButton';
import { PrimaryButton } from '../buttons/PrimaryButton';
import { drawElevatedSurface } from '../common/SurfaceRenderer';

export interface ModalActionConfig {
  readonly label: string;
  readonly onClick: () => void;
  readonly closeOnClick?: boolean;
  readonly destructive?: boolean;
}

export interface ModalConfig {
  readonly title: string;
  readonly message?: string;
  readonly content?: Phaser.GameObjects.Container;
  readonly contentHeight?: number;
  readonly primaryAction: ModalActionConfig;
  readonly secondaryAction?: ModalActionConfig;
  readonly dismissible?: boolean;
  readonly width?: number;
  readonly depth?: number;
  readonly onDismiss?: () => void;
  readonly theme?: GameTheme;
}

const MODAL_DEPTH = 1000;

export class Modal extends Phaser.GameObjects.Container {
  private theme: GameTheme;
  private readonly dismissible: boolean;
  private readonly onDismissCallback?: () => void;
  private readonly preferredWidth: number;
  private readonly customContent?: Phaser.GameObjects.Container;
  private readonly customContentHeight: number;

  private readonly backdropGraphics: Phaser.GameObjects.Graphics;
  private readonly backdropBlocker: Phaser.GameObjects.Zone;
  private readonly dialogContainer: Phaser.GameObjects.Container;
  private readonly dialogSurface: Phaser.GameObjects.Graphics;
  private readonly dialogBlocker: Phaser.GameObjects.Zone;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly messageText?: Phaser.GameObjects.Text;
  private readonly closeButton?: IconButton;
  private readonly primaryButton: BaseButton;
  private readonly secondaryButton?: OutlineButton;

  private openState = false;
  private activeTweens: Phaser.Tweens.Tween[] = [];

  public constructor(scene: Phaser.Scene, config: ModalConfig) {
    super(scene, 0, 0);

    this.theme = config.theme ?? DefaultGameTheme;
    this.dismissible = config.dismissible ?? true;
    this.onDismissCallback = config.onDismiss;
    this.preferredWidth = Math.min(Dimens.ModalMaxWidth, Math.max(280, config.width ?? 420));
    this.customContent = config.content;
    this.customContentHeight = config.contentHeight ?? 0;

    this.setDepth(config.depth ?? MODAL_DEPTH);

    this.backdropGraphics = scene.add.graphics();
    this.backdropBlocker = scene.add.zone(0, 0, scene.scale.width, scene.scale.height).setOrigin(0);
    this.backdropBlocker.setInteractive();
    this.backdropBlocker.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, this.handleBackdropPress);

    this.dialogContainer = scene.add.container(0, 0);
    this.dialogSurface = scene.add.graphics();
    this.dialogBlocker = scene.add.zone(0, 0, this.preferredWidth, 260).setOrigin(0.5);
    this.dialogBlocker.setInteractive();

    this.titleText = scene.add
      .text(
        0,
        0,
        config.title,
        createTextStyle(Typography.HeadlineSmall, {
          color: Colors.Text.Primary,
          align: 'center',
        }),
      )
      .setOrigin(0.5, 0);

    this.dialogContainer.add([this.dialogSurface, this.dialogBlocker, this.titleText]);

    if (config.message !== undefined && config.message.length > 0) {
      this.messageText = scene.add
        .text(
          0,
          0,
          config.message,
          createTextStyle(Typography.BodyMedium, {
            color: Colors.Text.Secondary,
            align: 'center',
          }),
        )
        .setOrigin(0.5, 0);
      this.dialogContainer.add(this.messageText);
    }

    if (this.customContent !== undefined) {
      this.dialogContainer.add(this.customContent);
    }

    if (this.dismissible) {
      this.closeButton = new IconButton(scene, {
        icon: 'close',
        size: Dimens.MinTouchTarget,
        variant: 'ghost',
        theme: this.theme,
        onClick: () => {
          this.close(true);
        },
      });
      this.dialogContainer.add(this.closeButton);
    }

    const handlePrimaryClick = (): void => {
      config.primaryAction.onClick();
      if (config.primaryAction.closeOnClick ?? true) {
        this.close(false);
      }
    };

    if (config.primaryAction.destructive === true) {
      this.primaryButton = new BaseButton(
        scene,
        {
          label: config.primaryAction.label,
          width: 170,
          height: Dimens.ButtonHeightMedium,
          theme: this.theme,
          onClick: handlePrimaryClick,
        },
        {
          fillDefault: Colors.Semantic.ErrorDark,
          fillHover: Colors.Semantic.Error,
          fillPressed: darkenHex(Colors.Semantic.ErrorDark, 0.2),
          fillDisabled: Colors.Surface.ElevatedSurface,
          depthColor: darkenHex(Colors.Semantic.ErrorDark, 0.35),
          depthColorDisabled: darkenHex(Colors.Surface.Surface, 0.2),
          borderColorHover: lightenHex(Colors.Semantic.Error, 0.2),
          textColorDefault: Colors.Text.OnPrimary,
          textColorDisabled: Colors.Text.Disabled,
          elevation: 'medium',
          cornerRadius: SemanticShapes.Button,
          typography: Typography.LabelLarge,
        },
      );
    } else {
      this.primaryButton = new PrimaryButton(scene, {
        label: config.primaryAction.label,
        width: 170,
        height: Dimens.ButtonHeightMedium,
        theme: this.theme,
        onClick: handlePrimaryClick,
      });
    }
    this.dialogContainer.add(this.primaryButton);

    if (config.secondaryAction !== undefined) {
      const secondaryAction = config.secondaryAction;
      this.secondaryButton = new OutlineButton(scene, {
        label: secondaryAction.label,
        width: 150,
        height: Dimens.ButtonHeightMedium,
        theme: this.theme,
        onClick: () => {
          secondaryAction.onClick();
          if (secondaryAction.closeOnClick ?? true) {
            this.close(false);
          }
        },
      });
      this.dialogContainer.add(this.secondaryButton);
    }

    this.add([this.backdropGraphics, this.backdropBlocker, this.dialogContainer]);
    this.resize(scene.scale.width, scene.scale.height);
    this.setVisible(false);

    scene.add.existing(this);
  }

  public isOpen(): boolean {
    return this.openState;
  }

  public open(animate = true): this {
    this.stopTweens();
    this.openState = true;
    this.resize(this.scene.scale.width, this.scene.scale.height);
    this.setVisible(true);

    const duration = animate
      ? resolveMotionDuration(MotionPresets.ModalEntrance.duration, this.theme.reducedMotion)
      : 0;

    if (duration === 0) {
      this.backdropGraphics.setAlpha(1);
      this.dialogContainer.setAlpha(1);
      this.dialogContainer.setScale(1);
      return this;
    }

    this.backdropGraphics.setAlpha(0);
    this.dialogContainer.setAlpha(MotionPresets.ModalEntrance.alphaFrom);
    this.dialogContainer.setScale(MotionPresets.ModalEntrance.scaleFrom);

    this.activeTweens.push(
      this.scene.tweens.add({
        targets: this.backdropGraphics,
        alpha: 1,
        duration: Math.round(duration * 0.8),
        ease: MotionPresets.FadeIn.ease,
      }),
      this.scene.tweens.add({
        targets: this.dialogContainer,
        alpha: MotionPresets.ModalEntrance.alphaTo,
        scaleX: MotionPresets.ModalEntrance.scaleTo,
        scaleY: MotionPresets.ModalEntrance.scaleTo,
        duration,
        ease: MotionPresets.ModalEntrance.ease,
      }),
    );

    return this;
  }

  public close(notifyDismiss = false): this {
    if (!this.openState) {
      return this;
    }

    this.openState = false;
    this.stopTweens();

    const finishClose = (): void => {
      this.dialogContainer.setScale(1);
      this.setVisible(false);
      if (notifyDismiss) {
        this.onDismissCallback?.();
      }
    };

    const duration = resolveMotionDuration(
      MotionPresets.ModalDismissal.duration,
      this.theme.reducedMotion,
    );

    if (duration === 0) {
      finishClose();
      return this;
    }

    this.activeTweens.push(
      this.scene.tweens.add({
        targets: this.backdropGraphics,
        alpha: 0,
        duration,
        ease: MotionPresets.FadeOut.ease,
      }),
      this.scene.tweens.add({
        targets: this.dialogContainer,
        alpha: MotionPresets.ModalDismissal.alphaTo,
        scaleX: MotionPresets.ModalDismissal.scaleTo,
        scaleY: MotionPresets.ModalDismissal.scaleTo,
        duration,
        ease: MotionPresets.ModalDismissal.ease,
        onComplete: finishClose,
      }),
    );

    return this;
  }

  public resize(
    viewportWidth: number,
    viewportHeight: number,
    safeArea?: PartialSafeAreaInsets,
  ): this {
    if (!this.active || !this.titleText.active) {
      return this;
    }

    const viewport = createViewportMetrics({
      width: viewportWidth,
      height: viewportHeight,
      ...(safeArea !== undefined ? { safeArea } : {}),
    });
    const safeW = viewport.width;
    const safeH = viewport.height;
    const bounds = computeModalBounds(viewport, {
      preferredWidth: this.preferredWidth,
      maxWidth: this.preferredWidth,
    });

    this.backdropGraphics.clear();
    this.backdropGraphics.fillStyle(
      hexToNumber(Colors.Surface.Overlay),
      Colors.Surface.OverlayAlpha,
    );
    this.backdropGraphics.fillRect(0, 0, safeW, safeH);
    this.backdropBlocker.setSize(safeW, safeH);

    const isShort = viewport.effectiveHeight < 420;
    const dialogWidth = bounds.width;
    const pad = isShort ? Math.min(bounds.padding, Dimens.Space16) : bounds.padding;
    const innerWidth = Math.max(180, dialogWidth - pad * 2);
    const titleWrapWidth =
      this.closeButton !== undefined ? Math.max(120, innerWidth - Dimens.Space48) : innerWidth;

    this.titleText.setStyle(
      createTextStyle(Typography.HeadlineSmall, {
        color: Colors.Text.Primary,
        align: 'center',
        scale: isShort ? 0.9 : 1,
        wordWrapWidth: titleWrapWidth,
      }),
    );

    let cursorY = pad;
    const titleY = cursorY;
    cursorY += this.titleText.height + (isShort ? Dimens.Space8 : Dimens.Space12);

    let messageY = cursorY;
    if (this.messageText !== undefined) {
      this.messageText.setStyle(
        createTextStyle(Typography.BodyMedium, {
          color: Colors.Text.Secondary,
          align: 'center',
          scale: isShort ? 0.92 : 1,
          wordWrapWidth: innerWidth,
        }),
      );
      messageY = cursorY;
      cursorY += this.messageText.height + (isShort ? Dimens.Space12 : Dimens.Space20);
    }

    let contentCenterY = cursorY;
    if (this.customContent !== undefined && this.customContentHeight > 0) {
      contentCenterY = cursorY + this.customContentHeight / 2;
      cursorY += this.customContentHeight + (isShort ? Dimens.Space12 : Dimens.Space20);
    }

    const actionsHeight = Math.max(44, isShort ? 44 : Dimens.ButtonHeightMedium);
    const actionsCenterY = cursorY + actionsHeight / 2;
    cursorY += actionsHeight + pad;

    const dialogHeight = Math.min(bounds.maxHeight, cursorY);
    const halfH = dialogHeight / 2;

    this.dialogContainer.setPosition(bounds.centerX, bounds.centerY);
    this.dialogBlocker.setSize(dialogWidth, dialogHeight);

    drawElevatedSurface(this.dialogSurface, {
      width: dialogWidth,
      height: dialogHeight,
      radius: SemanticShapes.Modal,
      fillColor: Colors.Surface.ElevatedSurface,
      borderColor: Colors.Surface.Border,
      borderWidth: Dimens.BorderMedium,
      elevation: 'floating',
    });

    this.titleText.setPosition(0, titleY - halfH);
    if (this.messageText !== undefined) {
      this.messageText.setPosition(0, messageY - halfH);
    }
    if (this.customContent !== undefined) {
      this.customContent.setPosition(0, contentCenterY - halfH);
    }
    if (this.closeButton !== undefined) {
      this.closeButton.setPosition(
        dialogWidth / 2 - Dimens.Space24 - Dimens.Space4,
        -halfH + Dimens.Space24 + Dimens.Space4,
      );
    }

    const clampedActionY = Math.min(halfH - pad - actionsHeight / 2, actionsCenterY - halfH);
    if (this.secondaryButton !== undefined) {
      const gap = isShort ? Dimens.Space8 : Dimens.Space12;
      const btnWidth = Math.max(100, Math.floor((innerWidth - gap) / 2));
      this.secondaryButton.setButtonSize(btnWidth, actionsHeight);
      this.primaryButton.setButtonSize(btnWidth, actionsHeight);
      this.secondaryButton.setPosition(-(btnWidth / 2 + gap / 2), clampedActionY);
      this.primaryButton.setPosition(btnWidth / 2 + gap / 2, clampedActionY);
    } else {
      const btnWidth = Math.min(innerWidth, 240);
      this.primaryButton.setButtonSize(btnWidth, actionsHeight);
      this.primaryButton.setPosition(0, clampedActionY);
    }

    return this;
  }

  public setTheme(theme: GameTheme): this {
    this.theme = theme;
    this.primaryButton.setTheme(theme);
    this.secondaryButton?.setTheme(theme);
    this.closeButton?.setTheme(theme);
    return this;
  }

  private readonly handleBackdropPress = (): void => {
    if (this.dismissible && this.openState) {
      this.close(true);
    }
  };

  private stopTweens(): void {
    for (const tween of this.activeTweens) {
      tween.stop();
    }
    this.activeTweens = [];
  }

  public override destroy(fromScene?: boolean): void {
    this.stopTweens();
    this.backdropBlocker.removeAllListeners();
    this.dialogBlocker.removeAllListeners();
    super.destroy(fromScene);
  }
}
