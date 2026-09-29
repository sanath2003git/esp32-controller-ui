"use client";

import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { Bluetooth, Cpu } from "lucide-react";


import { useBleContext } from "@/context/BleContext";
import type { RobotState } from "@/types/robot";

/** Horizontal battery bar indicator */
function BatteryBar({
  label,
  pct,
  accent,
}: {
  label: string;
  pct: number;
  accent: "cyan" | "green";
}) {
  const color = accent === "cyan" ? "#00e5ff" : "#35e59a";
  const low = pct < 20;
  const displayColor = low ? "#ff4d67" : color;

  return (
    <div className="flex items-center gap-1">
      <span className="w-5 text-right text-[8px] font-bold uppercase tracking-[0.05em] text-white/40">
        {label}
      </span>
      {/* Battery Body with slight outer glow */}
      <div
        className="relative flex h-2.5 w-10 items-center overflow-hidden rounded-[2px] border border-white/20 bg-black/40"
        style={{ boxShadow: `0 0 6px ${displayColor}33` }}
      >
        <div
          className="h-full rounded-[1px] transition-all duration-500"
          style={{ width: `${pct}%`, background: displayColor, boxShadow: `0 0 6px ${displayColor}b3` }}
        />
      </div>
      {/* Battery Terminal */}
      <div className="-ml-0.5 h-1.5 w-[2px] rounded-r-[1px]" style={{ background: "rgba(255,255,255,0.2)" }} />
      {/* Percentage Text with slight glow */}
      <span
        className="w-5 text-[8px] font-bold"
        style={{ color: displayColor, textShadow: `0 0 4px ${displayColor}88` }}
      >
        {pct}%
      </span>
    </div>
  );
}

export default function AppHeader() {
  const { status, deviceInfo, telemetry, openModal } = useBleContext();

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

  const robotBattery = telemetry?.battery_percentage ?? 0;
  const remoteBattery = 0;

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

        <div className="flex shrink-0 items-center gap-2.5">
          {/* Dual battery indicators */}
          <div className="flex flex-col gap-1">
            <BatteryBar label="RC"  pct={remoteBattery} accent="cyan"  />
            <BatteryBar label="Bot" pct={robotBattery}  accent="green" />
          </div>

          {/* BLE connect button */}
          <button
            type="button"
            onClick={() => { if (!isConnected) openModal(); }}
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
              isConnected
                ? "border-success/30 bg-success/10 text-success cursor-default"
                : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10 cursor-pointer"
            }`}
          >
            <Bluetooth size={13} />
            <span>{isConnected ? "Connected" : status === "connecting" ? "Connecting" : "Offline"}</span>
          </button>

          <div className="ml-1 flex items-center shrink-0">
            <UserButton />
          </div>
        </div>
      </div>
    </header>
  );
}
