import type {
  ColorQuestInputRegionCommand,
  ColorQuestRegion,
  ColorQuestResult,
  ColorQuestStartCommand,
} from "@/types/colourQuest";
import type { LevelDifficulty } from "@/data/levels";

export type LevelMeta = {
  id: number;
  title: string;
  description: string;
  concept?: string;
  difficulty: LevelDifficulty;
  timing?: string;
};

export const COLOUR_QUEST_LEVELS: LevelMeta[] = [
  {
    id: 1,
    title: "Level 1",
    description: "🍎 Find the basic colours among the mixed ones! Nice and easy.",
    concept: "1 primary target + 3 secondary distractors",
    difficulty: "Easy",
    timing: "5 seconds",
  },
  {
    id: 2,
    title: "Level 2",
    description: "⚡ Same as before, but you gotta be quick! Gotta go fast!",
    concept: "1 primary target + 3 secondary distractors",
    difficulty: "Easy",
    timing: "2.5 seconds",
  },
  {
    id: 3,
    title: "Level 3",
    description: "🍊 Now find the mixed colours hidden among the basics!",
    concept: "1 secondary target + 3 primary distractors",
    difficulty: "Medium",
    timing: "5 seconds",
  },
  {
    id: 4,
    title: "Level 4",
    description: "🚀 Find the mixed colours, but at super speed! Don't blink!",
    concept: "1 secondary target + 3 primary distractors",
    difficulty: "Medium",
    timing: "2.5 seconds",
  },
  {
    id: 5,
    title: "Level 5",
    description: "🕵️‍♂️ Tricky! Spot the rare Orange or Purple colour hidden in the mix!",
    concept: "Tertiary target vs primary/secondary noise",
    difficulty: "Hard",
    timing: "5 seconds",
  },
  {
    id: 6,
    title: "Level 6",
    description: "👑 The Ultimate Boss Level! Spot the rare colour at max speed. Good luck!",
    concept: "Tertiary target vs primary/secondary noise",
    difficulty: "Hard",
    timing: "2.5 seconds",
  },
];

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
  if (levelId < 1 || levelId > 6) return false;
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

/**
 * Validates whether an incoming object is a valid ColorQuestResult BLE message.
 */
export function isValidColorQuestResult(val: unknown): val is ColorQuestResult {
  if (typeof val !== "object" || val === null) return false;
  const obj = val as Record<string, unknown>;
  return (
    obj.type === "response" &&
    (obj.game === "color-quest" || obj.game === "colour-quest") &&
    typeof obj.score === "number" &&
    Number.isFinite(obj.score) &&
    obj.score >= 0 &&
    obj.score <= 1
  );
}

/**
 * Creates a strongly typed BLE start command payload for Colour Quest.
 */
export function createColorQuestStartCommand(
  level: number
): ColorQuestStartCommand {
  return {
    command: "challenge",
    game: "color-quest",
    level,
  };
}

/**
 * Creates a region input command payload for Colour Quest.
 */
export function createColorQuestRegionCommand(
  region: ColorQuestRegion
): ColorQuestInputRegionCommand {
  return {
    command: "input",
    region,
  };
}
