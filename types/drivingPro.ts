import type { CanonicalGameId } from "./protocol";

export type DrivingProTaskState =
  | "pending"
  | "instructions"
  | "running"
  | "passed"
  | "failed";

export type DrivingProGameState =
  | "idle"
  | "starting"
  | "TASK_INSTRUCTIONS"
  | "TASK_RUNNING"
  | "TASK_EVALUATION"
  | "GAME_OVER"
  | "LEVEL_COMPLETE"
  | "RESULT"
  | "error";

export type DrivingProTaskMeta = {
  id: number;
  title: string;
  durationMs: number;
  durationSec: number;
  description: string;
  requirementsText: string;
  minTurns?: number;
  minLeftTurns?: number;
  minRightTurns?: number;
};

export type TaskStartPayload = {
  gameId: CanonicalGameId;
  level: number;
  taskId: number;
};

export type TaskStartedPayload = {
  gameId: CanonicalGameId;
  level: number;
  taskId: number;
  durationMs: number;
};

export type TaskResultPayload = {
  status: "passed" | "failed" | string;
  score: number;
  stars: number;
};

export type GameOverPayload = {
  tasksCompleted: number;
  tasksTotal: number;
  score: number;
  stars: number;
};

export type LevelProgress = {
  level: number;
  bestScore: number;
  stars: 0 | 1 | 2 | 3;
  attempts: number;
  unlocked: boolean;
  updatedAt?: string;
};
