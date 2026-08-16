"use client";

import Link from "next/link";
import { Battery, Bluetooth, Cpu } from "lucide-react";

import { useBleContext } from "@/context/BleContext";
import type { RobotState } from "@/types/robot";

export default function AppHeader() {
  const { status, deviceInfo } = useBleContext();

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

  const isConnected = robot.connectionStatus === "connected";

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-md items-center justify-between px-4">
        <Link href="/profile" className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Cpu size={21} />
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-bold">
              {robot.info?.name ?? "No Robot"}
            </p>

            <p className="truncate text-[11px] text-white/40">
              {robot.info?.id ?? "Not connected"}
            </p>
          </div>
        </Link>

        <div className="flex shrink-0 items-center gap-3">
          {robot.info && (
            <div className="flex items-center gap-1.5 text-xs text-white/60">
              <Battery size={15} />

              <span>{robot.info.battery}%</span>
            </div>
          )}

          <div
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
              isConnected
                ? "border-success/30 bg-success/10 text-success"
                : "border-white/10 bg-white/5 text-white/40"
            }`}
          >
            <Bluetooth size={13} />

            <span>{isConnected ? "Connected" : "Offline"}</span>
          </div>
        </div>
      </div>
    </header>
  );
}