"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useBleContext } from "@/context/BleContext";

type SubPageHeaderProps = {
  title: string;
  subtitle?: string;
  backHref: string;
};

export default function SubPageHeader({
  title,
  subtitle,
  backHref,
}: SubPageHeaderProps) {
  const { status } = useBleContext();
  const isConnected = status === "connected";

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-md items-center gap-3 px-4">
        <Link
          href={backHref}
          aria-label="Go back"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-white/70 transition hover:bg-surface-light hover:text-white"
        >
          <ChevronLeft size={18} />
        </Link>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{title}</p>

          {subtitle && (
            <p className="truncate text-[11px] text-white/40">
              {subtitle}
            </p>
          )}
        </div>

        <div
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${
            isConnected
              ? "bg-success shadow-[0_0_10px_rgba(53,229,154,0.7)]"
              : "bg-white/20"
          }`}
        />
      </div>
    </header>
  );
}
