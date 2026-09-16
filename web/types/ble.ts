import type {
  ColorQuestCommand,
  ColorQuestErrorMessage,
  ColorQuestReadyMessage,
  ColorQuestResult,
  ColorQuestTaskMessage,
  ColorQuestTaskResultMessage,
} from "@/types/colourQuest";

export type RobotDeviceInfo = {
  deviceId: string;
  name: string;
  model: string;
  firmware: string;
};

export type RobotTelemetry = {
  direction: number;
  distance: {
    front: number | null;
  };
  obstacle: {
    frontLeft: boolean;
    frontRight: boolean;
    rearLeft: boolean;
    rearRight: boolean;
  };
  motion: {
    sudden: boolean;
  };
  pit: {
    detected: boolean;
  };
  timestamp?: number;
};

export type MovementDirection =
  | "forward"
  | "backward"
  | "left"
  | "right";

export type RgbColor = "red" | "green" | "blue" | "off";

export type MoveCommand = {
  command: "move";
  direction: MovementDirection;
};

export type StopCommand = {
  command: "stop";
};

export type ColorCommand = {
  command: "color";
  r: number;
  g: number;
  b: number;
};

export type BuzzerCommand = {
  command: "buzzer";
  freq?: number;
  duration?: number;
};

export type OledTextCommand = {
  command: "oled_text";
  text: string;
};

export type OledEmojiCommand = {
  command: "oled_emoji";
  emoji: string;
};

export type RobotCommand =
  | MoveCommand
  | StopCommand
  | ColorCommand
  | BuzzerCommand
  | OledTextCommand
  | OledEmojiCommand
  | ColorQuestCommand;

export type DeviceInfoMessage = {
  type: "device_info";
  deviceId: string;
  name: string;
  model: string;
  firmware: string;
};

export type TelemetryMessage = {
  type: "telemetry";
  telemetry: RobotTelemetry;
};

export type ResponseMessage = {
  type: "response";
  status: string;
  command: string;
  [key: string]: unknown;
};

export type BleMessage =
  | DeviceInfoMessage
  | TelemetryMessage
  | ResponseMessage
  | ColorQuestResult
  | ColorQuestTaskMessage
  | ColorQuestTaskResultMessage
  | ColorQuestReadyMessage
  | ColorQuestErrorMessage;

const RGB_VALUES: Record<RgbColor, Pick<ColorCommand, "r" | "g" | "b">> = {
  red: { r: 255, g: 0, b: 0 },
  green: { r: 0, g: 255, b: 0 },
  blue: { r: 0, g: 0, b: 255 },
  off: { r: 0, g: 0, b: 0 },
};

export function createColorCommand(color: RgbColor): ColorCommand {
  return {
    command: "color",
    ...RGB_VALUES[color],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRobotTelemetry(value: unknown): value is RobotTelemetry {
  if (!isRecord(value)) {
    return false;
  }

  const { direction, distance, obstacle, motion, pit, timestamp } = value;

  return (
    typeof direction === "number" &&
    isRecord(distance) &&
    (typeof distance.front === "number" || distance.front === null) &&
    isRecord(obstacle) &&
    typeof obstacle.frontLeft === "boolean" &&
    typeof obstacle.frontRight === "boolean" &&
    typeof obstacle.rearLeft === "boolean" &&
    typeof obstacle.rearRight === "boolean" &&
    isRecord(motion) &&
    typeof motion.sudden === "boolean" &&
    isRecord(pit) &&
    typeof pit.detected === "boolean" &&
    (timestamp === undefined || typeof timestamp === "number")
  );
}

export function parseBleMessage(value: unknown): BleMessage | null {
  if (!isRecord(value)) {
    return null;
  }

  // Legacy response format
  if (typeof value.type !== "string") {
    if (typeof value.status !== "string" || typeof value.command !== "string") {
      return null;
    }

    return { type: "response", ...value } as ResponseMessage;
  }

  if (value.type === "device_info") {
    if (
      typeof value.deviceId !== "string" ||
      typeof value.name !== "string" ||
      typeof value.model !== "string" ||
      typeof value.firmware !== "string"
    ) {
      return null;
    }

    return value as DeviceInfoMessage;
  }

  if (value.type === "telemetry") {
    if (!isRobotTelemetry(value)) {
      return null;
    }

    return {
      type: "telemetry",
      telemetry: {
        direction: value.direction,
        distance: value.distance,
        obstacle: value.obstacle,
        motion: value.motion,
        pit: value.pit,
        ...(value.timestamp === undefined ? {} : { timestamp: value.timestamp }),
      } as RobotTelemetry,
    };
  }

  if (value.type === "response") {
    if (
      (value.game === "color-quest" || value.game === "colour-quest") &&
      typeof value.score === "number" &&
      Number.isFinite(value.score) &&
      value.score >= 0 &&
      value.score <= 1
    ) {
      return { ...value, game: "color-quest" } as ColorQuestResult;
    }

    if (
      typeof value.status === "string" &&
      typeof value.command === "string"
    ) {
      return value as ResponseMessage;
    }

    return null;
  }

  if (value.type === "task" && (value.game === "color-quest" || value.game === "colour-quest")) {
    if (typeof value.index === "number") {
      return { ...value, game: "color-quest" } as ColorQuestTaskMessage;
    }
  }

  if (value.type === "task_result" && (value.game === "color-quest" || value.game === "colour-quest")) {
    if (typeof value.index === "number" && typeof value.correct === "boolean") {
      return { ...value, game: "color-quest" } as ColorQuestTaskResultMessage;
    }
  }

  if (value.type === "ready" && (value.game === "color-quest" || value.game === "colour-quest")) {
    return { ...value, game: "color-quest" } as ColorQuestReadyMessage;
  }

  if (value.type === "error" && typeof value.message === "string") {
    return value as ColorQuestErrorMessage;
  }

  return null;
}
