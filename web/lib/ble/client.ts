"use client";

// Minimal Web Bluetooth type shims for environments where the DOM lib
// (and its Bluetooth types) are not available to TypeScript.
declare global {
  interface Navigator {
    bluetooth?: {
      requestDevice(
        options:
          | {
              filters: Array<{ name?: string; services?: string[] }>;
              optionalServices?: string[];
            }
          | {
              acceptAllDevices: boolean;
              optionalServices?: string[];
            }
      ): Promise<BluetoothDevice>;
    };
  }

  interface BluetoothRemoteGATTCharacteristic {
    value: DataView | null;
    startNotifications(): Promise<void>;
    writeValue(data: BufferSource): Promise<void>;
    addEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject
    ): void;
    removeEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject
    ): void;
  }

  interface BluetoothRemoteGATTServer {
    connect(): Promise<BluetoothRemoteGATTServer>;
    getPrimaryService(uuid: string): Promise<{
      getCharacteristic(
        uuid: string
      ): Promise<BluetoothRemoteGATTCharacteristic>;
    }>;
    connected?: boolean;
    disconnect(): void;
  }

  interface BluetoothDevice {
    gatt?: BluetoothRemoteGATTServer | null;
    addEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject
    ): void;
    removeEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject
    ): void;
  }
}

// START
// -------------

import {
  BLE_DEVICE_NAME,
  BLE_RX_CHARACTERISTIC_UUID,
  BLE_SERVICE_UUID,
  BLE_TX_CHARACTERISTIC_UUID,
} from "@/lib/ble/constants";
import { parseBleMessage, type BleMessage } from "@/types/ble";

export type BleMessageHandler = (message: BleMessage) => void;
export type BleDisconnectHandler = () => void;

const MAX_QUEUE_LENGTH = 8;

// A hard floor on the gap between GATT writes. Coalescing + hysteresis
// upstream cut down *how many* writes get queued, but this guarantees the
// peripheral always gets a minimum breathing room between operations
// regardless of how fast the app produces them - useful if the ESP32's
// main loop is doing blocking work (motor PWM, etc.) between BLE stack
// services and a too-fast write cadence contributes to a supervision
// timeout / dropped connection.
const MIN_WRITE_INTERVAL_MS = 40;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type QueuedWrite = {
  data: BufferSource;
  /**
   * A key means only the newest queued value matters. This is useful for
   * continuous controls such as the colour wheel, where sending every
   * intermediate position only creates latency.
   */
  coalesceKey?: string;
  resolve: () => void;
  reject: (error: Error) => void;
};

// BLE Client (Nordic UART Service - NUS)
// -------------
export class BleClient {
  private device: BluetoothDevice | null = null;
  private rxCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private txCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private messageHandler: BleMessageHandler | null = null;
  private disconnectHandler: BleDisconnectHandler | null = null;
  private rxBuffer: string = "";
  private writeQueue: QueuedWrite[] = [];
  private isWriting = false;
  private lastWriteAt = 0;

  // CONNECT
  async connect(
    onMessage: BleMessageHandler,
    onDisconnect: BleDisconnectHandler,
  ): Promise<BluetoothDevice> {
    if (!navigator.bluetooth) {
      throw new Error(
        "Web Bluetooth is not supported by this browser."
      );
    }

    this.messageHandler = onMessage;
    this.disconnectHandler = onDisconnect;
    this.rxBuffer = "";

    this.device = await navigator.bluetooth.requestDevice({
      filters: [
        {
          name: BLE_DEVICE_NAME,
        },
      ],
      optionalServices: [BLE_SERVICE_UUID],
    });

    if (!this.device.gatt) {
      throw new Error("Bluetooth GATT is not available.");
    }

    const server = await this.device.gatt.connect();

    const service = await server.getPrimaryService(
      BLE_SERVICE_UUID
    );

    this.rxCharacteristic = await service.getCharacteristic(
      BLE_RX_CHARACTERISTIC_UUID
    );

    this.txCharacteristic = await service.getCharacteristic(
      BLE_TX_CHARACTERISTIC_UUID
    );

    await this.txCharacteristic.startNotifications();

    this.txCharacteristic.addEventListener(
      "characteristicvaluechanged",
      this.handleNotification
    );

    // Tell the ESP32 that the browser has finished
    // setting up its notification listener.
    await this.send({
      type: "client_ready",
    });

    this.device.addEventListener(
      "gattserverdisconnected",
      this.handleDisconnect
    );

    return this.device;
  }

