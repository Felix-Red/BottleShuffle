import type Phaser from 'phaser';
import { PERSISTENCE_CONFIG } from '../../../config/PersistenceConfig';
import { Toast, type GameTheme } from '../../../design-system';
import type { Unsubscribe } from '../../../platform/contracts/GamePlatform';
import type { SaveService } from '../../../services/persistence/SaveService';
import type {
  SaveLifecycleStatus,
  SaveStatusSnapshot,
} from '../../../services/persistence/SaveStatus';

const WARNING_STATUSES = new Set<SaveLifecycleStatus>([
  'unavailable',
  'recovery_required',
  'unsupported_version',
  'conflict',
]);

/**
 * Unobtrusive player-facing save feedback controller reusing the Design System Toast.
 * Displays non-blocking warnings at most once per distinct storage issue per session,
 * and never interrupts active gameplay or spams routine save confirmations.
 */
export class SaveStatusToastCoordinator {
  private readonly saveService: SaveService;
  private readonly toast: Toast;
  private readonly shownWarnings: Set<SaveLifecycleStatus>;
  private unsubscribe?: Unsubscribe;
  private disposed = false;

  public constructor(
    scene: Phaser.Scene,
    saveService: SaveService,
    theme: GameTheme,
    shownWarnings: Set<SaveLifecycleStatus> = new Set<SaveLifecycleStatus>(),
  ) {
    this.saveService = saveService;
    this.shownWarnings = shownWarnings;
    this.toast = new Toast(scene, { theme });
    this.toast.resize(scene.scale.width, scene.scale.height);

    this.handleSnapshot(this.saveService.getStatus());
    this.unsubscribe = this.saveService.subscribe((snapshot) => {
      this.handleSnapshot(snapshot);
    });
  }

  public resize(width: number, height: number): void {
    this.toast.resize(width, height);
  }

  public setTheme(theme: GameTheme): void {
    this.toast.setTheme(theme);
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.toast.destroy();
  }

  private handleSnapshot(snapshot: SaveStatusSnapshot): void {
    if (this.disposed || !WARNING_STATUSES.has(snapshot.status)) {
      return;
    }
    if (this.shownWarnings.has(snapshot.status)) {
      return;
    }

    this.shownWarnings.add(snapshot.status);

    let message: string = PERSISTENCE_CONFIG.copy.unavailableWarning;
    let variant: 'info' | 'warning' = 'warning';

    if (snapshot.status === 'recovery_required') {
      message = PERSISTENCE_CONFIG.copy.corruptedWarning;
    } else if (snapshot.status === 'unsupported_version') {
      message = PERSISTENCE_CONFIG.copy.unsupportedVersionWarning;
      variant = 'info';
    } else if (snapshot.status === 'conflict') {
      message = PERSISTENCE_CONFIG.copy.conflictWarning;
    }

    this.toast.show({
      message,
      variant,
      durationMs: 4200,
    });
  }
}
