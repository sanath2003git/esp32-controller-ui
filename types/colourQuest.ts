export type ColorQuestRegion = "front" | "right" | "back" | "left";
export type ColorQuestDirection = "up" | "right" | "down" | "left";

export type LevelProgress = {
  level: number;
  bestScore: number;
  stars: 0 | 1 | 2 | 3;
  attempts: number;
  unlocked: boolean;
  updatedAt?: string;
};

export type UserGameProgressResponse = {
  success: boolean;
  game: string;
  completedLevels: number;
  totalLevels: number;
  progressPercentage: number;
  levels: Record<number, LevelProgress>;
  error?: string;
};

export type ColourQuestGameState =
  | "idle"
  | "starting"
  | "playing"
  | "completed"
  | "error";
