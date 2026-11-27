import Phaser from 'phaser';
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
  ToggleSwitch,
  Typography,
  type GameTheme,
} from '../../design-system';
import type { GamePlatform, Unsubscribe } from '../../platform/contracts/GamePlatform';
import type { SettingsService } from '../../services/SettingsService';
import { getSfxAudioEntries, type AudioCatalogEntry } from '../../services/audio/AudioCatalog';
import type { AudioStateSnapshot } from '../../services/audio/AudioState';
import type { HapticEvent } from '../../services/haptics/HapticPattern';
import type { HapticService } from '../../services/haptics/HapticService';
import { AUDIO_ASSET_KEYS, type SfxAssetKey } from '../assets/AssetKeys';
import type { SceneAudioCoordinator } from '../audio/SceneAudioCoordinator';
import { GameBackground } from '../components/environment/GameBackground';
import { SCENE_KEYS } from './sceneKeys';

interface SfxPreviewCard {
  readonly entry: AudioCatalogEntry & { readonly id: SfxAssetKey };
  readonly button: OutlineButton;
  readonly metaText: Phaser.GameObjects.Text;
}

interface HapticPreviewItem {
  readonly event: HapticEvent;
  readonly label: string;
  readonly button: OutlineButton;
}

/**
 * Development-only scene (?scene=audio) for inspecting and testing all registered
 * sound effects, background music tracks, autoplay unlock status, player settings,
 * platform audio permission override, suspension/resumption, and haptic patterns.
 *
 * Dynamically imported only inside `if (import.meta.env.DEV)` and excluded from
 * production builds.
 */
export class AudioShowcaseScene extends Phaser.Scene {
  private readonly platform: GamePlatform;
  private readonly settingsService: SettingsService;
  private readonly audioCoordinator: SceneAudioCoordinator;
  private readonly hapticService: HapticService;
  private readonly theme: GameTheme = createGameTheme();

  private background?: GameBackground;
  private headerTitle?: Phaser.GameObjects.Text;
  private statusPanel?: Phaser.GameObjects.Graphics;
  private statusText?: Phaser.GameObjects.Text;
  private lastEventText?: Phaser.GameObjects.Text;

  private controlsPanel?: Phaser.GameObjects.Graphics;
  private controlsHeading?: Phaser.GameObjects.Text;
  private musicLabel?: Phaser.GameObjects.Text;
  private musicToggle?: ToggleSwitch;
  private sfxLabel?: Phaser.GameObjects.Text;
  private sfxToggle?: ToggleSwitch;
  private vibrationLabel?: Phaser.GameObjects.Text;
  private vibrationToggle?: ToggleSwitch;

  private playMenuBtn?: PrimaryButton;
  private playGameplayBtn?: PrimaryButton;
  private stopMusicBtn?: OutlineButton;
  private unlockBtn?: OutlineButton;
  private platformAudioBtn?: OutlineButton;
  private suspendBtn?: OutlineButton;

  private hapticsHeading?: Phaser.GameObjects.Text;
  private hapticItems: HapticPreviewItem[] = [];

  private sfxPanel?: Phaser.GameObjects.Graphics;
  private sfxHeading?: Phaser.GameObjects.Text;
  private sfxCards: SfxPreviewCard[] = [];

  private unsubscribeAudio?: Unsubscribe;
  private unsubscribeSettings?: Unsubscribe;
  private simulatedSuspended = false;
  private lastEventSummary = 'Ready — tap any control or SFX to test.';

  public constructor(
    platform: GamePlatform,
    settingsService: SettingsService,
    audioCoordinator: SceneAudioCoordinator,
    hapticService: HapticService,
  ) {
    super({ key: SCENE_KEYS.AUDIO_SHOWCASE });
    this.platform = platform;
    this.settingsService = settingsService;
    this.audioCoordinator = audioCoordinator;
    this.hapticService = hapticService;
  }

