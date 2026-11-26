/**
 * Aggregate outcome of a single valid pairwise bottle swap.
 * Intentionally omits individual matching positions and hidden target details.
 */
export interface SwapResult {
  readonly firstIndex: number;
  readonly secondIndex: number;
  readonly previousMatchCount: number;
  readonly currentMatchCount: number;
  readonly matchDelta: number;
  readonly moveCount: number;
  readonly isCompleted: boolean;
}