  // SEND (Browser -> ESP32 via NUS RX Characteristic with newline framing)
  async send(message: unknown): Promise<void> {
    if (!this.rxCharacteristic) {
      throw new Error("BLE device is not connected.");
    }

    // Append newline framing required by ESP32 firmware parser
    const json = JSON.stringify(message) + "\n";
    const data = new TextEncoder().encode(json);

    return new Promise((resolve, reject) => {
      // Web Bluetooth permits only one GATT operation at a time. Colour-wheel
      // pointer events can arrive much faster than a BLE write completes, so
      // retain just the latest unsent colour instead of building a backlog.
      const coalesceKey = this.getCoalesceKey(message);
      if (coalesceKey) {
        const queuedIndex = this.writeQueue.findIndex(
          (write) => write.coalesceKey === coalesceKey,
        );

        if (queuedIndex !== -1) {
          // The newer value supersedes this one. Resolve its caller because
          // its requested state has been accepted for delivery.
          this.writeQueue[queuedIndex].resolve();
          this.writeQueue.splice(queuedIndex, 1);
        }
      }

      this.writeQueue.push({ data, coalesceKey, resolve, reject });

      // Belt-and-suspenders: even non-coalesced commands (buzzer, OLED
      // text, colour-quest input) shouldn't be allowed to build an
      // unbounded backlog if the link is slow or stalled. Drop the oldest
      // queued write rather than let the queue - and the delay before the
      // robot reacts - grow without limit.
      while (this.writeQueue.length > MAX_QUEUE_LENGTH) {
        const dropped = this.writeQueue.shift();
        dropped?.reject(new Error("BLE write queue overflow; command dropped."));
      }

      void this.flushWriteQueue();
    });
  }

  private getCoalesceKey(message: unknown): string | undefined {
    if (
      typeof message === "object" &&
      message !== null &&
      "command" in message
    ) {
      const command = (message as { command?: unknown }).command;

      if (command === "color") {
        return "color";
      }

      // Joystick drag can flip direction (or hit the dead zone and call
      // stop) far faster than a GATT write completes, especially right at
      // the boundary between two axes where pointer jitter makes the
      // dominant axis flicker. Without coalescing, every intermediate
      // direction still gets written to the device one at a time, and a
      // burst of contradictory move/stop commands is a good way to stall
      // a write or overrun the ESP32's BLE stack and trigger a disconnect.
      // Only the newest motion command matters, so treat move+stop as one
      // coalescing group.
      if (command === "move" || command === "stop") {
        return "motion";
      }
    }

    return undefined;
  }

  private async flushWriteQueue(): Promise<void> {
    if (this.isWriting) return;

    this.isWriting = true;

    try {
      while (this.writeQueue.length > 0) {
        const write = this.writeQueue.shift();
        const characteristic = this.rxCharacteristic;

        if (!write) continue;

        if (!characteristic) {
          write.reject(new Error("BLE device is not connected."));
          continue;
        }

        const sinceLastWrite = performance.now() - this.lastWriteAt;
        if (sinceLastWrite < MIN_WRITE_INTERVAL_MS) {
          await delay(MIN_WRITE_INTERVAL_MS - sinceLastWrite);
        }

        try {
          await characteristic.writeValue(write.data);
          this.lastWriteAt = performance.now();
          write.resolve();
        } catch (error) {
          write.reject(
            error instanceof Error ? error : new Error("BLE write failed."),
          );
        }
      }
    } finally {
      this.isWriting = false;
    }
  }

  // DISCONNECT
  disconnect(): void {
    const device = this.device;

    this.cleanup();

    if (device?.gatt?.connected) {
      device.gatt.disconnect();
    }
  }

  private handleNotification = (
    event: Event
  ): void => {
    const characteristic =
      event.target as unknown as BluetoothRemoteGATTCharacteristic | null;

    if (!characteristic?.value) {
      return;
    }

    const chunk = new TextDecoder().decode(characteristic.value);
    this.rxBuffer += chunk;

    if (this.rxBuffer.includes("\n") || this.rxBuffer.includes("\r")) {
      const lines = this.rxBuffer.split(/[\r\n]+/);
      // Keep any trailing partial chunk in buffer
      this.rxBuffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const parsed = parseBleMessage(JSON.parse(trimmed));

          if (!parsed) {
            console.warn("[BLE] Unhandled message format:", trimmed);
            continue;
          }

          this.messageHandler?.(parsed);
        } catch (error) {
          console.error(
            "[BLE] Invalid JSON received:",
            trimmed,
            error
          );
        }
      }
    }
  };

  private handleDisconnect = (): void => {
    console.log("[BLE] Device disconnected");

    const disconnectHandler = this.disconnectHandler;
    this.cleanup();
    disconnectHandler?.();
  };

  private cleanup(): void {
    if (this.txCharacteristic) {
      this.txCharacteristic.removeEventListener(
        "characteristicvaluechanged",
        this.handleNotification,
      );
    }

    if (this.device) {
      this.device.removeEventListener(
        "gattserverdisconnected",
        this.handleDisconnect,
      );
    }

    this.rxCharacteristic = null;
    this.txCharacteristic = null;
    this.device = null;
    this.messageHandler = null;
    this.disconnectHandler = null;
    this.rxBuffer = "";

    const disconnectedError = new Error("BLE device is not connected.");
    for (const write of this.writeQueue) {
      write.reject(disconnectedError);
    }
    this.writeQueue = [];
  }
}