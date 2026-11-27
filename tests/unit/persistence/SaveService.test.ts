import { describe, expect, it, vi } from 'vitest';
import { CURRENT_SAVE_SCHEMA_VERSION, SAVE_GAME_ID } from '../../../src/core';
import { ProgressionController } from '../../../src/game/progression/ProgressionController';
import {
  BrowserSaveStorage,
  type BrowserStorageLike,
  type StorageEventWindowLike,
} from '../../../src/platform/browser/BrowserSaveStorage';
import { SettingsService } from '../../../src/services/SettingsService';
import { TutorialPreferenceService } from '../../../src/services/TutorialPreferenceService';
import { serializeSaveData } from '../../../src/services/persistence/SaveSerializer';
import { SaveService } from '../../../src/services/persistence/SaveService';
import { createPartialCampaignSaveFixture } from '../../fixtures/saves/saveFixtures';
import { InMemorySaveStorage } from '../../helpers/InMemorySaveStorage';

function createTargets(): {
  progressionController: ProgressionController;
  settingsService: SettingsService;
  tutorialPreference: TutorialPreferenceService;
} {
  return {
    progressionController: new ProgressionController(),
    settingsService: new SettingsService(),
    tutorialPreference: new TutorialPreferenceService(),
  };
}

describe('SaveService', () => {
  it('initialises clean defaults on missing save and restores valid saves without emitting completion events', async () => {
    const emptyStorage = new InMemorySaveStorage();
    const targetsA = createTargets();
    const serviceA = new SaveService({ storage: emptyStorage, targets: targetsA });

    const initMissing = await serviceA.initialise();
    expect(initMissing.outcome).toBe('missing');
    expect(serviceA.getStatus().status).toBe('ready');
    expect(targetsA.progressionController.getCampaignProgress().completedLevels).toBe(0);
    expect(targetsA.tutorialPreference.getStatus()).toBe('not_seen');
    serviceA.dispose();

    const fixture = createPartialCampaignSaveFixture();
    const seededStorage = new InMemorySaveStorage({ initialPayload: serializeSaveData(fixture) });
    const targetsB = createTargets();
    const emittedEvents: unknown[] = [];
    targetsB.progressionController.onChange((_s, events) => {
      emittedEvents.push(...events);
    });

    const serviceB = new SaveService({ storage: seededStorage, targets: targetsB });
    const initRestored = await serviceB.initialise();
    expect(initRestored.outcome).toBe('restored');
    expect(serviceB.getStatus().lastSavedRevision).toBe(5);
    expect(targetsB.progressionController.getCampaignProgress().completedLevels).toBe(2);
    expect(targetsB.progressionController.getLevelStatus('level-003')).toBe('unlocked');
    expect(targetsB.settingsService.getSettings().musicEnabled).toBe(false);
    expect(targetsB.settingsService.getSettings().motionPreference).toBe('reduced');
    expect(targetsB.tutorialPreference.getStatus()).toBe('completed');
    // Restoration must NEVER emit ordinary completion/unlock events
    expect(emittedEvents).toHaveLength(0);
    serviceB.dispose();
  });

  it('preserves corrupted and unsupported future saves without overwriting them', async () => {
    const corruptRaw = '{ not valid json';
    const corruptStorage = new InMemorySaveStorage({ initialPayload: corruptRaw });
    const targetsA = createTargets();
    const serviceA = new SaveService({ storage: corruptStorage, targets: targetsA });

    const corruptInit = await serviceA.initialise();
    expect(corruptInit.outcome).toBe('corrupted');
    expect(serviceA.getStatus().status).toBe('recovery_required');
    expect(serviceA.getStatus().autoWriteBlocked).toBe(true);

    // Subsequent save requests must NOT overwrite the preserved corrupt payload
    targetsA.settingsService.setMusicEnabled(false);
    expect(serviceA.requestSave('settings_changed', 'high')).toBe(false);
    expect(corruptStorage.getWriteCount()).toBe(0);
    expect(corruptStorage.getCurrentPayload()).toBe(corruptRaw);
    serviceA.dispose();

    const futureRaw = JSON.stringify({
      ...createPartialCampaignSaveFixture(),
      schemaVersion: CURRENT_SAVE_SCHEMA_VERSION + 5,
    });
    const futureStorage = new InMemorySaveStorage({ initialPayload: futureRaw });
    const targetsB = createTargets();
    const serviceB = new SaveService({ storage: futureStorage, targets: targetsB });

    const futureInit = await serviceB.initialise();
    expect(futureInit.outcome).toBe('unsupported_version');
    expect(serviceB.getStatus().status).toBe('unsupported_version');
    expect(serviceB.getStatus().autoWriteBlocked).toBe(true);
    expect(serviceB.requestSave('manual', 'high')).toBe(false);
    expect(futureStorage.getCurrentPayload()).toBe(futureRaw);
    serviceB.dispose();
  });

  it('debounces normal saves, bypasses debounce on high priority, and skips unchanged writes', async () => {
    vi.useFakeTimers();
    try {
      const storage = new InMemorySaveStorage();
      const targets = createTargets();
      const service = new SaveService({
        storage,
        targets,
        normalDebounceMs: 300,
      });
      await service.initialise();

      // Unchanged state produces zero writes
      expect(service.requestSave('manual', 'high')).toBe(false);
      expect(storage.getWriteCount()).toBe(0);

      // Normal-priority settings changes coalesce within 300ms debounce
      targets.settingsService.setMusicEnabled(false);
      expect(service.requestSave('settings_changed', 'normal')).toBe(true);
      targets.settingsService.setSoundEffectsEnabled(false);
      expect(service.requestSave('settings_changed', 'normal')).toBe(true);

      expect(storage.getWriteCount()).toBe(0);
      await vi.advanceTimersByTimeAsync(299);
      expect(storage.getWriteCount()).toBe(0);
      await vi.advanceTimersByTimeAsync(2);
      expect(storage.getWriteCount()).toBe(1);
      expect(service.getStatus().status).toBe('saved');

      // High-priority save bypasses debounce immediately
      targets.tutorialPreference.markCompleted();
      expect(service.requestSave('tutorial_completion', 'high')).toBe(true);
      await Promise.resolve();
      await Promise.resolve();
      expect(storage.getWriteCount()).toBe(2);

      service.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it('serializes concurrent writes so revision 10 cannot mark revision 12 as saved', async () => {
    const storage = new InMemorySaveStorage();
    const targets = createTargets();
    const service = new SaveService({
      storage,
      targets,
      normalDebounceMs: 0,
    });
    await service.initialise();

    storage.setManualWriteControl(true);

    // Revision 1 starts saving
    targets.settingsService.setMusicEnabled(false);
    service.requestSave('settings_changed', 'high');
    expect(storage.getPendingManualWrites()).toHaveLength(1);
    expect(service.getStatus().status).toBe('saving');

    // Revision 2 & Revision 3 requested while Revision 1 is still in flight
    targets.settingsService.setSoundEffectsEnabled(false);
    service.requestSave('settings_changed', 'high');
    targets.tutorialPreference.markCompleted();
    service.requestSave('tutorial_completion', 'high');

    // Still only ONE active write in flight
    expect(storage.getPendingManualWrites()).toHaveLength(1);
    expect(service.getStatus().currentRevision).toBe(3);

    // Complete Revision 1 -> must NOT mark saved; must immediately kick off coalesced Revision 3
    storage.getPendingManualWrites()[0]?.resolve();
    await new Promise<void>((resolve) => {
      globalThis.setTimeout(resolve, 0);
    });

    expect(service.getStatus().lastSavedRevision).toBe(1);
    expect(service.getStatus().hasUnsavedChanges).toBe(true);
    expect(storage.getPendingManualWrites()).toHaveLength(2);

    // Complete Revision 3 -> now durable and saved!
    storage.getPendingManualWrites()[1]?.resolve();
    await new Promise<void>((resolve) => {
      globalThis.setTimeout(resolve, 0);
    });

    expect(service.getStatus().lastSavedRevision).toBe(3);
    expect(service.getStatus().hasUnsavedChanges).toBe(false);
    expect(service.getStatus().status).toBe('saved');

    const lastPayload = storage.getLastSavedPayload();
    expect(lastPayload).not.toBeNull();
    const parsed = JSON.parse(lastPayload ?? '{}') as {
      revision: number;
      tutorial: { completed: boolean };
      settings: { musicEnabled: boolean; soundEffectsEnabled: boolean };
    };
    expect(parsed.revision).toBe(3);
    expect(parsed.tutorial.completed).toBe(true);
    expect(parsed.settings.musicEnabled).toBe(false);
    expect(parsed.settings.soundEffectsEnabled).toBe(false);

    service.dispose();
  });

  it('preserves dirty state on write failure, retries cleanly, and detects external multi-tab conflicts', async () => {
    const storage = new InMemorySaveStorage();
    const targets = createTargets();
    const service = new SaveService({
      storage,
      targets,
      normalDebounceMs: 0,
      maxAutomaticRetries: 0,
    });
    await service.initialise();

    storage.setFailNextSave('STORAGE_QUOTA_EXCEEDED');
    targets.settingsService.setMusicEnabled(false);
    service.requestSave('settings_changed', 'high');
    await service.flush();

    expect(service.getStatus().status).toBe('failed');
    expect(service.getStatus().lastErrorCode).toBe('STORAGE_QUOTA_EXCEEDED');
    expect(service.getStatus().hasUnsavedChanges).toBe(true);
    expect(targets.settingsService.getSettings().musicEnabled).toBe(false);

    // Storage recovers -> retry succeeds
    service.retryIfEligible();
    await service.flush();
    expect(service.getStatus().status).toBe('saved');
    expect(service.getStatus().hasUnsavedChanges).toBe(false);

    // Simulate another browser tab saving a higher revision -> blocks silent overwrite
    const externalNewer = JSON.stringify({
      ...createPartialCampaignSaveFixture(),
      revision: 99,
      gameId: SAVE_GAME_ID,
    });
    storage.seedPayload(externalNewer, true);
    expect(service.getStatus().status).toBe('conflict');
    expect(service.getStatus().autoWriteBlocked).toBe(true);
    expect(service.getStatus().detectedExternalRevision).toBe(99);
    expect(service.requestSave('manual', 'high')).toBe(false);

    service.dispose();
  });

  it('bounds startup loading with a timeout and ignores late storage responses', async () => {
    vi.useFakeTimers();
    try {
      const storage = new InMemorySaveStorage({
        initialPayload: serializeSaveData(createPartialCampaignSaveFixture()),
        loadDelayMs: 5000,
      });
      const targets = createTargets();
      const service = new SaveService({
        storage,
        targets,
        startupLoadTimeoutMs: 250,
      });

      const initPromise = service.initialise();
      await vi.advanceTimersByTimeAsync(260);
      const outcome = await initPromise;

      expect(outcome.outcome).toBe('timeout');
      expect(service.getStatus().status).toBe('unavailable');
      expect(targets.progressionController.getCampaignProgress().completedLevels).toBe(0);

      // Player makes progress after fallback; late load resolution must NOT overwrite it
      targets.tutorialPreference.markCompleted();
      await vi.advanceTimersByTimeAsync(5000);
      expect(targets.tutorialPreference.getStatus()).toBe('completed');
      expect(targets.progressionController.getCampaignProgress().completedLevels).toBe(0);

      service.dispose();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('BrowserSaveStorage', () => {
  it('reads, writes, reports quota errors, and listens for external storage events safely', async () => {
    const map = new Map<string, string>();
    const fakeStorage: BrowserStorageLike = {
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => {
        map.set(k, v);
      },
      removeItem: (k) => {
        map.delete(k);
      },
    };

    const listeners = new Set<(event: StorageEvent) => void>();
    const fakeWindow: StorageEventWindowLike = {
      addEventListener: (_type, listener) => {
        listeners.add(listener);
      },
      removeEventListener: (_type, listener) => {
        listeners.delete(listener);
      },
    };

    const adapter = new BrowserSaveStorage({
      storageKey: 'bottle-shuffle.test',
      storage: fakeStorage,
      windowRef: fakeWindow,
    });

    expect(adapter.isAvailable()).toBe(true);
    expect(await adapter.load()).toBeNull();
    await adapter.save('{"hello":"world"}');
    expect(await adapter.load()).toBe('{"hello":"world"}');

    const observed: (string | null)[] = [];
    const unsub = adapter.onExternalChange((val) => {
      observed.push(val);
    });
    for (const listener of listeners) {
      listener({ key: 'bottle-shuffle.test', newValue: '{"rev":2}' } as StorageEvent);
      listener({ key: 'unrelated.key', newValue: 'ignored' } as StorageEvent);
    }
    expect(observed).toEqual(['{"rev":2}']);
    unsub();

    // Unavailable storage fails cleanly
    const unavailable = new BrowserSaveStorage({ storage: null, windowRef: null });
    expect(unavailable.isAvailable()).toBe(false);
    await expect(unavailable.load()).rejects.toMatchObject({ code: 'STORAGE_UNAVAILABLE' });
    await expect(unavailable.save('{}')).rejects.toMatchObject({ code: 'STORAGE_UNAVAILABLE' });

    // Quota error mapped cleanly
    const quotaStorage = new BrowserSaveStorage({
      storage: {
        getItem: () => null,
        setItem: () => {
          const err = new Error('Quota full');
          err.name = 'QuotaExceededError';
          throw err;
        },
        removeItem: () => undefined,
      },
      windowRef: null,
    });
    await expect(quotaStorage.save('{}')).rejects.toMatchObject({ code: 'STORAGE_QUOTA_EXCEEDED' });

    adapter.dispose();
  });
});
