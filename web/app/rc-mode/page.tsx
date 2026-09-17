"use client";

import SubPageHeader from "@/components/SubPageHeader";
import ControlPanel from "@/components/ControlPanel";

export default function RcModePage() {
  return (
    <main className="min-h-screen pb-16">
      <SubPageHeader
        title="RC Mode"
        subtitle="Free Ride"
        backHref="/"
      />

      <div className="mx-auto min-h-screen max-w-md px-4 pb-10 pt-24">
        <section className="mb-6 text-center">
          <h2 className="text-2xl font-black tracking-tight text-white">
            Free Ride
          </h2>
          <p className="mt-2 text-sm leading-6 text-white/50">
            Take full control of the robot. Drive freely without any challenges.
          </p>
        </section>

        <section>
          <ControlPanel mode="free-ride" />
        </section>
      </div>
    </main>
  );
}
