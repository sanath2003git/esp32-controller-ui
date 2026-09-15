export type ColorQuestStartCommand = {
  command: "challenge";
  game: "color-quest";
  level: number;
};

export type ColorQuestResult = {
  type: "response";
  game: "color-quest";
  score: number; // 0..1
};

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
