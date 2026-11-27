import { APP_METADATA } from './appConfig';

export const SETTINGS_CONFIG = {
  appVersion: APP_METADATA.version,
  pause: {
    title: 'Game Paused',
    resumeLabel: 'Resume',
    restartLabel: 'Restart Puzzle',
    settingsLabel: 'Settings',
    exitLabel: 'Exit to Home',
  },
  restartConfirm: {
    title: 'Restart puzzle?',
    message: 'Your current moves and time will reset. The secret order will remain the same.',
    confirmLabel: 'Restart',
    cancelLabel: 'Cancel',
  },
  exitConfirm: {
    title: 'Leave this puzzle?',
    message:
      'Your current attempt will be lost. Previously completed levels and earned stars will be kept.',
    confirmLabel: 'Exit to Home',
    cancelLabel: 'Cancel',
  },
  tutorialConfirm: {
    title: 'Open How to Play?',
    message:
      'Starting the tutorial will leave your current attempt. Previously completed levels and earned stars will be kept.',
    confirmLabel: 'Start Tutorial',
    cancelLabel: 'Cancel',
  },
  settings: {
    title: 'Settings',
    doneLabel: 'Done',
    sections: {
      audio: 'AUDIO',
      gameplay: 'GAMEPLAY',
      help: 'HELP',
    },
    music: {
      title: 'Music',
      description: 'Background soundtrack preference',
    },
    soundEffects: {
      title: 'Sound Effects',
      description: 'Swaps, matches, and celebration audio',
    },
    vibration: {
      title: 'Vibration',
      description: 'Subtle tactile feedback on actions',
      unsupportedDescription: 'Not supported on this device',
    },
    reducedMotion: {
      title: 'Reduced Motion',
      description: 'Simplify swaps, glow pulses, and effects',
      systemActiveDescription: 'Enabled by your system accessibility setting',
    },
    howToPlay: {
      title: 'How to Play',
      description: 'Replay the interactive tutorial',
    },
    about: {
      title: 'About Bottle Shuffle',
      description: `Version ${APP_METADATA.version}`,
      dialogTitle: 'Bottle Shuffle',
      dialogMessage: 'Rearrange the bottles.\nWatch the counter.\nDiscover the secret order.',
      versionLine: `Version ${APP_METADATA.version}`,
      attributionLine: 'Typography: Fredoka & Nunito (SIL Open Font License 1.1)',
      closeLabel: 'Close',
    },
    reset: {
      title: 'Reset Settings',
      description: 'Restore default preferences only',
      confirmTitle: 'Reset settings?',
      confirmMessage:
        'Only your audio, vibration, and motion preferences will return to defaults. Your levels, stars, and scores will be kept.',
      confirmLabel: 'Reset',
      cancelLabel: 'Cancel',
    },
  },
} as const;
