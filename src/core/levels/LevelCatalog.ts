import type { ChapterDefinition } from './ChapterDefinition';
import type { LevelDefinition } from './LevelDefinition';
import type { ChapterId, LevelId } from './LevelId';
import { assertValidLevelCatalog } from './LevelValidator';

/**
 * Centralised, immutable campaign level catalogue.
 * Holds static chapter and level definitions without pre-generating puzzles at startup.
 */
export class LevelCatalog {
  private readonly levels: readonly LevelDefinition[];
  private readonly chapters: readonly ChapterDefinition[];
  private readonly levelsById: ReadonlyMap<LevelId, LevelDefinition>;
  private readonly levelsByNumber: ReadonlyMap<number, LevelDefinition>;
  private readonly levelIndexById: ReadonlyMap<LevelId, number>;
  private readonly chaptersById: ReadonlyMap<ChapterId, ChapterDefinition>;
  private readonly levelsByChapterId: ReadonlyMap<ChapterId, readonly LevelDefinition[]>;

  public constructor(levels: readonly LevelDefinition[], chapters: readonly ChapterDefinition[]) {
    assertValidLevelCatalog(levels, chapters);

    this.levels = Object.freeze(levels.map((level) => Object.freeze({ ...level })));
    this.chapters = Object.freeze(
      [...chapters]
        .sort((a, b) => a.order - b.order)
        .map((chapter) =>
          Object.freeze({
            ...chapter,
            levelIds: Object.freeze([...chapter.levelIds]),
          }),
        ),
    );

    const byId = new Map<LevelId, LevelDefinition>();
    const byNum = new Map<number, LevelDefinition>();
    const idxById = new Map<LevelId, number>();
    const chapById = new Map<ChapterId, ChapterDefinition>();
    const lvlsByChap = new Map<ChapterId, LevelDefinition[]>();

    for (const chapter of this.chapters) {
      chapById.set(chapter.id, chapter);
      lvlsByChap.set(chapter.id, []);
    }

    for (let i = 0; i < this.levels.length; i += 1) {
      const level = this.levels[i];
      if (level === undefined) {
        continue;
      }
      byId.set(level.id, level);
      byNum.set(level.levelNumber, level);
      idxById.set(level.id, i);
      lvlsByChap.get(level.chapterId)?.push(level);
    }

    const frozenByChap = new Map<ChapterId, readonly LevelDefinition[]>();
    for (const [chapId, chapLevels] of lvlsByChap.entries()) {
      frozenByChap.set(chapId, Object.freeze(chapLevels));
    }

    this.levelsById = byId;
    this.levelsByNumber = byNum;
    this.levelIndexById = idxById;
    this.chaptersById = chapById;
    this.levelsByChapterId = frozenByChap;
  }

  public getLevelById(levelId: LevelId): LevelDefinition | undefined {
    return this.levelsById.get(levelId);
  }

  public getLevelByNumber(levelNumber: number): LevelDefinition | undefined {
    return this.levelsByNumber.get(levelNumber);
  }

  public getAllLevels(): readonly LevelDefinition[] {
    return this.levels;
  }

  public getLevelsByChapter(chapterId: ChapterId): readonly LevelDefinition[] {
    return this.levelsByChapterId.get(chapterId) ?? Object.freeze([]);
  }

  public getNextLevel(levelId: LevelId): LevelDefinition | undefined {
    const index = this.levelIndexById.get(levelId);
    if (index === undefined || index + 1 >= this.levels.length) {
      return undefined;
    }
    return this.levels[index + 1];
  }

  public getPreviousLevel(levelId: LevelId): LevelDefinition | undefined {
    const index = this.levelIndexById.get(levelId);
    if (index === undefined || index - 1 < 0) {
      return undefined;
    }
    return this.levels[index - 1];
  }

  public getFirstLevel(): LevelDefinition {
    const first = this.levels[0];
    if (first === undefined) {
      throw new Error('LevelCatalog invariant violated: empty catalogue.');
    }
    return first;
  }

  public getFinalLevel(): LevelDefinition {
    const last = this.levels[this.levels.length - 1];
    if (last === undefined) {
      throw new Error('LevelCatalog invariant violated: empty catalogue.');
    }
    return last;
  }

  public getTotalLevelCount(): number {
    return this.levels.length;
  }

  public getChapterById(chapterId: ChapterId): ChapterDefinition | undefined {
    return this.chaptersById.get(chapterId);
  }

  public getAllChapters(): readonly ChapterDefinition[] {
    return this.chapters;
  }

  public getChapterForLevel(levelId: LevelId): ChapterDefinition | undefined {
    const level = this.levelsById.get(levelId);
    if (level === undefined) {
      return undefined;
    }
    return this.chaptersById.get(level.chapterId);
  }
}

export function createLevelCatalog(
  levels: readonly LevelDefinition[],
  chapters: readonly ChapterDefinition[],
): LevelCatalog {
  return new LevelCatalog(levels, chapters);
}
