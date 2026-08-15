export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected";

export type RobotInfo = {
  id: string;
  name: string;
  model: string;
  firmware: string;
  battery: number;
};

export type RobotState = {
  info: RobotInfo | null;
  connectionStatus: ConnectionStatus;
};