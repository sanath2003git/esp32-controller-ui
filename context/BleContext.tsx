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
import { incrementTrustLevel } from "@/lib/progressStore";

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

type BleStatus = "disconnected" | "connecting" | "connected";

const TRUST_DECAY_INTERVAL_MS = 30000; // 30 seconds
const TRUST_DECAY_AMOUNT = -3; // 3 percent

type BleContextValue = {
  status: BleStatus;
  deviceName: string | null;
  deviceInfo: RobotDeviceInfo | null;
  telemetry: RobotTelemetry | null;
  lastMessage: BleMessage | null;
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  connect: () => Promise<void>;
  send: (message: RobotCommand) => Promise<void>;
  move: (direction: MovementDirection) => Promise<void>;
  stop: () => Promise<void>;
  setColor: (color: RgbColor) => Promise<void>;
  beep: (freq?: number, duration?: number) => Promise<void>;
  setOledText: (text: string) => Promise<void>;
  disconnect: () => void;
};

const BleContext = createContext<BleContextValue | null>(null);

export function BleProvider({ children }: { children: ReactNode }) {
  const clientRef = useRef<BleClient | null>(null);
  const statusRef = useRef<BleStatus>("disconnected");
  const lastHoldTimeRef = useRef<number>(Date.now());
  const lastDecayTimeRef = useRef<number>(Date.now());

  const [status, setStatus] = useState<BleStatus>("disconnected");
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<RobotDeviceInfo | null>(null);
  const [telemetry, setTelemetry] = useState<RobotTelemetry | null>(null);
  const [lastMessage, setLastMessage] = useState<BleMessage | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(true);

  // Decay trust if there is no touch input for a prolonged period
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      const timeSinceLastTouch = now - lastHoldTimeRef.current;
      const timeSinceLastDecay = now - lastDecayTimeRef.current;
      
      // If it's been at least 30s since last touch, AND at least 30s since last decay
      if (timeSinceLastTouch >= TRUST_DECAY_INTERVAL_MS && timeSinceLastDecay >= TRUST_DECAY_INTERVAL_MS) {
        lastDecayTimeRef.current = now;
        incrementTrustLevel(TRUST_DECAY_AMOUNT);
      }
    }, 1000); // check every second

    return () => clearInterval(timer);
  }, []);

  // Process touch trust globally whenever a new telemetry message arrives
  useEffect(() => {
    if (lastMessage?.type === "telemetry" && lastMessage.telemetry.touch?.event) {
      const evt = lastMessage.telemetry.touch.event;
      if (evt === "hold" || evt === "single_tap" || evt === "double_tap") {
        const now = Date.now();
        if (now - lastHoldTimeRef.current > 1000) {
          lastHoldTimeRef.current = now;
          incrementTrustLevel(1);
        }
      }
    }
  }, [lastMessage]);

  const openModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

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
      setIsModalOpen(false);
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

  const beep = useCallback(
    async (freq = 2000, duration = 100) => {
      await send({ command: "buzzer", freq, duration });
    },
    [send],
  );

  const setOledText = useCallback(
    async (text: string) => {
      await send({ command: "oled_text", text });
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
        isModalOpen,
        openModal,
        closeModal,
        connect,
        send,
        move,
        stop,
        setColor,
        beep,
        setOledText,
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
