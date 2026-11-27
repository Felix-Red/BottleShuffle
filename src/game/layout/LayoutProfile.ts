export type LayoutProfile =
  | 'compact-portrait'
  | 'standard-portrait'
  | 'compact-landscape'
  | 'standard-landscape'
  | 'expanded-landscape';

export const ALL_LAYOUT_PROFILES: readonly LayoutProfile[] = Object.freeze([
  'compact-portrait',
  'standard-portrait',
  'compact-landscape',
  'standard-landscape',
  'expanded-landscape',
]);
