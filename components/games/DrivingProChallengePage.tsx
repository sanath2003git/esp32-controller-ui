"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Car,
  ShieldAlert,
  Clock,
  ArrowLeft,
  ArrowRight,
  Play,
  Sparkles,
  RotateCcw,
  Bluetooth,
  AlertCircle,
  TriangleAlert,
  ShieldCheck,
} from "lucide-react";
import SubPageHeader from "@/components/SubPageHeader";
import ResultModal from "@/components/ResultModal";
import ControlPanel from "@/components/ControlPanel";
import { useBleContext } from "@/context/BleContext";
import { getGameDefinition } from "@/data/gameCatalog";
import {
  calculateStars,
  getTaskMeta,
  isLevelUnlocked,
} from "@/lib/drivingPro";
import {
  fetchAndSyncProgress,
  submitAndPersistLevelResult,
} from "@/lib/progressStore";
import type { DrivingProGameState, LevelProgress } from "@/types/drivingPro";
import type { GameResultPayload } from "@/types/protocol";
import { useGameSession } from "@/games/useGameSession";

export default function DrivingProChallengePage() {
  const params = useParams<{ mode: string; level: string }>();
  const router = useRouter();
  const {
    status: bleStatus,
    sendJoystickInput,
    startTask,
    abortGame,
    lastMessage,
    telemetry,
    openModal,
  } = useBleContext();

  const game = getGameDefinition(params.mode ?? "driving-pro");
  const levelId = Number(params.level ?? "1");

  const [gameState, setGameState] = useState<DrivingProGameState>("idle");
  const [currentTaskId, setCurrentTaskId] = useState<number>(1);
  const [taskTimer, setTaskTimer] = useState<number>(7);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Turn counters for live UI display during tasks
  const [leftTurnsCount, setLeftTurnsCount] = useState<number>(0);
  const [rightTurnsCount, setRightTurnsCount] = useState<number>(0);
  const [totalTurnsCount, setTotalTurnsCount] = useState<number>(0);
  const lastTurnDirRef = useRef<"left" | "right" | "none">("none");

  // Game over state
  const [gameOverReason, setGameOverReason] = useState<string | null>(null);
  const [tasksCompletedCount, setTasksCompletedCount] = useState<number>(0);

  // Result state
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

  const clearTimers = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  // Load progress
  useEffect(() => {
    let isSubscribed = true;
    fetchAndSyncProgress("driving-pro")
      .then((data) => {
        if (isSubscribed && data.levels) {
          setUserProgressMap(data.levels as Record<number, LevelProgress>);
        }
      })
      .catch((err) => {
        console.warn("[DRIVING PRO] Failed to fetch progress:", err);
      })
      .finally(() => {
        if (isSubscribed) setIsLoadingProgress(false);
      });

    return () => {
      isSubscribed = false;
    };
  }, []);

  const unlocked = isLevelUnlocked(levelId, userProgressMap);

  const handleGameResult = useCallback(
    async (resultPayload: GameResultPayload) => {
      clearTimers();
      setGameState("RESULT");
      const score = resultPayload.tasksTotal > 0
        ? resultPayload.tasksCompleted / resultPayload.tasksTotal
        : resultPayload.score > 1 ? resultPayload.score / 100 : resultPayload.score;
      const stars = (resultPayload.stars ?? calculateStars(score)) as 0 | 1 | 2 | 3;

      try {
        const persisted = await submitAndPersistLevelResult(
          "driving-pro",
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
        console.warn("[DRIVING PRO] Submit result error:", err);
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

  const session = useGameSession({
    game: "driving_pro",
    level: levelId,
    onResult: handleGameResult,
  });

  // Listen to incoming protocol messages for game_started, task_started, task_result, game_over
  useEffect(() => {
    if (!lastMessage) return;

    const msg = lastMessage as Record<string, unknown>;

    // 1. game_started -> TASK_INSTRUCTIONS for Task 1
    if (
      msg.type === "response" &&
      msg.response === "game_started" &&
      typeof msg.payload === "object" &&
      msg.payload !== null
    ) {
      setTimeout(() => {
        setCurrentTaskId(1);
        setTasksCompletedCount(0);
        setGameState("TASK_INSTRUCTIONS");
      }, 0);
    }

    // 2. task_started -> TASK_RUNNING
    if (
      msg.type === "response" &&
      msg.response === "task_started" &&
      typeof msg.payload === "object" &&
      msg.payload !== null
    ) {
      const payload = msg.payload as Record<string, unknown>;
      const taskId = typeof payload.taskId === "number" ? payload.taskId : currentTaskId;
      const durationMs = typeof payload.durationMs === "number" ? payload.durationMs : 7000;
      const durationSec = Math.ceil(durationMs / 1000);

      setTimeout(() => {
        setCurrentTaskId(taskId);
        setTaskTimer(durationSec);
        setLeftTurnsCount(0);
        setRightTurnsCount(0);
        setTotalTurnsCount(0);
        lastTurnDirRef.current = "none";
        setGameState("TASK_RUNNING");

        clearTimers();
        const startTime = Date.now();
        countdownIntervalRef.current = setInterval(() => {
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          const remaining = Math.max(0, durationSec - elapsed);
          setTaskTimer(remaining);
          if (remaining <= 0 && countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
        }, 200);
      }, 0);
    }

    // 3. task_result -> task pass or fail evaluation
    if (msg.type === "response" && msg.response === "task_result") {
      const payload = (typeof msg.payload === "object" && msg.payload !== null
        ? msg.payload
        : msg) as Record<string, unknown>;
      const statusStr = String(payload.status || "passed");
      const taskId = typeof msg.taskId === "number" ? msg.taskId : currentTaskId;

      setTimeout(() => {
        clearTimers();
        if (statusStr === "passed") {
          setTasksCompletedCount(taskId);
          if (taskId < 3) {
            setCurrentTaskId(taskId + 1);
            setGameState("TASK_INSTRUCTIONS");
          } else {
            // Level 1 Completed!
            setGameState("LEVEL_COMPLETE");
          }
        } else {
          setGameOverReason("Task Target Not Met");
          setGameState("GAME_OVER");
        }
      }, 0);
    }

    // 4. game_over -> collision or failure
    if (msg.type === "response" && msg.response === "game_over") {
      const reason = String(msg.reason || "collision");
      const payload = (typeof msg.payload === "object" && msg.payload !== null
        ? msg.payload
        : {}) as Record<string, unknown>;
      const completed = typeof payload.tasksCompleted === "number" ? payload.tasksCompleted : tasksCompletedCount;

      setTimeout(() => {
        clearTimers();
        setTasksCompletedCount(completed);
        setGameOverReason(reason === "collision" ? "Collision Detected!" : "Task Failed");
        setGameState("GAME_OVER");
      }, 0);
    }
  }, [lastMessage, clearTimers, currentTaskId, tasksCompletedCount]);

  // Handle Level Start
  const handleStartLevel = async () => {
    if (session.status === "starting" || session.status === "playing") return;
    if (bleStatus !== "connected") {
      setErrorMessage("Robot is not connected over BLE. Please connect your device.");
      openModal();
      return;
    }
    if (!unlocked) {
      session.setError("This level is locked. Complete previous levels to unlock!");
      return;
    }

    setErrorMessage(null);
    setGameOverReason(null);
    setTasksCompletedCount(0);
    setCurrentTaskId(1);
    session.reset();
    setGameState("starting");

    await session.start();
  };

  // Handle GO Button -> Task Start Command
  const handleStartTask = async (taskId: number) => {
    if (bleStatus !== "connected") {
      setErrorMessage("Robot disconnected. Please reconnect.");
      openModal();
      return;
    }

    try {
      setErrorMessage(null);
      await startTask("driving_pro", levelId, taskId);

      // Local UI fallback if task_started response is instantaneous
      const taskMeta = getTaskMeta(taskId);
      const durationSec = taskMeta?.durationSec ?? 7;
      setTaskTimer(durationSec);
      setLeftTurnsCount(0);
      setRightTurnsCount(0);
      setTotalTurnsCount(0);
      lastTurnDirRef.current = "none";
      setGameState("TASK_RUNNING");

      clearTimers();
      const startTime = Date.now();
      countdownIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const remaining = Math.max(0, durationSec - elapsed);
        setTaskTimer(remaining);
        if (remaining <= 0 && countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
      }, 200);
    } catch (err) {
      console.warn("[DRIVING PRO] task_start error:", err);
      setErrorMessage("Failed to send task_start command to robot.");
    }
  };

  // Handle Steering Inputs (Left / Right steering only, Up/Down ignored, None on release)
  const handleSteer = async (dir: "left" | "right" | "none") => {
    if (gameState !== "TASK_RUNNING") return;

    if (dir === "left") {
      if (lastTurnDirRef.current !== "left") {
        setLeftTurnsCount((prev) => prev + 1);
        setTotalTurnsCount((prev) => prev + 1);
        lastTurnDirRef.current = "left";
      }
      await sendJoystickInput("left", 1.0);
    } else if (dir === "right") {
      if (lastTurnDirRef.current !== "right") {
        setRightTurnsCount((prev) => prev + 1);
        setTotalTurnsCount((prev) => prev + 1);
        lastTurnDirRef.current = "right";
      }
      await sendJoystickInput("right", 1.0);
    } else {
      lastTurnDirRef.current = "none";
      await sendJoystickInput("none", 0.0);
    }
  };

  const handleExit = () => {
    clearTimers();
    void abortGame().catch((e) => console.error("[ABORT ERROR]", e));
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

  const currentTaskMeta = getTaskMeta(currentTaskId);
  const isObstacleDetected = Boolean(
    telemetry?.obstacle?.frontLeft ||
      telemetry?.obstacle?.frontRight ||
      telemetry?.obstacle?.rearLeft ||
      telemetry?.obstacle?.rearRight ||
      (telemetry?.distance?.front !== null && (telemetry?.distance?.front ?? 100) < 15)
  );

  return (
    <main className="min-h-screen pb-16 select-none">
      <SubPageHeader
        title={`${game?.title ?? "Driving Pro"} \u00b7 Level ${levelId}`}
        subtitle="Continuous Drive · Collision Avoidance & Precision Steering"
        backHref={`/playground/${params.mode}/challenges`}
      />

      <div className="mx-auto min-h-screen max-w-md px-4 pb-10 pt-24 space-y-5">
        {/* Header Overview Card */}
        <section className="rounded-3xl border border-white/10 bg-surface p-5 shadow-xl flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/20 text-primary mb-3 shadow-inner shadow-primary/20">
            <Car size={34} />
          </div>

          <h1 className="text-2xl font-black tracking-tight text-white">
            Driving Pro
          </h1>

          <p className="mt-1 text-xs text-white/60 leading-relaxed max-w-xs">
            Auto forward drive · Steer left/right to avoid collisions and complete maneuvers!
          </p>

          <div className="mt-4 flex items-center justify-between w-full border-t border-white/10 pt-3">
            <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-0.5 text-xs font-bold text-primary">
              Level {levelId} · Easy
            </span>
            <span className="text-xs font-semibold text-white/50">
              3 Sequential Tasks
            </span>
          </div>
        </section>

        {/* Lock warning if locked */}
        {!isLoadingProgress && !unlocked && (
          <section className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-300 flex items-start gap-3">
            <AlertCircle size={20} className="shrink-0 mt-0.5" />
            <div className="text-xs leading-5">
              <span className="font-bold block">Level Locked</span>
              You need 3 stars on the previous level to unlock this challenge.
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
              <span className="text-lg font-bold text-white">Ready for Driver Training?</span>
              <p className="mt-1 text-xs leading-5 text-white/60">
                1. Complete Task 1: Drive 7s without collision.<br />
                2. Complete Task 2: Drive 7s & take $\ge 4$ turns.<br />
                3. Complete Task 3: Drive 9s with $\ge 2$ left & $\ge 3$ right turns!
              </p>
            </div>

            {bleStatus !== "connected" ? (
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
                disabled={!unlocked}
                onClick={handleStartLevel}
                className={`flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-4 text-base font-bold transition-all ${
                  unlocked
                    ? "bg-primary text-white hover:bg-primary/90 active:scale-[0.98] shadow-lg shadow-primary/20"
                    : "bg-white/10 text-white/30 cursor-not-allowed"
                }`}
              >
                <Play size={20} fill="currentColor" /> Start Level {levelId} Challenge
              </button>
            )}
          </section>
        )}

        {session.status === "starting" && gameState !== "TASK_INSTRUCTIONS" && (
          <section className="rounded-3xl border border-primary/30 bg-primary/10 p-6 text-center shadow-xl animate-pulse">
            <div className="flex items-center justify-center gap-3 text-primary font-bold text-sm">
              <RotateCcw size={18} className="animate-spin" />
              Initializing driving mode on robot...
            </div>
          </section>
        )}

        {/* TASK INSTRUCTIONS CARD */}
        {gameState === "TASK_INSTRUCTIONS" && currentTaskMeta && (
          <section className="rounded-3xl border border-primary/40 bg-surface-light p-6 text-center shadow-2xl space-y-4">
            <div className="flex items-center justify-center gap-2 text-xs font-bold text-primary uppercase tracking-widest">
              <Sparkles size={18} className="animate-pulse" />
              Task {currentTaskMeta.id} of 3 Instructions
            </div>

            <div className="my-2 p-4 rounded-2xl border border-white/10 bg-black/30 text-left space-y-2">
              <h3 className="text-base font-black text-white">{currentTaskMeta.title}</h3>
              <p className="text-xs text-white/70 leading-relaxed">{currentTaskMeta.description}</p>
              
              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
                <span className="text-white/50 font-semibold flex items-center gap-1">
                  <Clock size={14} /> Duration:
                </span>
                <span className="font-bold text-primary">{currentTaskMeta.durationSec} Seconds</span>
              </div>
            </div>

            <p className="text-[11px] text-white/50 max-w-xs mx-auto leading-relaxed">
              Press <strong>GO</strong> to start driving! Robot moves forward continuously; steer Left/Right to avoid obstacles.
            </p>

            <button
              type="button"
              onClick={() => handleStartTask(currentTaskMeta.id)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-4 text-base font-black text-black transition-all hover:bg-emerald-300 active:scale-[0.98] shadow-lg shadow-emerald-400/20"
            >
              <Play size={22} fill="currentColor" /> GO — Start Task {currentTaskMeta.id}
            </button>
          </section>
        )}

        {/* ACTIVE TASK RUNNING DASHBOARD */}
        {gameState === "TASK_RUNNING" && currentTaskMeta && (
          <section className="rounded-3xl border border-primary/40 bg-surface-light p-5 text-center shadow-2xl space-y-4">
            {/* Task Header & Timer Banner */}
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                <Car size={16} /> Task {currentTaskMeta.id} / 3 Active
              </span>
              <span className="font-extrabold text-amber-300 flex items-center gap-1">
                <Clock size={14} className="animate-spin" /> {taskTimer}s Remaining
              </span>
            </div>

            {/* Task Requirements & Maneuver Tracker */}
            <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-left space-y-2">
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest block">
                Task Objective
              </span>
              <p className="text-xs font-bold text-white leading-snug">
                {currentTaskMeta.requirementsText}
              </p>

              {/* Progress Counters per Task */}
              <div className="pt-2 border-t border-white/10 grid grid-cols-2 gap-2 text-xs">
                {currentTaskId === 1 && (
                  <div className="col-span-2 flex items-center justify-between rounded-xl bg-white/5 p-2">
                    <span className="text-white/60">Collision Status:</span>
                    <span className={`font-bold flex items-center gap-1 ${isObstacleDetected ? "text-rose-400 animate-pulse" : "text-emerald-400"}`}>
                      {isObstacleDetected ? <TriangleAlert size={14} /> : <ShieldCheck size={14} />}
                      {isObstacleDetected ? "DANGER / OBSTACLE" : "CLEAR"}
                    </span>
                  </div>
                )}

                {currentTaskId === 2 && (
                  <div className="col-span-2 flex items-center justify-between rounded-xl bg-white/5 p-2">
                    <span className="text-white/60">Turns Executed:</span>
                    <span className="font-black text-emerald-400 text-sm">
                      {totalTurnsCount} / {currentTaskMeta.minTurns ?? 4} Required
                    </span>
                  </div>
                )}

                {currentTaskId === 3 && (
                  <>
                    <div className="flex items-center justify-between rounded-xl bg-white/5 p-2">
                      <span className="text-white/60">Left Turns:</span>
                      <span className="font-bold text-emerald-400">
                        {leftTurnsCount} / {currentTaskMeta.minLeftTurns ?? 2}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-white/5 p-2">
                      <span className="text-white/60">Right Turns:</span>
                      <span className="font-bold text-emerald-400">
                        {rightTurnsCount} / {currentTaskMeta.minRightTurns ?? 3}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Interactive Steering Controls */}
            <div className="pt-2 space-y-3">
              <span className="text-xs font-bold text-white/60 uppercase tracking-wider block">
                Steering Controls (Auto-Forward Drive)
              </span>

              <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
                <button
                  type="button"
                  onMouseDown={() => handleSteer("left")}
                  onMouseUp={() => handleSteer("none")}
                  onTouchStart={() => handleSteer("left")}
                  onTouchEnd={() => handleSteer("none")}
                  className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-primary/50 bg-primary/20 py-4 text-primary hover:bg-primary/30 active:scale-95 transition-all shadow-lg shadow-primary/10"
                >
                  <ArrowLeft size={32} />
                  <span className="text-xs font-black">STEER LEFT</span>
                </button>

                <button
                  type="button"
                  onMouseDown={() => handleSteer("right")}
                  onMouseUp={() => handleSteer("none")}
                  onTouchStart={() => handleSteer("right")}
                  onTouchEnd={() => handleSteer("none")}
                  className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-primary/50 bg-primary/20 py-4 text-primary hover:bg-primary/30 active:scale-95 transition-all shadow-lg shadow-primary/10"
                >
                  <ArrowRight size={32} />
                  <span className="text-xs font-black">STEER RIGHT</span>
                </button>
              </div>

              <p className="text-[10px] text-white/40">
                Hold button to turn left or right. Release button to return to forward drive. Up/Down controls are disabled.
              </p>
            </div>
          </section>
        )}

        {/* GAME OVER CARD */}
        {gameState === "GAME_OVER" && (
          <section className="rounded-3xl border border-rose-500/50 bg-surface-light p-6 text-center shadow-2xl space-y-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-rose-500/20 text-rose-400 mx-auto shadow-inner shadow-rose-500/20">
              <ShieldAlert size={36} />
            </div>

            <h2 className="text-xl font-black text-white">{gameOverReason || "Game Over"}</h2>
            
            <p className="text-xs text-white/70 leading-relaxed max-w-xs mx-auto">
              Your robot encountered a collision or failed to complete the task requirements in time.
            </p>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-3 flex items-center justify-between text-xs">
              <span className="text-white/60 font-semibold">Tasks Completed:</span>
              <span className="font-bold text-amber-300">{tasksCompletedCount} / 3 Tasks</span>
            </div>

            <button
              type="button"
              onClick={handleReplay}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-3.5 text-sm font-extrabold text-black hover:bg-amber-400 active:scale-[0.98] transition-all shadow-lg shadow-amber-500/20"
            >
              <RotateCcw size={18} /> Try Level {levelId} Again
            </button>
          </section>
        )}

        {/* ControlPanel Component for Real-Time Telemetry & Vehicle Indicators */}
        <ControlPanel
          mode="challenge"
          game="driving-pro"
          isGameActive={gameState === "TASK_RUNNING"}
        />

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
          hasNextLevel={false}
          isNextUnlocked={false}
          onReplay={handleReplay}
          onNextLevel={handleNextLevel}
          onBackToLevels={handleExit}
        />
      )}
    </main>
  );
}
