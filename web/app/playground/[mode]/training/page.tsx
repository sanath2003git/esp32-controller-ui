"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import SubPageHeader from "@/components/SubPageHeader";
import { getModeMeta } from "@/data/modes";
import { ArrowLeft, Eye, HelpCircle, Palette, Sparkles, Trophy } from "lucide-react";

export default function TrainingPage() {
  const params = useParams<{ mode: string }>();
  const modeMeta = getModeMeta(params.mode);
  const title = modeMeta?.title ?? "Training";
  const isColourQuest = params.mode === "colour-quest" || params.mode === "color-quest";

  if (!isColourQuest) {
    return (
      <main className="min-h-screen">
        <SubPageHeader
          title={`${title} \u00b7 Training`}
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
              {title} Training is Coming Soon!
            </h3>

            <p className="mt-2 text-sm leading-6 text-white/50">
              Training mode for {title} is currently under development.
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
  else {
    return (
      <main className="min-h-screen">
        <SubPageHeader
          title={`${title} \u00b7 Training`}
          subtitle="Game Rules & Guide"
          backHref={`/playground/${params.mode}`}
        />

        <div className="mx-auto min-h-screen max-w-md px-4 pb-10 pt-24">
          <section>
            <p className="text-sm font-medium text-accent">Training</p>

            <h2 className="mt-2 text-3xl font-black tracking-tight">
              How to play?
            </h2>

            <p className="mt-2 text-sm leading-6 text-white/50">
              Learn the rules and gameplay mechanics of Colour Quest before starting your challenge!
            </p>
          </section>

          <section className="mt-8 space-y-4">
            <div className="rounded-3xl border border-border bg-surface p-5 shadow-[0_24px_80px_rgba(0,0,0,0.22)] sm:p-6">
              <div className="flex items-center gap-2 text-accent">
                <Palette size={18} />
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                  Gameplay Overview
                </p>
              </div>

              <h3 className="mt-2 text-xl font-bold text-white">
                Colour Quest Mechanics
              </h3>

              <p className="mt-2 text-sm leading-6 text-white/60">
                Colour Quest tests your speed and color recognition across 6 levels of 10 tasks each.
              </p>

              <div className="mt-5 space-y-4">
                <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-warning/30 bg-warning/10 text-warning">
                    <Eye size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">1. Memorize Phase (0–5s)</h4>
                    <p className="mt-0.5 text-xs leading-5 text-white/50">
                      The robot illuminates 4 physical LED regions simultaneously (Front, Right, Back, Left).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-accent/30 bg-accent/10 text-accent">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">2. Identify the Target Region</h4>
                    <p className="mt-0.5 text-xs leading-5 text-white/50">
                      Find the primary color, secondary color, or target tint specified by the level objective.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                    <HelpCircle size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">3. Answer Phase (5–10s)</h4>
                    <p className="mt-0.5 text-xs leading-5 text-white/50">
                      LEDs turn off, but your answer remains open. Select the target region (Front, Right, Back, Left) via the screen or joystick.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
                    <Trophy size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">4. Score & Unlock Levels</h4>
                    <p className="mt-0.5 text-xs leading-5 text-white/50">
                      Complete all 10 tasks in a level. Earn 3 stars (90%+ accuracy) to unlock the next challenge level!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }
}