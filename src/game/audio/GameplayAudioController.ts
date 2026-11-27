import type { GameEvent, ProgressionEvent } from '../../core';
import {
  computeStarRevealRate,
  mapMatchDeltaToFeedback,
} from '../../services/audio/AudioFeedbackMapper';
import type { AudioService } from '../../services/audio/AudioService';
import type { HapticService } from '../../services/haptics/HapticService';
import { AUDIO_ASSET_KEYS } from '../assets/AssetKeys';
import type { PendingSwapTransition } from '../gameplay/GameplayViewState';

export interface GameplayAudioControllerOptions {
  readonly audioService: AudioService;
  readonly hapticService?: HapticService;
  readonly initialAttemptId?: number;
}

/**
 * Pure gameplay audio & haptic orchestrator synchronising bottle selection/deselection,
 * swap whoosh, landing tap, match delta feedback, victory flourish, star reveals,
 * first-time milestones, and pause/restart/exit lifecycle transitions.
 *
 * Guards every asynchronous callback against stale attempt/transition IDs and
 * never inspects hidden secret bottle sequences.
 */
export class GameplayAudioController {
  private readonly audioService: AudioService;
  private readonly hapticService?: HapticService;

  private currentAttemptId: number;
  private landingPlayedTransitionId = -1;
  private reconciledTransitionId = -1;
  private victoryPlayedForAttemptId = -1;
  private tutorialCompletedForAttemptId = -1;
  private reducedMotionStarPlayedForAttemptId = -1;
  private milestoneChimePlayedForAttemptId = -1;
  private manualPauseActive = false;
  private disposed = false;

  public constructor(options: GameplayAudioControllerOptions) {
    this.audioService = options.audioService;
    this.hapticService = options.hapticService;
    this.currentAttemptId = options.initialAttemptId ?? 1;
  }

  public resetForAttempt(attemptId: number): void {
    if (this.disposed) {
      return;
    }
    this.currentAttemptId = attemptId;
    this.landingPlayedTransitionId = -1;
    this.reconciledTransitionId = -1;
    this.audioService.stopGameplayAudio();
    this.hapticService?.cancel();
  }

  /**
   * Handles player-initiated bottle selection and deselection events.
   * System-driven deselections (pause, restart, scene shutdown) must NOT call this method.
   */
  public handlePlayerGameEvents(events: readonly GameEvent[]): void {
    if (this.disposed) {
      return;
    }

    for (const event of events) {
      if (event.type === 'BOTTLE_SELECTED') {
        this.audioService.playSfx(AUDIO_ASSET_KEYS.SFX_BOTTLE_SELECT);
        this.hapticService?.trigger('bottle_select');
      } else if (event.type === 'SELECTION_CLEARED') {
        this.audioService.playSfx(AUDIO_ASSET_KEYS.SFX_BOTTLE_DESELECT);
      }
    }
  }

  public handleSwapStarted(transition: PendingSwapTransition): void {
    if (this.disposed || transition.attemptId !== this.currentAttemptId) {
      return;
    }
    this.audioService.playSfx(AUDIO_ASSET_KEYS.SFX_BOTTLE_SWAP);
  }

  /**
   * Fired directly from the bottle swap animation landing milestone.
   * Plays a single combined landing sound and subtle landing haptic once per swap.
   */
  public handleSwapLanding(transitionId: number, attemptId: number): void {
    if (
      this.disposed ||
      attemptId !== this.currentAttemptId ||
      this.landingPlayedTransitionId === transitionId
    ) {
      return;
    }
    this.landingPlayedTransitionId = transitionId;
    this.audioService.playSfx(AUDIO_ASSET_KEYS.SFX_BOTTLE_LAND);
    this.hapticService?.trigger('bottle_land');
  }

