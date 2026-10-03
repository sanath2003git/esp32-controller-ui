import { gameCatalog, getGameDefinition, type GameLevel } from "@/data/gameCatalog";
import {
  calculateGameProgress,
  calculateStars,
  isLevelUnlocked,
  mergeBestScore,
  mergeBestStars,
  normalizeGameSlug,
} from "./colourQuest";
import type { LevelProgress, UserGameProgressResponse } from "@/types/colourQuest";

const LOCAL_STORAGE_TRUST_KEY = "robotoy_trust_v1";

export function getTrustLevel(): number {
  if (typeof window === "undefined") return 50;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_TRUST_KEY);
    if (!raw) return 50;
    const val = parseInt(raw, 10);
    return isNaN(val) ? 50 : Math.min(100, Math.max(0, val));
  } catch {
    return 50;
  }
}

export function incrementTrustLevel(amount: number): void {
  if (typeof window === "undefined") return;
  try {
    const current = getTrustLevel();
    const newLevel = Math.min(100, Math.max(0, current + amount));
    localStorage.setItem(LOCAL_STORAGE_TRUST_KEY, newLevel.toString());

    // Dispatch custom event to notify UI components
    window.dispatchEvent(new CustomEvent("trustLevelChanged", { detail: newLevel }));
  } catch (err) {
    console.warn("[PROGRESS STORE] Trust Level write failed:", err);
  }
}

export function getGameLevels(gameSlugOrId = "color-quest"): GameLevel[] {
  const gameDef = getGameDefinition(gameSlugOrId);
  return gameDef?.levels ?? [];
}

export function getLocalStorageKey(gameSlugOrId = "color-quest"): string {
  const normGame = normalizeGameSlug(gameSlugOrId);
  return `robotoy_progress_${normGame}_v1`;
}

export function getInitialProgressMap(gameSlugOrId = "color-quest"): Record<number, LevelProgress> {
  const levels = getGameLevels(gameSlugOrId);
  const map: Record<number, LevelProgress> = {};
  for (const lvlMeta of levels) {
    const lvl = lvlMeta.id;
    map[lvl] = {
      level: lvl,
      bestScore: 0,
      stars: 0,
      attempts: 0,
      unlocked: lvl === 1,
    };
  }
  return map;
}

export function readLocalProgress(gameSlugOrId = "color-quest"): Record<number, LevelProgress> {
  if (typeof window === "undefined") {
    return getInitialProgressMap(gameSlugOrId);
  }

  const key = getLocalStorageKey(gameSlugOrId);
  const levels = getGameLevels(gameSlugOrId);

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return getInitialProgressMap(gameSlugOrId);

    const parsed: Record<number, LevelProgress> = JSON.parse(raw);
    const result: Record<number, LevelProgress> = {};

    for (const lvlMeta of levels) {
      const lvl = lvlMeta.id;
      const rec = parsed[lvl];
      result[lvl] = {
        level: lvl,
        bestScore: typeof rec?.bestScore === "number" ? rec.bestScore : 0,
        stars: (typeof rec?.stars === "number" && rec.stars >= 0 && rec.stars <= 3 ? rec.stars : 0) as 0 | 1 | 2 | 3,
        attempts: typeof rec?.attempts === "number" ? rec.attempts : 0,
        unlocked: isLevelUnlocked(lvl, parsed || {}, levels.length),
        updatedAt: rec?.updatedAt,
      };
    }
    return result;
  } catch (err) {
    console.warn(`[PROGRESS STORE] LocalStorage read failed for ${key}:`, err);
    return getInitialProgressMap(gameSlugOrId);
  }
}

export function writeLocalProgress(
  gameSlugOrId: string,
  map: Record<number, LevelProgress>
): void {
  if (typeof window === "undefined") return;
  const key = getLocalStorageKey(gameSlugOrId);

  try {
    localStorage.setItem(key, JSON.stringify(map));
  } catch (err) {
    console.warn(`[PROGRESS STORE] LocalStorage write failed for ${key}:`, err);
  }
}

export function readAllLocalProgressSummaries(): Record<
  string,
  { progressPercentage: number; completedLevels: number; totalLevels: number }
> {
  const result: Record<
    string,
    { progressPercentage: number; completedLevels: number; totalLevels: number }
  > = {};

  if (typeof window === "undefined") return result;

  const supportedGames = gameCatalog.filter((game) => game.progressSupported);
  for (const game of supportedGames) {
    const levelsMap = readLocalProgress(game.slug);
    const summary = calculateGameProgress(levelsMap, game.levels.length);
    result[game.id] = summary;
  }

  return result;
}

export function clearAllLocalProgress(): void {
  if (typeof window === "undefined") return;

  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith("robotoy_progress_") || key.startsWith("robotoy_trust_") || key.startsWith("robotoy_color_quest_"))) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
    console.info("[PROGRESS STORE] Local progress cache cleared.");
  } catch (err) {
    console.warn("[PROGRESS STORE] Failed to clear local progress cache:", err);
  }
}

