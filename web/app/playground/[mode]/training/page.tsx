"use client";

import { useParams } from "next/navigation";
import SubPageHeader from "@/components/SubPageHeader";
import { getModeMeta } from "@/data/modes";
import ControlPanel from "@/components/ControlPanel";

export default function TrainingPage() {
  const params = useParams<{ mode: string }>();
  const modeMeta = getModeMeta(params.mode);
  const title = modeMeta?.title ?? "Training";

  return (
    <main className="min-h-screen">
      <SubPageHeader
        title={`${title} \u00b7 Training`}
        subtitle="Free movement controls"
        backHref={`/playground/${params.mode}`}
      />

      <div className="mx-auto min-h-screen max-w-md px-4 pb-10 pt-24">
        <section>
          <p className="text-sm font-medium text-accent">Training</p>

          <h2 className="mt-2 text-3xl font-black tracking-tight">
            Drive freely
          </h2>

          <p className="mt-2 text-sm leading-6 text-white/50">
            No timers, no scoring — just get a feel for the robot.
          </p>
        </section>

        <section className="mt-8">
          <ControlPanel />
        </section>
      </div>
    </main>
  );
}
