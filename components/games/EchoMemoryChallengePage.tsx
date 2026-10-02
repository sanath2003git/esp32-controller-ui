"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
  Megaphone,
  BookOpen,
} from "lucide-react";
import SubPageHeader from "@/components/SubPageHeader";
import ResultModal from "@/components/ResultModal";
import { useBleContext } from "@/context/BleContext";
import { getGameDefinition } from "@/data/gameCatalog";
import {
  ECHO_MEMORY_MAPPING,
  calculateStars,
  getEchoColorVisual,
  getEchoLevelMeta,
  isLevelUnlocked,
} from "@/lib/echoMemory";
import {
  fetchAndSyncProgress,
  submitAndPersistLevelResult,
} from "@/lib/progressStore";
import type { LevelProgress } from "@/types/echoMemory";
import type {
  EchoMemoryAction,
  EchoMemoryGameState,
} from "@/types/echoMemory";
import type { GameFeedbackPayload, GameResultPayload, JoyStickDir } from "@/types/protocol";
import { useGameSession } from "@/games/useGameSession";

type StepResult = {
  answered: boolean;
  correct?: boolean;
  action?: EchoMemoryAction;
};

export default function EchoMemoryChallengePage() {
  const params = useParams<{ mode: string; level: string }>();
  const router = useRouter();
  const {
    status,
    sendJoystickInput,
    honk,
    runSeq,
    lastMessage,
    openModal,
  } = useBleContext();

  const game = getGameDefinition(params.mode ?? "echo-memory");
  const levelId = Number(params.level ?? "1");
  const levelMeta = getEchoLevelMeta(levelId);

  const [gameState, setGameState] = useState<EchoMemoryGameState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dynamicMapping, setDynamicMapping] = useState<Record<string, string> | null>(null);
  const [flashIndex, setFlashIndex] = useState<number>(0);
  const [waitTimer, setWaitTimer] = useState<number>(3);
  const [inputStep, setInputStep] = useState<number>(0);
  const [isSubmittingInput, setIsSubmittingInput] = useState<boolean>(false);
  const [stepResults, setStepResults] = useState<StepResult[]>(() =>
    Array.from({ length: levelMeta.sequenceLength }, () => ({ answered: false }))
  );
  const [stepFeedback, setStepFeedback] = useState<{
    correct: boolean;
    stepIndex: number;
  } | null>(null);

  const [currentResult, setCurrentResult] = useState<{
    score: number;
    stars: 0 | 1 | 2 | 3;
    bestScore: number;
    isNextUnlocked: boolean;
  } | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userProgressMap, setUserProgressMap] = useState<Record<number, LevelProgress>>({});
  const [isLoadingProgress, setIsLoadingProgress] = useState(true);

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
    return () => clearTimers();
  }, [clearTimers]);

  useEffect(() => {
    let isSubscribed = true;
    fetchAndSyncProgress("echo-memory")
      .then((data) => {
        if (isSubscribed && data.levels) {
          setUserProgressMap(data.levels as Record<number, LevelProgress>);
        }
      })
      .catch((err) => {
        console.warn("[ECHO MEMORY] Failed to fetch progress:", err);
      })
      .finally(() => {
        if (isSubscribed) {
          setIsLoadingProgress(false);
        }
      });

    return () => {
      isSubscribed = false;
    };
  }, []);

  const isUnlocked = isLevelUnlocked(levelId, userProgressMap);

  const handleGameResult = useCallback(
    async (resultPayload: GameResultPayload) => {
      clearTimers();
      setGameState("completed");
      const score = resultPayload.tasksTotal > 0
        ? resultPayload.tasksCompleted / resultPayload.tasksTotal
        : resultPayload.score > 1 ? resultPayload.score / 100 : resultPayload.score;
      const stars = resultPayload.stars ?? calculateStars(score);

      try {
        const persisted = await submitAndPersistLevelResult(
          "echo-memory",
          levelId,
          score,
          stars
        );
        setUserProgressMap(persisted.levels as Record<number, LevelProgress>);
        setCurrentResult({
          score,
          stars,
          bestScore: persisted.bestScore,
          isNextUnlocked: persisted.isNextUnlocked,
        });
      } catch (err) {
        console.warn("[ECHO MEMORY] Submit result error:", err);
        setCurrentResult({
          score,
          stars,
          bestScore: score,
          isNextUnlocked: stars === 3,
        });
      } finally {
        setIsModalOpen(true);
      }
    },
    [clearTimers, levelId]
  );

  const handleGameFeedback = useCallback((feedback: GameFeedbackPayload) => {
    const idx = feedback.taskId - 1;
    const isCorrect = feedback.correct;

    setStepResults((prev) => {
      const next = [...prev];
      if (next[idx]) {
        next[idx] = { ...next[idx], answered: true, correct: isCorrect };
      }
      return next;
    });

    setStepFeedback({ correct: isCorrect, stepIndex: idx });
    setInputStep(idx + 1);
    setIsSubmittingInput(false);
  }, []);

  const session = useGameSession({
    game: "echo_memory",
    level: levelId,
    onResult: handleGameResult,
    onFeedback: handleGameFeedback,
  });

  // Handle incoming protocol messages for phase transitions (mapping, flash, wait, input)
  useEffect(() => {
    if (!lastMessage || session.status === "idle") return;

    const msg = lastMessage as Record<string, unknown>;

    // Handle game_started mapping payload
    if (
      msg.type === "response" &&
      msg.response === "game_started" &&
      typeof msg.payload === "object" &&
      msg.payload !== null
    ) {
      const payload = msg.payload as Record<string, unknown>;
      setTimeout(() => {
        if (payload.mapping && typeof payload.mapping === "object") {
          setDynamicMapping(payload.mapping as Record<string, string>);
        }
        if (levelId === 6 || payload.mapping) {
          setGameState("mapping");
        } else {
          setGameState("flashing");
        }
      }, 0);
    }

    // Handle custom phase messages
    if (msg.type === "phase" && (msg.game === "echo-memory" || msg.game === "echo_memory")) {
      const phase = msg.phase as string;
      setTimeout(() => {
        if (phase === "mapping") {
          clearTimers();
          if (msg.mapping && typeof msg.mapping === "object") {
            setDynamicMapping(msg.mapping as Record<string, string>);
          }
          setGameState("mapping");
        } else if (phase === "flash") {
          clearTimers();
          setGameState("flashing");
          setFlashIndex(typeof msg.index === "number" ? msg.index : 0);
        } else if (phase === "wait") {
          clearTimers();
          setGameState("waiting");
          setWaitTimer(3);
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
        } else if (phase === "input") {
          clearTimers();
          setGameState("input");
          setInputStep(0);
          setIsSubmittingInput(false);
        }
      }, 0);
    }
  }, [lastMessage, session.status, clearTimers, levelId]);

  // Handle start level
  const handleStartLevel = async () => {
    if (session.status === "starting" || session.status === "playing") return;
    if (status !== "connected") {
      setErrorMessage("Robot is not connected over BLE. Please connect your device.");
      openModal();
      return;
    }
    if (!isUnlocked) {
      session.setError("This level is locked. Complete the previous level with 3 stars to unlock!");
      return;
    }

    setErrorMessage(null);
    setDynamicMapping(null);
    setStepResults(
      Array.from({ length: levelMeta.sequenceLength }, () => ({ answered: false }))
    );
    setStepFeedback(null);
    setInputStep(0);
    setFlashIndex(0);
    session.reset();
    setGameState("starting");

    await session.start();

    // If level 1-5, transition automatically to mapping/flashing if firmware fast-tracks
    if (levelId < 6) {
      setTimeout(() => {
        setGameState((current) => (current === "starting" ? "mapping" : current));
      }, 500);
    }
  };

  // Handle GO button on mapping phase -> triggers run_seq and immediately transitions to input phase
  const handleRunSeq = async () => {
    try {
      setGameState("input");
      setInputStep(0);
      setIsSubmittingInput(false);
      setStepFeedback(null);
      await runSeq("echo_memory", levelId);
    } catch (err) {
      console.warn("[ECHO MEMORY] runSeq error:", err);
      setErrorMessage("Failed to send run_seq command to robot.");
    }
  };

  // Handle direction or action input
  const handleActionInput = async (action: EchoMemoryAction) => {
    if (gameState !== "input" && session.status !== "playing") return;
    if (isSubmittingInput || inputStep >= levelMeta.sequenceLength) return;

    if (status !== "connected") {
      setErrorMessage("Robot disconnected. Please reconnect.");
      openModal();
      return;
    }

    try {
      setIsSubmittingInput(true);
      setStepFeedback(null);

      if (action === "honk") {
        await honk();
      } else if (action === "pet") {
        // Pet action is performed physically on robotoy (touch sensor), no BLE command sent from mobile
      } else {
        await sendJoystickInput(action as JoyStickDir, 1.0);
      }

      // Record prediction step
      setStepResults((prev) => {
        const next = [...prev];
        if (next[inputStep]) {
          next[inputStep] = { ...next[inputStep], action };
        }
        return next;
      });

      if (inputWatchdogRef.current) clearTimeout(inputWatchdogRef.current);
      inputWatchdogRef.current = setTimeout(() => {
        setIsSubmittingInput(false);
      }, 1500);
    } catch (err) {
      console.warn("[ECHO MEMORY] Input send failed:", err);
      setIsSubmittingInput(false);
    }
  };

  const handleExit = () => {
    clearTimers();
    void session.abort().catch((e) => console.error("[ABORT ERROR]", e));
    router.push(`/playground/${params.mode}/challenges`);
  };

  const handleReplay = () => {
    setIsModalOpen(false);
    setCurrentResult(null);
    session.reset();
    setGameState("idle");
    handleStartLevel();
  };

  const handleNextLevel = () => {
    setIsModalOpen(false);
    setCurrentResult(null);
    session.reset();
    setGameState("idle");
    router.push(`/playground/${params.mode}/challenges/${levelId + 1}`);
  };

  if (!levelMeta || levelId > 6) {
    return (
      <main className="min-h-screen">
        <SubPageHeader
          title="Unknown level"
          backHref={`/playground/${params.mode}/challenges`}
        />
        <div className="mx-auto min-h-screen max-w-md px-4 pb-10 pt-24">
          <div className="flex flex-col items-center rounded-3xl border border-border bg-surface p-6 text-center shadow-xl">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-accent/30 bg-accent/15 text-accent mb-4">
              <Sparkles size={32} />
            </div>
            <h3 className="text-xl font-extrabold text-white">Level Not Implemented</h3>
            <p className="mt-2 text-sm text-white/50">Levels 1 to 6 are supported for Echo Memory.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-16">
      <SubPageHeader
        title={`${game?.title ?? "Echo Memory"} \u00b7 Level ${levelMeta.id}`}
        subtitle={`${levelMeta.difficulty} \u00b7 ${levelMeta.sequenceLength}-step sequence`}
        backHref={`/playground/${params.mode}/challenges`}
      />

      <div className="mx-auto min-h-screen max-w-md px-4 pb-10 pt-24 space-y-5">
        {/* Header & Mode Overview */}
        <section className="rounded-3xl border border-white/10 bg-surface p-5 shadow-xl flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-accent/20 text-accent mb-3 shadow-inner shadow-accent/20">
            <BrainCircuit size={32} />
          </div>

          <h1 className="text-2xl font-black tracking-tight text-white">
            Echo Memory
          </h1>

          <div className="mt-3 flex items-center justify-between w-full border-t border-white/10 pt-3">
            <span className="rounded-full border border-accent/30 bg-accent/10 px-3 py-0.5 text-xs font-bold text-accent">
              Level {levelMeta.id} · {levelMeta.difficulty}
            </span>
            <span className="text-xs font-medium text-white/50">
              {levelMeta.sequenceLength} Steps · {levelMeta.flashDuration} Flash
            </span>
          </div>
        </section>

        {/* Colour-to-Action Mapping Legend */}
        <section className="rounded-3xl border border-white/10 bg-surface p-5 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-white/40">
              {levelId === 6
                ? "Dynamic Color-to-Action Mapping"
                : levelId >= 4
                  ? "Fixed Color-to-Action Mapping"
                  : "Fixed Color Mapping"}
            </span>
            <span className="text-[11px] text-accent font-semibold">
              {levelId === 6
                ? dynamicMapping
                  ? "Study mapping below!"
                  : "Generated on start"
                : levelId >= 4
                  ? "6 Actions"
                  : "4 Directions"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {levelId === 6 ? (
              // Level 6 Dynamic Mapping
              (
                [
                  { action: "up" as EchoMemoryAction, label: "UP" },
                  { action: "down" as EchoMemoryAction, label: "DOWN" },
                  { action: "left" as EchoMemoryAction, label: "LEFT" },
                  { action: "right" as EchoMemoryAction, label: "RIGHT" },
                  { action: "pet" as EchoMemoryAction, label: "PET", sub: "(Touch)" },
                  { action: "honk" as EchoMemoryAction, label: "HONK", sub: "(Center)" },
                ]
              ).map((item) => {
                const colorKey = dynamicMapping?.[item.action];
                const visual = colorKey ? getEchoColorVisual(colorKey) : null;
                return (
                  <div
                    key={item.action}
                    className={`flex items-center gap-3 rounded-2xl border p-3 ${
                      visual ? visual.borderClass : "border-white/10"
                    } bg-black/20`}
                  >
                    <div
                      className="h-4 w-4 rounded-full shadow-[0_0_10px_currentColor] shrink-0"
                      style={{
                        backgroundColor: visual ? visual.hex : "#555",
                        color: visual ? visual.hex : "#555",
                      }}
                    />
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-black uppercase text-white flex items-center gap-1">
                        {item.label}
                        {item.sub && (
                          <span className="text-[9px] font-normal text-white/60">
                            {item.sub}
                          </span>
                        )}
                      </span>
                      <span
                        className={`text-[11px] font-semibold ${
                          visual ? visual.textClass : "text-white/40"
                        }`}
                      >
                        {visual ? visual.color : "Pending start..."}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              // Levels 1-5 Fixed Mapping
              (levelId >= 4
                ? [
                    ECHO_MEMORY_MAPPING.up,
                    ECHO_MEMORY_MAPPING.down,
                    ECHO_MEMORY_MAPPING.left,
                    ECHO_MEMORY_MAPPING.right,
                    ECHO_MEMORY_MAPPING.pet,
                    ECHO_MEMORY_MAPPING.honk,
                  ]
                : [
                    ECHO_MEMORY_MAPPING.up,
                    ECHO_MEMORY_MAPPING.down,
                    ECHO_MEMORY_MAPPING.left,
                    ECHO_MEMORY_MAPPING.right,
                  ]
              ).map((item) => (
                <div
                  key={item.action}
                  className={`flex items-center gap-3 rounded-2xl border p-3 ${item.borderClass} bg-black/20`}
                >
                  <div
                    className="h-4 w-4 rounded-full shadow-[0_0_10px_currentColor] shrink-0"
                    style={{ backgroundColor: item.hex, color: item.hex }}
                  />
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-black uppercase text-white flex items-center gap-1">
                      {item.label}
                      {item.action === "pet" && (
                        <span className="text-[9px] font-normal text-purple-300 opacity-80">(Touch)</span>
                      )}
                      {item.action === "honk" && (
                        <span className="text-[9px] font-normal text-white opacity-80">(Center)</span>
                      )}
                    </span>
                    <span className={`text-[11px] font-semibold ${item.textClass}`}>
                      {item.color}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Lock warning */}
        {!isLoadingProgress && !isUnlocked && (
          <section className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-300 flex items-start gap-3">
            <AlertCircle size={20} className="shrink-0 mt-0.5" />
            <div className="text-xs leading-5">
              <span className="font-bold block">Level Locked</span>
              You need 3 stars on Level {levelId - 1} to unlock this challenge.
            </div>
          </section>
        )}

        {/* Error notification */}
        {(session.error || errorMessage) && (
          <section className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-300 flex items-start gap-3">
            <AlertCircle size={20} className="shrink-0 mt-0.5" />
            <div className="text-xs leading-5 flex-1">
              <span className="font-bold block">Error</span>
              {session.error || errorMessage}
            </div>
          </section>
        )}

        {/* Start / Status Controls */}
        {session.status === "idle" && (
          <section className="rounded-3xl border border-white/10 bg-surface p-6 text-center space-y-4 shadow-xl">
            <div className="flex flex-col items-center">
              <span className="text-lg font-bold text-white">Ready to begin?</span>
              <p className="mt-1 text-xs leading-5 text-white/60">
                {levelId === 6 ? (
                  <>
                    1. Study the randomly generated color-to-action mapping.<br />
                    2. Press &quot;GO&quot; to flash the 5-step sequence across the full strip.<br />
                    3. Wait 3 seconds, then echo the actions!
                  </>
                ) : (
                  <>
                    1. Watch your robot flash {levelMeta.sequenceLength} {levelId >= 4 ? "colors across the full strip" : "regional lights"}.<br />
                    2. Wait 3 seconds for the signal.<br />
                    3. Echo the sequence using your controller or robot sensors!
                  </>
                )}
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
                disabled={!isUnlocked}
                onClick={handleStartLevel}
                className={`flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-4 text-base font-bold transition-all ${
                  isUnlocked
                    ? "bg-accent text-black hover:bg-accent/90 active:scale-[0.98] shadow-lg shadow-accent/20"
                    : "bg-white/10 text-white/30 cursor-not-allowed"
                }`}
              >
                <Play size={20} fill="currentColor" /> Start Level {levelMeta.id} Challenge
              </button>
            )}
          </section>
        )}

        {session.status === "starting" && gameState !== "mapping" && (
          <section className="rounded-3xl border border-accent/30 bg-accent/10 p-6 text-center shadow-xl animate-pulse">
            <div className="flex items-center justify-center gap-3 text-accent font-bold text-sm">
              <RotateCcw size={18} className="animate-spin" />
              Starting challenge on robot...
            </div>
          </section>
        )}

        {/* Phase 0: Mapping Phase & GO Button */}
        {gameState === "mapping" && (
          <section className="rounded-3xl border border-accent/40 bg-surface-light p-6 text-center shadow-2xl space-y-4">
            <div className="flex items-center justify-center gap-2 text-xs font-bold text-accent uppercase tracking-widest">
              <BookOpen size={18} className="animate-pulse" />
              Phase 0: Study Color-Action Mapping
            </div>

            <p className="text-xs text-white/70 max-w-xs mx-auto leading-relaxed">
              {levelId === 6
                ? "Memorize the dynamic color assignments above. When you are ready, press GO to flash the sequence on your robot!"
                : "Review the mapping above. Press GO to begin the light sequence!"}
            </p>

            <button
              type="button"
              onClick={handleRunSeq}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-4 text-base font-black text-black transition-all hover:bg-emerald-300 active:scale-[0.98] shadow-lg shadow-emerald-400/20"
            >
              <Play size={22} fill="currentColor" /> GO — Start Sequence
            </button>
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
                Flashing step {flashIndex + 1} of {levelMeta.sequenceLength}
              </span>
            </div>

            <p className="text-xs text-white/70 max-w-xs mx-auto leading-relaxed">
              {levelId >= 4
                ? "Watch the full NeoPixel strip colours closely. Remember the sequence order!"
                : "Watch the regional LEDs light up. Remember each direction in order!"}
            </p>
          </section>
        )}

        {/* Phase 2: Wait Phase (3 Seconds) */}
        {gameState === "waiting" && (
          <section className="rounded-3xl border border-warning/40 bg-surface-light p-6 text-center shadow-2xl space-y-4">
            <div className="flex items-center justify-center gap-2 text-xs font-bold text-warning uppercase tracking-widest">
              <Clock size={18} className="animate-spin" />
              Phase 2: Prepare Your Answer
            </div>

            <div className="my-3 flex flex-col items-center">
              <div className="h-20 w-20 rounded-full border-2 border-warning bg-warning/10 flex items-center justify-center text-warning text-4xl font-black animate-bounce shadow-[0_0_30px_rgba(255,200,87,0.4)]">
                {waitTimer}s
              </div>
              <span className="mt-3 text-xs text-white/50 font-semibold uppercase tracking-wider">
                LEDs off · Pause for 3 seconds
              </span>
            </div>

            <p className="text-xs text-white/70 max-w-xs mx-auto leading-relaxed">
              Input controls will open in {waitTimer} seconds. Recall the sequence!
            </p>
          </section>
        )}

        {/* Phase 3: Input Phase */}
        {(gameState === "input" || (session.status === "playing" && gameState !== "flashing" && gameState !== "waiting" && gameState !== "mapping")) && (
          <section className="rounded-3xl border border-emerald-500/40 bg-surface-light p-5 text-center shadow-2xl space-y-4">
            <div className="flex items-center justify-between text-xs text-white/60">
              <span className="font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={16} /> Phase 3: Echo Sequence
              </span>
              <span className="font-semibold text-white/80">
                Step {Math.min(inputStep + 1, levelMeta.sequenceLength)} / {levelMeta.sequenceLength}
              </span>
            </div>

            {/* Step Tracker */}
            <div
              className={`grid gap-2 pt-1 ${
                levelMeta.sequenceLength === 7
                  ? "grid-cols-7"
                  : levelMeta.sequenceLength === 6
                    ? "grid-cols-6"
                    : levelMeta.sequenceLength === 5
                      ? "grid-cols-5"
                      : "grid-cols-4"
              }`}
            >
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
                  ? `Step ${stepFeedback.stepIndex + 1}: Correct! ✨`
                  : `Step ${stepFeedback.stepIndex + 1}: Incorrect 💡`}
              </div>
            )}

            {/* Directional Input Grid & Action Buttons */}
            {(() => {
              const isDynamic = levelId === 6 && Boolean(dynamicMapping);
              const upVisual = isDynamic
                ? getEchoColorVisual(dynamicMapping?.up)
                : getEchoColorVisual("red");
              const rightVisual = isDynamic
                ? getEchoColorVisual(dynamicMapping?.right)
                : getEchoColorVisual("yellow");
              const downVisual = isDynamic
                ? getEchoColorVisual(dynamicMapping?.down)
                : getEchoColorVisual("green");
              const leftVisual = isDynamic
                ? getEchoColorVisual(dynamicMapping?.left)
                : getEchoColorVisual("blue");
              const honkVisual = isDynamic
                ? getEchoColorVisual(dynamicMapping?.honk)
                : getEchoColorVisual("white");

              return (
                <div className="flex flex-col items-center gap-3">
                  <div className="mx-auto mt-2 grid max-w-[220px] grid-cols-3 gap-2.5">
                    <div />
                    <button
                      type="button"
                      onClick={() => handleActionInput("up")}
                      disabled={isSubmittingInput || inputStep >= levelMeta.sequenceLength}
                      className={`flex aspect-square flex-col items-center justify-center rounded-2xl border p-1 ${upVisual.borderClass} ${upVisual.bgClass} ${upVisual.textClass} hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed`}
                      aria-label={`UP (${upVisual.color})`}
                    >
                      <ArrowUp size={28} />
                      <span className="text-[10px] font-black">{isDynamic ? upVisual.badgeText : "UP"}</span>
                    </button>
                    <div />

                    <button
                      type="button"
                      onClick={() => handleActionInput("left")}
                      disabled={isSubmittingInput || inputStep >= levelMeta.sequenceLength}
                      className={`flex aspect-square flex-col items-center justify-center rounded-2xl border p-1 ${leftVisual.borderClass} ${leftVisual.bgClass} ${leftVisual.textClass} hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed`}
                      aria-label={`LEFT (${leftVisual.color})`}
                    >
                      <ArrowLeft size={28} />
                      <span className="text-[10px] font-black">{isDynamic ? leftVisual.badgeText : "LEFT"}</span>
                    </button>

                    {levelId >= 4 ? (
                      <button
                        type="button"
                        onClick={() => handleActionInput("honk")}
                        disabled={isSubmittingInput || inputStep >= levelMeta.sequenceLength}
                        className={`flex aspect-square flex-col items-center justify-center rounded-2xl border p-1 ${honkVisual.borderClass} ${honkVisual.bgClass} ${honkVisual.textClass} hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed`}
                        aria-label={`HONK (${honkVisual.color})`}
                      >
                        <Megaphone size={24} />
                        <span className="text-[9px] font-black">{isDynamic ? honkVisual.badgeText : "HONK"}</span>
                      </button>
                    ) : (
                      <div className="flex aspect-square items-center justify-center rounded-2xl border border-white/5 bg-white/5 text-white/20 text-xs font-semibold">
                        Echo
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => handleActionInput("right")}
                      disabled={isSubmittingInput || inputStep >= levelMeta.sequenceLength}
                      className={`flex aspect-square flex-col items-center justify-center rounded-2xl border p-1 ${rightVisual.borderClass} ${rightVisual.bgClass} ${rightVisual.textClass} hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed`}
                      aria-label={`RIGHT (${rightVisual.color})`}
                    >
                      <ArrowRight size={28} />
                      <span className="text-[10px] font-black">{isDynamic ? rightVisual.badgeText : "RIGHT"}</span>
                    </button>

                    <div />
                    <button
                      type="button"
                      onClick={() => handleActionInput("down")}
                      disabled={isSubmittingInput || inputStep >= levelMeta.sequenceLength}
                      className={`flex aspect-square flex-col items-center justify-center rounded-2xl border p-1 ${downVisual.borderClass} ${downVisual.bgClass} ${downVisual.textClass} hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed`}
                      aria-label={`DOWN (${downVisual.color})`}
                    >
                      <ArrowDown size={28} />
                      <span className="text-[10px] font-black">{isDynamic ? downVisual.badgeText : "DOWN"}</span>
                    </button>
                    <div />
                  </div>

                  {levelId >= 4 && (
                    <div className="flex w-full items-center justify-between rounded-2xl border border-purple-500/40 bg-purple-500/10 py-3.5 px-4 text-xs font-bold text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                      <span className="flex items-center gap-2">
                        <Sparkles size={18} /> Pet Action ({isDynamic ? getEchoColorVisual(dynamicMapping?.pet).color : "Purple"})
                      </span>
                      <span className="text-[10px] uppercase font-bold tracking-wider rounded-lg bg-purple-500/20 px-2 py-1 text-purple-200 border border-purple-500/30">
                        Touch Physical Robot
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}

            <p className="text-[11px] text-white/40">
              {levelId >= 4
                ? "Tap D-pad arrow or HONK center button. For PET action, touch the physical robot."
                : "Tap the arrow matching each sequence step. Each input will be evaluated."}
            </p>
          </section>
        )}

        {/* Exit Button */}
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
          level={levelId}
          score={currentResult.score}
          stars={currentResult.stars}
          bestScore={currentResult.score}
          hasNextLevel={levelId < 6}
          isNextUnlocked={levelId < 6 && currentResult.stars >= 3}
          onReplay={handleReplay}
          onNextLevel={handleNextLevel}
          onBackToLevels={handleExit}
        />
      )}
    </main>
  );
}