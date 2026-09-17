"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import LevelCard from "@/components/LevelCard";
import SubPageHeader from "@/components/SubPageHeader";
import { getModeMeta } from "@/data/modes";
import { levels as defaultLevels } from "@/data/levels";
import { COLOUR_QUEST_LEVELS } from "@/lib/colourQuest";
import { fetchAndSyncProgress } from "@/lib/progressStore";
import type { LevelProgress } from "@/types/colourQuest";

export default function ChallengesPage() {
  const params = useParams<{ mode: string }>();
  const modeMeta = getModeMeta(params.mode);
  const title = modeMeta?.title ?? "Challenge";

  const isColourQuest = params.mode === "colour-quest" || params.mode === "color-quest";
  const displayLevels = isColourQuest ? COLOUR_QUEST_LEVELS : defaultLevels;

  const [userProgress, setUserProgress] = useState<Record<number, LevelProgress>>({});

  useEffect(() => {
    if (!isColourQuest) return;

    let isMounted = true;
    fetchAndSyncProgress("color-quest")
      .then((data) => {
        if (isMounted && data.levels) {
          setUserProgress(data.levels);
        }
      })
      .catch((err) => {
        console.warn("[CHALLENGES] Progress sync error:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [isColourQuest]);

  if (!isColourQuest) {
    return (
      <main className="min-h-screen">
        <SubPageHeader
          title={`${title} \u00b7 Challenge`}
          subtitle="Coming Soon"
          backHref={`/playground/${params.mode}`}
        />

        <div className="mx-auto min-h-screen max-w-md px-4 pb-10 pt-24">
          <div className="flex flex-col items-center rounded-3xl border border-border bg-surface p-6 text-center shadow-xl">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-accent/30 bg-accent/15 text-accent">
              <Sparkles size={32} />
            </div>

            <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-accent">
              Under Development
            </span>

            <h3 className="mt-3 text-xl font-extrabold text-white">
              {title} Challenges are Coming Soon!
            </h3>

            <p className="mt-2 text-sm leading-6 text-white/50">
              Challenge mode for {title} is currently under development.
            </p>

            <Link
              href={`/playground/${params.mode}`}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-white/10 px-4 py-3.5 text-sm font-bold text-white transition hover:bg-white/15 active:scale-[0.98]"
            >
              <ArrowLeft size={16} /> Back to game hub
            </Link>
          </div>
        </div>
      </main>
    );
  }

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
            Complete level challenges with your robot. Earn 3 stars to unlock the next level!
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
