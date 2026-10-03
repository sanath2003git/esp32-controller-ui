import type { DrivingProTaskMeta, LevelProgress } from "@/types/drivingPro";

export const DRIVING_PRO_TASKS: DrivingProTaskMeta[] = [
  {
    id: 1,
    title: "Task 1: Continuous Forward Drive",
    durationMs: 7000,
    durationSec: 7,
    description: "Ride the toy without hitting anywhere for 7 seconds.",
    requirementsText: "Ride for 7s without collision. Robot moves forward automatically; use Left/Right to steer.",
  },
  {
    id: 2,
    title: "Task 2: Steering & Turns Challenge",
    durationMs: 7000,
    durationSec: 7,
    description: "Ride for 7 seconds without hitting anywhere and take at least 4 turns.",
    requirementsText: "Ride for 7s without collision & take at least 4 total turns.",
    minTurns: 4,
  },
  {
    id: 3,
    title: "Task 3: Precision Directional Maneuver",
    durationMs: 9000,
    durationSec: 9,
    description: "Ride for 9 seconds, take at least 2 left turns and 3 right turns without hitting anywhere.",
    requirementsText: "Ride for 9s without collision & perform at least 2 Left turns and 3 Right turns.",
    minLeftTurns: 2,
    minRightTurns: 3,
  },
];

export function getTaskMeta(taskId: number): DrivingProTaskMeta | undefined {
  return DRIVING_PRO_TASKS.find((t) => t.id === taskId);
}

export function isLevelUnlocked(
  levelId: number,
  userProgressMap: Record<number, LevelProgress>
): boolean {
  if (levelId === 1) return true;
  const prevLevel = userProgressMap[levelId - 1];
  return Boolean(prevLevel && prevLevel.stars >= 3);
}

export function calculateStars(scoreRatio: number): 0 | 1 | 2 | 3 {
  if (scoreRatio >= 1.0) return 3;
  if (scoreRatio >= 0.66) return 2;
  if (scoreRatio >= 0.33) return 1;
  return 0;
}
