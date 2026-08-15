import type { RobotState } from "@/types/robot";
import type { RobotTelemetry } from "@/types/ble";

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

export const mockTelemetrySequence: RobotTelemetry[] = [
  {
    direction: 127,

    distance: {
      front: 42,
    },

    obstacle: {
      frontLeft: false,
      frontRight: false,
      rearLeft: false,
      rearRight: false,
    },

    motion: {
      sudden: false,
    },

    pit: {
      detected: false,
    },
  },

  {
    direction: 130,

    distance: {
      front: 39,
    },

    obstacle: {
      frontLeft: false,
      frontRight: false,
      rearLeft: true,
      rearRight: false,
    },

    motion: {
      sudden: false,
    },

    pit: {
      detected: false,
    },
  },

  {
    direction: 124,

    distance: {
      front: 45,
    },

    obstacle: {
      frontLeft: false,
      frontRight: false,
      rearLeft: false,
      rearRight: false,
    },

    motion: {
      sudden: true,
    },

    pit: {
      detected: false,
    },
  },

  {
    direction: 128,

    distance: {
      front: 50,
    },

    obstacle: {
      frontLeft: false,
      frontRight: false,
      rearLeft: false,
      rearRight: false,
    },

    motion: {
      sudden: false,
    },

    pit: {
      detected: false,
    },
  },
];