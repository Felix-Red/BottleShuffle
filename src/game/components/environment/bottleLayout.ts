import { Dimens } from '../../../design-system/tokens/Dimens';

export const BOTTLE_SOURCE_DIMENSIONS = {
  width: 256,
  height: 512,
  aspectRatio: 256 / 512,
} as const;

export const RACK_BOTTLE_LIMITS = {
  minCount: 3,
  maxCount: 10,
} as const;

export interface BottleRackLayoutInput {
  readonly availableWidth: number;
  readonly availableHeight: number;
  readonly bottleCount: number;
  readonly aspectRatio?: number;
  readonly minInteractionSize?: number;
  readonly maxBottleWidth?: number;
  readonly maxBottleHeight?: number;
  readonly horizontalSpacing?: number;
  readonly verticalSpacing?: number;
}

export interface BottleHitRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface BottleSlotLayout {
  readonly slotIndex: number;
  readonly row: number;
  readonly col: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** Non-overlapping interactive hit target width in CSS/logical pixels. */
  readonly hitWidth: number;
  /** Non-overlapping interactive hit target height in CSS/logical pixels. */
  readonly hitHeight: number;
  /** Hit bounds relative to the rack center (top-left x, y, width, height). */
  readonly hitRect: BottleHitRect;
}

export interface BottleRackRowLayout {
  readonly rowIndex: number;
  readonly count: number;
  readonly shelfY: number;
  readonly shelfWidth: number;
  readonly shelfThickness: number;
}

export interface BottleRackLayoutResult {
  readonly bottleCount: number;
  readonly rows: number;
  readonly columns: number;
  readonly orientation: 'landscape' | 'portrait';
  readonly bottleWidth: number;
  readonly bottleHeight: number;
  readonly hitWidth: number;
  readonly hitHeight: number;
  readonly horizontalSpacing: number;
  readonly verticalSpacing: number;
  readonly slots: readonly BottleSlotLayout[];
  readonly rowLayouts: readonly BottleRackRowLayout[];
  readonly rackWidth: number;
  readonly rackHeight: number;
}

const DEFAULT_MIN_INTERACTION_SIZE = Dimens.MinTouchTarget;
const DEFAULT_MAX_BOTTLE_WIDTH = 112;
const DEFAULT_MAX_BOTTLE_HEIGHT = 224;
const DEFAULT_HORIZONTAL_SPACING = Dimens.Space12;
const DEFAULT_VERTICAL_SPACING = Dimens.Space32;
const SHELF_PADDING_X = Dimens.Space20;

function sanitizePositive(value: number | undefined, fallback: number, minimum = 1): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(minimum, value);
}

export function clampRackBottleCount(count: number): number {
  if (!Number.isFinite(count)) {
    return RACK_BOTTLE_LIMITS.minCount;
  }
  return Math.min(
    RACK_BOTTLE_LIMITS.maxCount,
    Math.max(RACK_BOTTLE_LIMITS.minCount, Math.floor(count)),
  );
}

interface CandidateMetrics {
  readonly rows: 1 | 2;
  readonly columns: number;
  readonly horizontalSpacing: number;
  readonly verticalSpacing: number;
  readonly shelfThickness: number;
  readonly bottleWidth: number;
  readonly bottleHeight: number;
}

