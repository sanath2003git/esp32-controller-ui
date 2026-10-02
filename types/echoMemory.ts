export type EchoMemoryAction = "up" | "right" | "down" | "left" | "pet" | "honk";
export type EchoMemoryDirection = "up" | "right" | "down" | "left";
export type EchoMemoryColor = "red" | "yellow" | "green" | "blue" | "purple" | "white";

export type EchoMemoryMapping = Partial<Record<EchoMemoryAction, EchoMemoryColor>>;

export type EchoMemoryGameState =
  | "idle"
  | "starting"
  | "mapping"
  | "flashing"
  | "waiting"
  | "input"
  | "completed"
  | "error";

export type EchoMemoryPhaseMessage = {
  type: "phase";
  game: "echo-memory" | "echo_memory";
  phase: "mapping" | "flash" | "wait" | "input";
  index?: number;
  length?: number;
  durationMs?: number;
  mapping?: Record<string, string>;
};

export type EchoMemoryInputResultMessage = {
  type: "input_result";
  game: "echo-memory" | "echo_memory";
  index: number;
  correct: boolean;
  correctCount?: number;
};

export type EchoMemoryResultMessage = {
  type: "response";
  response: "game_result";
  gameId: "echo_memory" | "echo-memory";
  level: number;
  score: number;
  scorePercent?: number;
  stars: 0 | 1 | 2 | 3;
  correct?: number;
  total?: number;
  tasksCompleted?: number;
  tasksTotal?: number;
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
