"use client";

import { BleTransport } from "./transport";
import {
  PROTOCOL_VERSION,
  type AckPayload,
  type AnyProtocolMessage,
  type ButtonInputPayload,
  type CanonicalGameId,
  type DeviceInfoPayload,
  type DirectionInputPayload,
  type GameResultPayload,
  type GameStartedPayload,
  type GameStatePayload,
  type HelloAckPayload,
  type InputPayload,
  type InboundProtocolMessage,
  type JoystickInputPayload,
  type LevelDefinitionAckPayload,
  type LevelDefinitionPayload,
  type PongPayload,
  type ProtocolEnvelope,
  type GameResultMessage,
  type GameFeedbackMessage,
  type GameFeedbackPayload,
  type LegacyGameResultMessage,
  type ProtocolErrorPayload,
  type ResultsSyncPayload,
  type TelemetryPayload,
  type JoyStickDir,
  type SignalChangeEventPayload,
  type SignalChangeMessage,
} from "@/types/protocol";

type RequestResolver = {
  resolve: (response: unknown) => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
};

export class ProtocolClient {
  private transport: BleTransport;
  private messageCounter = 0;
  private isHandshakeDone = false;
  private pendingRequests = new Map<string, RequestResolver>();

  private deviceInfoSubscribers = new Set<(info: DeviceInfoPayload) => void>();
  private telemetrySubscribers = new Set<(telemetry: TelemetryPayload) => void>();
  private gameStateSubscribers = new Set<(state: GameStatePayload) => void>();
  private gameResultSubscribers = new Set<(result: GameResultPayload) => void>();
  private gameFeedbackSubscribers = new Set<(feedback: GameFeedbackPayload) => void>();
  private signalChangeSubscribers = new Set<(event: SignalChangeEventPayload) => void>();
  private connectionSubscribers = new Set<(connected: boolean) => void>();
  private resultsSyncSubscribers = new Set<(sync: ResultsSyncPayload) => void>();
  private errorSubscribers = new Set<(error: ProtocolErrorPayload) => void>();
  private genericMessageSubscribers = new Set<(msg: AnyProtocolMessage) => void>();

  private unsubscribeTransportMessages: (() => void) | null = null;
  private unsubscribeTransportConnection: (() => void) | null = null;

  constructor(transport?: BleTransport) {
    this.transport = transport ?? new BleTransport();
    this.setupTransportListeners();
  }

  /**
   * Returns true if connected to the BLE transport and handshake is complete.
   */
  isConnected(): boolean {
    return this.transport.isConnected();
  }

  /**
   * Returns true if version handshake (hello <-> hello_ack) has successfully completed.
   */
  isHandshakeComplete(): boolean {
    return this.isConnected() && this.isHandshakeDone;
  }

  /**
   * Connect transport, perform Protocol v1 handshake, and fetch device info.
   */
  async connect(deviceName?: string): Promise<DeviceInfoPayload | null> {
    console.info("[ProtocolClient] Beginning connection and handshake", { deviceName });
    await this.transport.connect(deviceName);
    console.info("[ProtocolClient] Transport connected; sending hello");

    try {
      const helloAck = await this.sendHello();
      console.info("[ProtocolClient] Hello acknowledgement received", helloAck);
      if (!helloAck.accepted) {
        throw new Error(
          `Protocol v1 handshake rejected by robot (version ${helloAck.protocolVersion}).`,
        );
      }

      this.isHandshakeDone = true;
      console.info("[ProtocolClient] Handshake complete; requesting device info");
      const info = await this.requestDeviceInfo();
      console.info("[ProtocolClient] Device info received", info);
      return info;
    } catch (error) {
      console.error("[ProtocolClient] Connect/handshake failed", error);
      this.disconnect();
      throw error;
    }
  }

  /**
   * Disconnect transport and cleanup pending requests/state.
   */
  disconnect(): void {
    console.info("[ProtocolClient] Disconnect requested", { pendingRequests: this.pendingRequests.size });
    this.isHandshakeDone = false;
    this.rejectAllPendingRequests("Protocol client disconnected.");
    this.transport.disconnect();
  }

  /* ─── Outbound Protocol Operations ────────────────────────────────── */

  /**
   * Send Protocol v1 version handshake request.
   */
  async sendHello(): Promise<HelloAckPayload> {
    return this.sendRequest<HelloAckPayload>("hello", {
      client: "elxie-web",
      clientVersion: "1.0.0",
      protocolVersion: PROTOCOL_VERSION,
    });
  }