  public create(): void {
    this.simulatedSuspended = false;
    this.cameras.main.setBackgroundColor(hexToNumber(Colors.Surface.Background));
    this.audioCoordinator.ensureDeferredMusicLoaded(this);

    this.background = new GameBackground(this, { depth: -10 });

    this.headerTitle = this.add
      .text(
        0,
        0,
        'Audio & Haptics Showcase (DEV)',
        createTextStyle(Typography.HeadlineSmall, { color: Colors.Text.Primary }),
      )
      .setOrigin(0, 0.5);

    this.statusPanel = this.add.graphics();
    this.statusText = this.add
      .text(
        0,
        0,
        '',
        createTextStyle(Typography.LabelSmall, {
          color: Colors.Text.Secondary,
          scale: 0.92,
        }),
      )
      .setOrigin(0, 0.5);

    this.lastEventText = this.add
      .text(
        0,
        0,
        this.lastEventSummary,
        createTextStyle(Typography.LabelSmall, {
          color: Colors.Brand.Secondary,
          scale: 0.9,
        }),
      )
      .setOrigin(0, 0.5);

    this.controlsPanel = this.add.graphics();
    this.controlsHeading = this.add
      .text(
        0,
        0,
        'SETTINGS, MUSIC & LIFECYCLE',
        createTextStyle(Typography.LabelSmall, { color: Colors.Text.Secondary }),
      )
      .setOrigin(0, 0.5);

    const initialSettings = this.settingsService.getSettings();
    const audioService = this.audioCoordinator.getAudioService();

    this.musicLabel = this.add
      .text(0, 0, 'Music', createTextStyle(Typography.LabelMedium, { color: Colors.Text.Primary }))
      .setOrigin(0, 0.5);
    this.musicToggle = new ToggleSwitch(this, {
      value: initialSettings.musicEnabled,
      theme: this.theme,
      onChange: (enabled) => {
        this.settingsService.setMusicEnabled(enabled);
        this.recordEvent(`Music setting -> ${enabled ? 'ON' : 'OFF'}`);
      },
    });

    this.sfxLabel = this.add
      .text(0, 0, 'SFX', createTextStyle(Typography.LabelMedium, { color: Colors.Text.Primary }))
      .setOrigin(0, 0.5);
    this.sfxToggle = new ToggleSwitch(this, {
      value: initialSettings.soundEffectsEnabled,
      theme: this.theme,
      onChange: (enabled) => {
        this.settingsService.setSoundEffectsEnabled(enabled);
        this.recordEvent(`SFX setting -> ${enabled ? 'ON' : 'OFF'}`);
      },
    });

    this.vibrationLabel = this.add
      .text(
        0,
        0,
        'Haptics',
        createTextStyle(Typography.LabelMedium, { color: Colors.Text.Primary }),
      )
      .setOrigin(0, 0.5);
    this.vibrationToggle = new ToggleSwitch(this, {
      value: initialSettings.vibrationEnabled,
      enabled: this.hapticService.isSupported(),
      theme: this.theme,
      onChange: (enabled) => {
        this.settingsService.setVibrationEnabled(enabled);
        this.recordEvent(`Vibration setting -> ${enabled ? 'ON' : 'OFF'}`);
      },
    });

    this.playMenuBtn = new PrimaryButton(this, {
      label: 'Menu Music',
      theme: this.theme,
      onClick: () => {
        void audioService.unlock().then(() => {
          audioService.setMusicContext('menu');
          this.recordEvent('Music context -> Menu Theme');
        });
      },
    });

    this.playGameplayBtn = new PrimaryButton(this, {
      label: 'Game Music',
      theme: this.theme,
      onClick: () => {
        void audioService.unlock().then(() => {
          audioService.setMusicContext('gameplay');
          this.recordEvent('Music context -> Gameplay Theme');
        });
      },
    });

    this.stopMusicBtn = new OutlineButton(this, {
      label: 'Stop Music',
      theme: this.theme,
      onClick: () => {
        audioService.stopMusic(false);
        this.recordEvent('Music stopped (fade out)');
      },
    });

    this.unlockBtn = new OutlineButton(this, {
      label: 'Unlock Audio',
      theme: this.theme,
      onClick: () => {
        void audioService.unlock().then((ok) => {
          this.recordEvent(`Manual unlock -> ${ok ? 'UNLOCKED' : 'BLOCKED'}`);
        });
      },
    });

    this.platformAudioBtn = new OutlineButton(this, {
      label: 'Platform: ON',
      theme: this.theme,
      onClick: () => {
        const next = !audioService.getState().platformAudioEnabled;
        audioService.setPlatformAudioEnabled(next);
        this.recordEvent(`Platform audio permission -> ${next ? 'ALLOWED' : 'MUTED'}`);
      },
    });

    this.suspendBtn = new OutlineButton(this, {
      label: 'Suspend',
      theme: this.theme,
      onClick: () => {
        this.simulatedSuspended = !this.simulatedSuspended;
        if (this.simulatedSuspended) {
          audioService.suspend('platform_suspended');
          this.hapticService.suspend('platform_suspended');
          this.recordEvent('Lifecycle -> SUSPENDED');
        } else {
          audioService.resume('platform_suspended');
          this.hapticService.resume('platform_suspended');
          this.recordEvent('Lifecycle -> RESUMED');
        }
      },
    });

    this.hapticsHeading = this.add
      .text(
        0,
        0,
        'HAPTIC PATTERNS (CAPABILITY-AWARE)',
        createTextStyle(Typography.LabelSmall, { color: Colors.Text.Secondary }),
      )
      .setOrigin(0, 0.5);

    const hapticDefs: readonly { readonly event: HapticEvent; readonly label: string }[] = [
      { event: 'bottle_select', label: 'Select 10ms' },
      { event: 'bottle_land', label: 'Land 15ms' },
      { event: 'match_positive', label: 'Match+ 20ms' },
      { event: 'victory', label: 'Victory Pulse' },
    ];

    this.hapticItems = hapticDefs.map((def) => ({
      event: def.event,
      label: def.label,
      button: new OutlineButton(this, {
        label: def.label,
        theme: this.theme,
        onClick: () => {
          const fired = this.hapticService.trigger(def.event);
          this.recordEvent(
            `Haptic ${def.event} -> ${fired ? 'FIRED' : 'NO-OP (disabled or unsupported)'}`,
          );
        },
      }),
    }));

    this.sfxPanel = this.add.graphics();
    this.sfxHeading = this.add
      .text(
        0,
        0,
        'SOUND EFFECTS CATALOGUE (13 ESSENTIAL ASSETS)',
        createTextStyle(Typography.LabelSmall, { color: Colors.Text.Secondary }),
      )
      .setOrigin(0, 0.5);

    this.sfxCards = getSfxAudioEntries().map((entry) => {
      const effectiveGain = audioService.computeEffectiveGain(entry.channel, entry.defaultVolume);
      const button = new OutlineButton(this, {
        label: entry.displayName,
        theme: this.theme,
        onClick: () => {
          void audioService.unlock().then(() => {
            const played = audioService.playSfx(entry.id, { ignoreCooldown: true });
            this.recordEvent(
              `SFX ${entry.displayName} (${entry.channel}) -> ${played ? 'PLAYED' : 'SUPPRESSED'}`,
            );
          });
        },
      });
      const metaText = this.add
        .text(
          0,
          0,
          `${entry.channel} · gain ${effectiveGain.toFixed(2)}`,
          createTextStyle(Typography.LabelSmall, {
            color: Colors.Text.Disabled,
            scale: 0.78,
            minFontSize: 10,
          }),
        )
        .setOrigin(0.5, 0);

      return { entry, button, metaText };
    });

    this.unsubscribeAudio = audioService.subscribe((state) => {
      this.refreshStatus(state);
    });
    this.unsubscribeSettings = this.settingsService.subscribe((settings) => {
      this.musicToggle?.setValue(settings.musicEnabled, false, false);
      this.sfxToggle?.setValue(settings.soundEffectsEnabled, false, false);
      this.vibrationToggle?.setValue(settings.vibrationEnabled, false, false);
      this.refreshStatus(audioService.getState());
    });

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown);

