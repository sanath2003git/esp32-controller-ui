import type { LevelDifficulty } from "@/data/levels";
import type {
  EchoMemoryAbortCommand,
  EchoMemoryDirection,
  EchoMemoryInputCommand,
  EchoMemoryResultMessage,
  EchoMemoryStartCommand,
} from "@/types/echoMemory";

export type EchoMemoryLevelMeta = {
  id: number;
  title: string;
  description: string;
  difficulty: LevelDifficulty;
  sequenceLength: number;
  flashDuration: string;
  waitDuration: string;
  isImplemented: boolean;
};

export const ECHO_MEMORY_LEVELS: EchoMemoryLevelMeta[] = [
  {
    id: 1,
    title: "Level 1",
    description: "Watch the 4-step light pattern on your robot, wait 3 seconds, then echo the sequence!",
    difficulty: "Easy",
    sequenceLength: 4,
    flashDuration: "3.0s",
    waitDuration: "3.0s",
    isImplemented: true,
  },
  {
    id: 2,
    title: "Level 2",
    description: "Coming soon. Faster pace and longer sequence.",
    difficulty: "Easy",
    sequenceLength: 5,
    flashDuration: "1.5s",
    waitDuration: "3.0s",
    isImplemented: false,
  },
  {
    id: 3,
    title: "Level 3",
    description: "Coming soon. Challenging sequence.",
    difficulty: "Easy",
    sequenceLength: 6,
    flashDuration: "1.5s",
    waitDuration: "3.0s",
    isImplemented: false,
  },
  {
    id: 4,
    title: "Level 4",
    description: "Coming soon. Physical action memory.",
    difficulty: "Medium",
    sequenceLength: 5,
    flashDuration: "3.0s",
    waitDuration: "3.0s",
    isImplemented: false,
  },
  {
    id: 5,
    title: "Level 5",
    description: "Coming soon. Fast expanded actions.",
    difficulty: "Medium",
    sequenceLength: 6,
    flashDuration: "1.5s",
    waitDuration: "3.0s",
    isImplemented: false,
  },
  {
    id: 6,
    title: "Level 6",
    description: "Coming soon. Dynamic mapping boss level.",
    difficulty: "Hard",
    sequenceLength: 7,
    flashDuration: "1.5s",
    waitDuration: "3.0s",
    isImplemented: false,
  },
];

/**
 * Fixed colour-to-direction mapping for Echo Memory Level 1:
 * UP    = RED
 * RIGHT = YELLOW
 * DOWN  = GREEN
 * LEFT  = BLUE
 */
export const ECHO_MEMORY_MAPPING: Record<
  EchoMemoryDirection,
  {
    direction: EchoMemoryDirection;
    label: string;
    color: string;
    hex: string;
    bgClass: string;
    textClass: string;
    borderClass: string;
    glowClass: string;
  }
> = {
  up: {
    direction: "up",
    label: "UP",
    color: "Red",
    hex: "#EF4444",
    bgClass: "bg-red-500/20 hover:bg-red-500/30",
    textClass: "text-red-400",
    borderClass: "border-red-500/40",
    glowClass: "shadow-[0_0_20px_rgba(239,68,68,0.35)]",
  },
  right: {
    direction: "right",
    label: "RIGHT",
    color: "Yellow",
    hex: "#EAB308",
    bgClass: "bg-yellow-500/20 hover:bg-yellow-500/30",
    textClass: "text-yellow-400",
    borderClass: "border-yellow-500/40",
    glowClass: "shadow-[0_0_20px_rgba(234,179,8,0.35)]",
  },
  down: {
    direction: "down",
    label: "DOWN",
    color: "Green",
    hex: "#10B981",
    bgClass: "bg-emerald-500/20 hover:bg-emerald-500/30",
    textClass: "text-emerald-400",
    borderClass: "border-emerald-500/40",
    glowClass: "shadow-[0_0_20px_rgba(16,185,129,0.35)]",
  },
  left: {
    direction: "left",
    label: "LEFT",
    color: "Blue",
    hex: "#3B82F6",
    bgClass: "bg-blue-500/20 hover:bg-blue-500/30",
    textClass: "text-blue-400",
    borderClass: "border-blue-500/40",
    glowClass: "shadow-[0_0_20px_rgba(59,130,246,0.35)]",
  },
};

export function getEchoMemoryLevel(id: number): EchoMemoryLevelMeta | undefined {
  return ECHO_MEMORY_LEVELS.find((l) => l.id === id);
}

/**
 * Level 1 is always unlocked.
 * Levels 2-6 remain strictly not implemented / locked.
 */
export function isEchoMemoryLevelUnlocked(levelId: number): boolean {
  return levelId === 1;
}

/**
 * Star thresholds for Echo Memory:
 * >= 90% -> 3 stars (4/4 correct = 100%)
 * >= 70% -> 2 stars (3/4 correct = 75%)
 * >= 50% -> 1 star  (2/4 correct = 50%)
 * < 50%  -> 0 stars (1/4 = 25%, 0/4 = 0%)
 */
export function calculateEchoMemoryStars(scorePercent: number): 0 | 1 | 2 | 3 {
  if (scorePercent >= 90) return 3;
  if (scorePercent >= 70) return 2;
  if (scorePercent >= 50) return 1;
  return 0;
}

export function createEchoMemoryStartCommand(level = 1): EchoMemoryStartCommand {
  return {
    command: "challenge",
    game: "echo-memory",
    level,
  };
}

export function createEchoMemoryInputCommand(dir: EchoMemoryDirection): EchoMemoryInputCommand {
  return {
    command: "input",
    game: "echo-memory",
    dir,
  };
}

export function createEchoMemoryAbortCommand(): EchoMemoryAbortCommand {
  return {
    command: "abort",
  };
}

export function isValidEchoMemoryResult(val: unknown): val is EchoMemoryResultMessage {
  if (typeof val !== "object" || val === null) return false;
  const obj = val as Record<string, unknown>;
  return (
    obj.type === "response" &&
    obj.game === "echo-memory" &&
    typeof obj.score === "number" &&
    Number.isFinite(obj.score) &&
    typeof obj.scorePercent === "number" &&
    typeof obj.stars === "number"
  );
}
