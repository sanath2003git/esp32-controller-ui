"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import SubPageHeader from "@/components/SubPageHeader";
import { getModeMeta } from "@/data/modes";
import {
  ArrowLeft,
  BrainCircuit,
  Compass,
  Eye,
  HelpCircle,
  Layers,
  Palette,
  Sparkles,
  Star,
  Timer,
  Trophy,
} from "lucide-react";

export default function TrainingPage() {
  const params = useParams<{ mode: string }>();
  const modeMeta = getModeMeta(params.mode);
  const title = modeMeta?.title ?? "Training";
  const isColourQuest = params.mode === "colour-quest" || params.mode === "color-quest";
  const isReflexDash = params.mode === "reflex-dash";
  const isEchoMemory = params.mode === "echo-memory";

  if (!isColourQuest && !isReflexDash && !isEchoMemory) {
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
  } else if (isColourQuest) {
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
  else if (isReflexDash) {
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
              Learn the rules and gameplay mechanics of Reflex Dash before starting your challenge!
            </p>
          </section>

          <section className="mt-8 space-y-4">
            <div className="rounded-3xl border border-border bg-surface p-5 shadow-[0_24px_80px_rgba(0,0,0,0.22)] sm:p-6">
              <div className="flex items-center gap-2 text-warning">
                <Sparkles size={18} />
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-warning">
                  Gameplay Overview
                </p>
              </div>

              <h3 className="mt-2 text-xl font-bold text-white">
                Reflex Dash Mechanics
              </h3>

              <p className="mt-2 text-sm leading-6 text-white/60">
                Reflex Dash tests your reaction time and cognitive processing across 3 levels (Easy, Medium, Hard).
              </p>

              <div className="mt-5 space-y-4">
                <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                    <Palette size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">1. Watch the Colors</h4>
                    <p className="mt-0.5 text-xs leading-5 text-white/50">
                      The screen will show different colors.
                      <br/>- Easy: Green (Go), Red (Stop)
                      <br/>- Medium: 2 Go Colors, 2 Stop Colors
                      <br/>- Hard: 3 Go Colors, 3 Stop Colors
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-accent/30 bg-accent/10 text-accent">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">2. GO Action</h4>
                    <p className="mt-0.5 text-xs leading-5 text-white/50">
                      When a GO color appears, immediately press the GO button (or drive the robot). Do it as fast as you can to score points!
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400">
                    <HelpCircle size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">3. STOP Action</h4>
                    <p className="mt-0.5 text-xs leading-5 text-white/50">
                      When a STOP color appears, do NOT press anything! Pressing during a STOP phase results in a penalty.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
                    <Trophy size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">4. Score & Timing</h4>
                    <p className="mt-0.5 text-xs leading-5 text-white/50">
                      Each level lasts a fixed duration (15s, 20s, or 25s). Rack up points by reacting quickly to GO phases.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  } else if (isEchoMemory) {
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
              Learn the rules and gameplay mechanics of Echo Memory before starting your challenge!
            </p>
          </section>

          <section className="mt-8 space-y-4">
            {/* Gameplay Overview */}
            <div className="rounded-3xl border border-border bg-surface p-5 shadow-[0_24px_80px_rgba(0,0,0,0.22)] sm:p-6">
              <div className="flex items-center gap-2 text-accent">
                <BrainCircuit size={18} />
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                  Gameplay Overview
                </p>
              </div>

              <h3 className="mt-2 text-xl font-bold text-white">
                Echo Memory Mechanics
              </h3>

              <p className="mt-2 text-sm leading-6 text-white/60">
                Echo Memory tests your pattern recognition and memory recall. Watch the sequence flashed on your robot&apos;s directional LEDs, hold it in memory, and echo it back using your controller!
              </p>

              <div className="mt-5 space-y-4">
                <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-warning/30 bg-warning/10 text-warning">
                    <Eye size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">1. Watch / Memorize Phase</h4>
                    <p className="mt-0.5 text-xs leading-5 text-white/50">
                      Watch the Robo flash the directional LEDs in a specific sequence (3-second flash for Level 1). Observe each direction carefully.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-accent/30 bg-accent/10 text-accent">
                    <Timer size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">2. Wait Phase (3 Seconds)</h4>
                    <p className="mt-0.5 text-xs leading-5 text-white/50">
                      All LEDs turn off for 3 seconds. Hold the pattern in mind while waiting—inputs are temporarily locked while preparing your answer.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">3. Echo / Input Phase</h4>
                    <p className="mt-0.5 text-xs leading-5 text-white/50">
                      Reproduce the directions using the controller D-pad. Enter each directional step in the exact order you memorized.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Fixed Color-to-Direction Mapping */}
            <div className="rounded-3xl border border-border bg-surface p-5 shadow-[0_24px_80px_rgba(0,0,0,0.22)] sm:p-6">
              <div className="flex items-center gap-2 text-accent">
                <Compass size={18} />
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                  Color Mapping
                </p>
              </div>

              <h3 className="mt-2 text-xl font-bold text-white">
                Fixed Color-Direction Mapping
              </h3>

              <p className="mt-2 text-sm leading-6 text-white/60">
                Each direction corresponds to a fixed color on the robot&apos;s LEDs and controller:
              </p>

              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <div className="flex items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-500/20 text-red-400 font-black text-sm">
                    &uarr;
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Up</h4>
                    <p className="text-[11px] font-semibold text-red-400">Red</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-yellow-500/20 text-yellow-400 font-black text-sm">
                    &rarr;
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Right</h4>
                    <p className="text-[11px] font-semibold text-yellow-400">Yellow</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 font-black text-sm">
                    &darr;
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Down</h4>
                    <p className="text-[11px] font-semibold text-emerald-400">Green</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-2xl border border-blue-500/30 bg-blue-500/10 p-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400 font-black text-sm">
                    &larr;
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Left</h4>
                    <p className="text-[11px] font-semibold text-blue-400">Blue</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Rules, Mistakes, Scoring & Stars */}
            <div className="rounded-3xl border border-border bg-surface p-5 shadow-[0_24px_80px_rgba(0,0,0,0.22)] sm:p-6">
              <div className="flex items-center gap-2 text-accent">
                <Trophy size={18} />
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                  Rules &amp; Scoring
                </p>
              </div>

              <h3 className="mt-2 text-xl font-bold text-white">
                Mistakes, Scoring &amp; Stars
              </h3>

              <div className="mt-4 space-y-3">
                <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
                    <HelpCircle size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Mistakes Don&apos;t End the Game</h4>
                    <p className="mt-0.5 text-xs leading-5 text-white/50">
                      An incorrect input does not end the game; continue with the remaining sequence to complete your attempt.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
                    <Trophy size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Level 1 Scoring (4 Steps)</h4>
                    <p className="mt-0.5 text-xs leading-5 text-white/50">
                      Level 1 has a 4-step sequence. Each mistake reduces the score by 25 percentage points:
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-1.5 text-xs text-white/70">
                      <span className="rounded-lg bg-white/5 px-2 py-1">4/4 correct = 100%</span>
                      <span className="rounded-lg bg-white/5 px-2 py-1">3/4 correct = 75%</span>
                      <span className="rounded-lg bg-white/5 px-2 py-1">2/4 correct = 50%</span>
                      <span className="rounded-lg bg-white/5 px-2 py-1">1/4 correct = 25%</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-400/10 text-amber-400">
                    <Star size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Star Ratings</h4>
                    <p className="mt-0.5 text-xs leading-5 text-white/50">
                      Earn stars based on your final sequence score:
                    </p>
                    <div className="mt-2 space-y-1 text-xs">
                      <p className="text-white/80">
                        <span className="font-bold text-amber-400">90%+</span> = 3 stars (perfect 4/4)
                      </p>
                      <p className="text-white/80">
                        <span className="font-bold text-amber-400">70%+</span> = 2 stars (3/4 correct)
                      </p>
                      <p className="text-white/80">
                        <span className="font-bold text-amber-400">50%+</span> = 1 star (2/4 correct)
                      </p>
                      <p className="text-white/50">
                        <span className="font-bold text-white/40">below 50%</span> = 0 stars
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Level Availability */}
            <div className="rounded-3xl border border-border bg-surface p-5 shadow-[0_24px_80px_rgba(0,0,0,0.22)] sm:p-6">
              <div className="flex items-center gap-2 text-accent">
                <Layers size={18} />
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                  Roadmap
                </p>
              </div>

              <h3 className="mt-2 text-xl font-bold text-white">
                Level Availability
              </h3>

              <p className="mt-2 text-sm leading-6 text-white/60">
                Level 1 is currently implemented; later levels are coming soon with faster timings, longer sequences, and higher difficulty!
              </p>

              <Link
                href="/playground/echo-memory/challenges/1"
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3.5 text-sm font-bold text-black transition hover:bg-accent/90 active:scale-[0.98]"
              >
                Play Level 1 Now
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }
}