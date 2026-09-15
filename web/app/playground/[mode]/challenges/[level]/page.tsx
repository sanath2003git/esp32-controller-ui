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
  createColorQuestStartCommand,
  getColourQuestLevel,
  isLevelUnlocked,
  isValidColorQuestResult,
} from "@/lib/colourQuest";
import type {
  ColourQuestGameState,
  LevelProgress,
  UserGameProgressResponse,
} from "@/types/colourQuest";
import { AlertCircle, Play, RefreshCw, Bluetooth, CheckCircle2 } from "lucide-react";

export default function ChallengeLevelPage() {
  const params = useParams<{ mode: string; level: string }>();
  const router = useRouter();
  const { status, send, lastMessage, openModal } = useBleContext();

  const isColourQuest = params.mode === "colour-quest";
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

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userProgressMap, setUserProgressMap] = useState<Record<number, LevelProgress>>({});
  const [isLoadingProgress, setIsLoadingProgress] = useState(true);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const processedMessageRef = useRef<string | null>(null);

  useEffect(() => {
    let isSubscribed = true;

    if (isColourQuest) {
      fetch("/api/progress?game=color-quest")
        .then((res) => res.json())
        .then((data: UserGameProgressResponse) => {
          if (isSubscribed && data.success && data.levels) {
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
      setGameState("starting");
      processedMessageRef.current = null;

      const command = createColorQuestStartCommand(levelId);
      await send(command);

      setGameState("playing");

      // Set timeout for robot response (60 seconds)
      clearTimeoutTimer();
      timeoutRef.current = setTimeout(() => {
        if (gameStateRef.current === "playing" || gameStateRef.current === "starting") {
          setGameState("error");
          setErrorMessage("Robot response timed out (60s). Please verify your robot firmware.");
        }
      }, 60000);
    } catch (err) {
      console.error("[CHALLENGE START ERROR]", err);
      setGameState("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to send start command to BLE device."
      );
    }
  };

  // Submit result to API
  const handleGameResult = useCallback(
    async (score: number) => {
      clearTimeoutTimer();
      setGameState("completed");

      const localStars = calculateStars(score);

      try {
        const res = await fetch("/api/progress/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            game: "color-quest",
            level: levelId,
            score,
          }),
        });

        const data = await res.json();

        if (data.success) {
          const updatedLevels: Record<number, LevelProgress> = data.levels || {};
          setUserProgressMap(updatedLevels);

          const isNextUnlocked = isLevelUnlocked(levelId + 1, updatedLevels);

          setCurrentResult({
            score,
            stars: data.awardedStars ?? localStars,
            bestScore: data.bestScore ?? score,
            isNextUnlocked,
          });
        } else {
          // Fallback to local calculation if offline/unauthenticated
          setCurrentResult({
            score,
            stars: localStars,
            bestScore: score,
            isNextUnlocked: localStars === 3,
          });
        }
      } catch (err) {
        console.warn("[SUBMIT RESULT ERROR]", err);
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

  // BLE message listener
  useEffect(() => {
    if (gameState !== "playing" || !lastMessage) return;

    if (isValidColorQuestResult(lastMessage)) {
      const messageKey = `${lastMessage.game}-${lastMessage.score}`;
      if (processedMessageRef.current === messageKey) {
        return; // Prevent duplicate response processing
      }
      processedMessageRef.current = messageKey;

      handleGameResult(lastMessage.score);
    }
  }, [gameState, lastMessage, handleGameResult]);

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
        subtitle={`${levelMeta.difficulty} difficulty`}
        backHref={`/playground/${params.mode}/challenges`}
      />

      <div className="mx-auto min-h-screen max-w-md px-4 pb-10 pt-24">
        {/* Header Section */}
        <section className="rounded-2xl border border-white/10 bg-surface p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              Level {levelMeta.id}
            </span>
            <span className="text-xs font-semibold text-white/40">
              {levelMeta.difficulty}
            </span>
          </div>

          <h2 className="mt-3 text-2xl font-black tracking-tight text-white">
            {levelMeta.title}
          </h2>

          <p className="mt-1 text-sm leading-6 text-white/60">
            {levelMeta.description}
          </p>

          <p className="mt-2 text-xs italic text-accent/80">
            Concept: {levelMeta.concept}
          </p>
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
              className={`flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-4 text-base font-bold transition-all ${
                isUnlocked
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
              <CheckCircle2 size={18} className="animate-pulse" /> Challenge active on robot! Complete the task...
            </div>
          ) : null}
        </section>

        {/* ALWAYS SHOW ControlPanel FOR PLAYING THE GAME (per requirement!) */}
        <section className="mt-8">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/40">
              Robot Controls
            </span>
            {gameState === "playing" && (
              <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" /> Live
              </span>
            )}
          </div>
          <ControlPanel />
        </section>

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
