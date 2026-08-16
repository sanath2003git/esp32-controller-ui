"use client";

import { Bluetooth, LoaderCircle, Unplug } from "lucide-react";

import { useBleContext } from "@/context/BleContext";
import type { RobotState } from "@/types/robot";

export default function Profile() {
  const { status, deviceInfo, connect, disconnect } = useBleContext();

  const robot: RobotState = {
    connectionStatus: status,
    info: {
      id: deviceInfo?.deviceId ?? "Unknown ID",
      name: deviceInfo?.name ?? "Unknown Robot",
      model: deviceInfo?.model ?? "Unknown model",
      firmware: deviceInfo?.firmware ?? "Unknown firmware",
      battery: 0,
    },
  };

  const isConnecting = status === "connecting";
  const isConnected = status === "connected";

  return (
    <div className="mx-auto min-h-screen max-w-md px-4 pb-10 pt-24">
      <section className="mt-8 space-y-6">
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/35">
            Robot status
          </p>

          <div className="mt-4 flex items-center justify-between">
            <div>
              <p className="text-lg font-bold">{robot.info?.name ?? "Unknown Robot"}</p>
              <p className="mt-1 text-xs text-white/40">
                {robot.info?.model ?? "Unknown model"}
              </p>
            </div>

            <div
              className={`h-3 w-3 rounded-full ${
                robot.connectionStatus === "connected"
                  ? "bg-success shadow-[0_0_12px_rgba(53,229,154,0.7)]"
                  : "bg-white/20"
              }`}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/35">
            Bluetooth
          </p>

          <div className="mt-4 rounded-xl bg-black/20 p-4">
            <p className="text-sm text-white/50">Status</p>
            <p className="mt-1 font-semibold">
              {isConnecting && "Searching for robot..."}
              {isConnected && `Connected to ${deviceInfo?.name ?? "robot"}`}
              {!isConnected && !isConnecting && "Not connected"}
            </p>
          </div>

          {!isConnected ? (
            <button
              type="button"
              onClick={() => {
                void connect().catch((error: unknown) => {
                  console.error("[PROFILE] Connect failed", error);
                });
              }}
              disabled={isConnecting}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isConnecting ? (
                <>
                  <LoaderCircle size={18} className="animate-spin" />
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
        </div>
      </section>
    </div>
  );
}