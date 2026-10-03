// Minimal Web Bluetooth type shims for environments where DOM lib lacks them
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
    id?: string;
    name?: string;
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

import {
  BLE_DEVICE_NAME,
  BLE_RX_CHARACTERISTIC_UUID,
  BLE_SERVICE_UUID,
  BLE_TX_CHARACTERISTIC_UUID,
} from "./constants";

export type MessageCallback = (message: string) => void;
export type ConnectionCallback = (connected: boolean) => void;

type QueuedWrite = {
  data: Uint8Array;
  resolve: () => void;
  reject: (error: Error) => void;
};

const MIN_WRITE_INTERVAL_MS = 30;
const MAX_QUEUE_SIZE = 16;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Clean Web Bluetooth Transport Layer for Protocol v1.
 * Responsible ONLY for Web Bluetooth GATT connection, UTF-8 data encoding/decoding,
 * write queueing, and newline message framing.
 */
export class BleTransport {
  private device: BluetoothDevice | null = null;
  private rxCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private txCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;

  private rxBuffer: string = "";
  private isWriting: boolean = false;
  private lastWriteAt: number = 0;
  private writeQueue: QueuedWrite[] = [];

  private messageSubscribers: Set<MessageCallback> = new Set();
  private connectionSubscribers: Set<ConnectionCallback> = new Set();

  /**
   * Returns true if connected to the BLE GATT server.
   */
  isConnected(): boolean {
    return Boolean(this.device?.gatt?.connected);
  }

  /**
   * Connect to the Web Bluetooth device matching Nordic UART Service (NUS).
   */
  async connect(deviceName?: string): Promise<void> {
    console.info("[BLE Transport] Starting Web Bluetooth connection", {
      requestedName: deviceName ?? BLE_DEVICE_NAME,
      serviceUuid: BLE_SERVICE_UUID,
      rxCharacteristicUuid: BLE_RX_CHARACTERISTIC_UUID,
      txCharacteristicUuid: BLE_TX_CHARACTERISTIC_UUID,
    });
    if (!navigator.bluetooth) {
      throw new Error("Web Bluetooth is not supported by this browser.");
    }

    if (this.isConnected()) {
      return;
    }

    this.rxBuffer = "";

    const targetName = deviceName ?? BLE_DEVICE_NAME;

    this.device = await navigator.bluetooth.requestDevice({
      filters: [{ name: targetName }],
      optionalServices: [BLE_SERVICE_UUID],
    });

    console.info("[BLE Transport] Device selected", { name: this.device.name });

    if (!this.device.gatt) {
      throw new Error("Bluetooth GATT server is unavailable.");
    }

    const server = await this.device.gatt.connect();
    console.info("[BLE Transport] GATT server connected", { connected: server.connected });

    const service = await server.getPrimaryService(BLE_SERVICE_UUID);

    this.rxCharacteristic = await service.getCharacteristic(
      BLE_RX_CHARACTERISTIC_UUID,
    );

    this.txCharacteristic = await service.getCharacteristic(
      BLE_TX_CHARACTERISTIC_UUID,
    );

    await this.txCharacteristic.startNotifications();
    console.info("[BLE Transport] TX notifications started");

    this.txCharacteristic.addEventListener(
      "characteristicvaluechanged",
      this.handleNotification,
    );

    this.device.addEventListener(
      "gattserverdisconnected",
      this.handleDisconnect,
    );

    this.notifyConnectionState(true);
    console.info("[BLE Transport] Connection setup complete");
  }

  /**
   * Disconnect from the Web Bluetooth GATT server and cleanup resources.
   */
  disconnect(): void {
    const device = this.device;
    console.info("[BLE Transport] Local disconnect requested", {
      deviceName: device?.name,
      wasConnected: Boolean(device?.gatt?.connected),
      queuedWrites: this.writeQueue.length,
    });
    this.cleanup();

    if (device?.gatt?.connected) {
      device.gatt.disconnect();
    }
  }

  /**
   * Write UTF-8 string or Uint8Array payload to the RX characteristic.
   * Appends newline delimiter if required for line framing when string is passed.
   */
  async write(data: string | Uint8Array): Promise<void> {
    if (!this.rxCharacteristic || !this.isConnected()) {
      throw new Error("BLE transport is not connected.");
    }

    let bytes: Uint8Array;
    if (typeof data === "string") {
      const payload = data.endsWith("\n") ? data : data + "\n";
      bytes = new TextEncoder().encode(payload);
    } else {
      bytes = data;
    }

    return new Promise((resolve, reject) => {
      console.debug("[BLE Transport] Write queued", {
        bytes: bytes.byteLength,
        queueLength: this.writeQueue.length + 1,
      });
      this.writeQueue.push({ data: bytes, resolve, reject });

      while (this.writeQueue.length > MAX_QUEUE_SIZE) {
        const dropped = this.writeQueue.shift();
        dropped?.reject(new Error("BLE transport write queue overflow."));
      }

      void this.flushWriteQueue();
    });
  }

