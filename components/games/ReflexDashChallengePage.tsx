"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import SubPageHeader from "@/components/SubPageHeader";
import ResultModal from "@/components/ResultModal";
import JoystickController, { type JoystickDirection } from "@/components/JoystickController";
import { useBleContext } from "@/context/BleContext";
import { getGameDefinition } from "@/data/gameCatalog";
import { calculateStars, isLevelUnlocked } from "@/lib/colourQuest";
import { fetchAndSyncProgress, submitAndPersistLevelResult } from "@/lib/progressStore";
import type { LevelProgress } from "@/types/colourQuest";
import type { GameFeedbackPayload, GameResultPayload, JoyStickDir } from "@/types/protocol";
import { useGameSession } from "@/games/useGameSession";
import {
  AlertCircle,
  Play,
  RefreshCw,
  Bluetooth,
  CheckCircle2,
  Zap,
  OctagonX,
  Sparkles,
  ArrowRight,
  Check,
} from "lucide-react";

type ColorConfig = {
  name: string;
  bg: string;
  text: string;
  border: string;
  glow: string;
};

const COLOR_CONFIGS: Record<string, ColorConfig> = {
  green: {
    name: "Green",
    bg: "bg-emerald-500",
    text: "text-emerald-400",
    border: "border-emerald-500/50",
    glow: "shadow-[0_0_24px_rgba(16,185,129,0.5)]",
  },
  red: {
    name: "Red",
    bg: "bg-rose-500",
    text: "text-rose-400",
    border: "border-rose-500/50",
    glow: "shadow-[0_0_24px_rgba(244,63,94,0.5)]",
  },
  blue: {
    name: "Blue",
    bg: "bg-blue-500",
    text: "text-blue-400",
    border: "border-blue-500/50",
    glow: "shadow-[0_0_24px_rgba(59,130,246,0.5)]",
  },
  yellow: {
    name: "Yellow",
    bg: "bg-amber-400",
    text: "text-amber-300",
    border: "border-amber-400/50",
    glow: "shadow-[0_0_24px_rgba(251,191,36,0.5)]",
  },
  purple: {
    name: "Purple",
    bg: "bg-purple-500",
    text: "text-purple-400",
    border: "border-purple-500/50",
    glow: "shadow-[0_0_24px_rgba(168,85,247,0.5)]",
  },
  cyan: {
    name: "Cyan",
    bg: "bg-cyan-400",
    text: "text-cyan-300",
    border: "border-cyan-400/50",
    glow: "shadow-[0_0_24px_rgba(34,211,238,0.5)]",
  },
};

function getColorConfig(colorName: string): ColorConfig {
  const normalized = colorName.toLowerCase().trim();
  return (
    COLOR_CONFIGS[normalized] || {
      name: colorName.toUpperCase(),
      bg: "bg-white/20",
      text: "text-white",
      border: "border-white/30",
      glow: "shadow-none",
    }
  );
}

function getDefaultMapping(level: number): { go: string[]; stop: string[] } {
  if (level <= 6) {
    return { go: ["green"], stop: ["red"] };
  }
  if (level <= 8) {
    return { go: ["green", "blue"], stop: ["red", "yellow"] };
  }
  return {
    go: ["green", "purple", "cyan"],
    stop: ["red", "yellow", "blue"],
  };
}

