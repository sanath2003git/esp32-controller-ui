"use client";

import { RotateCcw, ArrowRight, List, Star, Trophy } from "lucide-react";

type ResultModalProps = {
  isOpen: boolean;
  level: number;
  score: number;
  stars: 0 | 1 | 2 | 3;
  bestScore: number;
  hasNextLevel: boolean;
  isNextUnlocked: boolean;
  onReplay: () => void;
  onNextLevel: () => void;
  onBackToLevels: () => void;
};

export default function ResultModal({
  isOpen,
  level,
  score,
  stars,
  bestScore,
  hasNextLevel,
  isNextUnlocked,
  onReplay,
  onNextLevel,
  onBackToLevels,
}: ResultModalProps) {
  if (!isOpen) return null;

  const scorePercentage = Math.round(score * 100);
  const bestPercentage = Math.round(bestScore * 100);
  const isNewBest = score >= bestScore && score > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-surface p-6 text-center shadow-2xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/20 text-primary mb-4">
          <Trophy size={32} />
        </div>

        <h3 className="text-2xl font-black text-white">Level {level} Complete!</h3>
        <p className="mt-1 text-xs text-white/50">Great effort with Colour Quest!</p>

        {/* Stars */}
        <div className="mt-6 flex justify-center items-center gap-2">
          {[1, 2, 3].map((starNum) => (
            <div
              key={starNum}
              className={`p-2 rounded-full transition-all duration-300 ${
                starNum <= stars
                  ? "bg-amber-500/20 text-amber-400 scale-110"
                  : "bg-white/5 text-white/20"
              }`}
            >
              <Star
                size={32}
                className={starNum <= stars ? "fill-amber-400" : ""}
              />
            </div>
          ))}
        </div>

        {/* Score metrics */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-surface-light p-4">
          <div className="text-3xl font-black text-primary">{scorePercentage}%</div>
          <div className="text-xs font-medium text-white/50 mt-0.5">Score</div>

          <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
            <span className="text-white/60">Best Result</span>
            <span className="font-bold text-white">
              {bestPercentage}% {isNewBest && <span className="text-emerald-400 text-[10px] ml-1">(New Best!)</span>}
            </span>
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="mt-6 flex flex-col gap-2.5">
          {hasNextLevel && isNextUnlocked && (
            <button
              type="button"
              onClick={onNextLevel}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-black transition-all hover:bg-primary/90 active:scale-[0.98]"
            >
              Next Level <ArrowRight size={16} />
            </button>
          )}

          <button
            type="button"
            onClick={onReplay}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-surface-light px-4 py-3 text-sm font-bold text-white transition-all hover:bg-white/10 active:scale-[0.98]"
          >
            <RotateCcw size={16} /> Replay Level
          </button>

          <button
            type="button"
            onClick={onBackToLevels}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold text-white/50 hover:text-white transition-colors"
          >
            <List size={14} /> Back to Levels
          </button>
        </div>
      </div>
    </div>
  );
}
