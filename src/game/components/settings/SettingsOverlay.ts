import Phaser from 'phaser';
import { SETTINGS_CONFIG } from '../../../config/SettingsConfig';
import {
  Colors,
  ConfirmDialog,
  createTextStyle,
  DefaultGameTheme,
  Dimens,
  drawElevatedSurface,
  hexToNumber,
  IconButton,
  Modal,
  MotionEasings,
  MotionPresets,
  PrimaryButton,
  resolveMotionDuration,
  SemanticShapes,
  Typography,
  type GameTheme,
} from '../../../design-system';
import type { MotionPreferenceService } from '../../../services/MotionPreferenceService';
import type { SettingsService } from '../../../services/SettingsService';
import { computeSettingsLayout } from '../../layout/SettingsLayout';
import type { PartialSafeAreaInsets } from '../../layout/ViewportMetrics';
import { SettingsController } from '../../settings/SettingsController';
import type {
  SettingsOrigin,
  SettingsSubOverlay,
  SettingsViewState,
} from '../../settings/SettingsViewState';
import { SettingsNavigationRow } from './SettingsNavigationRow';
import { SettingsSection } from './SettingsSection';
import { SettingsToggleRow } from './SettingsToggleRow';

export interface SettingsOverlayConfig {
  readonly settingsService: SettingsService;
  readonly motionPreference: MotionPreferenceService;
  readonly origin: SettingsOrigin;
  readonly vibrationSupported: boolean;
  readonly showHowToPlay?: boolean;
  readonly theme?: GameTheme;
  readonly onHowToPlay?: () => void;
  readonly onClose: () => void;
  readonly onUiClick?: () => void;
  readonly onUiBack?: () => void;
}

const SETTINGS_OVERLAY_DEPTH = 980;
const SUB_OVERLAY_DEPTH = 1020;

/**
 * Shared production SettingsOverlay used identically from HomeScene and the gameplay
 * pause menu. Manages Music, Sound Effects, capability-aware Vibration, Reduced Motion,
 * How to Play, About Bottle Shuffle, and Reset Settings confirmation cleanly.
 */
export class SettingsOverlay {
  private readonly scene: Phaser.Scene;
  private theme: GameTheme;
  private readonly controller: SettingsController;
  private readonly onUiClick?: () => void;
  private readonly onUiBack?: () => void;

  private root?: Phaser.GameObjects.Container;
  private scrim?: Phaser.GameObjects.Rectangle;
  private panelContainer?: Phaser.GameObjects.Container;
  private panelGraphics?: Phaser.GameObjects.Graphics;
  private bodyContainer?: Phaser.GameObjects.Container;
  private bodyMaskGraphics?: Phaser.GameObjects.Graphics;
  private bodyMask?: Phaser.Display.Masks.GeometryMask;
  private headerTitleText?: Phaser.GameObjects.Text;
  private closeButton?: IconButton;

  private audioSection?: SettingsSection;
  private musicRow?: SettingsToggleRow;
  private sfxRow?: SettingsToggleRow;

  private gameplaySection?: SettingsSection;
  private vibrationRow?: SettingsToggleRow;
  private reducedMotionRow?: SettingsToggleRow;

  private helpSection?: SettingsSection;
  private howToPlayRow?: SettingsNavigationRow;
  private aboutRow?: SettingsNavigationRow;
  private resetRow?: SettingsNavigationRow;
  private doneButton?: PrimaryButton;

  private aboutModal?: Modal;
  private resetConfirmDialog?: ConfirmDialog;

  private entranceTween?: Phaser.Tweens.Tween;
  private activeSubOverlay: SettingsSubOverlay = 'none';
  private openState = false;
  private scrollY = 0;
  private maxScrollY = 0;
  private scrollNeeded = false;
  private lastSafeArea?: PartialSafeAreaInsets;
  private dragStartY: number | null = null;
  private dragStartScrollY = 0;

