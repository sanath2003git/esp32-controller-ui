/* eslint-disable */
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import SubPageHeader from "@/components/SubPageHeader";
import ResultModal from "@/components/ResultModal";
import { useBleContext } from "@/context/BleContext";
import { submitAndPersistLevelResult } from "@/lib/progressStore";
import { calculateStars } from "@/lib/colourQuest";
import ControlPanel from "@/components/ControlPanel";
import { Play, AlertCircle, X, Clock, Target, Gamepad2 } from "lucide-react";

type Color = { name: string; hex: string; action: "GO" | "STOP" };

const COLORS = {
  green: { name: "Green", hex: "#10B981" },
  red: { name: "Red", hex: "#EF4444" },
  blue: { name: "Blue", hex: "#3B82F6" },
  yellow: { name: "Yellow", hex: "#EAB308" },
  purple: { name: "Purple", hex: "#A855F7" },
  cyan: { name: "Cyan", hex: "#06B6D4" },
  magenta: { name: "Magenta", hex: "#EC4899" },
};

export default function ReflexDashGame({ levelId, levelMeta }: { levelId: number, levelMeta: any }) {
  const router = useRouter();
  const { status, send, openModal, setColor, move, stop, lastEventMessage } = useBleContext();
  
  const [gameState, setGameState] = useState<"idle" | "playing" | "completed">("idle");
  const isGameActiveRef = useRef(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [score, setScoreState] = useState(0);
  const scoreRef = useRef(0);
  const maxPossibleScoreRef = useRef(0);
  const setScore = useCallback((action: React.SetStateAction<number>) => {
    setScoreState((prev) => {
      const next = typeof action === "function" ? action(prev) : action;
      scoreRef.current = next;
      return next;
    });
  }, []);
  const [isDriving, setIsDriving] = useState(false);
  const [currentColor, setCurrentColor] = useState<Color | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  
  const [currentResult, setCurrentResult] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const phaseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const gameTimerRef = useRef<NodeJS.Timeout | null>(null);
  const drivingScoreTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reactionStartRef = useRef<number>(0);
  const totalDuration = parseInt(levelMeta.timing || "15") * 1000;

  const getColorsForLevel = () => {
    if (levelId === 1) {
      return [
        { ...COLORS.green, action: "GO" },
        { ...COLORS.red, action: "STOP" }
      ] as Color[];
    } else if (levelId === 2) {
      return [
        { ...COLORS.green, action: "GO" },
        { ...COLORS.blue, action: "GO" },
        { ...COLORS.red, action: "STOP" },
        { ...COLORS.magenta, action: "STOP" }
      ] as Color[];
    } else {
      return [
        { ...COLORS.green, action: "GO" },
        { ...COLORS.blue, action: "GO" },
        { ...COLORS.cyan, action: "GO" },
        { ...COLORS.red, action: "STOP" },
        { ...COLORS.magenta, action: "STOP" },
        { ...COLORS.yellow, action: "STOP" }
      ] as Color[];
    }
  };

  const colors = useRef<Color[]>(getColorsForLevel());

  const sendColorToRobot = async (hex: string) => {
    if (status !== "connected") return;
    try {
      const cleanHex = hex.replace("#", "");
      const r = parseInt(cleanHex.substring(0, 2), 16);
      const g = parseInt(cleanHex.substring(2, 4), 16);
      const b = parseInt(cleanHex.substring(4, 6), 16);
      await send({ command: "color", r, g, b });
    } catch (err) {
      console.warn("Failed to send color to robot", err);
    }
  };

  const handleDrive = (dir: "forward" | "backward" | "left" | "right" | null) => {
    setIsDriving(dir !== null);
    // Note: ControlPanel handles BLE move() and stop() internally for us.
  };

  const nextPhase = useCallback(() => {
    if (gameState !== "playing" || status === "connected") return;
    const randomColor = colors.current[Math.floor(Math.random() * colors.current.length)];
    setCurrentColor(randomColor);
    sendColorToRobot(randomColor.hex);
    reactionStartRef.current = Date.now();
    setMessage(null);

    const phaseDuration = 1000 + Math.random() * 1500;
    phaseTimerRef.current = setTimeout(nextPhase, phaseDuration);
  }, [gameState, status]);

  const handleLevelComplete = useCallback(async (finalScore: number) => {
    isGameActiveRef.current = false;
    setGameState("completed");
    if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
    if (gameTimerRef.current) clearInterval(gameTimerRef.current);
    if (drivingScoreTimerRef.current) clearInterval(drivingScoreTimerRef.current);
    setCurrentColor(null);
    sendColorToRobot("#000000"); // turn off LED
    stop();
    
    if (status === "connected") {
      // Send abort ONLY if the user manually aborted, or if we need to ensure the robot stops.
      // But if handleLevelComplete was triggered by the robot's 'response', it's already stopped.
      // We can safely send abort just in case.
      send({ command: "abort" } as any).catch(console.error);
    }
    
    try {
      const result = await submitAndPersistLevelResult("reflex-dash", levelId, finalScore);
      setCurrentResult({
        score: finalScore,
        stars: result.awardedStars,
        bestScore: result.bestScore,
        isNextUnlocked: result.isNextUnlocked,
      });
    } catch (err) {
      const localStars = calculateStars(finalScore);
      setCurrentResult({
        score: finalScore,
        stars: localStars,
        bestScore: finalScore,
        isNextUnlocked: localStars === 3,
      });
    } finally {
      setIsModalOpen(true);
    }
  }, [levelId]);

  const startGame = () => {
    isGameActiveRef.current = true;
    setGameState("playing");
    setScore(0);
    maxPossibleScoreRef.current = 0;
    setTimeLeft(totalDuration / 1000);
    
    // Start game timer just for visual countdown
    gameTimerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Frontend is now the absolute source of truth for time and score!
          // We know exactly how many points a perfect player would have earned.
          const maxPoints = Math.max(1, maxPossibleScoreRef.current);
          const normalizedScore = Math.min(Math.max(scoreRef.current / maxPoints, 0), 1);
          handleLevelComplete(normalizedScore);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    if (status === "connected") {
      send({ command: "challenge", game: "reflex-dash", level: levelId });
    } else {
      nextPhase(); // Start offline mock loop
    }
  };

  const abortGame = useCallback(() => {
    isGameActiveRef.current = false;
    setGameState("idle");
    if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
    if (gameTimerRef.current) clearInterval(gameTimerRef.current);
    if (drivingScoreTimerRef.current) clearInterval(drivingScoreTimerRef.current);
    setCurrentColor(null);
    sendColorToRobot("#000000"); // turn off LED
    stop();
    if (status === "connected") {
      // Abort command tells ESP32 to immediately stop the game loop
      send({ command: "abort" } as any).catch(console.error);
    }
    router.push(`/playground/reflex-dash/challenges`);
  }, [router, send, status]);

  useEffect(() => {
    if (!lastEventMessage) return;
    
    const msg = lastEventMessage as any;
    if (msg.game === "reflex-dash") {
      if (msg.type === "event" && msg.event === "phase_start") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (gameState !== "playing") setGameState("playing");
        setCurrentColor({
          name: msg.colorName,
          hex: msg.hex,
          action: msg.isGo ? "GO" : "STOP",
        });
        // We no longer sync score from ESP32, frontend tracks it perfectly.
      } else if (msg.type === "aborted") {
        if (isGameActiveRef.current) {
          abortGame();
        }
      }
    }
  }, [lastEventMessage, gameState, handleLevelComplete, abortGame]);

  useEffect(() => {
    return () => {
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
      if (gameTimerRef.current) clearInterval(gameTimerRef.current);
      if (drivingScoreTimerRef.current) clearInterval(drivingScoreTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (gameState !== "playing") return;

    if (drivingScoreTimerRef.current) {
      clearInterval(drivingScoreTimerRef.current);
    }

    drivingScoreTimerRef.current = setInterval(() => {
      if (!currentColor) return;
      
      // The perfect score ceiling rises every 500ms a GO color is active
      if (currentColor.action === "GO") {
        maxPossibleScoreRef.current += 1;
      }

      if (isDriving) {
        if (currentColor.action === "GO") {
          setScore(s => s + 1);
          setMessage("Great driving!");
        } else {
          setScore(s => Math.max(0, s - 3));
          setMessage("STOP! You are losing points!");
        }
      } else {
        if (currentColor.action === "GO") {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setMessage("You should be moving!");
        } else {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setMessage(null);
        }
      }
    }, 500);

    return () => {
      if (drivingScoreTimerRef.current) clearInterval(drivingScoreTimerRef.current);
    };
  }, [isDriving, currentColor, gameState]);


  return (
    <main className="min-h-screen pb-16 bg-background">
      <SubPageHeader
        title={`Reflex Dash \u00b7 Level ${levelMeta.id}`}
        subtitle={`${levelMeta.difficulty} \u00b7 ${levelMeta.timing}`}
        backHref="/playground/reflex-dash/challenges"
      />

      <div className="mx-auto min-h-screen max-w-md px-4 pb-10 pt-24">
        {gameState === "idle" && (
          <div className="flex flex-col items-center">
             <section className="rounded-2xl border border-white/10 bg-surface p-5 shadow-lg flex flex-col items-center text-center w-full">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-warning/20 text-warning mb-4 shadow-inner shadow-warning/20">
                <Gamepad2 size={32} />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-white">
                Reflex Dash
              </h1>
              <div className="mt-4 text-left w-full">
                <p className="text-sm text-white/80 mb-2">{levelMeta.description}</p>
              </div>
            </section>

            {/* Color Legend Card */}
            <div className="mt-4 w-full rounded-2xl border border-white/10 bg-surface-light p-4 shadow-lg">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-3 text-left">Command Legend</h3>
              <div className="grid grid-cols-2 gap-2">
                {colors.current.map(c => (
                  <div key={c.hex} className="flex items-center gap-2 rounded-xl bg-black/20 p-2 border border-white/5">
                    <div className="h-4 w-4 rounded-full flex-shrink-0" style={{ backgroundColor: c.hex, boxShadow: `0 0 8px ${c.hex}80` }} />
                    <span className="text-xs font-semibold text-white/80 truncate">{c.name}</span>
                    <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0 ${
                      c.action === "GO" ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                    }`}>
                      {c.action}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            
            <button
              onClick={startGame}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-warning px-4 py-4 text-base font-bold text-black transition-all hover:bg-warning/90 active:scale-[0.98]"
            >
              <Play size={20} fill="currentColor" /> Start Challenge
            </button>
          </div>
        )}

        {gameState === "playing" && (
          <div className="fixed inset-0 z-50 bg-background overflow-hidden p-3 sm:p-4 pb-8 touch-none">
            <ControlPanel
              mode="challenge"
              game="reflex-dash"
              isGameActive={true}
              onDrive={handleDrive}
              customControls={
                <div className="flex flex-col gap-3 w-full">
                  {/* Top Bar with Score and Abort */}
                  <div className="flex justify-between items-center w-full z-10 shrink-0 bg-black/40 p-2.5 rounded-2xl border border-white/5">
                     <span className="font-black uppercase tracking-[0.2em] text-accent text-sm flex items-center gap-2">
                       <Target size={16} /> Score: {score}
                     </span>
                     <button onClick={abortGame} className="px-3 py-1.5 border border-rose-500/30 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 rounded-full font-bold text-[10px] uppercase tracking-wider transition-colors flex items-center gap-1">
                       <X size={12} /> Abort
                     </button>
                  </div>

                  {/* Info Cards (Timer, Color) */}
                  <div className="flex w-full shrink-0 justify-between gap-3 z-10">
                    {/* Timer Card */}
                    <div className="flex h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl border border-white/10 bg-black/40 text-white/50 shadow-inner relative overflow-hidden">
                      <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                        <Clock size={10} /> Timer
                      </span>
                      <span className="text-xl font-black text-white">
                        {timeLeft === 0 && status === "connected" && gameState === "playing" ? "Calc..." : `${timeLeft}s`}
                      </span>
                    </div>
                    
                    {/* Color Card */}
                    <div 
                      className="flex h-12 flex-1 flex-col items-center justify-center gap-0 rounded-2xl border bg-black/40 text-white transition-colors shadow-inner relative overflow-hidden"
                      style={{
                        borderColor: currentColor ? currentColor.hex : 'rgba(255,255,255,0.1)',
                        boxShadow: currentColor ? `0 0 15px ${currentColor.hex}33 inset` : 'none'
                      }}
                    >
                      {/* Subtle background glow for the color card */}
                      {currentColor && (
                        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundColor: currentColor.hex }} />
                      )}
                      
                      <span className="text-[9px] font-bold uppercase tracking-wider text-white/60">Target Color</span>
                      {currentColor ? (
                        <span className="text-lg font-black tracking-widest uppercase drop-shadow-md" style={{ color: currentColor.hex, textShadow: `0 0 10px ${currentColor.hex}88` }}>
                          {currentColor.name}
                        </span>
                      ) : (
                        <span className="text-lg font-black text-white/30">--</span>
                      )}
                    </div>
                  </div>

                  {/* Message popup if any */}
                  <div className="w-full h-8 flex items-center justify-center z-10 shrink-0">
                    {message && currentColor && (
                      <span className="text-[11px] font-black uppercase tracking-widest opacity-90 animate-pulse bg-black/60 px-5 py-2 rounded-full border border-white/10 shadow-lg" style={{ color: currentColor.hex }}>
                        {message}
                      </span>
                    )}
                  </div>
                </div>
              }
            />
          </div>
        )}
      </div>

      {currentResult && (
        <ResultModal
          isOpen={isModalOpen}
          level={levelId}
          score={currentResult.score}
          stars={currentResult.stars}
          bestScore={currentResult.bestScore}
          hasNextLevel={levelId < 3}
          isNextUnlocked={currentResult.isNextUnlocked}
          onReplay={() => {
            setIsModalOpen(false);
            setGameState("idle");
            startGame();
          }}
          onNextLevel={() => {
            router.push(`/playground/reflex-dash/challenges/${levelId + 1}`);
          }}
          onBackToLevels={() => router.push(`/playground/reflex-dash/challenges`)}
        />
      )}
    </main>
  );
}
