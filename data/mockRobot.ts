import type { RobotState } from "@/types/robot";

export const mockRobotState: RobotState = {
  connectionStatus: "connected",

  info: {
    id: "404321AD4F7C",
    name: "MAINBOT",
    model: "ESP32-S3 N16R8",
    firmware: "Prototype v1.0",
    battery: 87,
  },
};