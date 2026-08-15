"use client";

import { useCallback, useRef, useState } from "react";
import { BleClient } from "@/lib/ble/client";

export type BleConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected";

export function useBle() {
  const clientRef = useRef<BleClient | null>(null);

  const [status, setStatus] =
    useState<BleConnectionStatus>("disconnected");

  const [deviceName, setDeviceName] =
    useState<string | null>(null);

  const [lastMessage, setLastMessage] =
    useState<unknown>(null);

  const connect = useCallback(async () => {
    setStatus("connecting");

    try {
      const client = new BleClient();

      clientRef.current = client;

      const device = await client.connect((message) => {
        console.log("[BLE MESSAGE]", message);
        setLastMessage(message);
      });

      const bluetoothDevice = device as BluetoothDevice & {
        name?: string | null;
      };

      setDeviceName(bluetoothDevice.name ?? "Unknown device");
      setStatus("connected");
    } catch (error) {
      console.error("[BLE CONNECT ERROR]", error);

      clientRef.current = null;
      setDeviceName(null);
      setStatus("disconnected");

      throw error;
    }
  }, []);

  const send = useCallback(async (message: unknown) => {
    if (!clientRef.current) {
      throw new Error("BLE device is not connected.");
    }

    await clientRef.current.send(message);
  }, []);

  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();

    clientRef.current = null;
    setDeviceName(null);
    setStatus("disconnected");
  }, []);

  return {
    status,
    deviceName,
    lastMessage,
    connect,
    send,
    disconnect,
  };
}