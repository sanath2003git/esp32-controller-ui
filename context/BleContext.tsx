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
import { ProtocolClient } from "@/lib/ble/protocolClient";
import type {
  AckPayload,
  AnyProtocolMessage,
  CanonicalGameId,
  DeviceInfoPayload,
  GameResultPayload,
  GameSelectedPayload,
  GameStartedPayload,
  GameStatePayload,
  InputPayload,
  ProtocolErrorPayload,
  TelemetryPayload,
} from "@/types/protocol";

export type BleStatus = "disconnected" | "connecting" | "connected";

export type BleContextValue = {
  status: BleStatus;
  isHandshakeComplete: boolean;
  deviceName: string | null;
  deviceInfo: DeviceInfoPayload | null;
  telemetry: TelemetryPayload | null;
  gameState: GameStatePayload | null;
  gameResult: GameResultPayload | null;
  protocolError: ProtocolErrorPayload | null;
  lastMessage: AnyProtocolMessage | null;
  controlOwner: "mobile" | "remote" | "none";
  robotState: "IDLE" | "RC" | "GAME" | string;
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  connect: () => Promise<void>;
  disconnect: () => void;

  // Protocol v1 Semantic Actions
  requestDeviceInfo: () => Promise<DeviceInfoPayload | null>;
  sendInput: (payload: InputPayload) => Promise<void>;
  sendJoystickInput: (x: number, y: number, magnitude?: number) => Promise<void>;
  sendDirectionInput: (
    direction: "forward" | "backward" | "left" | "right" | "up" | "down" | "none",
  ) => Promise<void>;
  sendButtonInput: (
    button: "up" | "down" | "left" | "right" | "select" | "back" | "start" | "stop",
    pressed: boolean,
  ) => Promise<void>;
  selectGame: (game: CanonicalGameId) => Promise<GameSelectedPayload | null>;
  selectLevel: (game: CanonicalGameId, level: number) => Promise<AckPayload | null>;
  startGame: (
    game: CanonicalGameId,
    level?: number,
  ) => Promise<GameStartedPayload | null>;
  abortGame: () => Promise<AckPayload | null>;
  configureTelemetry: (
    enabled: boolean,
    intervalMs?: number,
  ) => Promise<AckPayload | null>;
  acknowledgeResultsSync: (accepted: boolean) => Promise<void>;
  stop: () => Promise<void>;
};

const TRUST_DECAY_INTERVAL_MS = 30000;
const TRUST_DECAY_AMOUNT = -3;

const BleContext = createContext<BleContextValue | null>(null);

