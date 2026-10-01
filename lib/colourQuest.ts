import { gameCatalog, type GameLevel } from "@/data/gameCatalog";

export type LevelMeta = GameLevel;
export const COLOUR_QUEST_LEVELS = gameCatalog.find((game) => game.id === "color_quest")!.levels;

export function getColourQuestLevel(id: number): LevelMeta | undefined {
  return COLOUR_QUEST_LEVELS.find((l) => l.id === id);
}

/**
 * Normalizes game slug to authoritative "color-quest" DB key
 */
export function normalizeGameSlug(slug: string): string {
  if (!slug) return "color-quest";
  const lower = slug.toLowerCase().trim();
  if (lower === "colour-quest" || lower === "color-quest") {
    return "color-quest";
  }
  return lower;
}

export function normalizeStars(stars: unknown): 0 | 1 | 2 | 3 {
  if (typeof stars === "number" && Number.isInteger(stars) && stars >= 0 && stars <= 3) {
    return stars as 0 | 1 | 2 | 3;
  }
  return 0;
}

/**
 * Calculates star rating for a score in range [0, 1].
 * Specification:
 * 80%+ (>= 0.80) -> 3 stars
 * 60%+ (>= 0.60) -> 2 stars
 * 40%+ (>= 0.40) -> 1 star
 * < 40%         -> 0 stars
 */
export function calculateStars(score: number): 0 | 1 | 2 | 3 {
  if (score >= 0.8) return 3;
  if (score >= 0.6) return 2;
  if (score >= 0.4) return 1;
  return 0;
}

/**
 * Determines whether a level is unlocked.
 * L1 is always unlocked.
 * Level N (N > 1) unlocks only when Level N - 1 has 3 stars.
 */
export function isLevelUnlocked(
  levelId: number,
  progressMap: Record<number, { stars: number }>
): boolean {
  if (levelId === 1) return true;
  if (levelId < 1 || levelId > COLOUR_QUEST_LEVELS.length) return false;
  const previousLevelProgress = progressMap[levelId - 1];
  return Boolean(previousLevelProgress && previousLevelProgress.stars >= 3);
}

/**
 * Merges best score cleanly: max(oldScore, newScore)
 */
export function mergeBestScore(
  oldScore: number | undefined,
  newScore: number
): number {
  const safeOld = typeof oldScore === "number" && !isNaN(oldScore) ? oldScore : 0;
  return Math.max(safeOld, newScore);
}

/**
 * Merges best stars cleanly: max(oldStars, newStars)
 */
export function mergeBestStars(
  oldStars: number | undefined,
  newStars: number
): 0 | 1 | 2 | 3 {
  const safeOld = typeof oldStars === "number" ? oldStars : 0;
  const merged = Math.max(safeOld, newStars);
  return (merged > 3 ? 3 : merged) as 0 | 1 | 2 | 3;
}

/**
 * Computes game completion progress across all 6 levels.
 */
export function calculateGameProgress(
  progressMap: Record<number, { stars: number }>
): { completedLevels: number; totalLevels: number; progressPercentage: number } {
  const totalLevels = COLOUR_QUEST_LEVELS.length;
  let completedLevels = 0;

  for (let i = 1; i <= totalLevels; i++) {
    if (progressMap[i] && progressMap[i].stars > 0) {
      completedLevels++;
    }
  }

  const progressPercentage = Math.round((completedLevels / totalLevels) * 100);

  return {
    completedLevels,
    totalLevels,
    progressPercentage,
  };
}
