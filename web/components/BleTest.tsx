"use client";

import { Bluetooth, LoaderCircle, Unplug } from "lucide-react";
import { useBle } from "@/lib/ble/useBle";

export default function BleTest() {
  const {
    status,
    deviceName,
    lastMessage,
    connect,
    send,
    disconnect,
  } = useBle();

  const isConnecting = status === "connecting";
  const isConnected = status === "connected";

  async function handleConnect() {
    try {
      await connect();
    } catch (error) {
      console.error(error);
    }
  }

  async function sendBlueCommand() {
  try {
    await send({
      command: "color",
      r: 0,
      g: 0,
      b: 255,
    });
  } catch (error) {
    console.error("[BLE TEST]", error);
  }
}

  return (
    <section className="mt-8 rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/35">
            Bluetooth
          </p>

          <h3 className="mt-1 text-lg font-bold">
            Robot connection
          </h3>
        </div>

        <Bluetooth
          className={
            isConnected
              ? "text-success"
              : "text-white/30"
          }
        />
      </div>

      <div className="mt-5 rounded-xl bg-black/20 p-4">
        <p className="text-sm text-white/50">
          Status
        </p>

        <p className="mt-1 font-semibold">
          {isConnecting && "Searching for robot..."}
          {isConnected && `Connected to ${deviceName}`}
          {status === "disconnected" && "Not connected"}
        </p>
      </div>

      {!isConnected ? (
        <button
          type="button"
          onClick={handleConnect}
          disabled={isConnecting}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isConnecting ? (
            <>
              <LoaderCircle
                size={18}
                className="animate-spin"
              />
              Searching...
            </>
          ) : (
            <>
              <Bluetooth size={18} />
              Connect Robot
            </>
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={disconnect}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-bold text-danger"
        >
          <Unplug size={18} />
          Disconnect
        </button>
      )}
      <button
  type="button"
  onClick={sendBlueCommand}
  className="mt-3 flex w-full items-center justify-center rounded-xl bg-accent px-4 py-3 text-sm font-bold text-black"
>
  Test Blue LED
</button>
      {lastMessage !== null && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-white/30">
            Latest BLE message
          </p>

          <pre className="mt-2 overflow-x-auto rounded-xl bg-black/30 p-3 text-xs text-accent">
            {JSON.stringify(lastMessage, null, 2)}
          </pre>
        </div>
      )}
    </section>
  );
}