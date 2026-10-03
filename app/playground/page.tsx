"use client";

import { useEffect, useState } from "react";
import ModeCard from "@/components/ModeCard";
import { gameCatalog } from "@/data/gameCatalog";
import { fetchAndSyncProgress, readAllLocalProgressSummaries } from "@/lib/progressStore";

type ProgressSummary = {
  progressPercentage: number;
  completedLevels: number;
  totalLevels: number;
};

export default function Playground() {
  // Initialize with empty record to ensure SSR HTML matches initial client hydration
  const [progress, setProgress] = useState<Record<string, ProgressSummary>>({});

  useEffect(() => {
    // 1. Immediately hydrate client state from local storage cache on mount
    const localSummaries = readAllLocalProgressSummaries();
    setProgress(localSummaries);

    // 2. Sync with server in background
    let isMounted = true;
    const supportedGames = gameCatalog.filter((game) => game.progressSupported);

    Promise.all(
      supportedGames.map(
        async (game) => [game.id, await fetchAndSyncProgress(game.slug)] as const
      )
    )
      .then((items) => {
        if (isMounted) {
          setProgress((prev) => ({
            ...prev,
            ...Object.fromEntries(
              items.map(([id, result]) => [
                id,
                {
                  progressPercentage: result.progressPercentage,
                  completedLevels: result.completedLevels,
                  totalLevels: result.totalLevels,
                },
              ])
            ),
          }));
        }
      })
      .catch((error) => console.warn("[PLAYGROUND] Failed to sync game progress:", error));

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="mx-auto min-h-screen max-w-md px-4 pb-10 pt-24">
      <section className="animate-fade-in">
        <p className="text-sm font-medium text-accent">Welcome back, Player</p>
        <h2 className="mt-2 text-3xl font-black text-white">Ready to play?</h2>
        <p className="mt-2 text-sm leading-6 text-white/50">
          Choose a mode and start your next robot adventure.
        </p>
      </section>

      <section className="mt-8">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/35">
            Game modes
          </p>
          <h3 className="mt-1 text-xl font-bold text-white">Choose your mission</h3>
        </div>

        <div className="space-y-3">
          {gameCatalog.map((game, index) => {
            const summary = progress[game.id];
            const defaultTotal = game.levels.length > 0 ? game.levels.length : 6;

            return (
              <ModeCard
                key={game.id}
                index={index}
                title={game.title}
                description={game.description}
                icon={game.icon}
                accent={game.accent}
                href={`/playground/${game.slug}`}
                isComingSoon={game.comingSoon}
                progress={game.progressSupported ? summary?.progressPercentage ?? 0 : undefined}
                completedLevels={summary?.completedLevels ?? 0}
                totalLevels={summary?.totalLevels ?? defaultTotal}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}
