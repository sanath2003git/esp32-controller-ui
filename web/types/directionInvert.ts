export type DirectionInvertMappingMode = "FORWARD_BACKWARD_INVERT";

export type DirectionInvertStartCommand = {
  command: "challenge";
  game: "direction-invert";
  level: number;
};

export type DirectionInvertAbortCommand = {
  command: "abort";
};

export type DirectionInvertCommand =
  | DirectionInvertStartCommand
  | DirectionInvertAbortCommand;

export type DirectionInvertTaskMessage = {
  type: "task";
  game: "direction-invert";
  level: number;
  task: number;
  index: number;
  mapping: string;
  maxTime: number;
};

export type DirectionInvertTaskResultMessage = {
  type: "task_result";
  game: "direction-invert";
  level: number;
  index: number;
  task: number;
  success: boolean;
  totalTurns?: number;
  leftTurns?: number;
  rightTurns?: number;
};

export type DirectionInvertResultMessage = {
  type: "response";
  mode: "direction_invert" | "direction-invert";
  game?: string;
  level: number;
  tasks: number;
  successfulTasks: number;
  score: number;
  stars: 0 | 1 | 2 | 3;
};

export type DirectionInvertAbortedMessage = {
  type: "aborted";
  game: "direction-invert";
};

export type DirectionInvertMessage =
  | DirectionInvertTaskMessage
  | DirectionInvertTaskResultMessage
  | DirectionInvertResultMessage
  | DirectionInvertAbortedMessage;
