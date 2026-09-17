"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import ModeCard from "@/components/ModeCard";
import SubPageHeader from "@/components/SubPageHeader";
import { getModeMeta } from "@/data/modes";

export default function ModeHubPage() {
  const params = useParams<{ mode: string }>();
  const modeMeta = getModeMeta(params.mode);

  if (!modeMeta) {
    return (
      <main className="min-h-screen">
        <SubPageHeader title="Unknown mode" backHref="/" />

        <div className="mx-auto min-h-screen max-w-md px-4 pb-10 pt-24">
          <p className="text-sm text-white/50">
            We couldn&apos;t find that mode. Head back home and pick one
            from the list.
          </p>

          <Link
            href="/"
            className="mt-4 inline-block text-sm font-semibold text-primary"
          >
            Back to home
          </Link>
        </div>
      </main>
    );
  }

  const isImplemented = params.mode === "colour-quest" || params.mode === "color-quest";

  return (
    <main className="min-h-screen">
      <SubPageHeader
        title={modeMeta.title}
        subtitle={isImplemented ? modeMeta.description : "Coming Soon"}
        backHref="/playground"
      />

      <div className="mx-auto min-h-screen max-w-md px-4 pb-10 pt-24">
        <section>
          <p className="text-sm font-medium text-accent">
            {modeMeta.title}
          </p>

          <h2 className="mt-2 text-3xl font-black tracking-tight">
            {isImplemented ? "Choose what you want do" : "Coming Soon"}
          </h2>

          <p className="mt-2 text-sm leading-6 text-white/50">
            {modeMeta.description}
          </p>
        </section>

        <section className="mt-8">
          {isImplemented ? (
            <>
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/35">
                  Pick a style
                </p>
              </div>

              <div className="space-y-3">
                <ModeCard
                  title="Training"
                  description="Learn how to play."
                  icon="training"
                  accent={modeMeta.accent}
                  href={`/playground/${modeMeta.slug}/training`}
                />

                <ModeCard
                  title="Challenge"
                  description="Pick a level and race against the clock."
                  icon="challenge"
                  accent={modeMeta.accent}
                  href={`/playground/${modeMeta.slug}/challenges`}
                />
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center rounded-3xl border border-border bg-surface p-6 text-center shadow-xl">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-accent/30 bg-accent/15 text-accent">
                <Sparkles size={32} />
              </div>

              <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-accent">
                Under Development
              </span>

              <h3 className="mt-3 text-xl font-extrabold text-white">
                {modeMeta.title} is Coming Soon!
              </h3>

              <p className="mt-2 text-sm leading-6 text-white/50">
                We&apos;re currently working hard on implementing {modeMeta.title}. Look out for upcoming robot firmware and app updates!
              </p>

              <Link
                href="/playground"
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-white/10 px-4 py-3.5 text-sm font-bold text-white transition hover:bg-white/15 active:scale-[0.98]"
              >
                <ArrowLeft size={16} /> Choose another game
              </Link>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
