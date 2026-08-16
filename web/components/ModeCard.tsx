import Link from "next/link";
import {
  ChevronRight,
  Gamepad2,
  Gauge,
  Trophy,
} from "lucide-react";

type ModeCardProps = {
  title: string;
  description: string;
  icon: "drive" | "challenge" | "training";
  accent: "primary" | "accent" | "warning";
  href: string;
};

const iconMap = {
  drive: Gamepad2,
  challenge: Trophy,
  training: Gauge,
};

const accentMap = {
  primary: {
    icon: "bg-primary/15 text-primary",
    glow: "group-hover:border-primary/40",
  },
  accent: {
    icon: "bg-accent/15 text-accent",
    glow: "group-hover:border-accent/40",
  },
  warning: {
    icon: "bg-warning/15 text-warning",
    glow: "group-hover:border-warning/40",
  },
};

export default function ModeCard({
  title,
  description,
  icon,
  accent,
  href,
}: ModeCardProps) {
  const Icon = iconMap[icon];
  const colors = accentMap[accent];

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
        <h3 className="text-base font-bold">{title}</h3>

        <p className="mt-1 text-sm leading-5 text-white/45">
          {description}
        </p>
      </div>

      <ChevronRight
        size={20}
        className="shrink-0 text-white/25 transition-transform group-hover:translate-x-1"
      />
    </Link>
  );
}