import { gameCatalog, type GameLevel } from "@/data/gameCatalog";
import type {
  EchoMemoryAction,
  EchoMemoryColor,
  EchoMemoryResultMessage,
} from "@/types/echoMemory";

export type EchoMemoryLevelMeta = GameLevel & {
  isImplemented: boolean;
  sequenceLength: number;
  flashDuration: string;
  actionsCount: number;
  isDynamic: boolean;
  ledMode: "Regional" | "Full strip";
};

export const ECHO_MEMORY_LEVELS = gameCatalog.find(
  (game) => game.id === "echo_memory"
)!.levels;

export function getEchoMemoryLevel(id: number): GameLevel | undefined {
  return ECHO_MEMORY_LEVELS.find((l) => l.id === id);
}

export function getEchoLevelMeta(levelId: number): EchoMemoryLevelMeta {
  const baseLevel = getEchoMemoryLevel(levelId) ?? {
    id: levelId,
    title: `Level ${levelId}`,
    description: "Echo Memory Challenge",
    difficulty: "Easy" as const,
  };

  const levelConfigs: Record<
    number,
    Omit<EchoMemoryLevelMeta, keyof GameLevel>
  > = {
    1: {
      isImplemented: true,
      sequenceLength: 4,
      flashDuration: "3.0s",
      actionsCount: 4,
      isDynamic: false,
      ledMode: "Regional",
    },
    2: {
      isImplemented: true,
      sequenceLength: 5,
      flashDuration: "1.5s",
      actionsCount: 4,
      isDynamic: false,
      ledMode: "Regional",
    },
    3: {
      isImplemented: true,
      sequenceLength: 6,
      flashDuration: "1.5s",
      actionsCount: 4,
      isDynamic: false,
      ledMode: "Regional",
    },
    4: {
      isImplemented: true,
      sequenceLength: 5,
      flashDuration: "3.0s",
      actionsCount: 6,
      isDynamic: false,
      ledMode: "Full strip",
    },
    5: {
      isImplemented: true,
      sequenceLength: 6,
      flashDuration: "1.5s",
      actionsCount: 6,
      isDynamic: false,
      ledMode: "Full strip",
    },
    6: {
      isImplemented: true,
      sequenceLength: 5,
      flashDuration: "1.5s",
      actionsCount: 6,
      isDynamic: true,
      ledMode: "Full strip",
    },
  };

  const extra = levelConfigs[levelId] ?? {
    isImplemented: false,
    sequenceLength: 5,
    flashDuration: "1.5s",
    actionsCount: 6,
    isDynamic: false,
    ledMode: "Full strip",
  };

  return { ...baseLevel, ...extra };
}

export const ECHO_MEMORY_FIXED_MAPPING: Record<EchoMemoryAction, EchoMemoryColor> = {
  up: "red",
  right: "yellow",
  down: "green",
  left: "blue",
  pet: "purple",
  honk: "white",
};

export type EchoColorVisual = {
  color: string;
  hex: string;
  borderClass: string;
  textClass: string;
  bgClass: string;
  glowClass: string;
  badgeText: string;
};

export function getEchoColorVisual(colorName?: string): EchoColorVisual {
  const norm = (colorName ?? "").toLowerCase().trim();
  switch (norm) {
    case "red":
      return {
        color: "Red",
        hex: "#ff4d67",
        borderClass: "border-rose-500/60",
        textClass: "text-rose-400",
        bgClass: "bg-rose-500/20",
        glowClass: "shadow-[0_0_15px_rgba(244,63,94,0.4)]",
        badgeText: "RED",
      };
    case "yellow":
      return {
        color: "Yellow",
        hex: "#ffc857",
        borderClass: "border-amber-400/60",
        textClass: "text-amber-300",
        bgClass: "bg-amber-400/20",
        glowClass: "shadow-[0_0_15px_rgba(255,200,87,0.4)]",
        badgeText: "YELLOW",
      };
    case "green":
      return {
        color: "Green",
        hex: "#35e59a",
        borderClass: "border-emerald-500/60",
        textClass: "text-emerald-400",
        bgClass: "bg-emerald-500/20",
        glowClass: "shadow-[0_0_15px_rgba(53,229,154,0.4)]",
        badgeText: "GREEN",
      };
    case "blue":
      return {
        color: "Blue",
        hex: "#00e5ff",
        borderClass: "border-sky-400/60",
        textClass: "text-sky-300",
        bgClass: "bg-sky-400/20",
        glowClass: "shadow-[0_0_15px_rgba(0,229,255,0.4)]",
        badgeText: "BLUE",
      };
    case "purple":
      return {
        color: "Purple",
        hex: "#a855f7",
        borderClass: "border-purple-500/60",
        textClass: "text-purple-300",
        bgClass: "bg-purple-500/20",
        glowClass: "shadow-[0_0_15px_rgba(168,85,247,0.4)]",
        badgeText: "PURPLE",
      };
    case "white":
    default:
      return {
        color: "White",
        hex: "#ffffff",
        borderClass: "border-slate-200/60",
        textClass: "text-slate-100",
        bgClass: "bg-white/20",
        glowClass: "shadow-[0_0_15px_rgba(255,255,255,0.4)]",
        badgeText: "WHITE",
      };
  }
}

