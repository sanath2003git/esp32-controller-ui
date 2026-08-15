"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { BleClient } from "@/lib/ble/client";
import {
  createColorCommand,
  type BleMessage,
  type MovementDirection,
  type RgbColor,
  type RobotCommand,
  type RobotDeviceInfo,
  type RobotTelemetry,
} from "@/types/ble";

import { mockTelemetrySequence } from "@/data/mockRobot";

type BleStatus = "disconnected" | "connecting" | "connected";

type BleContextValue = {
  status: BleStatus;
  deviceName: string | null;
  deviceInfo: RobotDeviceInfo | null;
  telemetry: RobotTelemetry | null;
  lastMessage: BleMessage | null;
  connect: () => Promise<void>;
  send: (message: RobotCommand) => Promise<void>;
  move: (direction: MovementDirection) => Promise<void>;
  stop: () => Promise<void>;
  setColor: (color: RgbColor) => Promise<void>;
  disconnect: () => void;
};

const BleContext = createContext<BleContextValue | null>(null);

export function BleProvider({ children }: { children: ReactNode }) {
  const clientRef = useRef<BleClient | null>(null);
  const statusRef = useRef<BleStatus>("disconnected");

  const [status, setStatus] = useState<BleStatus>("disconnected");
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<RobotDeviceInfo | null>(null);
  const [telemetry, setTelemetry] = useState<RobotTelemetry | null>(null);
  const [lastMessage, setLastMessage] = useState<BleMessage | null>(null);

    useEffect(() => {
    if (status !== "disconnected") {
      return;
    }

    let index = 0;

    const updateMockTelemetry = () => {
      const currentTelemetry = mockTelemetrySequence[index];

      setTelemetry({
        ...currentTelemetry,
        timestamp: Date.now(),
      });

      index = (index + 1) % mockTelemetrySequence.length;
    };

    updateMockTelemetry();

    const interval = window.setInterval(updateMockTelemetry, 2000);

    return () => {
      window.clearInterval(interval);
    };
  }, [status]);
  
  const setConnectionStatus = useCallback((nextStatus: BleStatus) => {
    statusRef.current = nextStatus;
    setStatus(nextStatus);
  }, []);

  const clearConnectionState = useCallback(() => {
    setDeviceName(null);
    setDeviceInfo(null);
    setTelemetry(null);
    setLastMessage(null);
    setConnectionStatus("disconnected");
  }, [setConnectionStatus]);

  const connect = useCallback(async () => {
    if (statusRef.current !== "disconnected") {
      return;
    }

    setConnectionStatus("connecting");
    setDeviceInfo(null);
    setTelemetry(null);
    setLastMessage(null);

    const client = new BleClient();
    clientRef.current = client;

    try {
      const device = await client.connect(
        (message) => {
          setLastMessage(message);

          if (message.type === "device_info") {
            setDeviceInfo(message);
          }

          if (message.type === "telemetry") {
            setTelemetry(message.telemetry);
          }
        },
        () => {
          if (clientRef.current === client) {
            clientRef.current = null;
            clearConnectionState();
          }
        },
      );

      const bluetoothDevice = device as BluetoothDevice & {
        id?: string;
        name?: string | null;
      };

      setDeviceName(
        bluetoothDevice.name ?? bluetoothDevice.id ?? "Unknown device",
      );
      setConnectionStatus("connected");
    } catch (error) {
      console.error("[BLE CONNECT ERROR]", error);

      if (clientRef.current === client) {
        client.disconnect();
        clientRef.current = null;
        clearConnectionState();
      }

      throw error;
    }
  }, [clearConnectionState, setConnectionStatus]);

  const send = useCallback(async (message: RobotCommand) => {
    const client = clientRef.current;

    if (!client || statusRef.current !== "connected") {
      throw new Error("BLE device is not connected.");
    }

    await client.send(message);
  }, []);

  const move = useCallback(
    async (direction: MovementDirection) => {
      await send({ command: "move", direction });
    },
    [send],
  );

  const stop = useCallback(async () => {
    await send({ command: "stop" });
  }, [send]);

  const setColor = useCallback(
    async (color: RgbColor) => {
      await send(createColorCommand(color));
    },
    [send],
  );

  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();
    clientRef.current = null;
    clearConnectionState();
  }, [clearConnectionState]);

  return (
    <BleContext.Provider
      value={{
        status,
        deviceName,
        deviceInfo,
        telemetry,
        lastMessage,
        connect,
        send,
        move,
        stop,
        setColor,
        disconnect,
      }}
    >
      {children}
    </BleContext.Provider>
  );
}

export function useBleContext() {
  const context = useContext(BleContext);

  if (!context) {
    throw new Error("useBleContext must be used inside BleProvider");
  }

  return context;
}
