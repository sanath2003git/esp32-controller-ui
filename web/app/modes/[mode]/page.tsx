"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
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

  return (
    <main className="min-h-screen">
      <SubPageHeader
        title={modeMeta.title}
        subtitle={modeMeta.description}
        backHref="/"
      />

      <div className="mx-auto min-h-screen max-w-md px-4 pb-10 pt-24">
        <section>
          <p className="text-sm font-medium text-accent">
            {modeMeta.title}
          </p>

          <h2 className="mt-2 text-3xl font-black tracking-tight">
            How do you want to play?
          </h2>

          <p className="mt-2 text-sm leading-6 text-white/50">
            {modeMeta.description}
          </p>
        </section>

        <section className="mt-8">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/35">
              Pick a style
            </p>
          </div>

          <div className="space-y-3">
            <ModeCard
              title="Training"
              description="Free-form movement controls, no scoring."
              icon="training"
              accent={modeMeta.accent}
              href={`/modes/${modeMeta.slug}/training`}
            />

            <ModeCard
              title="Challenge"
              description="Pick a level and race against the clock."
              icon="challenge"
              accent={modeMeta.accent}
              href={`/modes/${modeMeta.slug}/challenges`}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
