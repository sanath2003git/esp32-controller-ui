"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import LevelCard from "@/components/LevelCard";
import SubPageHeader from "@/components/SubPageHeader";
import { getGameDefinition } from "@/data/gameCatalog";
import { fetchAndSyncProgress } from "@/lib/progressStore";
import type { LevelProgress } from "@/types/colourQuest";

export default function ChallengesPage() {
  const params = useParams<{ mode: string }>();
  const game = getGameDefinition(params.mode);
  const [userProgress, setUserProgress] = useState<Record<number, LevelProgress>>({});

  useEffect(() => {
    if (!game?.progressSupported) return;
    let mounted = true;
    fetchAndSyncProgress(game.slug).then((data) => {
      if (mounted && data.levels) setUserProgress(data.levels);
    }).catch((error) => console.warn("[CHALLENGES] Progress sync error:", error));
    return () => { mounted = false; };
  }, [game]);

  if (!game) return <main className="min-h-screen"><SubPageHeader title="Unknown game" backHref="/playground" /></main>;
  const hasLevels = game.levels.length > 0;

  return (
    <main className="min-h-screen">
      <SubPageHeader title={`${game.title} · Challenge`} subtitle={hasLevels ? "Pick a level" : "Coming Soon"} backHref={`/playground/${game.slug}`} />
      <div className="mx-auto min-h-screen max-w-md px-4 pb-10 pt-24">
        {!hasLevels ? (
          <div className="flex flex-col items-center rounded-3xl border border-border bg-surface p-6 text-center shadow-xl">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-accent/30 bg-accent/15 text-accent"><Sparkles size={32} /></div>
            <span className="mt-4 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-accent">Under Development</span>
            <h3 className="mt-3 text-xl font-extrabold text-white">{game.title} Challenges are Coming Soon!</h3>
            <p className="mt-2 text-sm leading-6 text-white/50">Challenge mode for {game.title} is currently under development.</p>
            <Link href={`/playground/${game.slug}`} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-white/10 px-4 py-3.5 text-sm font-bold text-white"><ArrowLeft size={16} /> Back to game hub</Link>
          </div>
        ) : (
          <>
            <section><p className="text-sm font-medium text-accent">Challenge</p><h2 className="mt-2 text-3xl font-black">Choose a level</h2><p className="mt-2 text-sm leading-6 text-white/50">Complete level challenges with your robot. Earn 3 stars to unlock the next level!</p></section>
            <section className="mt-8 grid grid-cols-2 gap-3">
              {game.levels.map((level) => <LevelCard key={level.id} level={level} mode={game.slug} progress={userProgress[level.id]} />)}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
