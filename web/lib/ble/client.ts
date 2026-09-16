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

// BLE Client (Nordic UART Service - NUS)
// -------------
export class BleClient {
  private device: BluetoothDevice | null = null;
  private rxCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private txCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private messageHandler: BleMessageHandler | null = null;
  private disconnectHandler: BleDisconnectHandler | null = null;
  private rxBuffer: string = "";

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
    await this.rxCharacteristic.writeValue(data);
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
  }
}