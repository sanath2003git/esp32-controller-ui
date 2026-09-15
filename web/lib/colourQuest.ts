import type {
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
};

export const COLOUR_QUEST_LEVELS: LevelMeta[] = [
  {
    id: 1,
    title: "Level 1",
    description: "Identify the primary colour shown by the robot.",
    concept: "Single primary colour, select the shown colour",
    difficulty: "Easy",
  },
  {
    id: 2,
    title: "Level 2",
    description: "Fast primary colour identification.",
    concept: "Single primary colour, select the shown colour",
    difficulty: "Easy",
  },
  {
    id: 3,
    title: "Level 3",
    description: "Spot the secondary colour among choices.",
    concept: "Secondary colours, pick the odd one out",
    difficulty: "Medium",
  },
  {
    id: 4,
    title: "Level 4",
    description: "Pick the odd secondary colour out under speed.",
    concept: "Secondary colours, pick the odd one out",
    difficulty: "Medium",
  },
  {
    id: 5,
    title: "Level 5",
    description: "Advanced hue and tint color recognition.",
    concept: "Beyond primary/secondary",
    difficulty: "Hard",
  },
  {
    id: 6,
    title: "Level 6",
    description: "The ultimate colour gauntlet challenge.",
    concept: "Beyond primary/secondary",
    difficulty: "Hard",
  },
];

export function getColourQuestLevel(id: number): LevelMeta | undefined {
  return COLOUR_QUEST_LEVELS.find((l) => l.id === id);
}

export function normalizeStars(stars: unknown): 0 | 1 | 2 | 3 {
  if (typeof stars === "number" && Number.isInteger(stars) && stars >= 0 && stars <= 3) {
    return stars as 0 | 1 | 2 | 3;
  }
  return 0;
}

/**
 * Calculates star rating for a score in range [0, 1].
 * Section 6 rules:
 * score >= 0.80 -> 3 stars
 * score >= 0.60 -> 2 stars
 * score >= 0.40 -> 1 star
 * score <  0.40 -> 0 stars
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
    obj.game === "color-quest" &&
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