    this.applyLayout(this.scale.width, this.scale.height);
    this.refreshStatus(audioService.getState());
    this.platform.notifyGameReady();
  }

  private recordEvent(message: string): void {
    this.lastEventSummary = message;
    this.lastEventText?.setText(message);
  }

  private refreshStatus(state: AudioStateSnapshot): void {
    const musicLabel =
      state.activeMusicKey === AUDIO_ASSET_KEYS.MUSIC_MENU
        ? 'Menu Theme'
        : state.activeMusicKey === AUDIO_ASSET_KEYS.MUSIC_GAMEPLAY
          ? 'Gameplay Theme'
          : 'None';
    const pausedSuffix = state.isMusicPaused ? ' (Paused)' : '';
    const hapticState = this.hapticService.getState();

    this.statusText?.setText(
      `Audio: ${state.unlocked ? 'UNLOCKED' : 'LOCKED'}  |  Music: ${musicLabel}${pausedSuffix}  |  Active SFX: ${String(state.activeSfxCount)}  |  Platform: ${state.platformAudioEnabled ? 'ALLOWED' : 'MUTED'}  |  Haptics: ${hapticState.supported ? (hapticState.enabled ? 'ON' : 'SUPPORTED (OFF)') : 'UNSUPPORTED'}`,
    );

    this.platformAudioBtn?.setLabel(
      state.platformAudioEnabled ? 'Platform: ON' : 'Platform: MUTED',
    );
    this.suspendBtn?.setLabel(this.simulatedSuspended ? 'Resume' : 'Suspend');
  }

  private applyLayout(width: number, height: number): void {
    const safeW = Math.max(320, width);
    const safeH = Math.max(480, height);
    const isPortrait = safeH > safeW;
    const pad = isPortrait ? Dimens.Space12 : Dimens.Space20;

    this.background?.resize(safeW, safeH);

    // Header + Status bar
    const headerY = pad + 18;
    this.headerTitle?.setText(
      isPortrait ? 'Audio & Haptics (DEV)' : 'Audio & Haptics Showcase (DEV)',
    );
    this.headerTitle?.setPosition(pad, headerY);

    const statusY = headerY + 32;
    const statusW = safeW - pad * 2;
    const statusH = isPortrait ? 66 : 50;
    if (this.statusPanel !== undefined) {
      this.statusPanel.setPosition(safeW / 2, statusY + statusH / 2);
      drawElevatedSurface(this.statusPanel, {
        width: statusW,
        height: statusH,
        radius: SemanticShapes.Card,
        fillColor: Colors.Surface.ElevatedSurface,
        borderColor: Colors.Surface.Border,
        borderWidth: Dimens.BorderThin,
        elevation: 'low',
      });
    }
    this.statusText?.setPosition(pad + 14, statusY + (isPortrait ? 20 : 16));
    this.statusText?.setWordWrapWidth(statusW - 28, true);
    this.lastEventText?.setPosition(pad + 14, statusY + statusH - 14);
    this.lastEventText?.setWordWrapWidth(statusW - 28, true);

    const bodyTop = statusY + statusH + Dimens.Space12;
    const bodyHeight = Math.max(260, safeH - bodyTop - pad);

    if (isPortrait) {
      this.layoutPortrait(pad, bodyTop, statusW, bodyHeight);
    } else {
      this.layoutLandscape(pad, bodyTop, statusW, bodyHeight);
    }
  }

  private layoutLandscape(pad: number, top: number, totalW: number, totalH: number): void {
    const gap = Dimens.Space16;
    const leftW = Math.min(390, Math.round(totalW * 0.34));
    const rightW = totalW - leftW - gap;
    const leftX = pad;
    const rightX = pad + leftW + gap;

    this.layoutControlsPanel(leftX, top, leftW, totalH, false);
    this.layoutSfxPanel(rightX, top, rightW, totalH, 3, false);
  }

  private layoutPortrait(pad: number, top: number, totalW: number, totalH: number): void {
    const gap = Dimens.Space12;
    const controlsH = Math.min(288, Math.round(totalH * 0.41));
    const sfxH = Math.max(240, totalH - controlsH - gap);

    this.layoutControlsPanel(pad, top, totalW, controlsH, true);
    this.layoutSfxPanel(pad, top + controlsH + gap, totalW, sfxH, 2, true);
  }

  private layoutControlsPanel(x: number, y: number, w: number, h: number, compact: boolean): void {
    if (this.controlsPanel !== undefined) {
      this.controlsPanel.setPosition(x + w / 2, y + h / 2);
      drawElevatedSurface(this.controlsPanel, {
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
    let cursorY = y + (compact ? 18 : 22);

    this.controlsHeading?.setPosition(x + innerPad, cursorY);
    cursorY += compact ? 22 : 30;

    const togglePairs: readonly [Phaser.GameObjects.Text | undefined, ToggleSwitch | undefined][] =
      [
        [this.musicLabel, this.musicToggle],
        [this.sfxLabel, this.sfxToggle],
        [this.vibrationLabel, this.vibrationToggle],
      ];

    if (compact) {
      const colW = innerW / 3;
      togglePairs.forEach(([label, toggle], idx) => {
        const cx = x + innerPad + colW * idx + colW / 2;
        label?.setOrigin(0.5, 0.5).setPosition(cx, cursorY);
        toggle?.setPosition(cx, cursorY + 26);
      });
      cursorY += 54;
    } else {
      const toggleRightX = x + w - innerPad - 28;
      for (const [label, toggle] of togglePairs) {
        label?.setOrigin(0, 0.5).setPosition(x + innerPad, cursorY);
        toggle?.setPosition(toggleRightX, cursorY);
        cursorY += 40;
      }
      cursorY += 6;
    }

    const btnGap = 8;
    const btnCols = compact ? 3 : 2;
    const btnW = Math.floor((innerW - btnGap * (btnCols - 1)) / btnCols);
    const btnH = compact ? 36 : 40;
    const controlButtons = [
      this.playMenuBtn,
      this.playGameplayBtn,
      this.stopMusicBtn,
      this.unlockBtn,
      this.platformAudioBtn,
      this.suspendBtn,
    ];
    controlButtons.forEach((btn, idx) => {
      const col = idx % btnCols;
      const row = Math.floor(idx / btnCols);
      const bx = x + innerPad + col * (btnW + btnGap) + btnW / 2;
      const by = cursorY + row * (btnH + btnGap) + btnH / 2;
      btn?.setButtonSize(btnW, btnH);
      btn?.setPosition(bx, by);
    });

    const controlRows = Math.ceil(controlButtons.length / btnCols);
    cursorY += controlRows * (btnH + btnGap) + (compact ? 10 : 18);

    this.hapticsHeading?.setPosition(x + innerPad, cursorY);
    cursorY += compact ? 20 : 28;

    const hapCols = 2;
    const hapW = Math.floor((innerW - btnGap) / hapCols);
    const hapH = compact ? 34 : 38;
    this.hapticItems.forEach((item, idx) => {
      const col = idx % hapCols;
      const row = Math.floor(idx / hapCols);
      const bx = x + innerPad + col * (hapW + btnGap) + hapW / 2;
      const by = cursorY + row * (hapH + btnGap) + hapH / 2;
      item.button.setButtonSize(hapW, hapH);
      item.button.setPosition(bx, by);
    });
  }

  private layoutSfxPanel(
    x: number,
    y: number,
    w: number,
    h: number,
    cols: number,
    compact: boolean,
  ): void {
    if (this.sfxPanel !== undefined) {
      this.sfxPanel.setPosition(x + w / 2, y + h / 2);
      drawElevatedSurface(this.sfxPanel, {
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
    this.sfxHeading?.setText(
      compact ? 'SOUND EFFECTS (13 ASSETS)' : 'SOUND EFFECTS CATALOGUE (13 ESSENTIAL ASSETS)',
    );
    this.sfxHeading?.setPosition(x + innerPad, y + 20);

    const gridTop = y + 38;
    const rows = Math.ceil(this.sfxCards.length / cols);
    const availH = Math.max(180, h - 50);
    const gapX = 10;
    const gapY = compact ? 6 : 10;
    const cellW = Math.floor((innerW - gapX * (cols - 1)) / cols);
    const cellH = Math.max(36, Math.floor((availH - gapY * (rows - 1)) / rows));
    const showMeta = !compact && cellH >= 56;
    const btnH = showMeta ? Math.max(32, Math.min(42, cellH - 18)) : Math.max(30, cellH - 2);

    this.sfxCards.forEach((card, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const cx = x + innerPad + col * (cellW + gapX) + cellW / 2;
      const topY = gridTop + row * (cellH + gapY);

      card.button.setButtonSize(cellW, btnH);
      card.button.setPosition(cx, topY + btnH / 2);
      card.metaText.setVisible(showMeta);
      if (showMeta) {
        card.metaText.setPosition(cx, topY + btnH + 3);
      }
    });
  }

  private readonly handleResize = (gameSize: Phaser.Structs.Size): void => {
    this.applyLayout(gameSize.width, gameSize.height);
  };

  private readonly handleShutdown = (): void => {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize);
    this.unsubscribeAudio?.();
    this.unsubscribeAudio = undefined;
    this.unsubscribeSettings?.();
    this.unsubscribeSettings = undefined;

    if (this.simulatedSuspended) {
      this.simulatedSuspended = false;
      this.audioCoordinator.getAudioService().resume('platform_suspended');
      this.hapticService.resume('platform_suspended');
    }

    this.background = undefined;
    this.headerTitle = undefined;
    this.statusPanel = undefined;
    this.statusText = undefined;
    this.lastEventText = undefined;
    this.controlsPanel = undefined;
    this.controlsHeading = undefined;
    this.musicLabel = undefined;
    this.musicToggle = undefined;
    this.sfxLabel = undefined;
    this.sfxToggle = undefined;
    this.vibrationLabel = undefined;
    this.vibrationToggle = undefined;
    this.playMenuBtn = undefined;
    this.playGameplayBtn = undefined;
    this.stopMusicBtn = undefined;
    this.unlockBtn = undefined;
    this.platformAudioBtn = undefined;
    this.suspendBtn = undefined;
    this.hapticsHeading = undefined;
    this.hapticItems = [];
    this.sfxPanel = undefined;
    this.sfxHeading = undefined;
    this.sfxCards = [];
  };
}