export async function fetchAndSyncProgress(
  gameSlugOrId = "color-quest"
): Promise<UserGameProgressResponse> {
  const normGame = normalizeGameSlug(gameSlugOrId);
  const levels = getGameLevels(gameSlugOrId);
  const localMap = readLocalProgress(gameSlugOrId);

  try {
    const res = await fetch(`/api/progress?game=${normGame}`);
    if (res.ok) {
      const data: UserGameProgressResponse = await res.json();
      if (data.success && data.levels) {
        // Merge DB levels with local progress (take maximum stars/scores)
        const mergedMap: Record<number, LevelProgress> = {};

        for (const lvlMeta of levels) {
          const lvl = lvlMeta.id;
          const remoteRec = data.levels[lvl];
          const localRec = localMap[lvl];

          const bestScore = mergeBestScore(localRec?.bestScore, remoteRec?.bestScore ?? 0);
          const stars = mergeBestStars(localRec?.stars, remoteRec?.stars ?? 0);
          const attempts = Math.max(localRec?.attempts ?? 0, remoteRec?.attempts ?? 0);

          mergedMap[lvl] = {
            level: lvl,
            bestScore,
            stars,
            attempts,
            unlocked: isLevelUnlocked(lvl, mergedMap, levels.length),
            updatedAt: remoteRec?.updatedAt || localRec?.updatedAt,
          };
        }

        // Re-evaluate unlock status for all levels
        for (const lvlMeta of levels) {
          const lvl = lvlMeta.id;
          mergedMap[lvl].unlocked = isLevelUnlocked(lvl, mergedMap, levels.length);
        }

        writeLocalProgress(gameSlugOrId, mergedMap);
        const progressInfo = calculateGameProgress(mergedMap, levels.length);

        return {
          success: true,
          game: normGame,
          completedLevels: progressInfo.completedLevels,
          totalLevels: progressInfo.totalLevels,
          progressPercentage: progressInfo.progressPercentage,
          levels: mergedMap,
        };
      }
    }
  } catch (err) {
    console.warn("[PROGRESS STORE] Server sync failed, using LocalStorage:", err);
  }

  // Fallback to local map
  const progressInfo = calculateGameProgress(localMap, levels.length);
  return {
    success: true,
    game: normGame,
    completedLevels: progressInfo.completedLevels,
    totalLevels: progressInfo.totalLevels,
    progressPercentage: progressInfo.progressPercentage,
    levels: localMap,
  };
}

export async function submitAndPersistLevelResult(
  gameSlugOrId: string,
  level: number,
  score: number,
  awardedStarsOverride?: 0 | 1 | 2 | 3
): Promise<{
  awardedStars: 0 | 1 | 2 | 3;
  bestScore: number;
  bestStars: 0 | 1 | 2 | 3;
  isNextUnlocked: boolean;
  levels: Record<number, LevelProgress>;
  progressPercentage: number;
}> {
  const normGame = normalizeGameSlug(gameSlugOrId);
  const levels = getGameLevels(gameSlugOrId);
  const awardedStars = awardedStarsOverride ?? calculateStars(score);

  // 1. Update local storage immediately for fast UI feedback
  const localMap = readLocalProgress(gameSlugOrId);
  const currentLocal = localMap[level] || {
    level,
    bestScore: 0,
    stars: 0,
    attempts: 0,
    unlocked: level === 1,
  };

  const newBestScore = mergeBestScore(currentLocal.bestScore, score);
  const newBestStars = mergeBestStars(currentLocal.stars, awardedStars);

  localMap[level] = {
    level,
    bestScore: newBestScore,
    stars: newBestStars,
    attempts: (currentLocal.attempts || 0) + 1,
    unlocked: true,
    updatedAt: new Date().toISOString(),
  };

  // Re-calculate unlocked state for all levels
  for (const lvlMeta of levels) {
    const lvl = lvlMeta.id;
    localMap[lvl] = {
      ...(localMap[lvl] || {
        level: lvl,
        bestScore: 0,
        stars: 0,
        attempts: 0,
      }),
      unlocked: isLevelUnlocked(lvl, localMap, levels.length),
    };
  }

  writeLocalProgress(gameSlugOrId, localMap);
  const isNextUnlocked = isLevelUnlocked(level + 1, localMap, levels.length);
  const progressInfo = calculateGameProgress(localMap, levels.length);

  if (awardedStars >= 2) {
    incrementTrustLevel(5);
  }

  // 2. Submit to API asynchronously
  try {
    await fetch("/api/progress/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        game: normGame,
        level,
        score,
        stars: awardedStars,
      }),
    });
  } catch (err) {
    console.warn("[PROGRESS STORE] Remote submission error (saved locally):", err);
  }

  return {
    awardedStars,
    bestScore: newBestScore,
    bestStars: newBestStars,
    isNextUnlocked,
    levels: localMap,
    progressPercentage: progressInfo.progressPercentage,
  };
}
