import Link from "next/link";
import {
  ChevronRight,
  Gamepad2,
  Gauge,
  Trophy,
  Palette,
  BrainCircuit,
  TrafficCone
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
}: ModeCardProps) {
  const Icon = iconMap[icon];
  const colors = accentMap[accent];

  const hasProgress = typeof progress === "number";

  return (
    <Link
      href={href}
      className={`group flex w-full items-center gap-4 rounded-2xl border border-border bg-surface p-4 text-left transition-all duration-200 active:scale-[0.98] hover:bg-surface-light ${colors.glow}`}
    >
      <div
        className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${colors.icon}`}
      >
        <Icon size={27} strokeWidth={2.2} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold">{title}</h3>
          {isComingSoon && (
            <span className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/60">
              Coming Soon
            </span>
          )}
        </div>

        <p className="mt-1 text-sm leading-5 text-white/45">
          {description}
        </p>

        {hasProgress && (
          <div className="mt-2.5">
            <div className="flex items-center justify-between text-xs text-white/60 mb-1">
              <span>Progress</span>
              <span className="font-semibold text-white/80">
                {progress}% ({completedLevels ?? 0}/{totalLevels ?? 6})
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full transition-all duration-500 ${colors.bar}`}
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <ChevronRight
        size={20}
        className="shrink-0 text-white/25 transition-transform group-hover:translate-x-1"
      />
    </Link>
  );
}