export function BleProvider({ children }: { children: ReactNode }) {
  const clientRef = useRef<ProtocolClient | null>(null);
  const lastHoldTimeRef = useRef<number>(0);
  const lastDecayTimeRef = useRef<number>(0);

  const [status, setStatus] = useState<BleStatus>("disconnected");
  const [isHandshakeComplete, setIsHandshakeComplete] = useState<boolean>(false);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfoPayload | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryPayload | null>(null);
  const [gameState, setGameState] = useState<GameStatePayload | null>(null);
  const [gameResult, setGameResult] = useState<GameResultPayload | null>(null);
  const [protocolError, setProtocolError] = useState<ProtocolErrorPayload | null>(null);
  const [lastMessage, setLastMessage] = useState<AnyProtocolMessage | null>(null);
  const [controlOwner, setControlOwner] = useState<"mobile" | "remote" | "none">("none");
  const [robotState, setRobotState] = useState<string>("IDLE");
  const [isModalOpen, setIsModalOpen] = useState<boolean>(true);

  // Initialize timers on mount
  useEffect(() => {
    lastHoldTimeRef.current = Date.now();
    lastDecayTimeRef.current = Date.now();
  }, []);

  // Trust decay if no touch input for 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      if (lastHoldTimeRef.current === 0) return;
      const timeSinceLastTouch = now - lastHoldTimeRef.current;
      const timeSinceLastDecay = now - lastDecayTimeRef.current;

      if (
        timeSinceLastTouch >= TRUST_DECAY_INTERVAL_MS &&
        timeSinceLastDecay >= TRUST_DECAY_INTERVAL_MS
      ) {
        lastDecayTimeRef.current = now;
        incrementTrustLevel(TRUST_DECAY_AMOUNT);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Process trust increment from telemetry touch events
  useEffect(() => {
    if (telemetry?.touch?.event) {
      const evt = telemetry.touch.event;
      if (evt === "hold" || evt === "single_tap" || evt === "double_tap") {
        const now = Date.now();
        if (now - lastHoldTimeRef.current > 1000) {
          lastHoldTimeRef.current = now;
          incrementTrustLevel(1);
        }
      }
    }
  }, [telemetry]);

  const openModal = useCallback(() => setIsModalOpen(true), []);
  const closeModal = useCallback(() => setIsModalOpen(false), []);

  const clearState = useCallback(() => {
    setStatus("disconnected");
    setIsHandshakeComplete(false);
    setDeviceName(null);
    setDeviceInfo(null);
    setTelemetry(null);
    setGameState(null);
    setGameResult(null);
    setProtocolError(null);
    setLastMessage(null);
    setControlOwner("none");
    setRobotState("IDLE");
  }, []);

  const connect = useCallback(async () => {
    if (status === "connecting" || status === "connected") return;

    setStatus("connecting");
    setProtocolError(null);

    const client = new ProtocolClient();
    clientRef.current = client;

    // Register Protocol v1 client subscribers
    client.onDeviceInfo((info) => setDeviceInfo(info));
    client.onTelemetry((t) => {
      setTelemetry(t);
      if (t.state) setRobotState(t.state);
      if (t.controller === "ble" || t.controller === "esp_now" || t.controller === "none") {
        setControlOwner(t.controller as "mobile" | "remote" | "none");
      }
    });
    client.onGameState((s) => setGameState(s));
    client.onGameResult((r) => setGameResult(r));
    client.onError((err) => setProtocolError(err));
    client.onMessage((msg) => setLastMessage(msg));

    try {
      const info = await client.connect();
      setDeviceInfo(info);
      setDeviceName(info?.name ?? "Elxie Robot");
      setStatus("connected");
      setIsHandshakeComplete(true);
      setControlOwner("mobile"); // BLE connected -> Mobile App owns control
      setIsModalOpen(false);

      // Automatically request telemetry streaming from robot
      void client.configureTelemetry(true, 100).catch((err) => {
        console.warn("[BleContext] Telemetry config request failed:", err);
      });
    } catch (error) {
      console.error("[BLE CONNECT ERROR]", error);
      client.disconnect();
      clientRef.current = null;
      clearState();
      throw error;
    }
  }, [status, clearState]);

  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current = null;
    }
    clearState();
  }, [clearState]);

  /* ─── Protocol v1 Action Wrappers ─────────────────────────────────── */

  const requestDeviceInfo = useCallback(async (): Promise<DeviceInfoPayload | null> => {
    if (!clientRef.current || !clientRef.current.isConnected()) return null;
    return clientRef.current.requestDeviceInfo();
  }, []);

  const sendInput = useCallback(async (payload: InputPayload): Promise<void> => {
    if (!clientRef.current || !clientRef.current.isConnected()) {
      throw new Error("BLE device is not connected.");
    }
    await clientRef.current.sendInput(payload);
  }, []);

  const sendJoystickInput = useCallback(
    async (x: number, y: number, magnitude?: number): Promise<void> => {
      if (!clientRef.current || !clientRef.current.isConnected()) {
        throw new Error("BLE device is not connected.");
      }
      await clientRef.current.sendJoystickInput(x, y, magnitude);
    },
    [],
  );

  const sendDirectionInput = useCallback(
    async (
      direction: "forward" | "backward" | "left" | "right" | "up" | "down" | "none",
    ): Promise<void> => {
      if (!clientRef.current || !clientRef.current.isConnected()) {
        throw new Error("BLE device is not connected.");
      }
      await clientRef.current.sendDirectionInput(direction);
    },
    [],
  );

  const sendButtonInput = useCallback(
    async (
      button: "up" | "down" | "left" | "right" | "select" | "back" | "start" | "stop",
      pressed: boolean,
    ): Promise<void> => {
      if (!clientRef.current || !clientRef.current.isConnected()) {
        throw new Error("BLE device is not connected.");
      }
      await clientRef.current.sendButtonInput(button, pressed);
    },
    [],
  );

  const stop = useCallback(async (): Promise<void> => {
    await sendDirectionInput("none");
  }, [sendDirectionInput]);

  const selectGame = useCallback(
    async (game: CanonicalGameId): Promise<GameSelectedPayload | null> => {
      if (!clientRef.current || !clientRef.current.isConnected()) return null;
      return clientRef.current.selectGame(game);
    },
    [],
  );

  const selectLevel = useCallback(
    async (game: CanonicalGameId, level: number): Promise<AckPayload | null> => {
      if (!clientRef.current || !clientRef.current.isConnected()) return null;
      return clientRef.current.selectLevel(game, level);
    },
    [],
  );

  const startGame = useCallback(
    async (
      game: CanonicalGameId,
      level?: number,
    ): Promise<GameStartedPayload | null> => {
      if (!clientRef.current || !clientRef.current.isConnected()) return null;
      return clientRef.current.startGame(game, level);
    },
    [],
  );

  const abortGame = useCallback(async (): Promise<AckPayload | null> => {
    if (!clientRef.current || !clientRef.current.isConnected()) return null;
    return clientRef.current.abortGame();
  }, []);

  const configureTelemetry = useCallback(
    async (enabled: boolean, intervalMs?: number): Promise<AckPayload | null> => {
      if (!clientRef.current || !clientRef.current.isConnected()) return null;
      return clientRef.current.configureTelemetry(enabled, intervalMs);
    },
    [],
  );

  const acknowledgeResultsSync = useCallback(
    async (accepted: boolean): Promise<void> => {
      if (!clientRef.current || !clientRef.current.isConnected()) return;
      await clientRef.current.acknowledgeResultsSync(accepted);
    },
    [],
  );

  return (
    <BleContext.Provider
      value={{
        status,
        isHandshakeComplete,
        deviceName,
        deviceInfo,
        telemetry,
        gameState,
        gameResult,
        protocolError,
        lastMessage,
        controlOwner,
        robotState,
        isModalOpen,
        openModal,
        closeModal,
        connect,
        disconnect,
        requestDeviceInfo,
        sendInput,
        sendJoystickInput,
        sendDirectionInput,
        sendButtonInput,
        selectGame,
        selectLevel,
        startGame,
        abortGame,
        configureTelemetry,
        acknowledgeResultsSync,
        stop,
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
