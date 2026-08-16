"use client";

import { Bluetooth, LoaderCircle } from "lucide-react";

import { useBleContext } from "@/context/BleContext";

export default function BluetoothConnectionGate() {
  const { status, connect } = useBleContext();
  const isConnected = status === "connected";
  const isConnecting = status === "connecting";

  if (isConnected) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-border bg-surface p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <Bluetooth size={22} />
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              Bluetooth required
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-tight">Connect your robot</h2>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-white/65">
          Connect to the ESP32 robot before using the Home, Playground, or control features.
        </p>

        <button
          type="button"
          onClick={() => {
            void connect().catch((error: unknown) => {
              console.error("[BLE GATE] Connection failed", error);
            });
          }}
          disabled={isConnecting}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isConnecting ? (
            <>
              <LoaderCircle size={18} className="animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <Bluetooth size={18} />
              Connect Bluetooth
            </>
          )}
        </button>
      </div>
    </div>
  );
}
