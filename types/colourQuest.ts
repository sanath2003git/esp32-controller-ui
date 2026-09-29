export type ColorQuestStartCommand = {
  command: "challenge";
  game: "color-quest";
  level: number;
};

export type ColorQuestRegion = "front" | "right" | "back" | "left";
export type ColorQuestDirection = "up" | "right" | "down" | "left";

export type ColorQuestInputRegionCommand = {
  command: "input";
  region: ColorQuestRegion;
};

export type ColorQuestInputDirectionCommand = {
  command: "input";
  dir: ColorQuestDirection;
};

export type ColorQuestInputXYCommand = {
  command: "input";
  x: number;
  y: number;
};

export type ColorQuestAbortCommand = {
  command: "abort";
};

export type ColorQuestCommand =
  | ColorQuestStartCommand
  | ColorQuestInputRegionCommand
  | ColorQuestInputDirectionCommand
  | ColorQuestInputXYCommand
  | ColorQuestAbortCommand;

export type ColorQuestResult = {
  type: "response";
  game: "color-quest";
  level?: number;
  score: number; // 0..1
  correct?: number;
  tasks?: number;
};

export type ColorQuestTaskMessage = {
  type: "task";
  game: "color-quest" | "colour-quest";
  level?: number;
  index: number;
  phase?: "memorize" | "answer";
  input?: "region" | string;
  target?: string;
  options?: string[];
  regions?: string[];
};

export type ColorQuestTaskResultMessage = {
  type: "task_result";
  game: "color-quest" | "colour-quest";
  level?: number;
  index: number;
  correct: boolean;
  timeout?: boolean;
  correctCount?: number;
};

export type ColorQuestReadyMessage = {
  type: "ready";
  game: "color-quest";
};

export type ColorQuestErrorMessage = {
  type: "error";
  message: string;
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
