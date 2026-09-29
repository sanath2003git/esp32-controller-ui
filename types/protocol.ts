/**
 * Protocol v1 Type Definitions for Elxie Robot System
 * Source of Truth: docs/Communication_JSON_Contract.md & docs/New_Architecture_and_System_Design.md
 */

export const PROTOCOL_VERSION = 1;

export type CanonicalGameId =
  | "color_quest"
  | "echo_memory"
  | "reflex_arc"
  | "driving_pro"
  | "inverted_drive";

/* ─── Envelope Definition ────────────────────────────────────────── */

export type ProtocolEnvelope<TType extends string, TPayload extends object> = {
  v: typeof PROTOCOL_VERSION;
  type: TType;
  id?: string;
  ts?: number;
  payload: TPayload;
};

/* ─── Normalized Input Model ─────────────────────────────────────── */

export type JoystickInputPayload = {
  inputType: "joystick";
  x: number; // -1.0 ... +1.0
  y: number; // -1.0 ... +1.0
  magnitude: number; // 0.0 ... 1.0
};

export type DirectionInputPayload = {
  inputType: "direction";
  direction: "forward" | "backward" | "left" | "right" | "up" | "down" | "none";
};

export type ButtonInputPayload = {
  inputType: "button";
  button: "up" | "down" | "left" | "right" | "select" | "back" | "start" | "stop";
  pressed: boolean;
};

export type InputPayload =
  | JoystickInputPayload
  | DirectionInputPayload
  | ButtonInputPayload;

/* ─── Outbound Messages (Mobile -> Robot) ───────────────────────── */

export type HelloPayload = {
  client: string;
  clientVersion: string;
  protocolVersion: number;
};
export type HelloMessage = ProtocolEnvelope<"hello", HelloPayload>;

export type DeviceInfoRequestPayload = Record<string, never>;
export type DeviceInfoRequestMessage = ProtocolEnvelope<
  "device_info_request",
  DeviceInfoRequestPayload
>;

export type InputMessage = ProtocolEnvelope<"input", InputPayload>;

export type GameSelectPayload = {
  game: CanonicalGameId;
};
export type GameSelectMessage = ProtocolEnvelope<"game_select", GameSelectPayload>;

export type LevelSelectPayload = {
  game: CanonicalGameId;
  level: number;
};
export type LevelSelectMessage = ProtocolEnvelope<"level_select", LevelSelectPayload>;

export type GameStartPayload = {
  game: CanonicalGameId;
  level?: number;
};
export type GameStartMessage = ProtocolEnvelope<"game_start", GameStartPayload>;

export type GameAbortPayload = Record<string, never>;
export type GameAbortMessage = ProtocolEnvelope<"game_abort", GameAbortPayload>;

export type TelemetryConfigPayload = {
  enabled: boolean;
  intervalMs?: number;
};
export type TelemetryConfigMessage = ProtocolEnvelope<
  "telemetry_config",
  TelemetryConfigPayload
>;

export type LevelTaskDefinition = {
  id: number;
  type: string;
  durationMs?: number;
  minimumTurns?: number;
  minimumLeftTurns?: number;
  minimumRightTurns?: number;
  [key: string]: unknown;
};

export type LevelDefinitionPayload = {
  game: CanonicalGameId;
  level: number;
  version: number;
  difficulty?: "easy" | "medium" | "hard";
  tasks?: LevelTaskDefinition[];
};
export type LevelDefinitionMessage = ProtocolEnvelope<
  "level_definition",
  LevelDefinitionPayload
>;

export type ResultsSyncAckPayload = {
  accepted: boolean;
};
export type ResultsSyncAckMessage = ProtocolEnvelope<
  "results_sync_ack",
  ResultsSyncAckPayload
>;

export type PingPayload = Record<string, never>;
export type PingMessage = ProtocolEnvelope<"ping", PingPayload>;

export type OutboundProtocolMessage =
  | HelloMessage
  | DeviceInfoRequestMessage
  | InputMessage
  | GameSelectMessage
  | LevelSelectMessage
  | GameStartMessage
  | GameAbortMessage
  | TelemetryConfigMessage
  | LevelDefinitionMessage
  | ResultsSyncAckMessage
  | PingMessage;

/* ─── Inbound Messages (Robot -> Mobile) ────────────────────────── */

export type HelloAckPayload = {
  device: string;
  protocolVersion: number;
  accepted: boolean;
};
export type HelloAckMessage = ProtocolEnvelope<"hello_ack", HelloAckPayload>;

