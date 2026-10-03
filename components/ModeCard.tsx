"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  Gamepad2,
  Gauge,
  Trophy,
  Palette,
  BrainCircuit,
  TrafficCone,
} from "lucide-react";

type ModeCardProps = {
  title: string;
  description: string;
  icon: "game" | "memory" | "reflex" | "drive" | "challenge" | "training";
  accent: "primary" | "accent" | "warning";
  href: string;
  progress?: number;
  completedLevels?: number;
  totalLevels?: number;
  isComingSoon?: boolean;
  index?: number;
};

const iconMap = {
  game: Palette,
  memory: BrainCircuit,
  reflex: TrafficCone,
  drive: Gamepad2,
  challenge: Trophy,
  training: Gauge,
};

const accentMap = {
  primary: {
    icon: "bg-primary/15 text-primary",
    glow: "group-hover:border-primary/40",
    bar: "bg-primary",
  },
  accent: {
    icon: "bg-accent/15 text-accent",
    glow: "group-hover:border-accent/40",
    bar: "bg-accent",
  },
  warning: {
    icon: "bg-warning/15 text-warning",
    glow: "group-hover:border-warning/40",
    bar: "bg-warning",
  },
};

export default function ModeCard({
  title,
  description,
  icon,
  accent,
  href,
  progress,
  completedLevels,
  totalLevels,
  isComingSoon = false,
  index = 0,
}: ModeCardProps) {
  const Icon = iconMap[icon];
  const colors = accentMap[accent];

  const hasProgress = typeof progress === "number";
  const targetProgress = hasProgress ? Math.min(100, Math.max(0, progress)) : 0;

  // Animated bar fill state
  const [animatedWidth, setAnimatedWidth] = useState(0);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const timer = setTimeout(() => {
      setAnimatedWidth(targetProgress);
    }, 80 + index * 60);
    return () => clearTimeout(timer);
  }, [targetProgress, index]);

  return (
    <Link
      href={href}
      className={`group flex w-full items-center gap-4 rounded-2xl border border-border bg-surface p-4 text-left transition-all duration-300 active:scale-[0.98] hover:bg-surface-light hover:shadow-xl ${
        colors.glow
      } ${
        isMounted
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-3"
      }`}
      style={{
        transitionProperty: "opacity, transform, border-color, background-color, box-shadow",
        transitionDelay: `${index * 40}ms`,
      }}
    >
      <div
        className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-105 ${colors.icon}`}
      >
        <Icon size={27} strokeWidth={2.2} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-white">{title}</h3>
          {isComingSoon && (
            <span className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/60">
              Coming Soon
            </span>
          )}
        </div>

        <p className="mt-1 text-sm leading-5 text-white/45">
          {description}
        </p>

        {/* Progress Bar Container with constant height (Zero layout shifts) */}
        {hasProgress && (
          <div className="mt-2.5 min-h-[28px]">
            <div className="flex items-center justify-between text-xs text-white/60 mb-1">
              <span className="font-medium text-white/50">Progress</span>
              <span className="font-bold text-white/90">
                {targetProgress}% ({completedLevels ?? 0}/{totalLevels ?? 6})
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10 p-[0.5px]">
              <div
                className={`h-full rounded-full transition-all duration-700 cubic-bezier(0.4, 0, 0.2, 1) ${colors.bar}`}
                style={{ width: `${animatedWidth}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <ChevronRight
        size={20}
        className="shrink-0 text-white/25 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-white/60"
      />
    </Link>
  );
}