import {
  calculateGameProgress,
  calculateStars,
  COLOUR_QUEST_LEVELS,
  isLevelUnlocked,
  mergeBestScore,
  mergeBestStars,
  normalizeGameSlug,
} from "./colourQuest";
import { ECHO_MEMORY_LEVELS, isEchoMemoryLevelUnlocked } from "./echoMemory";
import { DIRECTION_INVERT_LEVELS, isDirectionInvertLevelUnlocked } from "./directionInvert";
import { REFLEX_DASH_LEVELS } from "./reflexDash";
import type { LevelProgress, UserGameProgressResponse } from "@/types/colourQuest";
import { DRIVING_PRO_LEVELS } from "./drivingPro";

const LOCAL_STORAGE_TRUST_KEY = "robotoy_trust_v1";

function getLocalStorageKey(game: string) {
  return `robotoy_${normalizeGameSlug(game)}_progress_v1`;
}


function getGameLevels(game?: string) {
  const norm = game ? normalizeGameSlug(game) : "color-quest";
  if (norm === "color-quest") return COLOUR_QUEST_LEVELS;
  if (norm === "echo-memory") return ECHO_MEMORY_LEVELS;
  if (norm === "direction-invert") return DIRECTION_INVERT_LEVELS;
  if (norm === "reflex-dash") return REFLEX_DASH_LEVELS;
  if (norm === "driving-pro") return DRIVING_PRO_LEVELS;
  return COLOUR_QUEST_LEVELS;
}

function isGameLevelUnlocked(
  game: string | undefined,
  levelId: number,
  progressMap: Record<number, { stars: number }>
): boolean {
  const norm = game ? normalizeGameSlug(game) : "color-quest";
  if (norm === "echo-memory") return isEchoMemoryLevelUnlocked(levelId, progressMap);
  if (norm === "direction-invert") return isDirectionInvertLevelUnlocked(levelId, progressMap);
  return isLevelUnlocked(levelId, progressMap);
}

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

export function getInitialProgressMap(game?: string): Record<number, LevelProgress> {
  const map: Record<number, LevelProgress> = {};
  const levels = getGameLevels(game);
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

export function readLocalProgress(game: string): Record<number, LevelProgress> {
  if (typeof window === "undefined") {
    return getInitialProgressMap(game);
    return getInitialProgressMap(game);
  }

  try {
    const raw = localStorage.getItem(getLocalStorageKey(game));
    if (!raw) return getInitialProgressMap(game);

    const parsed: Record<number, LevelProgress> = JSON.parse(raw);
    const result: Record<number, LevelProgress> = {};
    const levels = getGameLevels(game);

    for (const lvlMeta of levels) {
      const lvl = lvlMeta.id;
      const rec = parsed[lvl];
      result[lvl] = {
        level: lvl,
        bestScore: typeof rec?.bestScore === "number" ? rec.bestScore : 0,
        stars: (typeof rec?.stars === "number" && rec.stars >= 0 && rec.stars <= 3 ? rec.stars : 0) as 0 | 1 | 2 | 3,
        attempts: typeof rec?.attempts === "number" ? rec.attempts : 0,
        unlocked: isGameLevelUnlocked(game, lvl, parsed || {}),
        updatedAt: rec?.updatedAt,
      };
    }
    return result;
  } catch (err) {
    console.warn("[PROGRESS STORE] LocalStorage read failed:", err);
    return getInitialProgressMap(game);
  }
}

export function writeLocalProgress(map: Record<number, LevelProgress>, game: string): void {
  if (typeof window === "undefined") return;

  try {
    const storageKey = getLocalStorageKey(game);
    localStorage.setItem(storageKey, JSON.stringify(map));
  } catch (err) {
    console.warn("[PROGRESS STORE] LocalStorage write failed:", err);
  }
}

export async function fetchAndSyncProgress(
  game = "color-quest"
): Promise<UserGameProgressResponse> {
  const normGame = normalizeGameSlug(game);
  const localMap = readLocalProgress(normGame);
  const levels = getGameLevels(normGame);

  try {
    const res = await fetch(`/api/progress?game=${normGame}`);
    if (res.ok) {
      const data: UserGameProgressResponse = await res.json();
      if (data.success && data.levels) {
        // Merge DB levels with local progress (take maximum stars/scores)
        const mergedMap: Record<number, LevelProgress> = {};
        const gameLevels = getGameLevels(normGame);

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
            unlocked: isGameLevelUnlocked(normGame, lvl, mergedMap),
            updatedAt: remoteRec?.updatedAt || localRec?.updatedAt,
          };
        }

        // Re-evaluate unlock status for all levels
        for (const lvlMeta of levels) {
          const lvl = lvlMeta.id;
          mergedMap[lvl].unlocked = isGameLevelUnlocked(normGame, lvl, mergedMap);
        }

        writeLocalProgress(mergedMap, normGame);
        const progressInfo = calculateGameProgress(mergedMap);

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
  const progressInfo = calculateGameProgress(localMap);
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
  game: string,
  level: number,
  score: number
): Promise<{
  awardedStars: 0 | 1 | 2 | 3;
  bestScore: number;
  bestStars: 0 | 1 | 2 | 3;
  isNextUnlocked: boolean;
  levels: Record<number, LevelProgress>;
  progressPercentage: number;
}> {
  const normGame = normalizeGameSlug(game);
  const awardedStars = calculateStars(score);

  // 1. Update local storage immediately for fast UI feedback
  const localMap = readLocalProgress(normGame);
  const levels = getGameLevels(normGame);
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
      unlocked: isGameLevelUnlocked(normGame, lvl, localMap),
    };
  }

  writeLocalProgress(localMap, normGame);
  const isNextUnlocked = isLevelUnlocked(level + 1, localMap);
  const progressInfo = calculateGameProgress(localMap);

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
