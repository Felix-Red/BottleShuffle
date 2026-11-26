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

export interface BottleSlotLayout {
  readonly slotIndex: number;
  readonly row: number;
  readonly col: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
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

export function calculateBottleRackLayout(input: BottleRackLayoutInput): BottleRackLayoutResult {
  const bottleCount = clampRackBottleCount(input.bottleCount);
  const safeWidth = sanitizePositive(input.availableWidth, 320, 160);
  const safeHeight = sanitizePositive(input.availableHeight, 240, 140);
  const aspectRatio = sanitizePositive(input.aspectRatio, safeWidth / safeHeight, 0.1);
  const orientation: 'landscape' | 'portrait' = aspectRatio >= 1 ? 'landscape' : 'portrait';

  const minInteraction = sanitizePositive(
    input.minInteractionSize,
    DEFAULT_MIN_INTERACTION_SIZE,
    36,
  );
  const maxBottleWidth = Math.max(
    minInteraction,
    sanitizePositive(input.maxBottleWidth, DEFAULT_MAX_BOTTLE_WIDTH, 48),
  );
  const maxBottleHeight = Math.max(
    minInteraction * 2,
    sanitizePositive(input.maxBottleHeight, DEFAULT_MAX_BOTTLE_HEIGHT, 96),
  );
  const baseSpacingX = sanitizePositive(
    input.horizontalSpacing,
    DEFAULT_HORIZONTAL_SPACING,
    Dimens.Space6,
  );
  const verticalSpacing = sanitizePositive(
    input.verticalSpacing,
    DEFAULT_VERTICAL_SPACING,
    Dimens.Space16,
  );

  const usableShelfWidth = Math.max(120, safeWidth - SHELF_PADDING_X * 2);
  const singleRowCandidateWidth =
    (usableShelfWidth - baseSpacingX * (bottleCount - 1)) / bottleCount;

  const needsTwoRows =
    bottleCount >= 6 && (orientation === 'portrait' || singleRowCandidateWidth < minInteraction);

  const rows = needsTwoRows ? 2 : 1;
  const columns = Math.ceil(bottleCount / rows);

  // Adapt spacing gracefully on tighter widths
  const horizontalSpacing =
    usableShelfWidth < 460 ? Math.max(Dimens.Space6, Math.round(baseSpacingX * 0.7)) : baseSpacingX;

  const maxWidthByColumns = (usableShelfWidth - horizontalSpacing * (columns - 1)) / columns;
  const shelfThickness = 22;
  const heightBudgetPerRow =
    (safeHeight - (rows - 1) * verticalSpacing - rows * shelfThickness) / rows;
  const maxWidthByHeight = heightBudgetPerRow * BOTTLE_SOURCE_DIMENSIONS.aspectRatio;

  const unclampedWidth = Math.min(
    maxBottleWidth,
    maxBottleHeight * BOTTLE_SOURCE_DIMENSIONS.aspectRatio,
    maxWidthByColumns,
    maxWidthByHeight,
  );

  const bottleWidth = Math.max(
    Math.min(minInteraction, maxWidthByColumns),
    Math.floor(unclampedWidth),
  );
  const bottleHeight = Math.round(bottleWidth / BOTTLE_SOURCE_DIMENSIONS.aspectRatio);

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
    const shelfWidth = Math.min(safeWidth, Math.round(rowContentWidth + SHELF_PADDING_X * 2));
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
      slots.push({
        slotIndex,
        row,
        col,
        x: Math.round(startX + col * (bottleWidth + horizontalSpacing)),
        y: shelfY,
        width: bottleWidth,
        height: bottleHeight,
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
    horizontalSpacing,
    verticalSpacing,
    slots,
    rowLayouts,
    rackWidth: widestShelf,
    rackHeight: Math.round(totalHeight),
  };
}
