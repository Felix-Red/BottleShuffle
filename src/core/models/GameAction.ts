export type GameAction =
  | { readonly type: 'START_PUZZLE' }
  | { readonly type: 'SELECT_BOTTLE'; readonly slotIndex: number }
  | { readonly type: 'CLEAR_SELECTION' }
  | {
      readonly type: 'SWAP_BOTTLES';
      readonly firstIndex: number;
      readonly secondIndex: number;
    }
  | { readonly type: 'EXPIRE_TIMER' }
  | { readonly type: 'PAUSE_PUZZLE' }
  | { readonly type: 'RESUME_PUZZLE' }
  | { readonly type: 'RESTART_PUZZLE' };

export type GameActionType = GameAction['type'];