function evaluateRowCandidate(params: {
  readonly rows: 1 | 2;
  readonly bottleCount: number;
  readonly usableShelfWidth: number;
  readonly safeHeight: number;
  readonly baseSpacingX: number;
  readonly requestedVerticalSpacing: number;
  readonly maxBottleWidth: number;
  readonly maxBottleHeight: number;
}): CandidateMetrics {
  const { rows, bottleCount, usableShelfWidth, safeHeight } = params;
  const columns = Math.ceil(bottleCount / rows);
  const shelfThickness = safeHeight < 135 ? 14 : safeHeight < 190 ? 18 : 22;

  const horizontalSpacing =
    usableShelfWidth < 340
      ? Math.max(Dimens.Space4, Math.round(params.baseSpacingX * 0.5))
      : usableShelfWidth < 500
        ? Math.max(Dimens.Space6, Math.round(params.baseSpacingX * 0.7))
        : params.baseSpacingX;

  const verticalSpacing =
    rows === 1
      ? params.requestedVerticalSpacing
      : safeHeight < 160
        ? Math.min(params.requestedVerticalSpacing, Dimens.Space10)
        : safeHeight < 230
          ? Math.min(params.requestedVerticalSpacing, Dimens.Space16)
          : params.requestedVerticalSpacing;

  const maxWidthByColumns = (usableShelfWidth - horizontalSpacing * (columns - 1)) / columns;
  const heightBudgetPerRow =
    (safeHeight - (rows - 1) * verticalSpacing - rows * shelfThickness) / rows;
  const maxWidthByHeight = heightBudgetPerRow * BOTTLE_SOURCE_DIMENSIONS.aspectRatio;

  const rawWidth = Math.min(
    params.maxBottleWidth,
    params.maxBottleHeight * BOTTLE_SOURCE_DIMENSIONS.aspectRatio,
    maxWidthByColumns,
    maxWidthByHeight,
  );
  const bottleWidth = Math.max(16, Math.floor(rawWidth));
  const bottleHeight = Math.round(bottleWidth / BOTTLE_SOURCE_DIMENSIONS.aspectRatio);

  return {
    rows,
    columns,
    horizontalSpacing,
    verticalSpacing,
    shelfThickness,
    bottleWidth,
    bottleHeight,
  };
}

