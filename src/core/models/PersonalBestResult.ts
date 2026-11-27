import type { CompletionRecord } from '../progression/CompletionRecord';
import type { EarnedStarRating } from './StarRating';

/**
 * Deterministic outcome of comparing a completed attempt against any prior CompletionRecord.
 * Equal values are never treated as improvements.
 */
export interface PersonalBestComparison {
  readonly isFirstCompletion: boolean;
  readonly improvedScore: boolean;
  readonly improvedStars: boolean;
  readonly improvedMoves: boolean;
  readonly improvedTime: boolean;
  readonly hasAnyImprovement: boolean;
  readonly previousBestScore: number | null;
  readonly previousBestStars: EarnedStarRating | null;
  readonly previousBestMoves: number | null;
  readonly previousBestElapsedMs: number | null;
  readonly bestScore: number | null;
  readonly bestStars: EarnedStarRating | null;
  readonly bestMoves: number;
  readonly bestElapsedMs: number;
}

export interface PersonalBestCandidate {
  readonly moveCount: number;
  readonly elapsedMs: number;
  readonly score?: number;
  readonly starRating?: EarnedStarRating;
}

/**
 * Compares a newly completed attempt against an optional existing CompletionRecord.
 * Higher score/stars are better; lower moves/elapsedMs are better; equal values are not improvements.
 */
export function comparePersonalBest(
  previous: CompletionRecord | null | undefined,
  candidate: PersonalBestCandidate,
): PersonalBestComparison {
  const normalizedElapsedMs = Math.round(candidate.elapsedMs);

  if (previous === null || previous === undefined) {
    return Object.freeze({
      isFirstCompletion: true,
      improvedScore: false,
      improvedStars: false,
      improvedMoves: false,
      improvedTime: false,
      hasAnyImprovement: false,
      previousBestScore: null,
      previousBestStars: null,
      previousBestMoves: null,
      previousBestElapsedMs: null,
      bestScore: candidate.score ?? null,
      bestStars: candidate.starRating ?? null,
      bestMoves: candidate.moveCount,
      bestElapsedMs: normalizedElapsedMs,
    });
  }

  const prevScore = previous.bestScore ?? null;
  const prevStars = previous.bestStarRating ?? null;

  const improvedScore =
    candidate.score !== undefined && (prevScore === null || candidate.score > prevScore);
  const improvedStars =
    candidate.starRating !== undefined && (prevStars === null || candidate.starRating > prevStars);
  const improvedMoves = candidate.moveCount < previous.bestMoveCount;
  const improvedTime = normalizedElapsedMs < previous.bestElapsedMs;

  const bestScore =
    candidate.score !== undefined
      ? prevScore !== null
        ? Math.max(prevScore, candidate.score)
        : candidate.score
      : prevScore;

  const bestStars: EarnedStarRating | null =
    candidate.starRating !== undefined
      ? prevStars !== null
        ? (Math.max(prevStars, candidate.starRating) as EarnedStarRating)
        : candidate.starRating
      : prevStars;

  return Object.freeze({
    isFirstCompletion: false,
    improvedScore,
    improvedStars,
    improvedMoves,
    improvedTime,
    hasAnyImprovement: improvedScore || improvedStars || improvedMoves || improvedTime,
    previousBestScore: prevScore,
    previousBestStars: prevStars,
    previousBestMoves: previous.bestMoveCount,
    previousBestElapsedMs: previous.bestElapsedMs,
    bestScore,
    bestStars,
    bestMoves: Math.min(previous.bestMoveCount, candidate.moveCount),
    bestElapsedMs: Math.min(previous.bestElapsedMs, normalizedElapsedMs),
  });
}
