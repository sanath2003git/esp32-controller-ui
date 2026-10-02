"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Play,
  RotateCcw,
  AlertCircle,
  Bluetooth,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowUpDown,
  Compass,
  Trophy,
  Sparkles,
} from "lucide-react";

import SubPageHeader from "@/components/SubPageHeader";
import ResultModal from "@/components/ResultModal";
import ControlPanel from "@/components/ControlPanel";
import { useBleContext } from "@/context/BleContext";
import {
  createDirectionInvertAbortCommand,
  createDirectionInvertStartCommand,
  isValidDirectionInvertResult,
  type DirectionInvertLevelMeta,
} from "@/lib/directionInvert";
import { submitAndPersistLevelResult } from "@/lib/progressStore";
import type { DirectionInvertTaskMessage, DirectionInvertTaskResultMessage } from "@/types/directionInvert";

type TaskFeedback = {
  taskNum: number;
  success: boolean;
};

export default function DirectionInvertGame({
  levelId,
  levelMeta,
}: {
  levelId: number;
  levelMeta: DirectionInvertLevelMeta;
}) {
  const router = useRouter();
  const { status, send, lastMessage, openModal } = useBleContext();

  const isImplemented = levelMeta.isImplemented;

  const [gameState, setGameState] = useState<"idle" | "starting" | "playing" | "completed" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Level Timer (20s for Level 1 & Level 2)
  const [levelTimeLeft, setLevelTimeLeft] = useState<number>(levelMeta.totalMaxTime);
  const levelTimerRef = useRef<NodeJS.Timeout | null>(null);
  const levelStartTimeRef = useRef<number | null>(null);

  // Task & Turn metrics
  const [currentTaskIndex, setCurrentTaskIndex] = useState<number>(0); // 0, 1, or 2
  const [totalTurns, setTotalTurns] = useState<number>(0);
  const [leftTurns, setLeftTurns] = useState<number>(0);
  const [rightTurns, setRightTurns] = useState<number>(0);
  const [taskFeedback, setTaskFeedback] = useState<TaskFeedback | null>(null);

  // Result modal
  const [currentResult, setCurrentResult] = useState<{
    score: number;
    scorePercent: number;
    stars: 0 | 1 | 2 | 3;
    successfulTasks: number;
    totalTasks: number;
    bestScore?: number;
    isNextUnlocked?: boolean;
  } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const clearLevelTimer = useCallback(() => {
    if (levelTimerRef.current) {
      clearInterval(levelTimerRef.current);
      levelTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearLevelTimer();
    };
  }, [clearLevelTimer]);

  // Handle BLE disconnection during gameplay
  useEffect(() => {
    if (
      (gameState === "starting" || gameState === "playing") &&
      status !== "connected"
    ) {
      clearLevelTimer();
      const timer = setTimeout(() => {
        setGameState("error");
        setErrorMessage("Robot BLE disconnected during gameplay. Please reconnect.");
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [gameState, status, clearLevelTimer]);

  // Handle incoming BLE messages from ESP32
  useEffect(() => {
    if (!lastMessage || gameState === "idle") return;

    // 1. Task notification message from firmware
    if (lastMessage.type === "task" && lastMessage.game === "direction-invert") {
      const taskMsg = lastMessage as DirectionInvertTaskMessage;
      const idx = taskMsg.index ?? (taskMsg.task ? taskMsg.task - 1 : 0);
      setTimeout(() => {
        setCurrentTaskIndex(idx);
        setTaskFeedback(null);
      }, 0);
    }

    // 2. Task result message from firmware (after Task 1, 2, or 3)
    if (lastMessage.type === "task_result" && lastMessage.game === "direction-invert") {
      const taskRes = lastMessage as DirectionInvertTaskResultMessage;
      setTimeout(() => {
        if (typeof taskRes.totalTurns === "number") setTotalTurns(taskRes.totalTurns);
        if (typeof taskRes.leftTurns === "number") setLeftTurns(taskRes.leftTurns);
        if (typeof taskRes.rightTurns === "number") setRightTurns(taskRes.rightTurns);

        setTaskFeedback({
          taskNum: taskRes.task ?? taskRes.index + 1,
          success: taskRes.success,
        });
      }, 0);
    }

    // 3. Final Level Result from firmware
    if (isValidDirectionInvertResult(lastMessage)) {
      clearLevelTimer();
      const res = lastMessage;
      const successfulTasks = res.successfulTasks ?? 0;
      const scoreVal = res.score > 1 ? res.score / 100 : res.score; // Normalize 0..1
      const starsVal = res.stars ?? (successfulTasks === 3 ? 3 : successfulTasks === 2 ? 2 : successfulTasks === 1 ? 1 : 0);

      const resultPayload = {
        score: scoreVal,
        scorePercent: Math.round(scoreVal * 100),
        stars: starsVal as 0 | 1 | 2 | 3,
        successfulTasks,
        totalTasks: res.tasks ?? 3,
      };

      setTimeout(() => {
        setGameState("completed");
        setCurrentResult(resultPayload);
        setIsModalOpen(true);
      }, 0);

      // Save progress
      void submitAndPersistLevelResult("direction-invert", levelId, scoreVal).catch(
        (err) => console.warn("[DIRECTION INVERT] Progress save error:", err)
      );
    }

    // 4. Firmware error
    if (lastMessage.type === "error") {
      const msg = lastMessage.message;
      setTimeout(() => {
        setErrorMessage(`Firmware error: ${msg}`);
      }, 0);
    }

    // 5. Aborted confirmation
    if (lastMessage.type === "aborted" && lastMessage.game === "direction-invert") {
      clearLevelTimer();
      setTimeout(() => {
        setGameState("idle");
      }, 0);
    }
  }, [lastMessage, gameState, clearLevelTimer, levelId]);

  // Start Level Challenge
  const handleStartGame = async () => {
    if (status !== "connected") {
      openModal();
      return;
    }

    if (!isImplemented) {
      setErrorMessage("Direction Invert Levels 1 to 4 are currently supported.");
      return;
    }

    try {
      setErrorMessage(null);
      setTaskFeedback(null);
      setCurrentTaskIndex(0);
      setTotalTurns(0);
      setLeftTurns(0);
      setRightTurns(0);
      setLevelTimeLeft(levelMeta.totalMaxTime);
      setGameState("starting");

      await send(createDirectionInvertStartCommand(levelId));

      setGameState("playing");
      levelStartTimeRef.current = Date.now();

      // Start single level countdown timer (20s total)
      clearLevelTimer();
      levelTimerRef.current = setInterval(() => {
        if (!levelStartTimeRef.current) return;
        const elapsed = Math.floor((Date.now() - levelStartTimeRef.current) / 1000);
        const remaining = Math.max(0, levelMeta.totalMaxTime - elapsed);
        setLevelTimeLeft(remaining);

        if (remaining <= 0) {
          clearLevelTimer();
        }
      }, 200);
    } catch (err) {
      console.error("[DIRECTION INVERT] Start error:", err);
      setGameState("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to send start command to robot."
      );
    }
  };

  // Abort / Exit
  const handleExit = () => {
    if (gameState === "playing" || gameState === "starting") {
      void send(createDirectionInvertAbortCommand()).catch((err) =>
        console.warn("[DIRECTION INVERT] Abort error:", err)
      );
    }
    clearLevelTimer();
    router.push("/playground/direction-invert/challenges");
  };

  // Replay
  const handleReplay = () => {
    setIsModalOpen(false);
    setCurrentResult(null);
    setGameState("idle");
    void handleStartGame();
  };

  // Next Level
  const handleNextLevel = () => {
    setIsModalOpen(false);
    setCurrentResult(null);
    setGameState("idle");
    router.push(`/playground/direction-invert/challenges/${levelId + 1}`);
  };

  if (!isImplemented) {
    return (
      <main className="min-h-screen pb-16">
        <SubPageHeader
          title={`Direction Invert \u00b7 Level ${levelId}`}
          subtitle="Coming Soon"
          backHref="/playground/direction-invert/challenges"
        />

        <div className="mx-auto min-h-screen max-w-md px-4 pb-10 pt-24">
          <section className="flex flex-col items-center rounded-3xl border border-white/10 bg-surface p-6 text-center shadow-xl">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-warning/30 bg-warning/15 text-warning mb-4">
              <Sparkles size={32} />
            </div>

            <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-warning">
              Not Implemented Yet
            </span>

            <h2 className="mt-4 text-xl font-extrabold text-white">
              Level {levelId} is Coming Soon!
            </h2>

            <p className="mt-2 text-sm leading-6 text-white/50">
              Direction Invert Levels 1 to 4 are currently supported. Further levels are coming soon.
            </p>

            <button
              type="button"
              onClick={() => router.push("/playground/direction-invert/challenges/1")}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 text-sm font-bold text-black transition hover:bg-primary/90 active:scale-[0.98]"
            >
              Back to Level 1
            </button>
          </section>
        </div>
      </main>
    );
  }

  // Task Requirements for current level
  const isBasicLevel = levelId === 1 || levelId === 3;
  const task2GoalTurns = isBasicLevel ? 3 : 5;
  const task3GoalLeft = isBasicLevel ? 2 : 3;
  const task3GoalRight = isBasicLevel ? 2 : 3;

  // Level 6 Dynamic Invert active mapping (switches every 10s based on level timer & prototype switch constant)
  const isL6Inverted =
    levelId === 6 &&
    gameState === "playing" &&
    Math.floor((levelMeta.totalMaxTime - levelTimeLeft) / 10) % 2 === 1;

  const isFullInvert = levelId === 5 || isL6Inverted;
  const isSteeringInvert = levelId === 3 || levelId === 4;
  const isNormalMapping = levelId === 6 && !isL6Inverted;

  return (
    <main className="min-h-screen pb-16">
      <SubPageHeader
        title={`Direction Invert \u00b7 Level ${levelMeta.id}`}
        subtitle={`${levelMeta.difficulty} \u00b7 ${levelMeta.totalMaxTime}s Level Limit`}
        backHref="/playground/direction-invert/challenges"
      />

      <div className="mx-auto min-h-screen max-w-md px-4 pb-10 pt-24 space-y-5">
        {/* Level Banner & Inversion Card */}
        <section className="rounded-3xl border border-white/10 bg-surface p-5 shadow-xl flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-warning/20 text-warning mb-3 shadow-inner shadow-warning/20">
            <ArrowUpDown size={32} />
          </div>

          <h1 className="text-2xl font-black tracking-tight text-white">
            Direction Invert
          </h1>

          <p className="mt-1 text-xs text-white/60">
            {levelMeta.description}
          </p>

          {/* Active Inversion Mapping Banner */}
          <div className="mt-4 w-full rounded-2xl border border-warning/30 bg-warning/10 p-3.5 text-left">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-warning mb-1.5">
              <span className="flex items-center gap-2">
                <Compass size={16} /> Active Control Mapping
              </span>
              {levelId === 6 && (
                <span className="rounded-full border border-warning/40 bg-black/40 px-2 py-0.5 text-[10px] font-black tracking-widest text-warning">
                  {isL6Inverted ? "FULL INVERT" : "NORMAL"}
                </span>
              )}
            </div>

            {isFullInvert ? (
              <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold text-white/90">
                <div className="rounded-xl border border-white/10 bg-black/20 p-2 text-center">
                  <span className="text-warning font-bold">UP</span> → BACKWARD
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-2 text-center">
                  <span className="text-warning font-bold">DOWN</span> → FORWARD
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-2 text-center">
                  <span className="text-warning font-bold">LEFT</span> → RIGHT
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-2 text-center">
                  <span className="text-warning font-bold">RIGHT</span> → LEFT
                </div>
              </div>
            ) : isSteeringInvert ? (
              <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold text-white/90">
                <div className="rounded-xl border border-white/10 bg-black/20 p-2 text-center">
                  <span className="text-emerald-400 font-bold">UP</span> → FORWARD
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-2 text-center">
                  <span className="text-emerald-400 font-bold">DOWN</span> → BACKWARD
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-2 text-center">
                  <span className="text-warning font-bold">LEFT</span> → RIGHT
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-2 text-center">
                  <span className="text-warning font-bold">RIGHT</span> → LEFT
                </div>
              </div>
            ) : isNormalMapping ? (
              <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold text-white/90">
                <div className="rounded-xl border border-white/10 bg-black/20 p-2 text-center">
                  <span className="text-emerald-400 font-bold">UP</span> → FORWARD
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-2 text-center">
                  <span className="text-emerald-400 font-bold">DOWN</span> → BACKWARD
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-2 text-center">
                  <span className="text-emerald-400 font-bold">LEFT</span> → LEFT
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-2 text-center">
                  <span className="text-emerald-400 font-bold">RIGHT</span> → RIGHT
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold text-white/90">
                <div className="rounded-xl border border-white/10 bg-black/20 p-2 text-center">
                  <span className="text-warning font-bold">UP</span> → BACKWARD
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-2 text-center">
                  <span className="text-warning font-bold">DOWN</span> → FORWARD
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-2 text-center">
                  <span className="text-emerald-400 font-bold">LEFT</span> → LEFT
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-2 text-center">
                  <span className="text-emerald-400 font-bold">RIGHT</span> → RIGHT
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Error Notification */}
        {errorMessage && (
          <section className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-300 flex items-start gap-3">
            <AlertCircle size={20} className="shrink-0 mt-0.5" />
            <div className="text-xs leading-5 flex-1">
              <span className="font-bold block">Error</span>
              {errorMessage}
            </div>
          </section>
        )}

        {/* Start Game Section */}
        {gameState === "idle" && (
          <section className="rounded-3xl border border-white/10 bg-surface p-6 text-center space-y-4 shadow-xl">
            <div className="flex flex-col items-center">
              <span className="text-lg font-bold text-white">Ready for Level {levelMeta.id}?</span>
              <p className="mt-1 text-xs leading-5 text-white/60">
                You have <strong>20 seconds total</strong> to complete all 3 tasks in order:<br />
                <strong>Task 1:</strong> Short Drive (No collision)<br />
                <strong>Task 2:</strong> {task2GoalTurns} Turns Count<br />
                <strong>Task 3:</strong> {task3GoalLeft} Left + {task3GoalRight} Right Turns Count
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
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-warning px-4 py-4 text-base font-bold text-black transition-all hover:bg-warning/90 active:scale-[0.98] shadow-lg shadow-warning/20"
              >
                <Play size={20} fill="currentColor" /> Start Level {levelMeta.id} Challenge
              </button>
            )}
          </section>
        )}

        {gameState === "starting" && (
          <section className="rounded-3xl border border-warning/30 bg-warning/10 p-6 text-center shadow-xl animate-pulse">
            <div className="flex items-center justify-center gap-3 text-warning font-bold text-sm">
              <RotateCcw size={18} className="animate-spin" />
              Starting Level {levelMeta.id} on robot...
            </div>
          </section>
        )}

        {/* Active Gameplay Screen */}
        {gameState === "playing" && (
          <div className="space-y-4">
            {/* Level Timer & Task Stepper */}
            <section className="rounded-3xl border border-white/10 bg-surface-light p-4 shadow-xl space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-black text-warning uppercase tracking-wider">
                  <Clock size={16} /> Level Timer: {levelTimeLeft}s
                </span>
                <span className="font-bold text-white/70">
                  Task {currentTaskIndex + 1} of 3
                </span>
              </div>

              {/* Task Progress Stepper */}
              <div className="grid grid-cols-3 gap-2">
                {[0, 1, 2].map((idx) => {
                  const isActive = currentTaskIndex === idx;
                  const isDone = currentTaskIndex > idx;
                  return (
                    <div
                      key={idx}
                      className={`flex flex-col items-center justify-center p-2 rounded-2xl border text-center transition-all ${
                        isDone
                          ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-300"
                          : isActive
                            ? "border-warning bg-warning/20 text-warning animate-pulse shadow-[0_0_15px_rgba(234,179,8,0.3)]"
                            : "border-white/10 bg-white/5 text-white/30"
                      }`}
                    >
                      <span className="text-[10px] font-bold uppercase">Task {idx + 1}</span>
                      <span className="text-xs font-black">
                        {idx === 0 ? "Short Drive" : idx === 1 ? "Turns" : "L/R Turns"}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Active Task Instruction Banner */}
              <div className="rounded-2xl border border-white/10 bg-black/30 p-3.5 text-center">
                <h3 className="text-sm font-black text-white">
                  {currentTaskIndex === 0
                    ? "Task 1: Short Driving Movement"
                    : currentTaskIndex === 1
                      ? `Task 2: Turn Count (${totalTurns} / ${task2GoalTurns})`
                      : `Task 3: Left & Right Turns (L:${leftTurns}/${task3GoalLeft}, R:${rightTurns}/${task3GoalRight})`}
                </h3>
                <p className="mt-1 text-xs text-white/60">
                  {currentTaskIndex === 0
                    ? "Drive the robot smoothly without colliding into any obstacle."
                    : currentTaskIndex === 1
                      ? `Perform at least ${task2GoalTurns} distinct turns using your joystick.`
                      : `Perform ${task3GoalLeft} left turns and ${task3GoalRight} right turns.`}
                </p>
              </div>

              {/* Task Feedback Banner */}
              {taskFeedback && (
                <div
                  className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-bold ${
                    taskFeedback.success
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                      : "border-rose-500/40 bg-rose-500/10 text-rose-300"
                  }`}
                >
                  {taskFeedback.success ? (
                    <>
                      <CheckCircle2 size={16} /> Task {taskFeedback.taskNum} Passed!
                    </>
                  ) : (
                    <>
                      <XCircle size={16} /> Task {taskFeedback.taskNum} Missed!
                    </>
                  )}
                </div>
              )}
            </section>

            {/* Interactive Control Panel for Driving */}
            <ControlPanel
              mode="challenge"
              game="direction-invert"
              isGameActive={gameState === "playing"}
            />

            {/* Exit Challenge Button */}
            <button
              type="button"
              onClick={handleExit}
              className="w-full rounded-2xl border border-rose-500/30 bg-rose-500/10 py-3 text-xs font-bold text-rose-400 hover:bg-rose-500/20 transition"
            >
              Exit Challenge
            </button>
          </div>
        )}
      </div>

      {/* Result Modal */}
      {currentResult && (
        <ResultModal
          isOpen={isModalOpen}
          level={levelId}
          score={currentResult.score}
          stars={currentResult.stars}
          bestScore={currentResult.bestScore ?? currentResult.score}
          hasNextLevel={levelId < 6}
          isNextUnlocked={currentResult.stars >= 3}
          onReplay={handleReplay}
          onNextLevel={handleNextLevel}
          onBackToLevels={handleExit}
        />
      )}
    </main>
  );
}