  /**
   * Request robot device information and capabilities.
   */
  async requestDeviceInfo(): Promise<DeviceInfoPayload> {
    const info = await this.sendRequest<DeviceInfoPayload>(
      "device_info_request",
      {},
    );
    for (const sub of this.deviceInfoSubscribers) {
      try {
        sub(info);
      } catch (err) {
        console.error("[ProtocolClient] Error in deviceInfo subscriber:", err);
      }
    }
    return info;
  }

  /**
   * Send normalized input message (joystick, direction, or button).
   */
  async sendInput(payload: InputPayload): Promise<void> {
    await this.sendUncorrelatedMessage("input", payload, true);
  }

  /**
   * Convenience helper to send normalized joystick input.
   */
  async sendJoystickInput(
    direction: JoyStickDir,
    magnitude?: number,
  ): Promise<void> {
    const payload: JoystickInputPayload = {
      inputType: "joystick",
      dir: direction,
      ...(magnitude !== undefined
        ? { magnitude: Math.round(Math.max(0, Math.min(1, magnitude)) * 1000) / 1000 }
        : {}),
    };

    await this.sendInput(payload);
  }

  /**
   * Convenience helper to send normalized direction input.
   */
  async sendDirectionInput(
    direction: JoyStickDir,
  ): Promise<void> {
    const payload: DirectionInputPayload = {
      inputType: "direction",
      direction,
    };
    await this.sendInput(payload);
  }

  /**
   * Convenience helper to send normalized button input.
   */
  async sendButtonInput(
    button: "up" | "down" | "left" | "right" | "select" | "back" | "start" | "stop",
    pressed: boolean,
  ): Promise<void> {
    const payload: ButtonInputPayload = {
      inputType: "button",
      button,
      pressed,
    };
    await this.sendInput(payload);
  }

  /** Set the robot's RGB LED strip using the Protocol v1 hardware command. */
  async setLedColor(r: number, g: number, b: number): Promise<void> {
    const envelope = {
      v: PROTOCOL_VERSION,
      type: "command",
      command: "led_set",
      r: Math.round(Math.max(0, Math.min(255, r))),
      g: Math.round(Math.max(0, Math.min(255, g))),
      b: Math.round(Math.max(0, Math.min(255, b))),
    };
    await this.transport.write(JSON.stringify(envelope));
  }

  /** Play a short horn tone on the robot's buzzer. */
  async honk(frequency = 1200, duration = 400): Promise<void> {
    const envelope = {
      v: PROTOCOL_VERSION,
      type: "command",
      command: "honk",
      frequency: Math.max(1, Math.round(frequency)),
      duration: Math.max(1, Math.round(duration)),
    };
    await this.transport.write(JSON.stringify(envelope));
  }

  /**
   * Request game start on the robot.
   */
  async startGame(
    game: CanonicalGameId,
    level?: number,
  ): Promise<GameStartedPayload> {
    return this.sendCommandRequest<GameStartedPayload>("game_start", { gameId: game, level });
  }

  /**
   * Request active game abort on the robot.
   */
  async abortGame(): Promise<void> {
    const id = this.generateMessageId();
    const envelope = { v: PROTOCOL_VERSION, type: "command", command: "game_abort", id, payload: {} };
    await this.transport.write(JSON.stringify(envelope));
  }

  /**
   * Send sequence execution start command on the robot (Reflex Dash).
   */
  async runSeq(game: CanonicalGameId, level?: number): Promise<void> {
    const id = this.generateMessageId();
    const envelope = { v: PROTOCOL_VERSION, type: "command", command: "run_seq", id, payload: { gameId: game, level } };
    await this.transport.write(JSON.stringify(envelope));
  }

  /**
   * Configure robot telemetry streaming.
   */
  async configureTelemetry(
    enabled: boolean,
    intervalMs?: number,
  ): Promise<AckPayload> {
    return this.sendRequest<AckPayload>("telemetry_config", {
      enabled,
      ...(intervalMs !== undefined ? { intervalMs } : {}),
    });
  }

  /**
   * Send acknowledgement for offline results sync stream.
   */
  async acknowledgeResultsSync(accepted: boolean): Promise<void> {
    await this.sendUncorrelatedMessage("results_sync_ack", { accepted });
  }

  /**
   * Send custom level definition payload to robot.
   */
  async sendLevelDefinition(
    levelDef: LevelDefinitionPayload,
  ): Promise<LevelDefinitionAckPayload> {
    return this.sendRequest<LevelDefinitionAckPayload>(
      "level_definition",
      levelDef,
    );
  }