export function calculateBottleRackLayout(input: BottleRackLayoutInput): BottleRackLayoutResult {
  const bottleCount = clampRackBottleCount(input.bottleCount);
  const safeWidth = sanitizePositive(input.availableWidth, 320, 160);
  const safeHeight = sanitizePositive(input.availableHeight, 240, 80);
  const aspectRatio = sanitizePositive(input.aspectRatio, safeWidth / safeHeight, 0.1);
  const orientation: 'landscape' | 'portrait' = aspectRatio >= 1 ? 'landscape' : 'portrait';

  const minInteraction = sanitizePositive(
    input.minInteractionSize,
    DEFAULT_MIN_INTERACTION_SIZE,
    36,
  );
  const maxBottleWidth = Math.max(
    24,
    sanitizePositive(input.maxBottleWidth, DEFAULT_MAX_BOTTLE_WIDTH, 24),
  );
  const maxBottleHeight = Math.max(
    48,
    sanitizePositive(input.maxBottleHeight, DEFAULT_MAX_BOTTLE_HEIGHT, 48),
  );
  const baseSpacingX = sanitizePositive(
    input.horizontalSpacing,
    DEFAULT_HORIZONTAL_SPACING,
    Dimens.Space4,
  );
  const requestedVerticalSpacing = sanitizePositive(
    input.verticalSpacing,
    DEFAULT_VERTICAL_SPACING,
    Dimens.Space10,
  );

  const shelfPadX = safeWidth < 360 ? Dimens.Space12 : SHELF_PADDING_X;
  const usableShelfWidth = Math.max(120, safeWidth - shelfPadX * 2);

  const singleRow = evaluateRowCandidate({
    rows: 1,
    bottleCount,
    usableShelfWidth,
    safeHeight,
    baseSpacingX,
    requestedVerticalSpacing,
    maxBottleWidth,
    maxBottleHeight,
  });

  let chosen: CandidateMetrics = singleRow;

  if (bottleCount >= 6) {
    const twoRows = evaluateRowCandidate({
      rows: 2,
      bottleCount,
      usableShelfWidth,
      safeHeight,
      baseSpacingX,
      requestedVerticalSpacing,
      maxBottleWidth,
      maxBottleHeight,
    });

    if (orientation === 'portrait') {
      // Portrait stacks 6-10 bottles into 2 balanced rows unless height is extraordinarily tight
      chosen = twoRows.bottleWidth >= 20 ? twoRows : singleRow;
    } else {
      // Landscape uses 1 row whenever it meets comfortable size or matches/beats 2-row visual width
      const singleRowComfortable = singleRow.bottleWidth >= minInteraction;
      chosen =
        singleRowComfortable || singleRow.bottleWidth >= twoRows.bottleWidth ? singleRow : twoRows;
    }
  }

  const {
    rows,
    columns,
    horizontalSpacing,
    verticalSpacing,
    shelfThickness,
    bottleWidth,
    bottleHeight,
  } = chosen;

  // Separate visual bottle dimensions from non-overlapping hit target dimensions
  const maxNonOverlappingHitW =
    columns > 1
      ? Math.max(bottleWidth, Math.floor(bottleWidth + horizontalSpacing - 2))
      : Math.max(bottleWidth, minInteraction);
  const hitWidth = Math.max(bottleWidth, Math.min(minInteraction, maxNonOverlappingHitW));

  const maxNonOverlappingHitH =
    rows > 1
      ? Math.max(bottleHeight, Math.floor(bottleHeight + shelfThickness + verticalSpacing - 2))
      : Math.max(bottleHeight, minInteraction);
  const hitHeight = Math.max(bottleHeight, Math.min(minInteraction, maxNonOverlappingHitH));

  const rowCounts: number[] = [];
  if (rows === 1) {
    rowCounts.push(bottleCount);
  } else {
    const firstRowCount = Math.ceil(bottleCount / 2);
    rowCounts.push(firstRowCount, bottleCount - firstRowCount);
  }

  const rowBlockHeight = bottleHeight + shelfThickness;
  const totalHeight = rows * rowBlockHeight + (rows - 1) * verticalSpacing;
  const topY = -totalHeight / 2;

  const slots: BottleSlotLayout[] = [];
  const rowLayouts: BottleRackRowLayout[] = [];

  let slotIndex = 0;
  let widestShelf = 0;

  for (let row = 0; row < rows; row += 1) {
    const countInRow = rowCounts[row] ?? 0;
    const rowContentWidth =
      countInRow * bottleWidth + Math.max(0, countInRow - 1) * horizontalSpacing;
    const shelfWidth = Math.min(safeWidth, Math.round(rowContentWidth + shelfPadX * 2));
    widestShelf = Math.max(widestShelf, shelfWidth);

    const rowTopY = topY + row * (rowBlockHeight + verticalSpacing);
    const shelfY = Math.round(rowTopY + bottleHeight);
    const startX = -rowContentWidth / 2 + bottleWidth / 2;

    rowLayouts.push({
      rowIndex: row,
      count: countInRow,
      shelfY,
      shelfWidth,
      shelfThickness,
    });

    for (let col = 0; col < countInRow; col += 1) {
      const slotX = Math.round(startX + col * (bottleWidth + horizontalSpacing));
      const hitCenterY = shelfY - bottleHeight / 2;
      slots.push({
        slotIndex,
        row,
        col,
        x: slotX,
        y: shelfY,
        width: bottleWidth,
        height: bottleHeight,
        hitWidth,
        hitHeight,
        hitRect: {
          x: Math.round(slotX - hitWidth / 2),
          y: Math.round(hitCenterY - hitHeight / 2),
          width: hitWidth,
          height: hitHeight,
        },
      });
      slotIndex += 1;
    }
  }

  return {
    bottleCount,
    rows,
    columns,
    orientation,
    bottleWidth,
    bottleHeight,
    hitWidth,
    hitHeight,
    horizontalSpacing,
    verticalSpacing,
    slots,
    rowLayouts,
    rackWidth: widestShelf,
    rackHeight: Math.round(totalHeight),
  };
}
