export type TutorialAction =
  | { readonly type: 'START_TUTORIAL' }
  | { readonly type: 'ACKNOWLEDGE_INTRO' }
  | { readonly type: 'BOTTLE_SELECTED'; readonly slotIndex: number }
  | { readonly type: 'BOTTLE_DESELECTED' }
  | { readonly type: 'GUIDED_SWAP_STARTED' }
  | { readonly type: 'SWAP_ANIMATION_COMPLETED' }
  | { readonly type: 'ADVANCE_COUNTER_DEMO' }
  | { readonly type: 'ACKNOWLEDGE_COUNTER' }
  | { readonly type: 'INDEPENDENT_PUZZLE_SOLVED' }
  | { readonly type: 'RESTART_CURRENT_STAGE' }
  | { readonly type: 'SKIP_TUTORIAL' };