  /**
   * Send protocol ping request and await pong.
   */
  async ping(): Promise<PongPayload> {
    return this.sendRequest<PongPayload>("ping", {});
  }

  /* ─── Event Subscriptions ─────────────────────────────────────────── */

  onDeviceInfo(callback: (info: DeviceInfoPayload) => void): () => void {
    this.deviceInfoSubscribers.add(callback);
    return () => this.deviceInfoSubscribers.delete(callback);
  }

  onTelemetry(callback: (telemetry: TelemetryPayload) => void): () => void {
    this.telemetrySubscribers.add(callback);
    return () => this.telemetrySubscribers.delete(callback);
  }

  onGameState(callback: (state: GameStatePayload) => void): () => void {
    this.gameStateSubscribers.add(callback);
    return () => this.gameStateSubscribers.delete(callback);
  }

  onGameResult(callback: (result: GameResultPayload) => void): () => void {
    this.gameResultSubscribers.add(callback);
    return () => this.gameResultSubscribers.delete(callback);
  }

  onGameFeedback(callback: (feedback: GameFeedbackPayload) => void): () => void {
    this.gameFeedbackSubscribers.add(callback);
    return () => this.gameFeedbackSubscribers.delete(callback);
  }

  onSignalChange(callback: (event: SignalChangeEventPayload) => void): () => void {
    this.signalChangeSubscribers.add(callback);
    return () => this.signalChangeSubscribers.delete(callback);
  }

  onConnectionChange(callback: (connected: boolean) => void): () => void {
    this.connectionSubscribers.add(callback);
    return () => this.connectionSubscribers.delete(callback);
  }

  onResultsSync(callback: (sync: ResultsSyncPayload) => void): () => void {
    this.resultsSyncSubscribers.add(callback);
    return () => this.resultsSyncSubscribers.delete(callback);
  }

  onError(callback: (error: ProtocolErrorPayload) => void): () => void {
    this.errorSubscribers.add(callback);
    return () => this.errorSubscribers.delete(callback);
  }

  onMessage(callback: (msg: AnyProtocolMessage) => void): () => void {
    this.genericMessageSubscribers.add(callback);
    return () => this.genericMessageSubscribers.delete(callback);
  }

  /* ─── Private Internal Helper Methods ────────────────────────────── */

  private generateMessageId(): string {
    this.messageCounter += 1;
    return `msg_${Date.now()}_${this.messageCounter}`;
  }

  private constructEnvelope<TType extends string, TPayload extends object>(
    type: TType,
    payload: TPayload,
    id?: string,
  ): ProtocolEnvelope<TType, TPayload> {
    return {
      v: PROTOCOL_VERSION,
      type,
      ...(id ? { id } : {}),
      ts: Date.now(),
      payload,
    };
  }

  private async sendUncorrelatedMessage<
    TType extends string,
    TPayload extends object,
  >(type: TType, payload: TPayload, includeId = false): Promise<void> {
    const envelope = this.constructEnvelope(type, payload, includeId ? this.generateMessageId() : undefined);
    const json = JSON.stringify(envelope);
    console.debug("[ProtocolClient] Sending message", { type, json });
    await this.transport.write(json);
    console.debug("[ProtocolClient] Message write completed", { type });
  }

  private async sendRequest<TResponsePayload>(
    type: string,
    payload: object,
    timeoutMs = 8000,
  ): Promise<TResponsePayload> {
    const id = this.generateMessageId();
    const envelope = this.constructEnvelope(type, payload, id);
    return this.sendCorrelatedRequest<TResponsePayload>(JSON.stringify(envelope), id, type, timeoutMs);
  }

  private async sendCommandRequest<TResponsePayload>(
    command: string,
    payload: object,
    timeoutMs = 8000,
  ): Promise<TResponsePayload> {
    const id = this.generateMessageId();
    const envelope = { v: PROTOCOL_VERSION, type: "command", command, id, payload };
    return this.sendCorrelatedRequest<TResponsePayload>(JSON.stringify(envelope), id, command, timeoutMs);
  }

