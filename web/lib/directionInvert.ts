import type { LevelDifficulty } from "@/data/levels";
import type {
  DirectionInvertAbortCommand,
  DirectionInvertResultMessage,
  DirectionInvertStartCommand,
} from "@/types/directionInvert";

export type DirectionInvertLevelMeta = {
  id: number;
  title: string;
  description: string;
  mapping: string;
  difficulty: LevelDifficulty;
  totalMaxTime: number;
  isImplemented: boolean;
};

export const DIRECTION_INVERT_LEVELS: DirectionInvertLevelMeta[] = [
  {
    id: 1,
    title: "Level 1 — Forward/Backward Invert",
    description: "Drive with inverted forward & backward controls. Complete short drive, turns, and L/R turns in 20s!",
    mapping: "UP → BACKWARD | DOWN → FORWARD | LEFT → LEFT | RIGHT → RIGHT",
    difficulty: "Easy",
    totalMaxTime: 20,
    isImplemented: true,
  },
  {
    id: 2,
    title: "Level 2 — Forward/Backward Invert (Advanced)",
    description: "Reinforce forward/backward inversion with higher turn count requirements in 20s.",
    mapping: "UP → BACKWARD | DOWN → FORWARD | LEFT → LEFT | RIGHT → RIGHT",
    difficulty: "Easy",
    totalMaxTime: 20,
    isImplemented: true,
  },
  {
    id: 3,
    title: "Level 3 — Steering Invert",
    description: "Reversed steering control challenge.",
    mapping: "UP → FORWARD | DOWN → BACKWARD | LEFT → RIGHT | RIGHT → LEFT",
    difficulty: "Medium",
    totalMaxTime: 20,
    isImplemented: true,
  },
  {
    id: 4,
    title: "Level 4 — Steering Invert (Advanced)",
    description: "Reversed steering under higher driving constraints.",
    mapping: "UP → FORWARD | DOWN → BACKWARD | LEFT → RIGHT | RIGHT → LEFT",
    difficulty: "Medium",
    totalMaxTime: 20,
    isImplemented: true,
  },
  {
    id: 5,
    title: "Level 5 — Full Invert",
    description: "Both forward/backward and steering axes inverted.",
    mapping: "UP → BACKWARD | DOWN → FORWARD | LEFT → RIGHT | RIGHT → LEFT",
    difficulty: "Hard",
    totalMaxTime: 25,
    isImplemented: true,
  },
  {
    id: 6,
    title: "Level 6 — Dynamic Inversion",
    description: "Dynamic mapping switches between Normal and Full Invert in 30s!",
    mapping: "Dynamic Switch (Normal ↔ Full Invert)",
    difficulty: "Hard",
    totalMaxTime: 30,
    isImplemented: true,
  },
];

export function getDirectionInvertLevel(id: number): DirectionInvertLevelMeta | undefined {
  return DIRECTION_INVERT_LEVELS.find((l) => l.id === id);
}

export function createDirectionInvertStartCommand(level: number): DirectionInvertStartCommand {
  return {
    command: "challenge",
    game: "direction-invert",
    level,
  };
}

export function createDirectionInvertAbortCommand(): DirectionInvertAbortCommand {
  return {
    command: "abort",
  };
}

export function isValidDirectionInvertResult(val: unknown): val is DirectionInvertResultMessage {
  if (typeof val !== "object" || val === null) return false;
  const obj = val as Record<string, unknown>;
  return (
    obj.type === "response" &&
    (obj.mode === "direction_invert" || obj.mode === "direction-invert" || obj.game === "direction-invert") &&
    typeof obj.score === "number" &&
    typeof obj.stars === "number"
  );
}

/**
 * Unlocking rules for Direction Invert:
 * Level 1 is always unlocked.
 * Level N > 1 unlocks only when Level N - 1 has earned 3 stars (stars >= 3).
 */
export function isDirectionInvertLevelUnlocked(
  levelId: number,
  progressMap?: Record<number, { stars: number }>
): boolean {
  if (levelId === 1) return true;
  if (levelId < 1 || levelId > 6) return false;
  if (!progressMap) return false;
  const prev = progressMap[levelId - 1];
  return Boolean(prev && prev.stars >= 3);
}
