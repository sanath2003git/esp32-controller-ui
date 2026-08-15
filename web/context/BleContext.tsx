"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { BleClient } from "@/lib/ble/client";

import type {
  BleMessage,
  RobotDeviceInfo,
} from "@/types/ble";

type BleStatus =
  | "disconnected"
  | "connecting"
  | "connected";

type BleContextValue = {
  status: BleStatus;
  deviceName: string | null;
  deviceInfo: RobotDeviceInfo | null;
  lastMessage: BleMessage | null;
  connect: () => Promise<void>;
  send: (message: unknown) => Promise<void>;
  disconnect: () => void;
};

const BleContext = createContext<BleContextValue | null>(null);

export function BleProvider({
  children,
}: {
  children: ReactNode;
}) {
  const clientRef = useRef<BleClient | null>(null);

  const [status, setStatus] =
    useState<BleStatus>("disconnected");

  const [deviceName, setDeviceName] =
    useState<string | null>(null);

  const [lastMessage, setLastMessage] =
  useState<BleMessage | null>(null);

   const [deviceInfo, setDeviceInfo] =
  useState<RobotDeviceInfo | null>(null);

  const connect = useCallback(async () => {
    setStatus("connecting");

    try {
      const client = new BleClient();

      clientRef.current = client;

      const device = await client.connect((message: unknown) => {
        console.log("[BLE MESSAGE]", message);

        // Only treat the incoming payload as a BleMessage when it matches
        // the expected shape. The client.connect handler types use
        // unknown for safety.
        if (typeof message === "object" && message !== null && "type" in message) {
          const msg = message as BleMessage;

          setLastMessage(msg);

          if (msg.type === "device_info") {
            setDeviceInfo({
              deviceId: String((msg as any).deviceId),
              name: String((msg as any).name),
              model: String((msg as any).model),
              firmware: String((msg as any).firmware),
            });
          }
        }
      });

      // BluetoothDevice may not have a strongly-typed `name` property in some TS configs,
      // fall back to device.id or a default string.
      const deviceNameFallback = (device as any)?.name ?? (device as any)?.id ?? "Unknown device";
      setDeviceName(deviceNameFallback);
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
    setDeviceInfo(null);
    setLastMessage(null);

  }, []);

  return (
    <BleContext.Provider
      value={{
        status,
        deviceName,
        deviceInfo,
        lastMessage,
        connect,
        send,
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
    throw new Error(
      "useBleContext must be used inside BleProvider"
    );
  }

  return context;
}