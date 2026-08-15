"use client";

import { useParams } from "next/navigation";
import LevelCard from "@/components/LevelCard";
import SubPageHeader from "@/components/SubPageHeader";
import { getModeMeta } from "@/data/modes";
import { levels } from "@/data/levels";

export default function ChallengesPage() {
  const params = useParams<{ mode: string }>();
  const modeMeta = getModeMeta(params.mode);
  const title = modeMeta?.title ?? "Challenge";

  return (
    <main className="min-h-screen">
      <SubPageHeader
        title={`${title} \u00b7 Challenge`}
        subtitle="Pick a level"
        backHref={`/modes/${params.mode}`}
      />

      <div className="mx-auto min-h-screen max-w-md px-4 pb-10 pt-24">
        <section>
          <p className="text-sm font-medium text-accent">Challenge</p>

          <h2 className="mt-2 text-3xl font-black tracking-tight">
            Choose a level
          </h2>

          <p className="mt-2 text-sm leading-6 text-white/50">
            Each level raises the difficulty. Beat it without a
            collision.
          </p>
        </section>

        <section className="mt-8 grid grid-cols-2 gap-3">
          {levels.map((level) => (
            <LevelCard
              key={level.id}
              level={level}
              mode={params.mode as string}
            />
          ))}
        </section>
      </div>
    </main>
  );
}
