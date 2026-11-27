import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/main.ts',
        'src/config/gameConfig.ts',
        'src/design-system/components/**',
        'src/game/scenes/**',
        'src/game/components/**',
        'src/game/animations/bottle/**',
        'src/game/animations/celebration/**',
        'src/game/animations/feedback/**',
        'src/game/animations/levels/**',
        'src/game/animations/tutorial/**',
        'src/game/animations/ui/**',
        'src/game/animations/victory/**',
        'src/game/assets/AssetManifest.ts',
        'src/game/audio/SceneAudioCoordinator.ts',
        'src/game/navigation/SceneNavigator.ts',
        'src/game/victory/DevVictoryPreview.ts',
        'src/services/audio/PhaserAudioBackend.ts',
        'src/platform/browser/BrowserViewportProvider.ts',
      ],
    },
  },
});
