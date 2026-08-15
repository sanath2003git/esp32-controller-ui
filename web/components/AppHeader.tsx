"use client";

import { Battery, Bluetooth, UserRound } from "lucide-react";

export default function AppHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border bg-[#080b14]/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-md items-center justify-between px-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <span className="text-xl">🤖</span>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-sm font-bold tracking-wide">
                MAINBOT
              </h1>

              <span className="flex items-center gap-1 text-xs text-success">
                <Bluetooth size={12} />
                Connected
              </span>
            </div>

            <p className="truncate text-xs text-white/45">
              7C:4F:AD:21:43:40
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-white/65">
            <Battery size={16} className="text-success" />
            <span>87%</span>
          </div>

          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-white/70">
            <UserRound size={17} />
          </div>
        </div>
      </div>
    </header>
  );
}