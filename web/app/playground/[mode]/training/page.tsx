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

      <div className="mx-auto min-h-screen max-w-md px-4 pb-0 pt-20">
        <section >
          <ControlPanel />
        </section>
      </div>
    </main>
  );
}