export default function ReflexDashChallengePage() {
  const params = useParams<{ mode: string; level: string }>();
  const router = useRouter();
  const {
    status: bleStatus,
    sendJoystickInput: sendGameJoystickInput,
    openModal,
    lastMessage,
    signalChangeEvent,
    runSeq,
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

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userProgressMap, setUserProgressMap] = useState<Record<number, LevelProgress>>({});
  const [isLoadingProgress, setIsLoadingProgress] = useState(true);

  // Gameplay specific state
  const [hasStartedSeq, setHasStartedSeq] = useState(false);
  const [colorMapping, setColorMapping] = useState<{ go: string[]; stop: string[] }>(
    getDefaultMapping(levelId)
  );

  const [currentCue, setCurrentCue] = useState<{
    signal: string;
    color: string;
    durationMs: number;
    phaseIndex: number;
  } | null>(null);

  const [taskFeedback, setTaskFeedback] = useState<{
    taskId: number;
    correct: boolean;
    correctCount: number;
  } | null>(null);

  // Fetch saved progress
  useEffect(() => {
    let isSubscribed = true;
    if (game) {
      fetchAndSyncProgress("reflex-dash")
        .then((data) => {
          if (isSubscribed && data.levels) {
            setUserProgressMap(data.levels);
          }
        })
        .catch((err) => {
          console.warn("[REFLEX DASH] Failed to fetch progress:", err);
        })
        .finally(() => {
          if (isSubscribed) setIsLoadingProgress(false);
        });
    } else {
      setTimeout(() => {
        if (isSubscribed) setIsLoadingProgress(false);
      }, 0);
    }
    return () => {
      isSubscribed = false;
    };
  }, [game]);

  // Sync color mapping from game_started payload if provided by robot
  useEffect(() => {
    if (lastMessage && lastMessage.type === "response" && lastMessage.response === "game_started") {
      const payload = lastMessage.payload as {
        gameId?: string;
        mapping?: { go: string[]; stop: string[] };
      };
      if (payload.mapping?.go && payload.mapping?.stop) {
        setColorMapping(payload.mapping);
      }
    }
  }, [lastMessage]);

  // Sync active cue from BLE signal_change events
  useEffect(() => {
    if (signalChangeEvent && signalChangeEvent.gameId === "reflex_dash") {
      setCurrentCue({
        signal: signalChangeEvent.signal,
        color: signalChangeEvent.color,
        durationMs: signalChangeEvent.durationMs,
        phaseIndex: signalChangeEvent.phaseIndex,
      });
    }
  }, [signalChangeEvent]);

  const isUnlocked = isLevelUnlocked(levelId, userProgressMap);

  const handleGameResult = useCallback(
    async (gameResult: GameResultPayload) => {
      const score =
        gameResult.tasksTotal > 0
          ? gameResult.tasksCompleted / gameResult.tasksTotal
          : gameResult.score > 1
          ? gameResult.score / 100
          : gameResult.score;

      try {
        const result = await submitAndPersistLevelResult(
          "reflex-dash",
          levelId,
          score,
          gameResult.stars
        );
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
    [levelId]
  );

  const handleGameFeedback = useCallback((feedback: GameFeedbackPayload) => {
    setTaskFeedback({
      taskId: feedback.taskId,
      correct: feedback.correct,
      correctCount: feedback.correctCount,
    });
  }, []);

  const session = useGameSession({
    game: "reflex_dash",
    level: levelId,
    onResult: handleGameResult,
    onFeedback: handleGameFeedback,
  });

  const handleStartLevel = async () => {
    if (session.status === "starting" || session.status === "playing") return;
    if (!isUnlocked) {
      session.setError(
        "This level is locked. Complete the previous level with 3 stars to unlock!"
      );
      return;
    }
    setErrorMessage(null);
    setTaskFeedback(null);
    setCurrentCue(null);
    setHasStartedSeq(false);
    setColorMapping(getDefaultMapping(levelId));
    session.reset();
    await session.start();
  };

  const handleRunSequence = async () => {
    if (bleStatus !== "connected") {
      openModal();
      return;
    }
    setHasStartedSeq(true);
    try {
      await runSeq("reflex_dash", levelId);
    } catch (err) {
      console.warn("[RUN SEQ ERROR]", err);
    }
  };

  // Convert JoystickController (dx, dy) to normalized joystick BLE commands
  const handleJoystickDirectionChange = (direction: JoystickDirection) => {
    const magnitude = Math.min(1, Math.hypot(direction.dx, direction.dy));

    let dirStr: JoyStickDir = "none";
    if (magnitude >= 0.08) {
      const absX = Math.abs(direction.dx);
      const absY = Math.abs(direction.dy);
      if (absY >= absX) {
        dirStr = direction.dy > 0 ? "up" : "down";
      } else {
        dirStr = direction.dx > 0 ? "right" : "left";
      }
    }

    void sendGameJoystickInput(dirStr, magnitude).catch((err: unknown) => {
      console.warn("[JOYSTICK INPUT ERROR]", err);
    });
  };

  const handleJoystickRelease = () => {
    void sendGameJoystickInput("none", 0.0).catch((err: unknown) => {
      console.warn("[JOYSTICK RELEASE ERROR]", err);
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
    <main className="min-h-screen pb-16 select-none">
      <SubPageHeader
        title={`${game?.title ?? "Reflex Dash"} \u00b7 Level ${levelMeta.id}`}
        subtitle={`${levelMeta.difficulty} difficulty \u00b7 ${levelMeta.timing}`}
        backHref={`/playground/${params.mode}/challenges`}
      />

      <div className="mx-auto min-h-screen max-w-md px-4 pb-10 pt-24 flex flex-col justify-between">
        <div>
          {/* Header Section */}
          <section className="rounded-2xl border border-white/10 bg-surface p-5 shadow-lg flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-500/20 text-amber-400 mb-4 shadow-inner shadow-amber-500/20">
              <Zap size={32} />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">
              {game?.title || "Reflex Dash"}
            </h1>

            <div className="mt-4 flex flex-col items-start space-y-2 text-sm text-left bg-black/20 rounded-xl p-4 w-full border border-white/5">
              <p className="text-white/80">
                <span className="inline-block w-6 text-center mr-2 text-lg">🚨</span>
                <strong>Watch</strong> the LED strip color on your robot!
              </p>
              <p className="text-white/80">
                <span className="inline-block w-6 text-center mr-2 text-lg">🏎️</span>
                <strong>Drive</strong> using the joystick during <strong>GO</strong> colors!
              </p>
              <p className="text-white/80">
                <span className="inline-block w-6 text-center mr-2 text-lg">🛑</span>
                <strong>Stop</strong> immediately when a <strong>STOP</strong> color appears!
              </p>
            </div>

            <div className="mt-5 w-full border-t border-white/10 pt-4 text-left">
              <div className="flex items-center justify-between">
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-400">
                  Level {levelMeta.id}
                </span>
                <span className="text-xs font-semibold text-white/40">
                  {levelMeta.difficulty}
                </span>
              </div>

              <h2 className="mt-2 text-lg font-bold tracking-tight text-white">
                {levelMeta.title}
              </h2>
              <p className="mt-1 text-xs leading-5 text-white/60">
                {levelMeta.description}
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

          {/* Connection / Start Controls */}
          <section className="mt-6">
            {bleStatus !== "connected" ? (
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
                className={`flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-4 text-base font-bold transition-all ${
                  isUnlocked
                    ? "bg-amber-500 text-black hover:bg-amber-400 active:scale-[0.98] shadow-lg shadow-amber-500/20"
                    : "bg-white/10 text-white/30 cursor-not-allowed"
                }`}
              >
                <Play size={20} fill="currentColor" /> Start Level {levelId}
              </button>
            ) : session.status === "starting" ? (
              <div className="flex w-full items-center justify-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-400 font-bold text-sm">
                <RefreshCw size={18} className="animate-spin" /> Initializing game state on robot...
              </div>
            ) : null}
          </section>

          {/* Rule Mapping & Pre-Game GO Button Card (when session is active) */}
          {session.status === "playing" && !hasStartedSeq && (
            <section className="mt-6 rounded-2xl border border-amber-500/40 bg-surface-light p-5 shadow-2xl text-center flex flex-col items-center">
              <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-amber-400 uppercase mb-3">
                <Sparkles size={16} /> Color Rule Mapping
              </div>

              <p className="text-xs text-white/70 mb-4">
                Memorize the color rules below. Drive when GO colors show, stop when STOP colors show!
              </p>

              <div className="grid grid-cols-2 gap-3 w-full mb-6">
                {/* GO Colors Column */}
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 flex flex-col items-center">
                  <span className="flex items-center gap-1 text-xs font-black text-emerald-400 uppercase mb-2">
                    <Check size={14} /> GO Colors
                  </span>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {colorMapping.go.map((c) => {
                      const cfg = getColorConfig(c);
                      return (
                        <span
                          key={c}
                          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-extrabold text-black ${cfg.bg} shadow-md`}
                        >
                          <span className="h-2 w-2 rounded-full bg-black/40" />
                          {cfg.name}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* STOP Colors Column */}
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 flex flex-col items-center">
                  <span className="flex items-center gap-1 text-xs font-black text-rose-400 uppercase mb-2">
                    <OctagonX size={14} /> STOP Colors
                  </span>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {colorMapping.stop.map((c) => {
                      const cfg = getColorConfig(c);
                      return (
                        <span
                          key={c}
                          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-extrabold text-white ${cfg.bg} shadow-md`}
                        >
                          <span className="h-2 w-2 rounded-full bg-white/40" />
                          {cfg.name}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Prominent GO Button to trigger run_seq */}
              <button
                type="button"
                onClick={handleRunSequence}
                className="flex w-full items-center justify-center gap-3 rounded-2xl bg-emerald-500 px-5 py-4 text-lg font-black text-black shadow-xl shadow-emerald-500/30 hover:bg-emerald-400 active:scale-95 transition-all"
              >
                GO! Start Dash <ArrowRight size={22} />
              </button>
            </section>
          )}

          {/* Active Gameplay Dashboard (Stationary, Non-Shifting Layout) */}
          {session.status === "playing" && hasStartedSeq && (
            <div className="mt-6 flex flex-col space-y-4">
              {/* Signal Cue Status Container (Fixed Height: 120px) */}
              <div className="h-[120px] rounded-2xl border border-white/10 bg-surface-light p-4 shadow-xl flex flex-col justify-between items-center relative overflow-hidden">
                <div className="flex w-full items-center justify-between text-xs text-white/50">
                  <span className="font-bold text-amber-400">
                    Phase {currentCue ? currentCue.phaseIndex : 1}
                  </span>
                  <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                    <CheckCircle2 size={14} /> Active Sequence
                  </span>
                </div>

                {/* Big Glowing Signal Orb */}
                {currentCue ? (
                  (() => {
                    const cfg = getColorConfig(currentCue.color);
                    const isGo = currentCue.signal === "GO";
                    return (
                      <div className="flex items-center justify-center gap-4">
                        <div
                          className={`h-14 w-14 rounded-full flex items-center justify-center font-black text-xl border-2 ${cfg.bg} ${cfg.border} ${cfg.glow} ${
                            isGo ? "text-black animate-pulse" : "text-white"
                          }`}
                        >
                          {isGo ? "GO" : "STOP"}
                        </div>
                        <div className="flex flex-col text-left">
                          <span className={`text-xl font-black ${cfg.text}`}>
                            {cfg.name.toUpperCase()}
                          </span>
                          <span className="text-xs font-bold tracking-widest text-white/60 uppercase">
                            {isGo ? "⚡ DRIVE NOW!" : "🛑 DO NOT MOVE!"}
                          </span>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="flex items-center gap-2 text-sm font-bold text-white/50 my-auto">
                    <RefreshCw size={16} className="animate-spin text-amber-400" /> Waiting for signal state...
                  </div>
                )}
                <div />
              </div>

              {/* Feedback Banner (Fixed Height: 56px) - ZERO layout jumping! */}
              <div
                className={`h-14 flex items-center justify-center rounded-xl border px-4 text-center text-sm font-bold transition-colors duration-200 ${
                  taskFeedback
                    ? taskFeedback.correct
                      ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                      : "border-rose-500/40 bg-rose-500/15 text-rose-300 animate-shake"
                    : "border-white/10 bg-black/30 text-white/40"
                }`}
              >
                {taskFeedback ? (
                  <span>
                    {taskFeedback.correct ? "✅ GREAT REACTION!" : "⚠️ STOP VIOLATION!"} · Score:{" "}
                    {taskFeedback.correctCount}
                  </span>
                ) : (
                  <span className="text-xs text-white/50">
                    Push joystick to drive on GO cues. Release during STOP cues!
                  </span>
                )}
              </div>

              {/* Joystick Controller Section (Fixed Height Container: 250px) */}
              <div className="h-[250px] w-full">
                <JoystickController
                  disabled={session.status !== "playing"}
                  onDirectionChange={handleJoystickDirectionChange}
                  onRelease={handleJoystickRelease}
                />
              </div>
            </div>
          )}
        </div>

        {/* Exit Button */}
        <button
          type="button"
          onClick={handleExit}
          className="mt-6 flex w-full items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3.5 text-sm font-bold text-rose-400 hover:bg-rose-500/20 active:scale-[0.98] transition-all"
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
