"use client";

import { useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import SubPageHeader from "@/components/SubPageHeader";
import { useBleContext } from "@/context/BleContext";
import { getModeMeta } from "@/data/modes";
import { getLevelMeta } from "@/data/levels";
import ControlPanel from "@/components/ControlPanel";

export default function ChallengeLevelPage() {
  const params = useParams<{ mode: string; level: string }>();
  const router = useRouter();
  const { status, send } = useBleContext();

  const modeMeta = getModeMeta(params.mode);
  const levelId = Number(params.level);
  const levelMeta = getLevelMeta(levelId);

  const startedRef = useRef(false);

  useEffect(() => {
    if (status !== "connected" || startedRef.current || !levelMeta) {
      return;
    }

    startedRef.current = true;

    // send({
    //   type: "command",
    //   id: crypto.randomUUID(),
    //   command: "start_challenge",
    //   mode: params.mode,
    //   level: levelId,
    // }).catch((error) => {
    //   console.error("[CHALLENGE START]", error);
    // });
  }, [status, send, params.mode, levelId, levelMeta]);

  function handleExit() {
    // send({
    //   type: "command",
    //   id: crypto.randomUUID(),
    //   command: "stop",
    // }).catch(() => {});

    router.push(`/playground/${params.mode}/challenges`);
  }

  if (!levelMeta) {
    return (
      <main className="min-h-screen">
        <SubPageHeader
          title="Unknown level"
          backHref={`/playground/${params.mode}/challenges`}
        />

        <div className="mx-auto min-h-screen max-w-md px-4 pb-10 pt-24">
          <p className="text-sm text-white/50">
            That level doesn&apos;t exist. Head back and pick another
            one.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <SubPageHeader
        title={`${modeMeta?.title ?? "Challenge"} \u00b7 Level ${levelMeta.id}`}
        subtitle={`${levelMeta.difficulty} difficulty`}
        backHref={`/playground/${params.mode}/challenges`}
      />

      <div className="mx-auto min-h-screen max-w-md px-4 pb-10 pt-24">
        <section>
          <p className="text-sm font-medium text-accent">
            Level {levelMeta.id}
          </p>

          <h2 className="mt-2 text-3xl font-black tracking-tight">
            {levelMeta.title}
          </h2>

          <p className="mt-2 text-sm leading-6 text-white/50">
            {levelMeta.description}
          </p>
        </section>

        <section className="mt-8">
          <ControlPanel />
        </section>

        <button
          type="button"
          onClick={handleExit}
          className="mt-6 flex w-full items-center justify-center rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-bold text-danger"
        >
          Exit challenge
        </button>
      </div>
    </main>
  );
}
