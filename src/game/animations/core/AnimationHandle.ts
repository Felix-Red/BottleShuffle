export interface AnimationHandle {
  readonly id: number;
  isActive(): boolean;
  cancel(): void;
}

/**
 * Creates a single-shot cancellable animation handle.
 * Calling cancel() or finish() more than once is guaranteed to be a no-op.
 */
export function createAnimationHandle(
  id: number,
  onCancel: () => void,
): { readonly handle: AnimationHandle; readonly markFinished: () => void } {
  let active = true;

  const handle: AnimationHandle = {
    id,
    isActive: () => active,
    cancel: () => {
      if (!active) {
        return;
      }
      active = false;
      onCancel();
    },
  };

  return {
    handle,
    markFinished: () => {
      active = false;
    },
  };
}
