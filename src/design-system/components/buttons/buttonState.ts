export type ButtonInteractionState =
  'default' | 'hovered' | 'pressed' | 'focused' | 'disabled' | 'loading';

export interface ButtonStateFlags {
  readonly enabled: boolean;
  readonly loading: boolean;
  readonly hovered: boolean;
  readonly pressed: boolean;
  readonly focused: boolean;
}

export function resolveButtonState(flags: ButtonStateFlags): ButtonInteractionState {
  if (flags.loading) {
    return 'loading';
  }
  if (!flags.enabled) {
    return 'disabled';
  }
  if (flags.pressed) {
    return 'pressed';
  }
  if (flags.hovered) {
    return 'hovered';
  }
  if (flags.focused) {
    return 'focused';
  }
  return 'default';
}

export function canTriggerButtonAction(
  flags: Pick<ButtonStateFlags, 'enabled' | 'loading'>,
  nowMs: number,
  lastActivatedAtMs: number,
  cooldownMs: number,
): boolean {
  if (!flags.enabled || flags.loading) {
    return false;
  }

  if (cooldownMs <= 0) {
    return true;
  }

  return nowMs - lastActivatedAtMs >= cooldownMs;
}
