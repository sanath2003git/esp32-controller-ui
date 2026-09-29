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
  type GameSelectedPayload,
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
  type ProtocolErrorPayload,
  type ResultsSyncPayload,
  type TelemetryPayload,
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
    await this.transport.connect(deviceName);

    try {
      const helloAck = await this.sendHello();
      if (!helloAck.accepted) {
        throw new Error(
          `Protocol v1 handshake rejected by robot (version ${helloAck.protocolVersion}).`,
        );
      }

      this.isHandshakeDone = true;
      const info = await this.requestDeviceInfo();
      return info;
    } catch (error) {
      this.disconnect();
      throw error;
    }
  }

  /**
   * Disconnect transport and cleanup pending requests/state.
   */
  disconnect(): void {
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
    await this.sendUncorrelatedMessage("input", payload);
  }

  /**
   * Convenience helper to send normalized joystick input.
   */
  async sendJoystickInput(
    x: number,
    y: number,
    magnitude?: number,
  ): Promise<void> {
    const clampedX = Math.max(-1.0, Math.min(1.0, x));
    const clampedY = Math.max(-1.0, Math.min(1.0, y));
    const calculatedMag =
      magnitude ?? Math.min(1.0, Math.hypot(clampedX, clampedY));

    const payload: JoystickInputPayload = {
      inputType: "joystick",
      x: Math.round(clampedX * 1000) / 1000,
      y: Math.round(clampedY * 1000) / 1000,
      magnitude: Math.round(calculatedMag * 1000) / 1000,
    };

    await this.sendInput(payload);
  }

  /**
   * Convenience helper to send normalized direction input.
   */
  async sendDirectionInput(
    direction: "forward" | "backward" | "left" | "right" | "up" | "down" | "none",
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

  /**
   * Request game selection on the robot.
   */
  async selectGame(game: CanonicalGameId): Promise<GameSelectedPayload> {
    return this.sendRequest<GameSelectedPayload>("game_select", { game });
  }

  /**
   * Request level selection on the robot.
   */
  async selectLevel(game: CanonicalGameId, level: number): Promise<AckPayload> {
    return this.sendRequest<AckPayload>("level_select", { game, level });
  }

  /**
   * Request game start on the robot.
   */
  async startGame(
    game: CanonicalGameId,
    level?: number,
  ): Promise<GameStartedPayload> {
    return this.sendRequest<GameStartedPayload>("game_start", { game, level });
  }

  /**
   * Request active game abort on the robot.
   */
  async abortGame(): Promise<AckPayload> {
    return this.sendRequest<AckPayload>("game_abort", {});
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
  >(type: TType, payload: TPayload): Promise<void> {
    const envelope = this.constructEnvelope(type, payload);
    const json = JSON.stringify(envelope);
    await this.transport.write(json);
  }

  private async sendRequest<TResponsePayload>(
    type: string,
    payload: object,
    timeoutMs = 8000,
  ): Promise<TResponsePayload> {
    const id = this.generateMessageId();
    const envelope = this.constructEnvelope(type, payload, id);
    const json = JSON.stringify(envelope);

    return new Promise<TResponsePayload>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(
          new Error(
            `Protocol v1 request timed out after ${timeoutMs}ms (type: ${type}, id: ${id})`,
          ),
        );
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
        if (!connected) {
          this.isHandshakeDone = false;
          this.rejectAllPendingRequests("Transport connection lost.");
        }
      });
  }

  private handleRawMessage(raw: string): void {
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
          pending.resolve(message.payload);
        }
      }
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
            sub(message.payload as TelemetryPayload);
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

      case "game_result":
        for (const sub of this.gameResultSubscribers) {
          try {
            sub(message.payload as GameResultPayload);
          } catch (err) {
            console.error("[ProtocolClient] Error in gameResult subscriber:", err);
          }
        }
        break;

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

  private isValidEnvelope(val: unknown): val is ProtocolEnvelope<string, object> {
    if (typeof val !== "object" || val === null) return false;
    const obj = val as Record<string, unknown>;
    return (
      obj.v === PROTOCOL_VERSION &&
      typeof obj.type === "string" &&
      typeof obj.payload === "object" &&
      obj.payload !== null
    );
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
    for (const [id, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timeoutId);
      pending.reject(new Error(`Request cancelled (${id}): ${reason}`));
    }
    this.pendingRequests.clear();
  }
}