export type DeviceCapabilities = {
  ble: boolean;
  espNow: boolean;
  oled: boolean;
  led: boolean;
  sensors: boolean;
  games: CanonicalGameId[];
};

export type DeviceInfoPayload = {
  deviceId: string;
  name: string;
  model: string;
  firmware: string;
  protocolVersion: number;
  capabilities?: DeviceCapabilities;
};
export type DeviceInfoMessage = ProtocolEnvelope<"device_info", DeviceInfoPayload>;

export type AckPayload = {
  accepted: boolean;
};
export type AckMessage = ProtocolEnvelope<"ack", AckPayload>;

export type ProtocolErrorCode =
  | "INVALID_JSON"
  | "INVALID_SCHEMA"
  | "UNSUPPORTED_VERSION"
  | "UNKNOWN_MESSAGE_TYPE"
  | "MISSING_FIELD"
  | "INVALID_FIELD"
  | "INVALID_VALUE"
  | "NOT_ALLOWED_IN_STATE"
  | "NOT_ACTIVE_CONTROLLER"
  | "GAME_NOT_IMPLEMENTED"
  | "GAME_NOT_ACTIVE"
  | "LEVEL_NOT_FOUND"
  | "CONTENT_INVALID"
  | "CONTENT_VERSION_CONFLICT"
  | "COMMAND_REJECTED"
  | "TIMEOUT"
  | "INTERNAL_ERROR";

export type ProtocolErrorPayload = {
  code: ProtocolErrorCode | string;
  message: string;
};
export type ErrorMessage = ProtocolEnvelope<"error", ProtocolErrorPayload>;

export type GameSelectedPayload = {
  accepted: boolean;
  game: CanonicalGameId;
  reason?: string;
};
export type GameSelectedMessage = ProtocolEnvelope<"game_selected", GameSelectedPayload>;

export type GameStartedPayload = {
  game: CanonicalGameId;
  level?: number;
  status: "running" | string;
};
export type GameStartedMessage = ProtocolEnvelope<"game_started", GameStartedPayload>;

export type GameStatus =
  | "selected"
  | "ready"
  | "running"
  | "passed"
  | "failed"
  | "completed"
  | "aborted";

export type GameStatePayload = {
  game: CanonicalGameId;
  level?: number;
  task?: number;
  status: GameStatus;
};
export type GameStateMessage = ProtocolEnvelope<"game_state", GameStatePayload>;

export type TaskSummary = {
  completed: number;
  passed: number;
  failed: number;
};

export type GameResultPayload = {
  game: CanonicalGameId;
  level?: number;
  score: number; // 0..100 or 0.0..1.0
  stars: 0 | 1 | 2 | 3;
  status: "completed" | "aborted" | "failed" | string;
  tasks?: TaskSummary;
};
export type GameResultMessage = ProtocolEnvelope<"game_result", GameResultPayload>;

export type SingleResultItem = {
  game: CanonicalGameId;
  level: number;
  score: number;
  stars: 0 | 1 | 2 | 3;
  timestamp: number;
};

export type ResultsSyncPayload = {
  results: SingleResultItem[];
};
export type ResultsSyncMessage = ProtocolEnvelope<"results_sync", ResultsSyncPayload>;

export type TelemetryPayload = {
  state: "GAME" | "RC" | "IDLE" | string;
  controller: "ble" | "esp_now" | "none" | string;
  game?: CanonicalGameId | null;
  level?: number;
  task?: number;
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
  battery: {
    robot: number;
  };
  touch?: {
    event: "none" | "single_tap" | "double_tap" | "hold";
  };
};
export type TelemetryMessage = ProtocolEnvelope<"telemetry", TelemetryPayload>;

export type LevelDefinitionAckPayload = {
  accepted: boolean;
  game: CanonicalGameId;
  level: number;
  version: number;
};
export type LevelDefinitionAckMessage = ProtocolEnvelope<
  "level_definition_ack",
  LevelDefinitionAckPayload
>;

export type PongPayload = Record<string, never>;
export type PongMessage = ProtocolEnvelope<"pong", PongPayload>;

export type InboundProtocolMessage =
  | HelloAckMessage
  | DeviceInfoMessage
  | AckMessage
  | ErrorMessage
  | GameSelectedMessage
  | GameStartedMessage
  | GameStateMessage
  | GameResultMessage
  | ResultsSyncMessage
  | TelemetryMessage
  | LevelDefinitionAckMessage
  | PongMessage;

export type AnyProtocolMessage = OutboundProtocolMessage | InboundProtocolMessage;
