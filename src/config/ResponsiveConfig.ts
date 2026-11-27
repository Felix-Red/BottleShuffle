export const RESPONSIVE_CONFIG = Object.freeze({
  /** Reference landscape design resolution. */
  referenceLandscape: Object.freeze({ width: 1280, height: 720 }),
  /** Minimum sanitized container dimensions to prevent divide-by-zero or negative math. */
  minViewportWidth: 280,
  minViewportHeight: 280,
  /** Profile classification thresholds in CSS/logical pixels (Phaser.Scale.RESIZE is 1:1). */
  breakpoints: Object.freeze({
    compactPortraitMaxWidth: 400,
    compactLandscapeMaxHeight: 450,
    expandedLandscapeMinWidth: 1100,
    expandedLandscapeMinHeight: 650,
  }),
  /** Internal GPU/rendering performance default capping text/canvas supersampling. */
  maxEffectiveDpr: 2,
  minEffectiveDpr: 1,
  /** Preferred minimum interactive touch target in CSS pixels. */
  preferredMinTouchTargetPx: 44,
  /** Maximum centered content width on large desktop/expanded monitors. */
  maxExpandedContentWidth: 1220,
});
