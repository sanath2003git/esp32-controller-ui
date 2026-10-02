"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import SubPageHeader from "@/components/SubPageHeader";
import ResultModal from "@/components/ResultModal";
import { useBleContext } from "@/context/BleContext";
import { getGameDefinition } from "@/data/gameCatalog";
import {
  calculateStars,
  isLevelUnlocked,
} from "@/lib/colourQuest";
import {
  fetchAndSyncProgress,
  submitAndPersistLevelResult,
} from "@/lib/progressStore";
import type { LevelProgress } from "@/types/colourQuest";
import type { GameFeedbackPayload, GameResultPayload, JoyStickDir } from "@/types/protocol";
import { useGameSession } from "@/games/useGameSession";
import {
  AlertCircle,
  Play,
  RefreshCw,
  Bluetooth,
  CheckCircle2,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Gamepad2,
} from "lucide-react";

export default function ColorQuestChallengePage() {
  const params = useParams<{ mode: string; level: string }>();
  const router = useRouter();
  const {
    status,
    sendJoystickInput: sendGameInput,
    openModal,
  } = useBleContext();

  const game = getGameDefinition(params.mode);
  const levelId = Number(params.level);
  const levelMeta = game?.levels.find((level) => level.id === levelId);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentResult, setCurrentResult] = useState<{
    score: number;
    stars: 0 | 1 | 2 | 3;
    bestScore: number;
    isNextUnlocked: boolean;
  } | null>(null);

  const [activeTask, setActiveTask] = useState<{
    index: number;
    phase: "memorize" | "answer";
    input: string;
    target?: string;
    options?: string[];
  } | null>(null);

  const [taskFeedback, setTaskFeedback] = useState<{
    taskId: number;
    correct: boolean;
    correctCount: number;
  } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userProgressMap, setUserProgressMap] = useState<Record<number, LevelProgress>>({});
  const [isLoadingProgress, setIsLoadingProgress] = useState(true);

  const regionSelectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let isSubscribed = true;

    if (game) {
      fetchAndSyncProgress("color-quest")
        .then((data) => {
          if (isSubscribed && data.levels) {
            setUserProgressMap(data.levels);
          }
        })
        .catch((err) => {
          console.warn("[LEVEL PAGE] Failed to fetch progress:", err);
        })
        .finally(() => {
          if (isSubscribed) {
            setIsLoadingProgress(false);
          }
        });
    } else {
      setTimeout(() => {
        if (isSubscribed) {
          setIsLoadingProgress(false);
        }
      }, 0);
    }

    return () => {
      isSubscribed = false;
    };
  }, [game]);

  const isUnlocked = isLevelUnlocked(levelId, userProgressMap);

  const handleGameResult = useCallback(
    async (gameResult: GameResultPayload) => {
      const score = gameResult.tasksTotal > 0
        ? gameResult.tasksCompleted / gameResult.tasksTotal
        : gameResult.score > 1 ? gameResult.score / 100 : gameResult.score;
      try {
        const result = await submitAndPersistLevelResult("color-quest", levelId, score, gameResult.stars);
        setUserProgressMap(result.levels);
        setCurrentResult({
          score,
          stars: gameResult.stars,
          bestScore: result.bestScore,
          isNextUnlocked: result.isNextUnlocked,
        });
      } catch (err) {
        console.warn("[SUBMIT RESULT ERROR]", err);
        const localStars = gameResult.stars ?? calculateStars(score);
        setCurrentResult({ score, stars: localStars, bestScore: score, isNextUnlocked: localStars === 3 });
      } finally {
        setIsModalOpen(true);
      }
    },
    [levelId],
  );

  const handleGameFeedback = useCallback((feedback: GameFeedbackPayload) => {
    setTaskFeedback({
      taskId: feedback.taskId,
      correct: feedback.correct,
      correctCount: feedback.correctCount,
    });
    setActiveTask({
      index: feedback.taskId - 1,
      phase: "answer",
      input: "",
    });
  }, []);

  const session = useGameSession({
    game: "color_quest",
    level: levelId,
    onResult: handleGameResult,
    onFeedback: handleGameFeedback,
  });

  useEffect(() => {
    if (session.status === "playing") {
      regionSelectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [session.status, activeTask]);

  const handleStartLevel = async () => {
    if (session.status === "starting" || session.status === "playing") return;
    if (!isUnlocked) {
      session.setError("This level is locked. Complete the previous level with 3 stars to unlock!");
      return;
    }
    setErrorMessage(null);
    setActiveTask(null);
    setTaskFeedback(null);
    session.reset();
    await session.start();
  };

  const handleGameInput = (direction: JoyStickDir) => {
    setTaskFeedback(null);
    void sendGameInput(direction).catch((error: unknown) => {
      console.warn("[GAME INPUT ERROR]", error);
    });
  };

  const handleExit = () => {
    void session.abort().catch((e) => console.error("[ABORT ERROR]", e));
    router.push(`/playground/${params.mode}/challenges`);
  };

  const handleReplay = () => {
    setIsModalOpen(false);
    setCurrentResult(null);
    session.reset();
    handleStartLevel();
  };

  const handleNextLevel = () => {
    setIsModalOpen(false);
    setCurrentResult(null);
    session.reset();
    router.push(`/playground/${params.mode}/challenges/${levelId + 1}`);
  };

  if (!levelMeta) {
    return (
      <main className="min-h-screen">
        <SubPageHeader
          title="Unknown level"
          backHref={`/playground/${params.mode}/challenges`}
        />

        <div className="mx-auto min-h-screen max-w-md px-4 pb-10 pt-24">
          <p className="text-sm text-white/50">
            That level doesn&apos;t exist. Head back and pick another one.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-16">
      <SubPageHeader
        title={`${game?.title ?? "Colour Quest"} \u00b7 Level ${levelMeta.id}`}
        subtitle={`${levelMeta.difficulty} difficulty \u00b7 ${levelMeta.timing} speed`}
        backHref={`/playground/${params.mode}/challenges`}
      />

      <div className="mx-auto min-h-screen max-w-md px-4 pb-10 pt-24">
        {/* Header Section */}
        <section className="rounded-2xl border border-white/10 bg-surface p-5 shadow-lg flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/20 text-primary mb-4 shadow-inner shadow-primary/20">
            <Gamepad2 size={32} />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            {game?.title || "Colour Quest"}
          </h1>

          <div className="mt-4 flex flex-col items-start space-y-2 text-sm text-left bg-black/20 rounded-xl p-4 w-full border border-white/5">
            <p className="text-white/80">
              <span className="inline-block w-6 text-center mr-2 text-lg">🤖</span>
              <strong>Watch</strong> the colourful LEDs light up on your robot!
            </p>
            <p className="text-white/80">
              <span className="inline-block w-6 text-center mr-2 text-lg">🧠</span>
              <strong>Memorize</strong> where each colour is located!
            </p>
            <p className="text-white/80">
              <span className="inline-block w-6 text-center mr-2 text-lg">🎮</span>
              <strong>Match</strong> the target colour using your D-Pad arrows!
            </p>
          </div>

          <div className="mt-6 w-full border-t border-white/10 pt-5 text-left">
            <div className="flex items-center justify-between">
              <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                Level {levelMeta.id}
              </span>
              <span className="text-xs font-semibold text-white/40">
                {levelMeta.difficulty}
              </span>
            </div>

            <h2 className="mt-3 text-xl font-bold tracking-tight text-white">
              {levelMeta.title}
            </h2>

            <p className="mt-1 text-sm leading-6 text-white/60">
              {levelMeta.description}
            </p>

            <p className="mt-2 text-xs italic text-accent/80">
              Concept: {levelMeta.concept}
            </p>
          </div>
        </section>

        {/* Lock warning if locked */}
        {!isLoadingProgress && !isUnlocked && (
          <section className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-300 flex items-start gap-3">
            <AlertCircle size={20} className="shrink-0 mt-0.5" />
            <div className="text-xs leading-5">
              <span className="font-bold block">Level Locked</span>
              You need 3 stars on Level {levelId - 1} to unlock this challenge.
            </div>
          </section>
        )}

        {/* Error notification */}
        {(session.error || errorMessage) && (
          <section className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-300 flex items-start gap-3">
            <AlertCircle size={20} className="shrink-0 mt-0.5" />
            <div className="text-xs leading-5 flex-1">
              <span className="font-bold block">Error</span>
              {session.error || errorMessage}
            </div>
          </section>
        )}

        {/* Start / Status Controls */}
        <section className="mt-6">
          {status !== "connected" ? (
            <button
              type="button"
              onClick={openModal}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-4 text-base font-bold text-black transition-all hover:bg-amber-400 active:scale-[0.98]"
            >
              <Bluetooth size={20} /> Connect Robot BLE to Start
            </button>
          ) : session.status === "idle" || session.status === "error" ? (
            <button
              type="button"
              disabled={!isUnlocked}
              onClick={handleStartLevel}
              className={`flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-4 text-base font-bold transition-all ${isUnlocked
                ? "bg-primary text-black hover:bg-primary/90 active:scale-[0.98] shadow-lg shadow-primary/20"
                : "bg-white/10 text-white/30 cursor-not-allowed"
                }`}
            >
              <Play size={20} fill="currentColor" /> Start Level {levelId}
            </button>
          ) : session.status === "starting" ? (
            <div className="flex w-full items-center justify-center gap-3 rounded-2xl border border-primary/30 bg-primary/10 p-4 text-primary font-bold text-sm">
              <RefreshCw size={18} className="animate-spin" /> Sending start command to robot...
            </div>
          ) : session.status === "playing" ? (
            <div className="flex w-full items-center justify-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-400 font-bold text-sm">
              <CheckCircle2 size={18} className="animate-pulse" /> Challenge active on robot! Match target region...
            </div>
          ) : null}
        </section>

        {/* Common game task feedback and region input */}
        {session.status === "playing" && (
          <section
            ref={regionSelectionRef}
            className="mt-6 scroll-mt-24 rounded-2xl border border-accent/30 bg-surface-light p-5 text-center shadow-xl"
            aria-live="polite"
          >
            <div className="mb-3 flex items-center justify-between text-xs text-white/60">
              <span className="font-bold text-accent">
                Task {activeTask ? activeTask.index + 1 : 1} / 10
              </span>
              <span className="font-semibold text-white/80">Select a region</span>
            </div>

            {/* Fixed-dimension feedback box that never collapses or jumps */}
            <div
              className={`mb-4 flex h-12 items-center justify-center rounded-xl border px-3 text-sm font-bold transition-colors duration-300 ${taskFeedback
                ? taskFeedback.correct
                  ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                  : "border-rose-500/40 bg-rose-500/15 text-rose-300"
                : "border-white/10 bg-white/5 text-white/40"
                }`}
            >
              <span className="transition-opacity duration-200">
                {taskFeedback ? (
                  <>
                    {taskFeedback.correct ? "CORRECT" : "INCORRECT"} · Correct answers: {taskFeedback.correctCount}/10
                  </>
                ) : (
                  "Make your move using the buttons below"
                )}
              </span>
            </div>

            {/* Directional Input Grid (Completely stationary now) */}
            <div className="mx-auto mt-4 grid max-w-[200px] grid-cols-3 gap-2">
              <div />
              <button
                type="button"
                onClick={() => handleGameInput("up")}
                className="flex aspect-square items-center justify-center rounded-2xl border border-primary/40 bg-primary/20 text-primary hover:bg-primary/30 active:scale-95 transition-all"
                aria-label="Front (Top)"
              >
                <ArrowUp size={32} />
              </button>
              <div />
              <button
                type="button"
                onClick={() => handleGameInput("left")}
                className="flex aspect-square items-center justify-center rounded-2xl border border-primary/40 bg-primary/20 text-primary hover:bg-primary/30 active:scale-95 transition-all"
                aria-label="Left"
              >
                <ArrowLeft size={32} />
              </button>
              <div />
              <button
                type="button"
                onClick={() => handleGameInput("right")}
                className="flex aspect-square items-center justify-center rounded-2xl border border-primary/40 bg-primary/20 text-primary hover:bg-primary/30 active:scale-95 transition-all"
                aria-label="Right"
              >
                <ArrowRight size={32} />
              </button>
              <div />
              <button
                type="button"
                onClick={() => handleGameInput("down")}
                className="flex aspect-square items-center justify-center rounded-2xl border border-primary/40 bg-primary/20 text-primary hover:bg-primary/30 active:scale-95 transition-all"
                aria-label="Back (Bottom)"
              >
                <ArrowDown size={32} />
              </button>
              <div />
            </div>
          </section>
        )}

        {/* Exit Button */}
        <button
          type="button"
          onClick={handleExit}
          className="mt-6 flex w-full items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-400 hover:bg-rose-500/20 transition-all"
        >
          Exit challenge
        </button>
      </div>

      {/* Result Modal */}
      {currentResult && (
        <ResultModal
          isOpen={isModalOpen}
          level={levelId}
          score={currentResult.score}
          stars={currentResult.stars}
          bestScore={currentResult.bestScore}
          hasNextLevel={levelId < (game?.levels.length ?? 0)}
          isNextUnlocked={currentResult.isNextUnlocked}
          onReplay={handleReplay}
          onNextLevel={handleNextLevel}
          onBackToLevels={handleExit}
        />
      )}
    </main>
  );
}
