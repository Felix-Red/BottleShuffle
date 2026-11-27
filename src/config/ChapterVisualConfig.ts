import { CANONICAL_BOTTLE_IDS, type BottleId, type ChapterId, type DifficultyId } from '../core';
import { Colors } from '../design-system/tokens/Colors';

export interface ChapterVisualTheme {
  readonly accentHex: string;
  readonly accentName: string;
  readonly badgeBgHex: string;
  readonly decorativeBottleIds: readonly BottleId[];
}

interface ChapterVisualOverride {
  readonly accentHex: string;
  readonly accentName: string;
}

const CHAPTER_VISUAL_OVERRIDES: Readonly<Record<string, ChapterVisualOverride>> = {
  'chapter-01': { accentHex: Colors.Bottle.Green, accentName: 'Green' },
  'chapter-02': { accentHex: Colors.Bottle.Blue, accentName: 'Blue' },
  'chapter-03': { accentHex: Colors.Bottle.Teal, accentName: 'Teal' },
  'chapter-04': { accentHex: Colors.Brand.Secondary, accentName: 'Gold' },
  'chapter-05': { accentHex: Colors.Bottle.Orange, accentName: 'Orange' },
  'chapter-06': { accentHex: Colors.Brand.Primary, accentName: 'Purple' },
};

const FALLBACK_CHAPTER_ACCENTS: readonly ChapterVisualOverride[] = [
  { accentHex: Colors.Bottle.Pink, accentName: 'Pink' },
  { accentHex: Colors.Bottle.Teal, accentName: 'Teal' },
  { accentHex: Colors.Brand.Secondary, accentName: 'Gold' },
  { accentHex: Colors.Bottle.Blue, accentName: 'Blue' },
  { accentHex: Colors.Brand.Primary, accentName: 'Purple' },
  { accentHex: Colors.Bottle.Green, accentName: 'Green' },
];

/**
 * Deterministic decorative bottle selection for chapter showcase artwork.
 * Never generates a puzzle or mirrors any campaign level's hidden target sequence.
 */
export function getDecorativeBottleIdsForCount(
  bottleCount: number,
  chapterOrder = 1,
): readonly BottleId[] {
  const safeCount = Math.max(1, Math.min(CANONICAL_BOTTLE_IDS.length, Math.floor(bottleCount)));
  if (safeCount >= CANONICAL_BOTTLE_IDS.length) {
    return CANONICAL_BOTTLE_IDS;
  }

  // Deterministic gentle rotation per chapter so chapters feel visually distinct
  const offset = Math.max(0, (chapterOrder - 1) % CANONICAL_BOTTLE_IDS.length);
  const result: BottleId[] = [];
  for (let i = 0; i < safeCount; i += 1) {
    const id = CANONICAL_BOTTLE_IDS[(offset + i) % CANONICAL_BOTTLE_IDS.length];
    if (id !== undefined) {
      result.push(id);
    }
  }
  return Object.freeze(result);
}

/**
 * Resolves visual presentation metadata for any chapter ID, providing a deterministic
 * fallback palette for future chapters beyond the initial six.
 */
export function getChapterVisualTheme(
  chapterId: ChapterId,
  bottleCount: number,
  chapterOrder: number,
): ChapterVisualTheme {
  const explicit = CHAPTER_VISUAL_OVERRIDES[chapterId];
  const fallbackIndex = Math.max(0, chapterOrder - 1) % FALLBACK_CHAPTER_ACCENTS.length;
  const resolved = explicit ??
    FALLBACK_CHAPTER_ACCENTS[fallbackIndex] ?? {
      accentHex: Colors.Brand.Primary,
      accentName: 'Purple',
    };

  return Object.freeze({
    accentHex: resolved.accentHex,
    accentName: resolved.accentName,
    badgeBgHex: Colors.Surface.ElevatedSurface,
    decorativeBottleIds: getDecorativeBottleIdsForCount(bottleCount, chapterOrder),
  });
}

export const LEVEL_SELECTION_DIFFICULTY_DESCRIPTIONS: Readonly<Record<DifficultyId, string>> = {
  beginner: 'Swap 3 bottles to uncover the hidden match order.',
  easy: 'Deduce the hidden sequence across 4 colourful bottles.',
  normal: 'Plan deliberate swaps across 5 bottles to maximise matches.',
  intermediate: 'Use structured deduction across 6 distinct bottles.',
  hard: 'Master an 8-bottle arrangement with deeper swap chains.',
  expert: 'Take on the full 10-bottle deduction challenge.',
};

export const LEVEL_SELECTION_COPY = {
  screenTitle: 'Select Level',
  chapterProgressLabel: 'CHAPTER PROGRESS',
  chapterCompleteLabel: 'Chapter Complete',
  campaignCompleteLabel: 'Campaign Complete!',
  lockedChapterLabel: 'Locked Chapter',
  personalBestHeading: 'PERSONAL BEST',
  playLevelButton: 'Play Level',
  replayLevelButton: 'Replay Level',
  closeButton: 'Close',
  errorModalTitle: 'Unable to Launch Level',
  errorDismissLabel: 'OK',
  recommendedBadge: 'NEXT',
} as const;

export const LEVEL_SELECTION_MOTION = {
  chapterTransitionMs: 240,
  chapterSlideOffsetPx: 36,
  levelUnlockDurationMs: 420,
  recommendedPulseDurationMs: 1400,
} as const;
