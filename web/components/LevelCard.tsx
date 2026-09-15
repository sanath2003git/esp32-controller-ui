import Link from "next/link";
import { ChevronRight, Lock, Star } from "lucide-react";
import type { LevelMeta } from "@/lib/colourQuest";
import type { LevelProgress } from "@/types/colourQuest";

const difficultyStyles: Record<LevelMeta["difficulty"], string> = {
  Easy: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  Medium: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  Hard: "border-rose-500/30 bg-rose-500/10 text-rose-400",
};

type LevelCardProps = {
  level: LevelMeta;
  mode: string;
  progress?: LevelProgress;
};

export default function LevelCard({ level, mode, progress }: LevelCardProps) {
  const isUnlocked = progress?.unlocked ?? (level.id === 1);
  const stars = progress?.stars ?? 0;
  const bestScore = progress?.bestScore ?? 0;
  const bestPercentage = Math.round(bestScore * 100);

  const cardContent = (
    <div
      className={`group flex flex-col justify-between rounded-2xl border p-4 transition-all duration-200 ${
        isUnlocked
          ? "border-border bg-surface hover:border-primary/40 hover:bg-surface-light cursor-pointer active:scale-[0.98]"
          : "border-white/10 bg-surface/50 opacity-60 cursor-not-allowed"
      }`}
    >
      <div>
        <div className="flex items-center justify-between">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl text-base font-black ${
              isUnlocked
                ? "bg-primary/15 text-primary"
                : "bg-white/10 text-white/40"
            }`}
          >
            {level.id}
          </div>

          {isUnlocked ? (
            <ChevronRight
              size={18}
              className="text-white/25 transition-transform group-hover:translate-x-1"
            />
          ) : (
            <Lock size={18} className="text-white/40" />
          )}
        </div>

        <div className="mt-3">
          <h3 className="text-sm font-bold text-white">{level.title}</h3>
          <p className="mt-1 text-xs leading-4 text-white/50">{level.description}</p>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-white/5 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              difficultyStyles[level.difficulty]
            }`}
          >
            {level.difficulty}
          </span>

          {isUnlocked && (
            <div className="flex items-center gap-0.5">
              {[1, 2, 3].map((starNum) => (
                <Star
                  key={starNum}
                  size={14}
                  className={
                    starNum <= stars
                      ? "fill-amber-400 text-amber-400"
                      : "text-white/20"
                  }
                />
              ))}
            </div>
          )}
        </div>

        {isUnlocked ? (
          <div className="text-[11px] font-medium text-white/60">
            {bestScore > 0 ? `Best: ${bestPercentage}%` : "Not attempted"}
          </div>
        ) : (
          <div className="text-[11px] leading-3 text-amber-400/90 font-medium">
            Requires 3★ on Level {level.id - 1}
          </div>
        )}
      </div>
    </div>
  );

  if (!isUnlocked) {
    return cardContent;
  }

  return (
    <Link href={`/playground/${mode}/challenges/${level.id}`}>
      {cardContent}
    </Link>
  );
}
