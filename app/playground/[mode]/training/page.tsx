"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Eye, HelpCircle, Palette, Sparkles, Trophy } from "lucide-react";
import SubPageHeader from "@/components/SubPageHeader";
import { getGameDefinition, type TrainingIcon } from "@/data/gameCatalog";

const trainingIcons = { palette: Palette, eye: Eye, sparkles: Sparkles, help: HelpCircle, trophy: Trophy } satisfies Record<TrainingIcon, typeof Palette>;

export default function TrainingPage() {
  const params = useParams<{ mode: string }>();
  const game = getGameDefinition(params.mode);
  if (!game) return <main className="min-h-screen"><SubPageHeader title="Unknown game" backHref="/playground" /></main>;
  const hasTraining = game.trainingSteps.length > 0;

  return (
    <main className="min-h-screen">
      <SubPageHeader title={`${game.title} · Training`} subtitle={hasTraining ? "Game Rules & Guide" : "Coming Soon"} backHref={`/playground/${game.slug}`} />
      <div className="mx-auto min-h-screen max-w-md px-4 pb-10 pt-24">
        {!hasTraining ? (
          <div className="flex flex-col items-center rounded-3xl border border-border bg-surface p-6 text-center shadow-xl">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-accent/30 bg-accent/15 text-accent"><Sparkles size={32} /></div>
            <span className="mt-4 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-accent">Under Development</span>
            <h3 className="mt-3 text-xl font-extrabold text-white">{game.title} Training is Coming Soon!</h3>
            <p className="mt-2 text-sm leading-6 text-white/50">Training mode for {game.title} is currently under development.</p>
            <Link href={`/playground/${game.slug}`} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-white/10 px-4 py-3.5 text-sm font-bold text-white"><ArrowLeft size={16} /> Back to game hub</Link>
          </div>
        ) : (
          <>
            <section><p className="text-sm font-medium text-accent">Training</p><h2 className="mt-2 text-3xl font-black tracking-tight">How to play?</h2><p className="mt-2 text-sm leading-6 text-white/50">Learn the rules and gameplay mechanics of {game.title} before starting a challenge.</p></section>
            <section className="mt-8 rounded-3xl border border-border bg-surface p-5 shadow-[0_24px_80px_rgba(0,0,0,0.22)] sm:p-6">
              <div className="mb-5 flex items-center gap-2 text-accent"><Palette size={18} /><p className="text-xs font-semibold uppercase tracking-[0.2em]">Training steps</p></div>
              <div className="space-y-4">
                {game.trainingSteps.map((step, index) => {
                  const Icon = trainingIcons[step.icon];
                  return <article key={`${step.title}-${index}`} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-3.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-accent/30 bg-accent/10 text-accent"><Icon size={18} /></div>
                    <div><h3 className="text-sm font-bold text-white">{index === 0 ? step.title : `${index}. ${step.title}`}</h3><p className="mt-0.5 text-xs leading-5 text-white/50">{step.description}</p></div>
                  </article>;
                })}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
