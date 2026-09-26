"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUp,
  ArrowRight,
  ArrowDown,
  ArrowLeft,
  Play,
  RotateCcw,
  AlertCircle,
  Bluetooth,
  BrainCircuit,
  Eye,
  Clock,
  Sparkles,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import SubPageHeader from "@/components/SubPageHeader";
import ResultModal from "@/components/ResultModal";
import { useBleContext } from "@/context/BleContext";
import {
  ECHO_MEMORY_MAPPING,
  createEchoMemoryAbortCommand,
  createEchoMemoryInputCommand,
  createEchoMemoryStartCommand,
  isValidEchoMemoryResult,
  type EchoMemoryLevelMeta,
} from "@/lib/echoMemory";
import { submitAndPersistLevelResult } from "@/lib/progressStore";
import type {
  EchoMemoryDirection,
  EchoMemoryGameState,
  EchoMemoryResultMessage,
} from "@/types/echoMemory";

type StepResult = {
  answered: boolean;
  correct?: boolean;
  direction?: EchoMemoryDirection;
};

export default function EchoMemoryGame({
  levelId,
  levelMeta,
}: {
  levelId: number;
  levelMeta: EchoMemoryLevelMeta;
}) {
  const router = useRouter();
  const { status, send, lastMessage, openModal } = useBleContext();

  const isImplemented = levelId === 1;

  const [gameState, setGameState] = useState<EchoMemoryGameState>("idle");
  const gameStateRef = useRef<EchoMemoryGameState>("idle");
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [flashIndex, setFlashIndex] = useState<number>(0);
  const [waitTimer, setWaitTimer] = useState<number>(3);
  const [inputStep, setInputStep] = useState<number>(0);
  const [isSubmittingInput, setIsSubmittingInput] = useState<boolean>(false);
  const [stepResults, setStepResults] = useState<StepResult[]>([
    { answered: false },
    { answered: false },
    { answered: false },
    { answered: false },
  ]);
  const [stepFeedback, setStepFeedback] = useState<{
    correct: boolean;
    stepIndex: number;
  } | null>(null);

  const [currentResult, setCurrentResult] = useState<{
    score: number;
    scorePercent: number;
    stars: 0 | 1 | 2 | 3;
    correct: number;
    total: number;
  } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const inputWatchdogRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimers = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (inputWatchdogRef.current) {
      clearTimeout(inputWatchdogRef.current);
      inputWatchdogRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  // Handle BLE disconnect while playing
  useEffect(() => {
    if (
      (gameState === "starting" ||
        gameState === "flashing" ||
        gameState === "waiting" ||
        gameState === "input") &&
      status !== "connected"
    ) {
      clearTimers();
      const timer = setTimeout(() => {
        setGameState("error");
        setErrorMessage("Robot BLE disconnected during gameplay. Please reconnect.");
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [gameState, status, clearTimers]);

  // Handle incoming BLE messages from ESP32
  useEffect(() => {
    if (!lastMessage || gameState === "idle") return;

    // 1. Phase messages (flash, wait, input)
    if (lastMessage.type === "phase" && lastMessage.game === "echo-memory") {
      if (lastMessage.phase === "flash") {
        const idx = lastMessage.index ?? 0;
        setTimeout(() => {
          setGameState("flashing");
          setFlashIndex(idx);
          setStepFeedback(null);
        }, 0);
      } else if (lastMessage.phase === "wait") {
        clearTimers();
        setTimeout(() => {
          setGameState("waiting");
          setWaitTimer(3);
        }, 0);

        // 3-second wait countdown
        const startTime = Date.now();
        countdownIntervalRef.current = setInterval(() => {
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          const remaining = Math.max(0, 3 - elapsed);
          setWaitTimer(remaining);
          if (remaining <= 0 && countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
        }, 200);
      } else if (lastMessage.phase === "input") {
        clearTimers();
        setTimeout(() => {
          setGameState("input");
          setInputStep(0);
          setIsSubmittingInput(false);
        }, 0);
      }
    }

    // 2. Input feedback message (per-step evaluation)
    if (lastMessage.type === "input_result" && lastMessage.game === "echo-memory") {
      const idx = lastMessage.index;
      const isCorrect = lastMessage.correct;

      setTimeout(() => {
        setStepResults((prev) => {
          const next = [...prev];
          if (next[idx]) {
            next[idx] = {
              ...next[idx],
              answered: true,
              correct: isCorrect,
            };
          }
          return next;
        });

        setStepFeedback({ correct: isCorrect, stepIndex: idx });
        setInputStep(idx + 1);
        setIsSubmittingInput(false);
      }, 0);
    }

    // 3. Final Level Result message from firmware
    if (isValidEchoMemoryResult(lastMessage)) {
      clearTimers();
      const resMsg = lastMessage as EchoMemoryResultMessage;

      const resultPayload = {
        score: resMsg.score,
        scorePercent: resMsg.scorePercent,
        stars: resMsg.stars,
        correct: resMsg.correct,
        total: resMsg.total,
      };

      setTimeout(() => {
        setGameState("completed");
        setCurrentResult(resultPayload);
        setIsModalOpen(true);
      }, 0);

      // Persist progress to local store & backend
      void submitAndPersistLevelResult("echo-memory", levelId, resMsg.score).catch(
        (err) => {
          console.warn("[ECHO MEMORY] Progress submission failed:", err);
        }
      );
    }

    // 4. Firmware error notification
    if (lastMessage.type === "error") {
      const errMsg = lastMessage.message;
      setTimeout(() => {
        setErrorMessage(`Firmware error: ${errMsg}`);
      }, 0);
    }

    // 5. Aborted acknowledgement
    if (lastMessage.type === "aborted" && lastMessage.game === "echo-memory") {
      clearTimers();
      setTimeout(() => {
        setGameState("idle");
      }, 0);
    }
  }, [lastMessage, gameState, clearTimers, levelId]);

  // Start Level 1 Challenge
  const handleStartGame = async () => {
    if (status !== "connected") {
      openModal();
      return;
    }

    if (!isImplemented) {
      setErrorMessage("Only Level 1 is currently implemented.");
      return;
    }

    try {
      setErrorMessage(null);
      setStepResults([
        { answered: false },
        { answered: false },
        { answered: false },
        { answered: false },
      ]);
      setStepFeedback(null);
      setInputStep(0);
      setFlashIndex(0);
      setGameState("starting");

      await send(createEchoMemoryStartCommand(1));
    } catch (err) {
      console.error("[ECHO MEMORY] Start command error:", err);
      setGameState("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to send start command to robot."
      );
    }
  };

  // Submit Directional Input
  const handleDirectionInput = async (dir: EchoMemoryDirection) => {
    if (gameState !== "input" || isSubmittingInput || inputStep >= 4) {
      return;
    }

    if (status !== "connected") {
      setErrorMessage("Robot disconnected. Please reconnect.");
      return;
    }

    try {
      setIsSubmittingInput(true);

      // Record visual step prediction
      setStepResults((prev) => {
        const next = [...prev];
        if (next[inputStep]) {
          next[inputStep] = { ...next[inputStep], direction: dir };
        }
        return next;
      });

      await send(createEchoMemoryInputCommand(dir));

      // Watchdog in case firmware misses reply
      if (inputWatchdogRef.current) clearTimeout(inputWatchdogRef.current);
      inputWatchdogRef.current = setTimeout(() => {
        setIsSubmittingInput(false);
      }, 2000);
    } catch (err) {
      console.warn("[ECHO MEMORY] Input send failed:", err);
      setIsSubmittingInput(false);
    }
  };

  // Abort / Exit
  const handleExit = () => {
    if (
      gameState === "starting" ||
      gameState === "flashing" ||
      gameState === "waiting" ||
      gameState === "input"
    ) {
      void send(createEchoMemoryAbortCommand()).catch((err) =>
        console.warn("[ECHO MEMORY] Abort error:", err)
      );
    }
    clearTimers();
    router.push("/playground/echo-memory/challenges");
  };

  // Replay
  const handleReplay = () => {
    setIsModalOpen(false);
    setCurrentResult(null);
    setGameState("idle");
    void handleStartGame();
  };

  // If level > 1 (Levels 2-6 not implemented)
  if (!isImplemented) {
    return (
      <main className="min-h-screen pb-16">
        <SubPageHeader
          title={`Echo Memory \u00b7 Level ${levelId}`}
          subtitle="Coming Soon"
          backHref="/playground/echo-memory/challenges"
        />

        <div className="mx-auto min-h-screen max-w-md px-4 pb-10 pt-24">
          <section className="flex flex-col items-center rounded-3xl border border-white/10 bg-surface p-6 text-center shadow-xl">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-accent/30 bg-accent/15 text-accent mb-4">
              <Sparkles size={32} />
            </div>

            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-accent">
              Not Implemented Yet
            </span>

            <h2 className="mt-4 text-xl font-extrabold text-white">
              Level {levelId} is Coming Soon!
            </h2>

            <p className="mt-2 text-sm leading-6 text-white/50">
              Echo Memory Level 1 is the currently supported introductory challenge. Higher tiers will unlock in upcoming robot updates.
            </p>

            <button
              type="button"
              onClick={() => router.push("/playground/echo-memory/challenges/1")}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 text-sm font-bold text-black transition hover:bg-primary/90 active:scale-[0.98]"
            >
              Play Level 1 Now
            </button>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-16">
      <SubPageHeader
        title={`Echo Memory \u00b7 Level ${levelMeta.id}`}
        subtitle={`${levelMeta.difficulty} \u00b7 4-step sequence`}
        backHref="/playground/echo-memory/challenges"
      />

      <div className="mx-auto min-h-screen max-w-md px-4 pb-10 pt-24 space-y-5">
        {/* Header & Mode Intro */}
        <section className="rounded-3xl border border-white/10 bg-surface p-5 shadow-xl flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-accent/20 text-accent mb-3 shadow-inner shadow-accent/20">
            <BrainCircuit size={32} />
          </div>

          <h1 className="text-2xl font-black tracking-tight text-white">
            Echo Memory
          </h1>

          <div className="mt-3 flex items-center justify-between w-full border-t border-white/10 pt-3">
            <span className="rounded-full border border-accent/30 bg-accent/10 px-3 py-0.5 text-xs font-bold text-accent">
              Level 1 \u00b7 Easy
            </span>
            <span className="text-xs font-medium text-white/50">
              4 Steps \u00b7 3s Flash
            </span>
          </div>
        </section>

        {/* Fixed Colour-to-Direction Mapping Reference */}
        <section className="rounded-3xl border border-white/10 bg-surface p-5 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-white/40">
              Fixed Color Mapping
            </span>
            <span className="text-[11px] text-accent font-semibold">
              Study the directions
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {Object.values(ECHO_MEMORY_MAPPING).map((item) => (
              <div
                key={item.direction}
                className={`flex items-center gap-3 rounded-2xl border p-3 ${item.borderClass} bg-black/20`}
              >
                <div
                  className="h-4 w-4 rounded-full shadow-[0_0_10px_currentColor] shrink-0"
                  style={{ backgroundColor: item.hex, color: item.hex }}
                />
                <div className="flex flex-col text-left">
                  <span className="text-xs font-black uppercase text-white">
                    {item.label}
                  </span>
                  <span className={`text-[11px] font-semibold ${item.textClass}`}>
                    {item.color}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Error notification */}
        {errorMessage && (
          <section className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-300 flex items-start gap-3">
            <AlertCircle size={20} className="shrink-0 mt-0.5" />
            <div className="text-xs leading-5 flex-1">
              <span className="font-bold block">Error</span>
              {errorMessage}
            </div>
          </section>
        )}

        {/* Primary Game State Display */}
        {gameState === "idle" && (
          <section className="rounded-3xl border border-white/10 bg-surface p-6 text-center space-y-4 shadow-xl">
            <div className="flex flex-col items-center">
              <span className="text-lg font-bold text-white">Ready to begin?</span>
              <p className="mt-1 text-xs leading-5 text-white/60">
                1. Watch your robot flash 4 lights one by one.<br />
                2. Wait 3 seconds for the signal.<br />
                3. Echo the 4 directions on your controller!
              </p>
            </div>

            {status !== "connected" ? (
              <button
                type="button"
                onClick={openModal}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-4 text-sm font-bold text-black transition-all hover:bg-amber-400 active:scale-[0.98] shadow-lg shadow-amber-500/20"
              >
                <Bluetooth size={18} /> Connect Robot BLE to Start
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartGame}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-4 text-base font-bold text-black transition-all hover:bg-accent/90 active:scale-[0.98] shadow-lg shadow-accent/20"
              >
                <Play size={20} fill="currentColor" /> Start Level 1 Challenge
              </button>
            )}
          </section>
        )}

        {gameState === "starting" && (
          <section className="rounded-3xl border border-accent/30 bg-accent/10 p-6 text-center shadow-xl animate-pulse">
            <div className="flex items-center justify-center gap-3 text-accent font-bold text-sm">
              <RotateCcw size={18} className="animate-spin" />
              Starting challenge on robot...
            </div>
          </section>
        )}

        {/* Phase 1: Flashing Phase */}
        {gameState === "flashing" && (
          <section className="rounded-3xl border border-accent/40 bg-surface-light p-6 text-center shadow-2xl space-y-4">
            <div className="flex items-center justify-center gap-2 text-xs font-bold text-accent uppercase tracking-widest">
              <Eye size={18} className="animate-pulse" />
              Phase 1: Watch Robot LEDs
            </div>

            <div className="my-3 flex flex-col items-center">
              <div className="h-20 w-20 rounded-full border-2 border-accent bg-accent/10 flex items-center justify-center text-accent text-3xl font-black animate-pulse shadow-[0_0_30px_rgba(0,229,255,0.4)]">
                {flashIndex + 1}
              </div>
              <span className="mt-3 text-xs text-white/50 font-semibold uppercase tracking-wider">
                Flashing step {flashIndex + 1} of 4
              </span>
            </div>

            <p className="text-xs text-white/70 max-w-xs mx-auto leading-relaxed">
              Look closely at the robot&apos;s physical LED strip. Remember each directional colour in order!
            </p>
          </section>
        )}

        {/* Phase 2: Wait Phase (3 Seconds) */}
        {gameState === "waiting" && (
          <section className="rounded-3xl border border-warning/40 bg-surface-light p-6 text-center shadow-2xl space-y-4">
            <div className="flex items-center justify-center gap-2 text-xs font-bold text-warning uppercase tracking-widest">
              <Clock size={18} className="animate-spin" />
              Phase 2: Get Ready...
            </div>

            <div className="my-3 flex flex-col items-center">
              <div className="h-20 w-20 rounded-full border-2 border-warning bg-warning/10 flex items-center justify-center text-warning text-4xl font-black animate-bounce shadow-[0_0_30px_rgba(255,200,87,0.4)]">
                {waitTimer}s
              </div>
              <span className="mt-3 text-xs text-white/50 font-semibold uppercase tracking-wider">
                LEDs off \u00b7 Prepare your answer
              </span>
            </div>

            <p className="text-xs text-white/70 max-w-xs mx-auto leading-relaxed">
              Input will be accepted in {waitTimer} seconds. Recall the sequence!
            </p>
          </section>
        )}

        {/* Phase 3: Input Phase (Interactive D-Pad) */}
        {gameState === "input" && (
          <section className="rounded-3xl border border-emerald-500/40 bg-surface-light p-5 text-center shadow-2xl space-y-4">
            <div className="flex items-center justify-between text-xs text-white/60">
              <span className="font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={16} /> Phase 3: Echo Sequence
              </span>
              <span className="font-semibold text-white/80">
                Step {Math.min(inputStep + 1, 4)} / 4
              </span>
            </div>

            {/* Sequence 4-Step Tracker */}
            <div className="grid grid-cols-4 gap-2 pt-1">
              {stepResults.map((step, idx) => {
                const isActive = inputStep === idx;
                return (
                  <div
                    key={idx}
                    className={`h-12 rounded-2xl border flex items-center justify-center transition-all ${
                      step.answered
                        ? step.correct
                          ? "border-emerald-500 bg-emerald-500/20 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                          : "border-rose-500 bg-rose-500/20 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.3)]"
                        : isActive
                          ? "border-accent bg-accent/15 text-accent animate-pulse shadow-[0_0_15px_rgba(0,229,255,0.3)]"
                          : "border-white/10 bg-white/5 text-white/30"
                    }`}
                  >
                    {step.answered ? (
                      step.correct ? (
                        <CheckCircle2 size={20} />
                      ) : (
                        <XCircle size={20} />
                      )
                    ) : (
                      <span className="text-xs font-bold">{idx + 1}</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Step Feedback Banner */}
            {stepFeedback && (
              <div
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                  stepFeedback.correct
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                    : "border-rose-500/40 bg-rose-500/10 text-rose-300"
                }`}
              >
                {stepFeedback.correct
                  ? `Step ${stepFeedback.stepIndex + 1}: Correct! \u2728`
                  : `Step ${stepFeedback.stepIndex + 1}: Missed! Keep going... \ud83d\udca1`}
              </div>
            )}

            {/* Directional Input D-Pad */}
            <div className="mx-auto pt-2 pb-2 grid max-w-[210px] grid-cols-3 gap-2.5">
              <div />
              {/* UP - RED */}
              <button
                type="button"
                id="echo-btn-up"
                disabled={isSubmittingInput || inputStep >= 4}
                onClick={() => handleDirectionInput("up")}
                className={`flex aspect-square flex-col items-center justify-center rounded-2xl border transition-all active:scale-95 ${ECHO_MEMORY_MAPPING.up.borderClass} ${ECHO_MEMORY_MAPPING.up.bgClass} ${ECHO_MEMORY_MAPPING.up.textClass} ${ECHO_MEMORY_MAPPING.up.glowClass}`}
                aria-label="Input Up (Red)"
              >
                <ArrowUp size={28} />
                <span className="text-[10px] font-black uppercase mt-0.5">RED</span>
              </button>
              <div />

              {/* LEFT - BLUE */}
              <button
                type="button"
                id="echo-btn-left"
                disabled={isSubmittingInput || inputStep >= 4}
                onClick={() => handleDirectionInput("left")}
                className={`flex aspect-square flex-col items-center justify-center rounded-2xl border transition-all active:scale-95 ${ECHO_MEMORY_MAPPING.left.borderClass} ${ECHO_MEMORY_MAPPING.left.bgClass} ${ECHO_MEMORY_MAPPING.left.textClass} ${ECHO_MEMORY_MAPPING.left.glowClass}`}
                aria-label="Input Left (Blue)"
              >
                <ArrowLeft size={28} />
                <span className="text-[10px] font-black uppercase mt-0.5">BLUE</span>
              </button>

              {/* Center Guide / Indicator */}
              <div className="flex aspect-square items-center justify-center rounded-2xl border border-white/5 bg-black/30 text-white/30 text-xs font-black">
                {isSubmittingInput ? (
                  <RotateCcw size={16} className="animate-spin text-accent" />
                ) : (
                  <span>L1</span>
                )}
              </div>

              {/* RIGHT - YELLOW */}
              <button
                type="button"
                id="echo-btn-right"
                disabled={isSubmittingInput || inputStep >= 4}
                onClick={() => handleDirectionInput("right")}
                className={`flex aspect-square flex-col items-center justify-center rounded-2xl border transition-all active:scale-95 ${ECHO_MEMORY_MAPPING.right.borderClass} ${ECHO_MEMORY_MAPPING.right.bgClass} ${ECHO_MEMORY_MAPPING.right.textClass} ${ECHO_MEMORY_MAPPING.right.glowClass}`}
                aria-label="Input Right (Yellow)"
              >
                <ArrowRight size={28} />
                <span className="text-[10px] font-black uppercase mt-0.5">YEL</span>
              </button>

              <div />
              {/* DOWN - GREEN */}
              <button
                type="button"
                id="echo-btn-down"
                disabled={isSubmittingInput || inputStep >= 4}
                onClick={() => handleDirectionInput("down")}
                className={`flex aspect-square flex-col items-center justify-center rounded-2xl border transition-all active:scale-95 ${ECHO_MEMORY_MAPPING.down.borderClass} ${ECHO_MEMORY_MAPPING.down.bgClass} ${ECHO_MEMORY_MAPPING.down.textClass} ${ECHO_MEMORY_MAPPING.down.glowClass}`}
                aria-label="Input Down (Green)"
              >
                <ArrowDown size={28} />
                <span className="text-[10px] font-black uppercase mt-0.5">GRN</span>
              </button>
              <div />
            </div>

            <p className="text-[11px] text-white/40">
              Tap the color button matching each step. Mistakes will not stop the game!
            </p>
          </section>
        )}

        {/* Exit / Abort Button */}
        <button
          type="button"
          onClick={handleExit}
          className="flex w-full items-center justify-center rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3.5 text-sm font-bold text-rose-400 hover:bg-rose-500/20 transition-all"
        >
          Exit Challenge
        </button>
      </div>

      {/* Result Modal */}
      {currentResult && (
        <ResultModal
          isOpen={isModalOpen}
          level={1}
          score={currentResult.score}
          stars={currentResult.stars}
          bestScore={currentResult.score}
          hasNextLevel={false}
          isNextUnlocked={false}
          onReplay={handleReplay}
          onNextLevel={handleExit}
          onBackToLevels={handleExit}
        />
      )}
    </main>
  );
}
