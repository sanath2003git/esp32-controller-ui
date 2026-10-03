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
  AnyProtocolMessage,
  CanonicalGameId,
  DeviceInfoPayload,
  GameResultPayload,
  GameFeedbackPayload,
  GameStartedPayload,
  GameStatePayload,
  InputPayload,
  JoyStickDir,
  ProtocolErrorPayload,
  SignalChangeEventPayload,
  TelemetryPayload,
} from "@/types/protocol";

export type BleStatus = "disconnected" | "connecting" | "connected";

export type GameFeedbackEvent = { sequence: number; payload: GameFeedbackPayload };

export type BleContextValue = {
  status: BleStatus;
  connectionLost: boolean;
  isHandshakeComplete: boolean;
  deviceName: string | null;
  deviceInfo: DeviceInfoPayload | null;
  telemetry: TelemetryPayload | null;
  gameState: GameStatePayload | null;
  gameResult: GameResultPayload | null;
  gameFeedbackEvents: GameFeedbackEvent[];
  signalChangeEvent: SignalChangeEventPayload | null;
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
  sendJoystickInput: (direction: "up" | "down" | "left" | "right" | "none", magnitude?: number) => Promise<void>;
  sendDirectionInput: (
    direction: JoyStickDir,
  ) => Promise<void>;
  sendButtonInput: (
    button: "up" | "down" | "left" | "right" | "select" | "back" | "start" | "stop",
    pressed: boolean,
  ) => Promise<void>;
  setLedColor: (r: number, g: number, b: number) => Promise<void>;
  honk: (frequency?: number, duration?: number) => Promise<void>;
  startGame: (
    game: CanonicalGameId,
    level?: number,
  ) => Promise<GameStartedPayload | null>;
  runSeq: (game: CanonicalGameId, level: number) => Promise<void>;
  abortGame: () => Promise<void>;
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
  const gameFeedbackSequenceRef = useRef(0);

  const [status, setStatus] = useState<BleStatus>("disconnected");
  const [connectionLost, setConnectionLost] = useState(false);
  const [isHandshakeComplete, setIsHandshakeComplete] = useState<boolean>(false);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfoPayload | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryPayload | null>(null);
  const [gameState, setGameState] = useState<GameStatePayload | null>(null);
  const [gameResult, setGameResult] = useState<GameResultPayload | null>(null);
  const [gameFeedbackEvents, setGameFeedbackEvents] = useState<GameFeedbackEvent[]>([]);
  const [signalChangeEvent, setSignalChangeEvent] = useState<SignalChangeEventPayload | null>(null);
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
      if (evt === "touched") {
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
    console.info("[BleContext] Clearing BLE application state");
    setStatus("disconnected");
    setIsHandshakeComplete(false);
    setDeviceName(null);
    setDeviceInfo(null);
    setTelemetry(null);
    setGameState(null);
    setGameResult(null);
    setGameFeedbackEvents([]);
    setSignalChangeEvent(null);
    gameFeedbackSequenceRef.current = 0;
    setProtocolError(null);
    setLastMessage(null);
    setControlOwner("none");
    setRobotState("IDLE");
  }, []);

  const connect = useCallback(async () => {
    console.info("[BleContext] Connect requested", { status });
    if (status === "connecting" || status === "connected") return;

    console.info("[BleContext] Connection state: connecting");
    setStatus("connecting");
    setConnectionLost(false);
    setProtocolError(null);

    const client = new ProtocolClient();
    clientRef.current = client;

    // Register Protocol v1 client subscribers
    client.onDeviceInfo((info) => setDeviceInfo(info));
    client.onTelemetry((t) => {
      setTelemetry(t);
      if (t.state) setRobotState(t.state);
      if (
        t.controller.active === "mobile" ||
        t.controller.active === "remote" ||
        t.controller.active === "none"
      ) {
        setControlOwner(t.controller.active);
      }
    });
    client.onGameState((s) => setGameState(s));
    client.onGameResult((r) => setGameResult(r));
    client.onGameFeedback((feedback) => {
      const sequence = ++gameFeedbackSequenceRef.current;
      setGameFeedbackEvents((current) => [...current, { sequence, payload: feedback }].slice(-64));
    });
    client.onSignalChange((evt) => setSignalChangeEvent(evt));
    client.onConnectionChange((connected) => {
      if (connected || clientRef.current !== client) return;
      console.warn("[BleContext] Bluetooth connection lost");
      clientRef.current = null;
      clearState();
      setConnectionLost(true);
      setIsModalOpen(true);
    });
    client.onError((err) => setProtocolError(err));
    client.onMessage((msg) => setLastMessage(msg));

    try {
      console.info("[BleContext] Protocol client connect started");
      const info = await client.connect();
      console.info("[BleContext] Handshake and device info completed", info);
      setDeviceInfo(info);
      setDeviceName(info?.name ?? "Elxie Robot");
      console.info("[BleContext] Connection state: connected");
      setStatus("connected");
      setConnectionLost(false);
      setIsHandshakeComplete(true);
      setControlOwner("mobile"); // BLE connected -> Mobile App owns control
      setIsModalOpen(false);
    } catch (error) {
      console.error("[BleContext] BLE connect/handshake flow failed", error);
      client.disconnect();
      clientRef.current = null;
      clearState();
      throw error;
    }
  }, [status, clearState]);

  const disconnect = useCallback(() => {
    console.info("[BleContext] Disconnect requested by application");
    setConnectionLost(false);
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
    async (direction: JoyStickDir, magnitude?: number): Promise<void> => {
      if (!clientRef.current || !clientRef.current.isConnected()) {
        throw new Error("BLE device is not connected.");
      }
      await clientRef.current.sendJoystickInput(direction, magnitude);
    },
    [],
  );

  const sendDirectionInput = useCallback(
    async (
      direction: JoyStickDir,
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

  const setLedColor = useCallback(async (r: number, g: number, b: number): Promise<void> => {
    if (!clientRef.current || !clientRef.current.isConnected()) {
      throw new Error("BLE device is not connected.");
    }
    await clientRef.current.setLedColor(r, g, b);
  }, []);

  const honk = useCallback(async (frequency?: number, duration?: number): Promise<void> => {
    if (!clientRef.current || !clientRef.current.isConnected()) {
      throw new Error("BLE device is not connected.");
    }
    await clientRef.current.honk(frequency, duration);
  }, []);

  const stop = useCallback(async (): Promise<void> => {
    await sendDirectionInput("none");
  }, [sendDirectionInput]);

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

  const runSeq = useCallback(
    async (game: CanonicalGameId, level: number): Promise<void> => {
      if (!clientRef.current || !clientRef.current.isConnected()) return;
      await clientRef.current.runSeq(game, level);
    },
    [],
  );

  const abortGame = useCallback(async (): Promise<void> => {
    if (!clientRef.current || !clientRef.current.isConnected()) return;
    await clientRef.current.abortGame();
  }, []);

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
        connectionLost,
        isHandshakeComplete,
        deviceName,
        deviceInfo,
        telemetry,
        gameState,
        gameResult,
        gameFeedbackEvents,
        signalChangeEvent,
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
        setLedColor,
        honk,
        startGame,
        runSeq,
        abortGame,
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