  public constructor(scene: Phaser.Scene, config: SettingsOverlayConfig) {
    this.scene = scene;
    this.theme = config.theme ?? DefaultGameTheme;
    this.onUiClick = config.onUiClick;
    this.onUiBack = config.onUiBack;

    this.controller = new SettingsController({
      settingsService: config.settingsService,
      motionPreference: config.motionPreference,
      origin: config.origin,
      vibrationSupported: config.vibrationSupported,
      ...(config.showHowToPlay !== undefined ? { showHowToPlay: config.showHowToPlay } : {}),
      callbacks: {
        onViewStateChange: (state) => {
          this.renderState(state, true);
        },
        onCloseRequested: () => {
          config.onClose();
        },
        ...(config.onHowToPlay !== undefined ? { onHowToPlayRequested: config.onHowToPlay } : {}),
      },
    });
  }

  public isOpen(): boolean {
    return this.openState;
  }

  public hasOpenSubOverlay(): boolean {
    return this.activeSubOverlay !== 'none';
  }

  public handleEscapeKey(): boolean {
    if (!this.openState) {
      return false;
    }
    return this.controller.handleEscapeKey();
  }

  public open(animate = true): void {
    this.destroyVisuals();
    this.openState = true;
    this.activeSubOverlay = 'none';

    const state = this.controller.getViewState();
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;

    this.root = this.scene.add.container(0, 0).setDepth(SETTINGS_OVERLAY_DEPTH);

    this.scrim = this.scene.add
      .rectangle(
        width / 2,
        height / 2,
        width,
        height,
        hexToNumber(Colors.Surface.Overlay),
        Colors.Surface.OverlayAlpha,
      )
      .setInteractive();
    this.root.add(this.scrim);

    this.panelContainer = this.scene.add.container(width / 2, height / 2);
    this.root.add(this.panelContainer);

    this.panelGraphics = this.scene.add.graphics();
    this.panelContainer.add(this.panelGraphics);

    this.headerTitleText = this.scene.add
      .text(
        0,
        0,
        SETTINGS_CONFIG.settings.title,
        createTextStyle(Typography.HeadlineSmall, {
          color: Colors.Text.Primary,
        }),
      )
      .setOrigin(0, 0.5);

    this.closeButton = new IconButton(this.scene, {
      icon: 'close',
      size: Dimens.MinTouchTarget,
      variant: 'ghost',
      theme: this.theme,
      onClick: () => {
        this.onUiBack?.();
        this.controller.requestClose();
      },
    });

    this.audioSection = new SettingsSection(this.scene, SETTINGS_CONFIG.settings.sections.audio);
    this.musicRow = new SettingsToggleRow(this.scene, {
      icon: 'sound',
      theme: this.theme,
      onChange: (enabled) => {
        this.controller.setMusicEnabled(enabled);
        this.onUiClick?.();
      },
    });
    this.sfxRow = new SettingsToggleRow(this.scene, {
      icon: 'sparkles',
      theme: this.theme,
      onChange: (enabled) => {
        this.controller.setSoundEffectsEnabled(enabled);
        // Play feedback only when enabling; disabling must remain immediately silent.
        if (enabled) {
          this.onUiClick?.();
        }
      },
    });

    this.gameplaySection = new SettingsSection(
      this.scene,
      SETTINGS_CONFIG.settings.sections.gameplay,
    );
    this.vibrationRow = new SettingsToggleRow(this.scene, {
      icon: 'moves',
      theme: this.theme,
      onChange: (enabled) => {
        this.controller.setVibrationEnabled(enabled);
        this.onUiClick?.();
      },
    });
    this.reducedMotionRow = new SettingsToggleRow(this.scene, {
      icon: 'settings',
      theme: this.theme,
      onChange: (enabled) => {
        this.controller.setReducedMotionEnabled(enabled);
        this.onUiClick?.();
      },
    });

    this.helpSection = new SettingsSection(this.scene, SETTINGS_CONFIG.settings.sections.help);

    if (state.showHowToPlay) {
      this.howToPlayRow = new SettingsNavigationRow(this.scene, {
        icon: 'play',
        title: SETTINGS_CONFIG.settings.howToPlay.title,
        description: SETTINGS_CONFIG.settings.howToPlay.description,
        onClick: () => {
          this.onUiClick?.();
          this.controller.requestHowToPlay();
        },
      });
    }

    this.aboutRow = new SettingsNavigationRow(this.scene, {
      icon: 'info',
      title: SETTINGS_CONFIG.settings.about.title,
      description: SETTINGS_CONFIG.settings.about.description,
      onClick: () => {
        this.onUiClick?.();
        this.controller.openAbout();
      },
    });

    this.resetRow = new SettingsNavigationRow(this.scene, {
      icon: 'restart',
      title: SETTINGS_CONFIG.settings.reset.title,
      description: SETTINGS_CONFIG.settings.reset.description,
      destructiveTint: true,
      enabled: state.canResetSettings,
      onClick: () => {
        this.onUiClick?.();
        this.controller.requestResetConfirmation();
      },
    });

    this.doneButton = new PrimaryButton(this.scene, {
      label: SETTINGS_CONFIG.settings.doneLabel,
      theme: this.theme,
      onClick: () => {
        this.onUiClick?.();
        this.controller.requestClose();
      },
    });

    this.bodyContainer = this.scene.add.container(0, 0);
    const bodyChildren: Phaser.GameObjects.GameObject[] = [
      this.audioSection,
      this.musicRow,
      this.sfxRow,
      this.gameplaySection,
      this.vibrationRow,
      this.reducedMotionRow,
      this.helpSection,
    ];
    if (this.howToPlayRow !== undefined) {
      bodyChildren.push(this.howToPlayRow);
    }
    bodyChildren.push(this.aboutRow, this.resetRow);
    this.bodyContainer.add(bodyChildren);

    this.panelContainer.add([
      this.bodyContainer,
      this.headerTitleText,
      this.closeButton,
      this.doneButton,
    ]);

    this.scene.input.on(Phaser.Input.Events.POINTER_WHEEL, this.handlePointerWheel);
    this.scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown);
    this.scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove);
    this.scene.input.on(Phaser.Input.Events.POINTER_UP, this.handlePointerUp);

    this.renderState(state, false);
    this.resize(width, height, this.lastSafeArea);

    const duration = animate
      ? resolveMotionDuration(MotionPresets.ModalEntrance.duration, this.theme.reducedMotion)
      : 0;

    if (duration > 0) {
      this.scrim.setAlpha(0);
      this.panelContainer.setAlpha(0);
      this.panelContainer.setScale(MotionPresets.ModalEntrance.scaleFrom);

      this.entranceTween = this.scene.tweens.add({
        targets: this.scrim,
        alpha: Colors.Surface.OverlayAlpha,
        duration,
        ease: MotionEasings.EaseOut,
      });

      this.scene.tweens.add({
        targets: this.panelContainer,
        alpha: 1,
        scaleX: 1,
        scaleY: 1,
        duration,
        ease: MotionEasings.EaseOut,
      });
    }
  }

  public resize(width: number, height: number, safeArea?: PartialSafeAreaInsets): void {
    if (safeArea !== undefined) {
      this.lastSafeArea = safeArea;
    }
    if (!this.openState || this.panelContainer === undefined) {
      return;
    }

    const effectiveSafeArea = safeArea ?? this.lastSafeArea;
    const state = this.controller.getViewState();
    const layout = computeSettingsLayout(width, height, {
      showHowToPlay: state.showHowToPlay,
      ...(effectiveSafeArea !== undefined ? { safeArea: effectiveSafeArea } : {}),
    });

    if (this.scrim?.active) {
      this.scrim.setPosition(width / 2, height / 2);
      this.scrim.setSize(width, height);
    }

    this.panelContainer.setPosition(layout.panelRect.x, layout.panelRect.y);

    if (this.panelGraphics?.active) {
      drawElevatedSurface(this.panelGraphics, {
        width: layout.panelRect.width,
        height: layout.panelRect.height,
        radius: SemanticShapes.Modal,
        fillColor: Colors.Surface.ElevatedSurface,
        borderColor: Colors.Surface.Border,
        borderWidth: Dimens.BorderMedium,
        elevation: 'high',
      });
    }

    this.headerTitleText?.setPosition(layout.headerTitlePosition.x, layout.headerTitlePosition.y);
    this.closeButton?.setPosition(layout.closeButtonPosition.x, layout.closeButtonPosition.y);

    this.audioSection?.setPosition(layout.audioHeadingPosition.x, layout.audioHeadingPosition.y);
    this.musicRow?.setPosition(layout.musicRowRect.x, layout.musicRowRect.y);
    this.musicRow?.setRowLayout(
      layout.musicRowRect.width,
      layout.musicRowRect.height,
      layout.compactRow,
    );
    this.sfxRow?.setPosition(layout.sfxRowRect.x, layout.sfxRowRect.y);
    this.sfxRow?.setRowLayout(layout.sfxRowRect.width, layout.sfxRowRect.height, layout.compactRow);

    this.gameplaySection?.setPosition(
      layout.gameplayHeadingPosition.x,
      layout.gameplayHeadingPosition.y,
    );
    this.vibrationRow?.setPosition(layout.vibrationRowRect.x, layout.vibrationRowRect.y);
    this.vibrationRow?.setRowLayout(
      layout.vibrationRowRect.width,
      layout.vibrationRowRect.height,
      layout.compactRow,
    );
    this.reducedMotionRow?.setPosition(
      layout.reducedMotionRowRect.x,
      layout.reducedMotionRowRect.y,
    );
    this.reducedMotionRow?.setRowLayout(
      layout.reducedMotionRowRect.width,
      layout.reducedMotionRowRect.height,
      layout.compactRow,
    );

    this.helpSection?.setPosition(layout.helpHeadingPosition.x, layout.helpHeadingPosition.y);
    if (this.howToPlayRow !== undefined && layout.howToPlayRowRect !== null) {
      this.howToPlayRow.setPosition(layout.howToPlayRowRect.x, layout.howToPlayRowRect.y);
      this.howToPlayRow.setRowLayout(
        layout.howToPlayRowRect.width,
        layout.howToPlayRowRect.height,
        layout.compactRow,
      );
    }

    this.aboutRow?.setPosition(layout.aboutRowRect.x, layout.aboutRowRect.y);
    this.aboutRow?.setRowLayout(
      layout.aboutRowRect.width,
      layout.aboutRowRect.height,
      layout.compactRow,
    );

    this.resetRow?.setPosition(layout.resetRowRect.x, layout.resetRowRect.y);
    this.resetRow?.setRowLayout(
      layout.resetRowRect.width,
      layout.resetRowRect.height,
      layout.compactRow,
    );

    this.doneButton?.setPosition(layout.doneButtonRect.x, layout.doneButtonRect.y);
    this.doneButton?.setButtonSize(layout.doneButtonRect.width, layout.doneButtonRect.height);

    this.scrollNeeded = layout.scrollNeeded;
    this.maxScrollY = layout.maxScrollY;
    this.scrollY = layout.scrollNeeded ? Math.min(this.scrollY, this.maxScrollY) : 0;
    this.bodyContainer?.setPosition(0, -this.scrollY);
    this.updateBodyScrollMask(layout.panelRect, layout.bodyViewportRect, layout.scrollNeeded);

    this.aboutModal?.resize(width, height, effectiveSafeArea);
    this.resetConfirmDialog?.resize(width, height);
  }

  public setTheme(theme: GameTheme): void {
    this.theme = theme;
    this.closeButton?.setTheme(theme);
    this.musicRow?.setTheme(theme);
    this.sfxRow?.setTheme(theme);
    this.vibrationRow?.setTheme(theme);
    this.reducedMotionRow?.setTheme(theme);
    this.doneButton?.setTheme(theme);
    this.aboutModal?.setTheme(theme);
    this.resetConfirmDialog?.setTheme(theme);
  }

  public close(): void {
    this.destroyVisuals();
    this.openState = false;
    this.activeSubOverlay = 'none';
  }

  public destroy(): void {
    this.close();
    this.controller.dispose();
  }

  private renderState(state: SettingsViewState, animateSwitch: boolean): void {
    if (!this.openState) {
      return;
    }

    this.musicRow?.applyState(state.music, animateSwitch);
    this.sfxRow?.applyState(state.soundEffects, animateSwitch);
    this.vibrationRow?.applyState(state.vibration, animateSwitch);
    this.reducedMotionRow?.applyState(state.reducedMotion, animateSwitch);
    this.resetRow?.setEnabled(state.canResetSettings);

    this.syncSubOverlay(state.subOverlay);
  }

  private syncSubOverlay(next: SettingsSubOverlay): void {
    if (next === this.activeSubOverlay) {
      return;
    }
    const previous = this.activeSubOverlay;
    this.activeSubOverlay = next;

    if (previous === 'about' && this.aboutModal?.isOpen()) {
      this.aboutModal.close(false);
    }
    if (previous === 'reset_confirm' && this.resetConfirmDialog?.isOpen()) {
      this.resetConfirmDialog.close();
    }

    if (next === 'about') {
      this.openAboutModal();
    } else if (next === 'reset_confirm') {
      this.openResetConfirmDialog();
    }
  }

  private openAboutModal(): void {
    this.aboutModal?.destroy();
    const content = this.scene.add.container(0, 0);

    const versionText = this.scene.add
      .text(
        0,
        -16,
        SETTINGS_CONFIG.settings.about.versionLine,
        createTextStyle(Typography.LabelMedium, {
          color: Colors.Brand.Secondary,
          align: 'center',
        }),
      )
      .setOrigin(0.5);

    const attrText = this.scene.add
      .text(
        0,
        14,
        SETTINGS_CONFIG.settings.about.attributionLine,
        createTextStyle(Typography.LabelSmall, {
          color: Colors.Text.Secondary,
          align: 'center',
          scale: 0.86,
          wordWrapWidth: 320,
        }),
      )
      .setOrigin(0.5);

    content.add([versionText, attrText]);

    this.aboutModal = new Modal(this.scene, {
      title: SETTINGS_CONFIG.settings.about.dialogTitle,
      message: SETTINGS_CONFIG.settings.about.dialogMessage,
      content,
      contentHeight: 62,
      width: 400,
      depth: SUB_OVERLAY_DEPTH,
      dismissible: true,
      theme: this.theme,
      primaryAction: {
        label: SETTINGS_CONFIG.settings.about.closeLabel,
        closeOnClick: false,
        onClick: () => {
          this.onUiBack?.();
          this.controller.closeSubOverlay();
        },
      },
      onDismiss: () => {
        this.onUiBack?.();
        this.controller.closeSubOverlay();
      },
    });
    this.aboutModal.resize(this.scene.scale.width, this.scene.scale.height);
    this.aboutModal.open(!this.theme.reducedMotion);
  }

  private openResetConfirmDialog(): void {
    this.resetConfirmDialog?.destroy();
    this.resetConfirmDialog = new ConfirmDialog(this.scene, {
      title: SETTINGS_CONFIG.settings.reset.confirmTitle,
      message: SETTINGS_CONFIG.settings.reset.confirmMessage,
      confirmLabel: SETTINGS_CONFIG.settings.reset.confirmLabel,
      cancelLabel: SETTINGS_CONFIG.settings.reset.cancelLabel,
      destructive: true,
      depth: SUB_OVERLAY_DEPTH,
      dismissible: true,
      theme: this.theme,
      onConfirm: () => {
        this.controller.confirmResetSettings();
        this.onUiClick?.();
      },
      onCancel: () => {
        this.onUiBack?.();
        this.controller.closeSubOverlay();
      },
    });
    this.resetConfirmDialog.resize(this.scene.scale.width, this.scene.scale.height);
    this.resetConfirmDialog.open();
  }

  private updateBodyScrollMask(
    panelRect: { readonly x: number; readonly y: number },
    bodyViewportRect: {
      readonly x: number;
      readonly y: number;
      readonly width: number;
      readonly height: number;
    },
    enabled: boolean,
  ): void {
    if (this.bodyContainer === undefined) {
      return;
    }

    if (!enabled) {
      this.bodyContainer.clearMask();
      this.bodyMask?.destroy();
      this.bodyMask = undefined;
      this.bodyMaskGraphics?.destroy();
      this.bodyMaskGraphics = undefined;
      return;
    }

    if (this.bodyMaskGraphics === undefined) {
      this.bodyMaskGraphics = this.scene.make.graphics({ x: 0, y: 0 }, false);
      this.bodyMask = this.bodyMaskGraphics.createGeometryMask();
    }

    this.bodyMaskGraphics.clear();
    this.bodyMaskGraphics.fillStyle(0xffffff, 1);
    this.bodyMaskGraphics.fillRect(
      panelRect.x + bodyViewportRect.x,
      panelRect.y + bodyViewportRect.y,
      bodyViewportRect.width,
      bodyViewportRect.height,
    );
    if (this.bodyMask !== undefined) {
      this.bodyContainer.setMask(this.bodyMask);
    }
  }

  private setScrollY(nextY: number): void {
    if (!this.scrollNeeded) {
      this.scrollY = 0;
      this.bodyContainer?.setPosition(0, 0);
      return;
    }
    this.scrollY = Math.max(0, Math.min(this.maxScrollY, Math.round(nextY)));
    this.bodyContainer?.setPosition(0, -this.scrollY);
  }

  private readonly handlePointerWheel = (
    _pointer: Phaser.Input.Pointer,
    _currentlyOver: Phaser.GameObjects.GameObject[],
    _deltaX: number,
    deltaY: number,
  ): void => {
    if (!this.openState || !this.scrollNeeded || this.activeSubOverlay !== 'none') {
      return;
    }
    this.setScrollY(this.scrollY + deltaY * 0.45);
  };

  private readonly handlePointerDown = (pointer: Phaser.Input.Pointer): void => {
    if (!this.openState || !this.scrollNeeded || this.activeSubOverlay !== 'none') {
      return;
    }
    this.dragStartY = pointer.y;
    this.dragStartScrollY = this.scrollY;
  };

  private readonly handlePointerMove = (pointer: Phaser.Input.Pointer): void => {
    if (
      !this.openState ||
      !this.scrollNeeded ||
      this.activeSubOverlay !== 'none' ||
      this.dragStartY === null ||
      !pointer.isDown
    ) {
      return;
    }
    const deltaY = this.dragStartY - pointer.y;
    if (Math.abs(deltaY) >= 4) {
      this.setScrollY(this.dragStartScrollY + deltaY);
    }
  };

  private readonly handlePointerUp = (): void => {
    this.dragStartY = null;
  };

  private destroyVisuals(): void {
    this.scene.input.off(Phaser.Input.Events.POINTER_WHEEL, this.handlePointerWheel);
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown);
    this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.handlePointerUp);
    this.dragStartY = null;
    this.scrollY = 0;
    this.maxScrollY = 0;
    this.scrollNeeded = false;

    if (this.entranceTween !== undefined) {
      this.entranceTween.stop();
      this.entranceTween = undefined;
    }
    this.bodyContainer?.clearMask();
    this.bodyMask?.destroy();
    this.bodyMask = undefined;
    this.bodyMaskGraphics?.destroy();
    this.bodyMaskGraphics = undefined;
    this.aboutModal?.destroy();
    this.aboutModal = undefined;
    this.resetConfirmDialog?.destroy();
    this.resetConfirmDialog = undefined;

    this.root?.destroy(true);
    this.root = undefined;
    this.scrim = undefined;
    this.panelContainer = undefined;
    this.panelGraphics = undefined;
    this.bodyContainer = undefined;
    this.headerTitleText = undefined;
    this.closeButton = undefined;
    this.audioSection = undefined;
    this.musicRow = undefined;
    this.sfxRow = undefined;
    this.gameplaySection = undefined;
    this.vibrationRow = undefined;
    this.reducedMotionRow = undefined;
    this.helpSection = undefined;
    this.howToPlayRow = undefined;
    this.aboutRow = undefined;
    this.resetRow = undefined;
    this.doneButton = undefined;
  }
}
