export type EchoMemoryDirection = "up" | "right" | "down" | "left";

export type EchoMemoryColor = "red" | "yellow" | "green" | "blue";

export type EchoMemoryStartCommand = {
  command: "challenge";
  game: "echo-memory";
  level: number;
};

export type EchoMemoryInputCommand = {
  command: "input";
  game?: "echo-memory";
  dir: EchoMemoryDirection;
};

export type EchoMemoryAbortCommand = {
  command: "abort";
};

export type EchoMemoryCommand =
  | EchoMemoryStartCommand
  | EchoMemoryInputCommand
  | EchoMemoryAbortCommand;

export type EchoMemoryPhaseType = "flash" | "wait" | "input";

export type EchoMemoryPhaseMessage = {
  type: "phase";
  game: "echo-memory";
  level: number;
  phase: EchoMemoryPhaseType;
  index?: number;
  length?: number;
  durationMs?: number;
};

export type EchoMemoryInputResultMessage = {
  type: "input_result";
  game: "echo-memory";
  level: number;
  index: number;
  correct: boolean;
  score: number;
};

export type EchoMemoryResultMessage = {
  type: "response";
  game: "echo-memory";
  level: number;
  score: number; // 0..1 float
  scorePercent: number; // 0..100 integer
  stars: 0 | 1 | 2 | 3;
  correct: number;
  total: number;
};

export type EchoMemoryAbortedMessage = {
  type: "aborted";
  game: "echo-memory";
};

export type EchoMemoryMessage =
  | EchoMemoryPhaseMessage
  | EchoMemoryInputResultMessage
  | EchoMemoryResultMessage
  | EchoMemoryAbortedMessage;

export type EchoMemoryGameState =
  | "idle"
  | "starting"
  | "flashing"
  | "waiting"
  | "input"
  | "completed"
  | "error";