export const ECHO_MEMORY_MAPPING: Record<
  EchoMemoryAction,
  EchoColorVisual & { action: EchoMemoryAction; label: string }
> = {
  up: {
    ...getEchoColorVisual("red"),
    action: "up",
    label: "UP",
  },
  right: {
    ...getEchoColorVisual("yellow"),
    action: "right",
    label: "RIGHT",
  },
  down: {
    ...getEchoColorVisual("green"),
    action: "down",
    label: "DOWN",
  },
  left: {
    ...getEchoColorVisual("blue"),
    action: "left",
    label: "LEFT",
  },
  pet: {
    ...getEchoColorVisual("purple"),
    action: "pet",
    label: "PET",
  },
  honk: {
    ...getEchoColorVisual("white"),
    action: "honk",
    label: "HONK",
  },
};

export function createEchoMemoryStartCommand(level: number) {
  return {
    v: 1,
    type: "command",
    command: "game_start",
    id: `start-echo-${Date.now()}`,
    payload: {
      gameId: "echo_memory",
      level,
    },
  };
}

export function createEchoMemoryRunSeqCommand(level: number) {
  return {
    v: 1,
    type: "command",
    command: "run_seq",
    id: `runseq-echo-${Date.now()}`,
    payload: {
      gameId: "echo_memory",
      level,
    },
  };
}

export function createEchoMemoryInputCommand(action: EchoMemoryAction) {
  if (action === "honk") {
    return {
      v: 1,
      type: "command",
      command: "honk",
      id: `input-honk-${Date.now()}`,
      ts: Date.now(),
      payload: {},
    };
  }
  return {
    v: 1,
    type: "input",
    id: `input-dir-${Date.now()}`,
    ts: Date.now(),
    payload: {
      inputType: "joystick",
      dir: action,
    },
  };
}

export function createEchoMemoryAbortCommand() {
  return {
    v: 1,
    type: "command",
    command: "game_abort",
    id: `abort-echo-${Date.now()}`,
    payload: {},
  };
}

export function isValidEchoMemoryResult(val: unknown): val is EchoMemoryResultMessage {
  if (typeof val !== "object" || val === null) return false;
  const obj = val as Record<string, unknown>;
  return (
    obj.type === "response" &&
    (obj.response === "game_result" || obj.response === "result") &&
    (obj.gameId === "echo_memory" || obj.gameId === "echo-memory" || obj.game === "echo_memory" || obj.game === "echo-memory") &&
    typeof obj.score === "number" &&
    Number.isFinite(obj.score)
  );
}

export function normalizeGameSlug(slug: string): string {
  if (!slug) return "echo-memory";
  const lower = slug.toLowerCase().trim();
  if (lower === "echo-memory" || lower === "echo_memory") {
    return "echo-memory";
  }
  return lower;
}

export function calculateStars(score: number): 0 | 1 | 2 | 3 {
  if (score >= 0.8) return 3;
  if (score >= 0.6) return 2;
  if (score >= 0.4) return 1;
  return 0;
}

export function isLevelUnlocked(
  levelId: number,
  progressMap: Record<number, { stars: number }>
): boolean {
  if (levelId === 1) return true;
  if (levelId < 1 || levelId > ECHO_MEMORY_LEVELS.length) return false;
  const previousLevelProgress = progressMap[levelId - 1];
  return Boolean(previousLevelProgress && previousLevelProgress.stars >= 3);
}

export function mergeBestScore(
  oldScore: number | undefined,
  newScore: number
): number {
  const safeOld = typeof oldScore === "number" && !isNaN(oldScore) ? oldScore : 0;
  return Math.max(safeOld, newScore);
}

export function mergeBestStars(
  oldStars: number | undefined,
  newStars: number
): 0 | 1 | 2 | 3 {
  const safeOld = typeof oldStars === "number" ? oldStars : 0;
  const merged = Math.max(safeOld, newStars);
  return (merged > 3 ? 3 : merged) as 0 | 1 | 2 | 3;
}

export function calculateGameProgress(
  progressMap: Record<number, { stars: number }>
): { completedLevels: number; totalLevels: number; progressPercentage: number } {
  const totalLevels = ECHO_MEMORY_LEVELS.length;
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
