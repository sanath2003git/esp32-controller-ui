"use client";

// Minimal Web Bluetooth type shims for environments where the DOM lib
// (and its Bluetooth types) are not available to TypeScript.
declare global {
  interface Navigator {
    bluetooth?: {
      requestDevice(options: { filters: Array<{ services: string[] }> }): Promise<BluetoothDevice>;
    };
  }

  interface BluetoothRemoteGATTCharacteristic {
    value: DataView | null;
    startNotifications(): Promise<void>;
    writeValue(data: BufferSource): Promise<void>;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
  }

  interface BluetoothRemoteGATTServer {
    connect(): Promise<BluetoothRemoteGATTServer>;
    getPrimaryService(uuid: string): Promise<{ getCharacteristic(uuid: string): Promise<BluetoothRemoteGATTCharacteristic> }>;
    connected?: boolean;
    disconnect(): void;
  }

  interface BluetoothDevice {
    gatt?: BluetoothRemoteGATTServer | null;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
  }
}

// START
// -------------

import {
  BLE_CHARACTERISTIC_UUID,
  BLE_SERVICE_UUID,
} from "@/lib/ble/constants";
import { parseBleMessage, type BleMessage } from "@/types/ble";

export type BleMessageHandler = (message: BleMessage) => void;
export type BleDisconnectHandler = () => void;

// BLE Client
// -------------
export class BleClient {
  private device: BluetoothDevice | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private messageHandler: BleMessageHandler | null = null;
  private disconnectHandler: BleDisconnectHandler | null = null;

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

    this.device = await navigator.bluetooth.requestDevice({
      filters: [
        {
          services: [BLE_SERVICE_UUID],
        },
      ],
    });

    if (!this.device.gatt) {
      throw new Error("Bluetooth GATT is not available.");
    }

    const server = await this.device.gatt.connect();

    const service = await server.getPrimaryService(
      BLE_SERVICE_UUID
    );

    this.characteristic =
      await service.getCharacteristic(
        BLE_CHARACTERISTIC_UUID
      );

    await this.characteristic.startNotifications();

    this.characteristic.addEventListener(
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

  // SEND
  async send(message: unknown): Promise<void> {
    if (!this.characteristic) {
      throw new Error("BLE device is not connected.");
    }

    const json = JSON.stringify(message);
    const data = new TextEncoder().encode(json);

    await this.characteristic.writeValue(data);
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

    const message = new TextDecoder().decode(
      characteristic.value
    );

    console.log("[BLE RX]", message);

    try {
      const parsed = parseBleMessage(JSON.parse(message));

      if (!parsed) {
        console.error("[BLE] Invalid message received");
        return;
      }

      this.messageHandler?.(parsed);
    } catch (error) {
      console.error(
        "[BLE] Invalid JSON received:",
        error
      );
    }
  };

  private handleDisconnect = (): void => {
    console.log("[BLE] Device disconnected");

    const disconnectHandler = this.disconnectHandler;
    this.cleanup();
    disconnectHandler?.();
  };

  private cleanup(): void {
    if (this.characteristic) {
      this.characteristic.removeEventListener(
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

    this.characteristic = null;
    this.device = null;
    this.messageHandler = null;
    this.disconnectHandler = null;
  }
}
