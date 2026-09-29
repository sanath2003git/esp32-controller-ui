"use client";

import { Bluetooth, ChevronRight } from "lucide-react";

import { useBleContext } from "@/context/BleContext";

export default function BluetoothNotificationBanner() {
  const { status, isModalOpen, openModal } = useBleContext();

  const isConnected = status === "connected";

  if (isConnected || isModalOpen) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 top-16 z-40 px-4 pt-2">
      <div className="mx-auto max-w-md">
        <button
          type="button"
          onClick={openModal}
          className="flex w-full items-center justify-between gap-3 rounded-2xl border border-warning/30 bg-warning/15 px-3.5 py-2.5 text-xs font-semibold text-white/90 backdrop-blur-md shadow-lg transition hover:bg-warning/20 active:scale-[0.99]"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="relative flex h-2.5 w-2.5 shrink-0 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-warning" />
            </span>

            <Bluetooth size={15} className="shrink-0 text-warning" />

            <span className="truncate text-white/90 font-medium">
              {status === "connecting"
                ? "Connecting to Bluetooth... Tap to view"
                : "Bluetooth not connected. Tap to connect"}
            </span>
          </div>

          <ChevronRight size={14} className="shrink-0 text-white/60" />
        </button>
      </div>
    </div>
  );
}
