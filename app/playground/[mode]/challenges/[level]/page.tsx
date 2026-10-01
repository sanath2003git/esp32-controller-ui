"use client";

import { useParams } from "next/navigation";
import SubPageHeader from "@/components/SubPageHeader";
import { getGameDefinition } from "@/data/gameCatalog";
import { getChallengeRuntime } from "@/games/registry";
import { ArrowLeft, Sparkles } from "lucide-react";
import Link from "next/link";

export default function ChallengeLevelRoute() {
  const params = useParams<{ mode: string; level: string }>();
  const game = getGameDefinition(params.mode);
  const runtime = getChallengeRuntime(params.mode);
  if (runtime) {
    const Challenge = runtime.Component;
    return <Challenge />;
  }
  const title = game?.title ?? "Unknown game";
  return <main className="min-h-screen">
    <SubPageHeader title={game ? `${title} · Challenge` : title} subtitle="Coming Soon" backHref={game ? `/playground/${game.slug}/challenges` : "/playground"} />
    <div className="mx-auto min-h-screen max-w-md px-4 pb-10 pt-24">
      <div className="flex flex-col items-center rounded-3xl border border-border bg-surface p-6 text-center shadow-xl">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-accent/30 bg-accent/15 text-accent"><Sparkles size={32} /></div>
        <span className="mt-4 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-accent">Under Development</span>
        <h3 className="mt-3 text-xl font-extrabold text-white">{title} challenge is coming soon</h3>
        <p className="mt-2 text-sm leading-6 text-white/50">This game does not have a challenge runtime yet.</p>
        <Link href={game ? `/playground/${game.slug}/challenges` : "/playground"} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-white/10 px-4 py-3.5 text-sm font-bold text-white"><ArrowLeft size={16} /> Back</Link>
      </div>
    </div>
  </main>;
}
