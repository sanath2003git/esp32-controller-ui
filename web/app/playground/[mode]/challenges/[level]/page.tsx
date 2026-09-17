"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import SubPageHeader from "@/components/SubPageHeader";
import ControlPanel from "@/components/ControlPanel";
import ResultModal from "@/components/ResultModal";
import { useBleContext } from "@/context/BleContext";
import { getModeMeta } from "@/data/modes";
import {
  calculateStars,
  createColorQuestRegionCommand,
  createColorQuestStartCommand,
  getColourQuestLevel,
  isLevelUnlocked,
  isValidColorQuestResult,
} from "@/lib/colourQuest";
import {
  fetchAndSyncProgress,
  submitAndPersistLevelResult,
} from "@/lib/progressStore";
import type {
  ColorQuestRegion,
  ColourQuestGameState,
  LevelProgress,
} from "@/types/colourQuest";
import {
  AlertCircle,
  Play,
  RefreshCw,
  Bluetooth,
  CheckCircle2,
  Eye,
  HelpCircle,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Gamepad2,
} from "lucide-react";

export default function ChallengeLevelPage() {
  const params = useParams<{ mode: string; level: string }>();
  const router = useRouter();
  const { status, send, lastMessage, openModal } = useBleContext();

  const isColourQuest = params.mode === "colour-quest" || params.mode === "color-quest";
  const modeMeta = getModeMeta(params.mode);
  const levelId = Number(params.level);
  const levelMeta = getColourQuestLevel(levelId);

  const [gameState, setGameState] = useState<ColourQuestGameState>("idle");
  const gameStateRef = useRef<ColourQuestGameState>("idle");

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

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

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userProgressMap, setUserProgressMap] = useState<Record<number, LevelProgress>>({});
  const [isLoadingProgress, setIsLoadingProgress] = useState(true);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const processedMessageRef = useRef<string | null>(null);
  const regionSelectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (gameState === "playing" && activeTask) {
      regionSelectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [gameState, activeTask]);

  useEffect(() => {
    let isSubscribed = true;

    if (isColourQuest) {
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
  }, [isColourQuest]);

  const isUnlocked = isColourQuest ? isLevelUnlocked(levelId, userProgressMap) : true;

  const clearTimeoutTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Handle game start
  const handleStartLevel = async () => {
    if (gameState === "starting" || gameState === "playing") {
      return;
    }

    if (status !== "connected") {
      setErrorMessage("Robot is not connected over BLE. Please connect your device.");
      openModal();
      return;
    }

    if (!isUnlocked) {
      setErrorMessage("This level is locked. Complete the previous level with 3 stars to unlock!");
      return;
    }

    try {
      setErrorMessage(null);
      setActiveTask(null);
      setGameState("starting");
      processedMessageRef.current = null;

      const command = createColorQuestStartCommand(levelId);
      await send(command);

      setGameState("playing");

      // Set timeout for robot response (120 seconds for 10 tasks)
      clearTimeoutTimer();
      timeoutRef.current = setTimeout(() => {
        if (gameStateRef.current === "playing" || gameStateRef.current === "starting") {
          setGameState("error");
          setErrorMessage("Robot response timed out (120s). Please verify your robot firmware.");
        }
      }, 120000);
    } catch (err) {
      console.error("[CHALLENGE START ERROR]", err);
      setGameState("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to send start command to BLE device."
      );
    }
  };

  // Submit result to progress store & API
  const handleGameResult = useCallback(
    async (score: number) => {
      clearTimeoutTimer();
      setGameState("completed");

      try {
        const result = await submitAndPersistLevelResult("color-quest", levelId, score);
        setUserProgressMap(result.levels);

        setCurrentResult({
          score,
          stars: result.awardedStars,
          bestScore: result.bestScore,
          isNextUnlocked: result.isNextUnlocked,
        });
      } catch (err) {
        console.warn("[SUBMIT RESULT ERROR]", err);
        const localStars = calculateStars(score);
        setCurrentResult({
          score,
          stars: localStars,
          bestScore: score,
          isNextUnlocked: localStars === 3,
        });
      } finally {
        setIsModalOpen(true);
      }
    },
    [clearTimeoutTimer, levelId]
  );

  // Send region answer to firmware
  const handleRegionAnswer = async (region: ColorQuestRegion) => {
    if (gameState !== "playing" || status !== "connected") return;
    try {
      await send(createColorQuestRegionCommand(region));
    } catch (err) {
      console.warn("[REGION ANSWER ERROR]", err);
    }
  };

  const [taskFeedback, setTaskFeedback] = useState<{
    correct: boolean;
    timeout?: boolean;
    correctCount: number;
  } | null>(null);

  // BLE message listener
  useEffect(() => {
    if (gameState !== "playing" || !lastMessage) return;

    if (lastMessage.type === "task" && (lastMessage.game === "color-quest" || lastMessage.game === "colour-quest")) {
      const taskData = {
        index: lastMessage.index,
        phase: (lastMessage.phase as "memorize" | "answer") || "memorize",
        input: lastMessage.input || "region",
        target: lastMessage.target,
        options: lastMessage.options,
      };
      setTimeout(() => {
        setActiveTask(taskData);
        setTaskFeedback(null);
      }, 0);
    } else if (
      lastMessage.type === "task_result" &&
      (lastMessage.game === "color-quest" || lastMessage.game === "colour-quest")
    ) {
      const feedback = {
        correct: lastMessage.correct,
        timeout: lastMessage.timeout,
        correctCount: lastMessage.correctCount ?? 0,
      };
      setTimeout(() => {
        setTaskFeedback(feedback);
      }, 0);
    } else if (lastMessage.type === "error") {
      const msg = lastMessage.message;
      setTimeout(() => {
        setErrorMessage(`Firmware error: ${msg}`);
      }, 0);
    } else if (isValidColorQuestResult(lastMessage)) {
      const messageKey = `${lastMessage.game}-${lastMessage.score}-${lastMessage.level ?? levelId}`;
      if (processedMessageRef.current === messageKey) {
        return; // Prevent duplicate response processing
      }
      processedMessageRef.current = messageKey;

      handleGameResult(lastMessage.score);
    }
  }, [gameState, lastMessage, handleGameResult, levelId]);

  // Handle BLE disconnection while playing
  useEffect(() => {
    if ((gameState === "playing" || gameState === "starting") && status !== "connected") {
      clearTimeoutTimer();
      const timer = setTimeout(() => {
        setGameState("error");
        setErrorMessage("BLE connection lost while playing. Please reconnect.");
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [gameState, status, clearTimeoutTimer]);

  const handleExit = () => {
    if (gameState === "playing" || gameState === "starting") {
      void send({ command: "abort" }).catch((e) => console.error("[ABORT ERROR]", e));
    }
    clearTimeoutTimer();
    router.push(`/playground/${params.mode}/challenges`);
  };

  const handleReplay = () => {
    setIsModalOpen(false);
    setCurrentResult(null);
    setGameState("idle");
    handleStartLevel();
  };

  const handleNextLevel = () => {
    setIsModalOpen(false);
    setCurrentResult(null);
    setGameState("idle");
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
        title={`${modeMeta?.title ?? "Colour Quest"} \u00b7 Level ${levelMeta.id}`}
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
            {modeMeta?.title || "Colour Quest"}
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
        {errorMessage && (
          <section className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-300 flex items-start gap-3">
            <AlertCircle size={20} className="shrink-0 mt-0.5" />
            <div className="text-xs leading-5 flex-1">
              <span className="font-bold block">Error</span>
              {errorMessage}
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
          ) : gameState === "idle" || gameState === "error" ? (
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
          ) : gameState === "starting" ? (
            <div className="flex w-full items-center justify-center gap-3 rounded-2xl border border-primary/30 bg-primary/10 p-4 text-primary font-bold text-sm">
              <RefreshCw size={18} className="animate-spin" /> Sending start command to robot...
            </div>
          ) : gameState === "playing" ? (
            <div className="flex w-full items-center justify-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-400 font-bold text-sm">
              <CheckCircle2 size={18} className="animate-pulse" /> Challenge active on robot! Match target region...
            </div>
          ) : null}
        </section>

        {/* Active Task & Anti-Cheating Phase Flow Overlay */}
        {gameState === "playing" && activeTask && (
          <section
            ref={regionSelectionRef}
            className="mt-6 scroll-mt-24 rounded-2xl border border-accent/30 bg-surface-light p-5 text-center shadow-xl"
          >
            <div className="flex items-center justify-between text-xs text-white/60 mb-3">
              <span className="flex items-center gap-1.5 font-bold text-accent">
                Task {activeTask.index + 1} / 10
              </span>
              <span className="uppercase tracking-wider font-semibold text-white/80">
                {activeTask.phase === "memorize" ? "Phase 1: Memorize (0-5s)" : "Phase 2: Answer (5-10s)"}
              </span>
            </div>

            {taskFeedback ? (
              <div
                className={`mb-4 rounded-xl border p-4 font-bold text-sm ${taskFeedback.correct
                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                    : taskFeedback.timeout
                      ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
                      : "border-rose-500/40 bg-rose-500/15 text-rose-300"
                  }`}
              >
                {taskFeedback.correct
                  ? `CORRECT! Score: ${taskFeedback.correctCount}/10`
                  : taskFeedback.timeout
                    ? `TIMEOUT! Score: ${taskFeedback.correctCount}/10`
                    : `WRONG! Score: ${taskFeedback.correctCount}/10`}
              </div>
            ) : activeTask.phase === "memorize" ? (
              <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-300">
                <div className="flex items-center justify-center gap-2 font-bold text-sm mb-1">
                  <Eye size={18} className="animate-pulse" /> Memorize Phase!
                </div>
                <p className="text-xs text-amber-200/80">
                  Observe the 4 LED colours illuminated simultaneously on your robot!
                </p>
              </div>
            ) : (
              <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-300">
                <div className="flex items-center justify-center gap-2 font-bold text-sm mb-1">
                  <HelpCircle size={18} /> Answer Phase!
                </div>
                <p className="text-xs text-emerald-200/80">
                  LEDs are off. Input accepted for 5 more seconds!
                </p>
              </div>
            )}

            {/* Region Selection Buttons (D-Pad Layout) */}
            <div className="mx-auto mt-6 grid max-w-[200px] grid-cols-3 gap-2">
              <div />
              <button
                type="button"
                onClick={() => handleRegionAnswer("front")}
                className="flex aspect-square items-center justify-center rounded-2xl border border-primary/40 bg-primary/20 text-primary hover:bg-primary/30 active:scale-95 transition-all"
                aria-label="Front (Top)"
              >
                <ArrowUp size={32} />
              </button>
              <div />

              <button
                type="button"
                onClick={() => handleRegionAnswer("left")}
                className="flex aspect-square items-center justify-center rounded-2xl border border-primary/40 bg-primary/20 text-primary hover:bg-primary/30 active:scale-95 transition-all"
                aria-label="Left"
              >
                <ArrowLeft size={32} />
              </button>
              <div />
              <button
                type="button"
                onClick={() => handleRegionAnswer("right")}
                className="flex aspect-square items-center justify-center rounded-2xl border border-primary/40 bg-primary/20 text-primary hover:bg-primary/30 active:scale-95 transition-all"
                aria-label="Right"
              >
                <ArrowRight size={32} />
              </button>

              <div />
              <button
                type="button"
                onClick={() => handleRegionAnswer("back")}
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
          hasNextLevel={levelId < 6}
          isNextUnlocked={currentResult.isNextUnlocked}
          onReplay={handleReplay}
          onNextLevel={handleNextLevel}
          onBackToLevels={handleExit}
        />
      )}
    </main>
  );
}