  /**
   * Subscribe to raw incoming text messages emitted when newline framing is reached.
   * Returns an unsubscribe function.
   */
  subscribeToMessages(callback: MessageCallback): () => void {
    this.messageSubscribers.add(callback);
    return () => {
      this.messageSubscribers.delete(callback);
    };
  }

  /**
   * Subscribe to connection state changes (true = connected, false = disconnected).
   * Returns an unsubscribe function.
   */
  subscribeToConnectionChange(callback: ConnectionCallback): () => void {
    this.connectionSubscribers.add(callback);
    return () => {
      this.connectionSubscribers.delete(callback);
    };
  }

  /**
   * Convenience helper to listen for connection event.
   */
  onConnect(callback: () => void): () => void {
    return this.subscribeToConnectionChange((connected) => {
      if (connected) callback();
    });
  }

  /**
   * Convenience helper to listen for disconnection event.
   */
  onDisconnect(callback: () => void): () => void {
    return this.subscribeToConnectionChange((connected) => {
      if (!connected) callback();
    });
  }

  private async flushWriteQueue(): Promise<void> {
    if (this.isWriting) return;
    this.isWriting = true;

    try {
      while (this.writeQueue.length > 0) {
        const item = this.writeQueue.shift();
        const characteristic = this.rxCharacteristic;

        if (!item) continue;

        if (!characteristic || !this.isConnected()) {
          item.reject(new Error("BLE transport is not connected."));
          continue;
        }

        const sinceLastWrite = performance.now() - this.lastWriteAt;
        if (sinceLastWrite < MIN_WRITE_INTERVAL_MS) {
          await delay(MIN_WRITE_INTERVAL_MS - sinceLastWrite);
        }

        try {
          console.debug("[BLE Transport] Writing characteristic", { bytes: item.data.byteLength });
          await characteristic.writeValue(item.data.buffer as ArrayBuffer);
          this.lastWriteAt = performance.now();
          console.debug("[BLE Transport] Characteristic write completed", { bytes: item.data.byteLength });
          item.resolve();
        } catch (error) {
          console.error("[BLE Transport] Characteristic write failed", error);
          item.reject(
            error instanceof Error ? error : new Error("BLE write failed."),
          );
        }
      }
    } finally {
      this.isWriting = false;
    }
  }

  private handleNotification = (event: Event): void => {
    const characteristic =
      event.target as unknown as BluetoothRemoteGATTCharacteristic | null;

    if (!characteristic?.value) return;

    const chunk = new TextDecoder().decode(characteristic.value);
    this.rxBuffer += chunk;

    if (this.rxBuffer.includes("\n") || this.rxBuffer.includes("\r")) {
      const lines = this.rxBuffer.split(/[\r\n]+/);
      // Keep trailing incomplete fragment in rxBuffer
      this.rxBuffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (!trimmed.includes('"telemetry"')) {
          console.info("[BLE Transport] Complete line received", trimmed);
        }

        // Emit raw string to subscribers (no JSON parsing in transport)
        for (const subscriber of this.messageSubscribers) {
          try {
            subscriber(trimmed);
          } catch (err) {
            console.error("[BLE Transport] Error in message subscriber:", err);
          }
        }
      }
    }
  };

  private handleDisconnect = (): void => {
    console.warn("[BLE Transport] GATT server disconnected", {
      deviceName: this.device?.name,
      queuedWrites: this.writeQueue.length,
    });
    this.cleanup();
    this.notifyConnectionState(false);
  };

  private notifyConnectionState(connected: boolean): void {
    console.info("[BLE Transport] Connection state changed", {
      connected,
      subscribers: this.connectionSubscribers.size,
    });
    for (const subscriber of this.connectionSubscribers) {
      try {
        subscriber(connected);
      } catch (err) {
        console.error("[BLE Transport] Error in connection subscriber:", err);
      }
    }
  }

  private cleanup(): void {
    console.debug("[BLE Transport] Cleaning up transport", {
      deviceName: this.device?.name,
      queuedWrites: this.writeQueue.length,
    });
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
    this.rxBuffer = "";

    const disconnectError = new Error("BLE transport disconnected.");
    for (const write of this.writeQueue) {
      write.reject(disconnectError);
    }
    this.writeQueue = [];
  }
}
