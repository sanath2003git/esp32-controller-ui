export type RobotDeviceInfo = {
  deviceId: string;
  name: string;
  model: string;
  firmware: string;
};

export type BleMessage =
  | {
      type: "device_info";
      deviceId: string;
      name: string;
      model: string;
      firmware: string;
    }
  | {
      type: "response";
      status: string;
      command: string;
      [key: string]: unknown;
    }
  | {
      type: string;
      [key: string]: unknown;
    };