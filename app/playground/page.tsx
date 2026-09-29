"use client";

import { useEffect, useState } from "react";
import ModeCard from "@/components/ModeCard";
import { fetchAndSyncProgress } from "@/lib/progressStore";

export default function Playground() {
  const [colourQuestProgress, setColourQuestProgress] = useState<{
    progressPercentage: number;
    completedLevels: number;
    totalLevels: number;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;
    fetchAndSyncProgress("color-quest")
      .then((data) => {
        if (isMounted) {
          setColourQuestProgress({
            progressPercentage: data.progressPercentage,
            completedLevels: data.completedLevels,
            totalLevels: data.totalLevels,
          });
        }
      })
      .catch((err) => {
        console.warn("[PLAYGROUND] Failed to fetch game progress:", err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="mx-auto min-h-screen max-w-md px-4 pb-10 pt-24">
      <section>
        <p className="text-sm font-medium text-accent">
          Welcome back, Player
        </p>

        <h2 className="mt-2 text-3xl font-black tracking-tight">
          Ready to play?
        </h2>

        <p className="mt-2 text-sm leading-6 text-white/50">
          Choose a mode and start your next robot adventure.
        </p>
      </section>
      <section className="mt-8">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/35">
            Game modes
          </p>

          <h3 className="mt-1 text-xl font-bold">
            Choose your mission
          </h3>
        </div>

        <div className="space-y-3">
          <ModeCard
            title="Colour Quest"
            description="Identify colours and complete challenges with your robot."
            icon="game"
            accent="primary"
            href="/playground/colour-quest"
            progress={colourQuestProgress?.progressPercentage}
            completedLevels={colourQuestProgress?.completedLevels}
            totalLevels={colourQuestProgress?.totalLevels ?? 6}
          />

          <ModeCard
            title="Echo Memory"
            description="Single-colour direction sequence, echo on joystick."
            icon="memory"
            accent="accent"
            href="/playground/echo-memory"
            isComingSoon={true}
          />

          <ModeCard
            title="Driving Pro"
            description="Basic driving tasks (straight, no collision, precision turns)."
            icon="drive"
            accent="warning"
            href="/playground/driving-pro"
            isComingSoon={true}
          />

          <ModeCard
            title="Reflex Dash"
            description="Single-colour alert / safe point reflex testing."
            icon="reflex"
            accent="warning"
            href="/playground/reflex-dash"
            isComingSoon={true}
          />
        </div>
      </section>
    </div>
  );
}