  private async sendCorrelatedRequest<TResponsePayload>(
    json: string,
    id: string,
    operation: string,
    timeoutMs: number,
  ): Promise<TResponsePayload> {
    console.info("[ProtocolClient] Sending correlated request", { operation, id, timeoutMs, json });
    return new Promise<TResponsePayload>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Protocol v1 request timed out after ${timeoutMs}ms (operation: ${operation}, id: ${id})`));
      }, timeoutMs);

      this.pendingRequests.set(id, {
        resolve: resolve as (res: unknown) => void,
        reject,
        timeoutId,
      });

      this.transport.write(json).catch((err) => {
        const req = this.pendingRequests.get(id);
        if (req) {
          clearTimeout(req.timeoutId);
          this.pendingRequests.delete(id);
        }
        reject(err);
      });
    });
  }

  private setupTransportListeners(): void {
    this.unsubscribeTransportMessages = this.transport.subscribeToMessages(
      (rawMessage) => this.handleRawMessage(rawMessage),
    );

    this.unsubscribeTransportConnection =
      this.transport.subscribeToConnectionChange((connected) => {
        console.info("[ProtocolClient] Transport connection event", { connected, pendingRequests: this.pendingRequests.size });
        if (!connected) {
          this.isHandshakeDone = false;
          this.rejectAllPendingRequests("Transport connection lost.");
        }
        for (const subscriber of this.connectionSubscribers) {
          try { subscriber(connected); } catch (err) {
            console.error("[ProtocolClient] Error in connection subscriber:", err);
          }
        }
      });
  }

  private handleRawMessage(raw: string): void {
    const isTelemetry = raw.includes('"telemetry"');
    if (!isTelemetry) {
      console.info("[ProtocolClient] Incoming raw message", raw);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      console.warn("[ProtocolClient] Failed to parse JSON message:", raw, err);
      this.emitError("INVALID_JSON", "Failed to parse incoming JSON string.");
      return;
    }

    if (!this.isValidEnvelope(parsed)) {
      console.warn("[ProtocolClient] Invalid message envelope:", parsed);
      this.emitError(
        "INVALID_SCHEMA",
        "Message envelope missing required fields (v:1, type, payload).",
      );
      return;
    }

    const message = parsed as InboundProtocolMessage;
    if (message.type !== "telemetry") {
      console.info("[ProtocolClient] Parsed protocol message", { type: message.type, id: message.id, payload: "payload" in message ? message.payload : undefined });
    }

    // Dispatch to raw generic message subscribers
    for (const sub of this.genericMessageSubscribers) {
      try {
        sub(message);
      } catch (err) {
        console.error("[ProtocolClient] Error in generic message subscriber:", err);
      }
    }

    // Resolve correlated pending request if `id` matches
    if (message.id && this.pendingRequests.has(message.id)) {
      console.info("[ProtocolClient] Matched response to pending request", { type: message.type, id: message.id });
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        clearTimeout(pending.timeoutId);
        this.pendingRequests.delete(message.id);

        if (message.type === "error") {
          const errPayload = message.payload as ProtocolErrorPayload;
          pending.reject(
            new Error(
              `Protocol error ${errPayload.code}: ${errPayload.message}`,
            ),
          );
        } else {
          pending.resolve("payload" in message ? message.payload : message);
        }
      }
    } else if (message.id) {
      console.warn("[ProtocolClient] Received response with no matching pending request", { type: message.type, id: message.id, pendingIds: [...this.pendingRequests.keys()] });
    }

    // Dispatch to specific event type handlers
    this.dispatchTypedMessage(message);
  }

  private dispatchTypedMessage(message: InboundProtocolMessage): void {
    switch (message.type) {
      case "device_info":
        for (const sub of this.deviceInfoSubscribers) {
          try {
            sub(message.payload as DeviceInfoPayload);
          } catch (err) {
            console.error("[ProtocolClient] Error in deviceInfo subscriber:", err);
          }
        }
        break;

      case "telemetry":
        for (const sub of this.telemetrySubscribers) {
          try {
            sub(message as TelemetryPayload);
          } catch (err) {
            console.error("[ProtocolClient] Error in telemetry subscriber:", err);
          }
        }
        break;

      case "game_state":
        for (const sub of this.gameStateSubscribers) {
          try {
            sub(message.payload as GameStatePayload);
          } catch (err) {
            console.error("[ProtocolClient] Error in gameState subscriber:", err);
          }
        }
        break;

      case "response":
        if (message.response === "game_result") {
          const result = message as GameResultMessage;
          for (const sub of this.gameResultSubscribers) {
            try { sub(result); } catch (err) {
              console.error("[ProtocolClient] Error in gameResult subscriber:", err);
            }
          }
        } else if (message.response === "game_feedback") {
          const feedback = message as GameFeedbackMessage;
          for (const sub of this.gameFeedbackSubscribers) {
            try { sub(feedback); } catch (err) {
              console.error("[ProtocolClient] Error in gameFeedback subscriber:", err);
            }
          }
        }
        break;

      case "game_event":
        if ((message as SignalChangeMessage).event === "signal_change") {
          const signalEvt = message as SignalChangeMessage;
          const payload: SignalChangeEventPayload = {
            gameId: signalEvt.gameId,
            level: signalEvt.level,
            phaseIndex: signalEvt.phaseIndex,
            signal: signalEvt.signal,
            color: signalEvt.color,
            durationMs: signalEvt.durationMs,
          };
          for (const sub of this.signalChangeSubscribers) {
            try { sub(payload); } catch (err) {
              console.error("[ProtocolClient] Error in signalChange subscriber:", err);
            }
          }
        }
        break;

      case "game_result": {
        const legacy = message as LegacyGameResultMessage;
        const result: GameResultPayload = {
          gameId: legacy.payload.game,
          level: legacy.payload.level ?? 1,
          score: legacy.payload.score,
          stars: legacy.payload.stars,
          tasksCompleted: legacy.payload.tasks?.completed ?? 0,
          tasksTotal: legacy.payload.tasks
            ? legacy.payload.tasks.completed + legacy.payload.tasks.passed + legacy.payload.tasks.failed
            : 0,
          status: legacy.payload.status,
        };
        for (const sub of this.gameResultSubscribers) {
          try { sub(result); } catch (err) {
            console.error("[ProtocolClient] Error in gameResult subscriber:", err);
          }
        }
        break;
      }

      case "results_sync":
        for (const sub of this.resultsSyncSubscribers) {
          try {
            sub(message.payload as ResultsSyncPayload);
          } catch (err) {
            console.error("[ProtocolClient] Error in resultsSync subscriber:", err);
          }
        }
        break;

      case "error":
        for (const sub of this.errorSubscribers) {
          try {
            sub(message.payload as ProtocolErrorPayload);
          } catch (err) {
            console.error("[ProtocolClient] Error in error subscriber:", err);
          }
        }
        break;
    }
  }

  private isValidEnvelope(val: unknown): val is InboundProtocolMessage {
    
    if (typeof val !== "object" || val === null) return false;
    
    const obj = val as Record<string, unknown>;
    
    if (obj.v !== PROTOCOL_VERSION || typeof obj.type !== "string") return false;

    if (obj.type === "telemetry") {
      return typeof obj.timestamp === "number" && Number.isFinite(obj.timestamp) &&
        typeof obj.direction === "number" &&
        typeof obj.controller === "object" && obj.controller !== null;
    }
    
    if (obj.type === "response" && obj.response === "game_result") {
      return typeof obj.gameId === "string" && Number.isInteger(obj.level) && Number(obj.level) >= 1 &&
        typeof obj.score === "number" && Number.isFinite(obj.score) && obj.score >= 0 &&
        Number.isInteger(obj.stars) && Number(obj.stars) >= 0 && Number(obj.stars) <= 3 &&
        Number.isInteger(obj.tasksCompleted) && Number(obj.tasksCompleted) >= 0 &&
        Number.isInteger(obj.tasksTotal) && Number(obj.tasksTotal) >= Number(obj.tasksCompleted);
    }
    
    if (obj.type === "response" && obj.response === "game_feedback") {
      return typeof obj.gameId === "string" && Number.isInteger(obj.level) && Number(obj.level) >= 1 &&
        Number.isInteger(obj.taskId) && Number(obj.taskId) >= 1 && typeof obj.correct === "boolean" &&
        Number.isInteger(obj.correctCount) && Number(obj.correctCount) >= 0;
    }

    if (obj.type === "game_event") {
      return typeof obj.event === "string";
    }
    
    return typeof obj.payload === "object" && obj.payload !== null;
  }

  private emitError(code: string, message: string): void {
    const payload: ProtocolErrorPayload = { code, message };
    for (const sub of this.errorSubscribers) {
      try {
        sub(payload);
      } catch (err) {
        console.error("[ProtocolClient] Error in error subscriber:", err);
      }
    }
  }

  private rejectAllPendingRequests(reason: string): void {
    console.warn("[ProtocolClient] Rejecting pending requests", { reason, requestIds: [...this.pendingRequests.keys()] });
    for (const [id, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timeoutId);
      pending.reject(new Error(`Request cancelled (${id}): ${reason}`));
    }
    this.pendingRequests.clear();
  }
}
