"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import LevelCard from "@/components/LevelCard";
import SubPageHeader from "@/components/SubPageHeader";
import { getModeMeta } from "@/data/modes";
import { levels as defaultLevels } from "@/data/levels";
import { COLOUR_QUEST_LEVELS } from "@/lib/colourQuest";
import type { LevelProgress, UserGameProgressResponse } from "@/types/colourQuest";

export default function ChallengesPage() {
  const params = useParams<{ mode: string }>();
  const modeMeta = getModeMeta(params.mode);
  const title = modeMeta?.title ?? "Challenge";

  const isColourQuest = params.mode === "colour-quest";
  const displayLevels = isColourQuest ? COLOUR_QUEST_LEVELS : defaultLevels;

  const [userProgress, setUserProgress] = useState<Record<number, LevelProgress>>({});

  useEffect(() => {
    if (!isColourQuest) return;

    fetch("/api/progress?game=color-quest")
      .then((res) => res.json())
      .then((data: UserGameProgressResponse) => {
        if (data.success && data.levels) {
          setUserProgress(data.levels);
        }
      })
      .catch((err) => {
        console.warn("[CHALLENGES] Progress fetch failed:", err);
      });
  }, [isColourQuest]);

  return (
    <main className="min-h-screen">
      <SubPageHeader
        title={`${title} \u00b7 Challenge`}
        subtitle="Pick a level"
        backHref={`/playground/${params.mode}`}
      />

      <div className="mx-auto min-h-screen max-w-md px-4 pb-10 pt-24">
        <section>
          <p className="text-sm font-medium text-accent">Challenge</p>

          <h2 className="mt-2 text-3xl font-black tracking-tight">
            Choose a level
          </h2>

          <p className="mt-2 text-sm leading-6 text-white/50">
            {isColourQuest
              ? "Complete level challenges with your robot. Earn 3 stars to unlock the next level!"
              : "Each level raises the difficulty. Beat it without a collision."}
          </p>
        </section>

        <section className="mt-8 grid grid-cols-2 gap-3">
          {displayLevels.map((level) => (
            <LevelCard
              key={level.id}
              level={level}
              mode={params.mode as string}
              progress={userProgress[level.id]}
            />
          ))}
        </section>
      </div>
    </main>
  );
}