  /**
   * Fired when the swap completes and the match counter updates on screen.
   * Suppresses redundant positive match chime when the swap completes the puzzle.
   */
  public handleSwapReconciled(transition: PendingSwapTransition): void {
    if (
      this.disposed ||
      transition.attemptId !== this.currentAttemptId ||
      this.reconciledTransitionId === transition.transitionId
    ) {
      return;
    }
    this.reconciledTransitionId = transition.transitionId;

    const cue = mapMatchDeltaToFeedback(transition.swap.matchDelta, {
      suppressForVictory: transition.completedAfterSwap,
    });

    if (cue.sfx !== null) {
      this.audioService.playSfx(cue.sfx);
    }
    if (cue.haptic !== null) {
      this.hapticService?.trigger(cue.haptic);
    }
  }

  public handleVictoryTriggered(attemptId: number): void {
    if (
      this.disposed ||
      attemptId !== this.currentAttemptId ||
      this.victoryPlayedForAttemptId === attemptId
    ) {
      return;
    }
    this.victoryPlayedForAttemptId = attemptId;
    this.audioService.playSfx(AUDIO_ASSET_KEYS.SFX_VICTORY);
    this.hapticService?.trigger('victory');
  }

  public handleTutorialCompleted(attemptId: number): void {
    if (
      this.disposed ||
      attemptId !== this.currentAttemptId ||
      this.tutorialCompletedForAttemptId === attemptId
    ) {
      return;
    }
    this.tutorialCompletedForAttemptId = attemptId;
    this.audioService.playSfx(AUDIO_ASSET_KEYS.SFX_TUTORIAL_COMPLETE);
    this.hapticService?.trigger('victory');
  }

  public handleStarRevealed(starIndex: number): void {
    if (this.disposed) {
      return;
    }
    this.audioService.playSfx(AUDIO_ASSET_KEYS.SFX_STAR_REVEAL, {
      rate: computeStarRevealRate(starIndex),
      ignoreCooldown: true,
    });
  }

  /**
   * In reduced-motion mode, stars render statically; play a single concise chime
   * instead of a rapid multi-star cascade.
   */
  public handleReducedMotionStarsPresented(earnedStars: number, attemptId: number): void {
    if (
      this.disposed ||
      earnedStars <= 0 ||
      attemptId !== this.currentAttemptId ||
      this.reducedMotionStarPlayedForAttemptId === attemptId
    ) {
      return;
    }
    this.reducedMotionStarPlayedForAttemptId = attemptId;
    this.audioService.playSfx(AUDIO_ASSET_KEYS.SFX_STAR_REVEAL, {
      rate: computeStarRevealRate(Math.max(0, earnedStars - 1)),
    });
  }

  public handleProgressionEvents(events: readonly ProgressionEvent[], attemptId: number): void {
    if (
      this.disposed ||
      attemptId !== this.currentAttemptId ||
      this.milestoneChimePlayedForAttemptId === attemptId
    ) {
      return;
    }

    const hasFirstTimeMilestone = events.some(
      (event) =>
        event.type === 'LEVEL_UNLOCKED' ||
        event.type === 'CHAPTER_COMPLETED' ||
        event.type === 'CAMPAIGN_COMPLETED',
    );

    if (hasFirstTimeMilestone) {
      this.milestoneChimePlayedForAttemptId = attemptId;
      this.audioService.playSfx(AUDIO_ASSET_KEYS.SFX_LEVEL_UNLOCK);
    }
  }

  public setManualPaused(paused: boolean): void {
    if (this.disposed || this.manualPauseActive === paused) {
      return;
    }
    this.manualPauseActive = paused;
    if (paused) {
      this.audioService.suspend('manual_pause');
      this.hapticService?.suspend('manual_pause');
    } else {
      this.audioService.resume('manual_pause');
      this.hapticService?.resume('manual_pause');
    }
  }

  public stopObsoleteAudio(): void {
    if (this.disposed) {
      return;
    }
    this.audioService.stopGameplayAudio();
    this.hapticService?.cancel();
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.audioService.stopGameplayAudio();
    this.hapticService?.cancel();
    if (this.manualPauseActive) {
      this.manualPauseActive = false;
      this.audioService.resume('manual_pause');
      this.hapticService?.resume('manual_pause');
    }
  }
}
