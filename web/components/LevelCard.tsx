import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { LevelMeta } from "@/data/levels";

const difficultyStyles: Record<LevelMeta["difficulty"], string> = {
  Easy: "border-success/30 bg-success/10 text-success",
  Medium: "border-warning/30 bg-warning/10 text-warning",
  Hard: "border-danger/30 bg-danger/10 text-danger",
};

type LevelCardProps = {
  level: LevelMeta;
  mode: string;
};

export default function LevelCard({ level, mode }: LevelCardProps) {
  return (
    <Link
      href={`/playground/${mode}/challenges/${level.id}`}
      className="group flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4 transition-all duration-200 active:scale-[0.98] hover:border-primary/40 hover:bg-surface-light"
    >
      <div className="flex items-center justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-base font-black text-primary">
          {level.id}
        </div>

        <ChevronRight
          size={18}
          className="text-white/25 transition-transform group-hover:translate-x-1"
        />
      </div>

      <div>
        <h3 className="text-sm font-bold">{level.title}</h3>

        <p className="mt-1 text-xs leading-5 text-white/45">
          {level.description}
        </p>

        <span
          className={`mt-3 inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            difficultyStyles[level.difficulty]
          }`}
        >
          {level.difficulty}
        </span>
      </div>
    </Link>
  );
}
