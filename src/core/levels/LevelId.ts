export type LevelId = string;
export type ChapterId = string;

const LEVEL_ID_PATTERN = /^level-\d{3,}$/;
const CHAPTER_ID_PATTERN = /^chapter-\d{2,}$/;

export function formatLevelId(levelNumber: number): LevelId {
  const safe = Math.max(1, Math.floor(levelNumber));
  return `level-${String(safe).padStart(3, '0')}`;
}

export function formatChapterId(chapterOrder: number): ChapterId {
  const safe = Math.max(1, Math.floor(chapterOrder));
  return `chapter-${String(safe).padStart(2, '0')}`;
}

export function isValidLevelId(value: unknown): value is LevelId {
  return typeof value === 'string' && LEVEL_ID_PATTERN.test(value.trim());
}

export function isValidChapterId(value: unknown): value is ChapterId {
  return typeof value === 'string' && CHAPTER_ID_PATTERN.test(value.trim());
}
