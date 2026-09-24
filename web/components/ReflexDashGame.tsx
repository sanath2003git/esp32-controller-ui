"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import SubPageHeader from "@/components/SubPageHeader";
import ResultModal from "@/components/ResultModal";
import { useBleContext } from "@/context/BleContext";
import { submitAndPersistLevelResult } from "@/lib/progressStore";
import { calculateStars } from "@/lib/colourQuest";
import { Play, AlertCircle, Gamepad2 } from "lucide-react";
import ControlPanel from "@/components/ControlPanel";

type Color = { name: string; hex: string; action: "GO" | "STOP" };

const COLORS = {
  green: { name: "Green", hex: "#10B981" },
  red: { name: "Red", hex: "#EF4444" },
  blue: { name: "Blue", hex: "#3B82F6" },
  yellow: { name: "Yellow", hex: "#EAB308" },
  purple: { name: "Purple", hex: "#A855F7" },
  cyan: { name: "Cyan", hex: "#06B6D4" },
};

export default function ReflexDashGame({ levelId, levelMeta }: { levelId: number, levelMeta: any }) {
  const router = useRouter();
  const { status, send, openModal } = useBleContext();
  
  const [gameState, setGameState] = useState<"idle" | "playing" | "completed">("idle");
  const [timeLeft, setTimeLeft] = useState(0);
  const [score, setScore] = useState(0);
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
        { ...COLORS.yellow, action: "STOP" }
      ] as Color[];
    } else {
      return [
        { ...COLORS.green, action: "GO" },
        { ...COLORS.blue, action: "GO" },
        { ...COLORS.cyan, action: "GO" },
        { ...COLORS.red, action: "STOP" },
        { ...COLORS.yellow, action: "STOP" },
        { ...COLORS.purple, action: "STOP" }
      ] as Color[];
    }
  };

  const colors = useRef<Color[]>(getColorsForLevel());

  const sendColorToRobot = async (hex: string) => {
    if (status !== "connected") return;
    try {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      await send({ command: "color", r, g, b });
    } catch (err) {
      console.warn("Failed to send color to robot", err);
    }
  };

  const nextPhase = useCallback(() => {
    if (gameState !== "playing") return;
    const randomColor = colors.current[Math.floor(Math.random() * colors.current.length)];
    setCurrentColor(randomColor);
    sendColorToRobot(randomColor.hex);
    reactionStartRef.current = Date.now();
    setMessage(null);

    // Random duration for each phase (1s to 2.5s)
    const phaseDuration = 1000 + Math.random() * 1500;
    phaseTimerRef.current = setTimeout(nextPhase, phaseDuration);
  }, [gameState, status, send]);

  const startGame = () => {
    if (status !== "connected") {
      openModal();
      return;
    }
    setGameState("playing");
    setScore(0);
    setTimeLeft(totalDuration / 1000);
    
    // Start game timer
    gameTimerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          endGame();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    nextPhase();
  };

  const endGame = useCallback(async () => {
    setGameState("completed");
    if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
    if (gameTimerRef.current) clearInterval(gameTimerRef.current);
    setCurrentColor(null);
    sendColorToRobot("#000000"); // turn off LED
    
    // Normalize score between 0 and 1. Max possible score varies, let's estimate 10 as perfect.
    const normalizedScore = Math.min(Math.max(score / 10, 0), 1);
    
    try {
      const result = await submitAndPersistLevelResult("reflex-dash", levelId, normalizedScore);
      setCurrentResult({
        score: normalizedScore,
        stars: result.awardedStars,
        bestScore: result.bestScore,
        isNextUnlocked: result.isNextUnlocked,
      });
    } catch (err) {
      const localStars = calculateStars(normalizedScore);
      setCurrentResult({
        score: normalizedScore,
        stars: localStars,
        bestScore: normalizedScore,
        isNextUnlocked: localStars === 3,
      });
    } finally {
      setIsModalOpen(true);
    }
  }, [score, levelId]);

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
      drivingScoreTimerRef.current = null;
    }

    if (isDriving) {
      drivingScoreTimerRef.current = setInterval(() => {
        if (!currentColor) return;
        
        if (currentColor.action === "GO") {
          setScore(s => s + 1);
          setMessage("Great driving!");
        } else {
          setScore(s => Math.max(0, s - 3));
          setMessage("STOP! You are losing points!");
        }
      }, 500); // add/subtract points every 500ms while driving
    } else {
      if (currentColor && currentColor.action === "GO") {
        setMessage("You should be moving!");
      }
    }

    return () => {
      if (drivingScoreTimerRef.current) clearInterval(drivingScoreTimerRef.current);
    };
  }, [isDriving, currentColor, gameState]);

  const handleAction = () => {
    if (gameState !== "playing" || !currentColor) return;

    const reactionTime = Date.now() - reactionStartRef.current;

    if (currentColor.action === "GO") {
      // Reward based on reaction time (faster = more points)
      if (reactionTime < 500) {
        setScore(s => s + 2);
        setMessage("Perfect!");
      } else if (reactionTime < 1000) {
        setScore(s => s + 1);
        setMessage("Good!");
      } else {
        setMessage("Too slow!");
      }
    } else {
      // Penalty for GO on STOP
      setScore(s => Math.max(0, s - 2));
      setMessage("Oops! That was a STOP color.");
    }
    
    // Immediately start next phase
    if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
    nextPhase();
  };

  return (
    <main className="min-h-screen pb-16">
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
            
            <button
              onClick={startGame}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-warning px-4 py-4 text-base font-bold text-black transition-all hover:bg-warning/90 active:scale-[0.98]"
            >
              <Play size={20} fill="currentColor" /> Start Challenge
            </button>
          </div>
        )}

        {gameState === "playing" && (
          <div className="flex flex-col items-center mt-4">
            <div className="w-full">
              <ControlPanel 
                mode="challenge" 
                game="reflex-dash" 
                isGameActive={gameState === "playing"} 
                onDrive={(dir) => setIsDriving(dir !== null)}
                customTelemetry={
                  <div className="mt-5 rounded-3xl border border-border bg-black/20 px-4 py-5">
                    <div className="w-full flex justify-between text-white/80 font-bold mb-4">
                      <span>Time: {timeLeft}s</span>
                      <span>Score: {score}</span>
                    </div>
                    
                    <div 
                      className="w-full aspect-square rounded-3xl flex items-center justify-center mb-4 border-4 transition-colors"
                      style={{ 
                        backgroundColor: currentColor ? `${currentColor.hex}33` : 'transparent',
                        borderColor: currentColor ? currentColor.hex : '#333'
                      }}
                    >
                      {currentColor ? (
                        <div className="flex flex-col items-center">
                           <span className="text-4xl font-black tracking-widest uppercase" style={{ color: currentColor.hex }}>
                             {currentColor.name}
                           </span>
                           {message && (
                             <span className="mt-2 text-sm font-bold opacity-80" style={{ color: currentColor.hex }}>
                               {message}
                             </span>
                           )}
                        </div>
                      ) : (
                        <span className="text-white/20 font-bold">Waiting...</span>
                      )}
                    </div>
                  </div>
                }
              />
            </div>
            <p className="mt-4 text-xs text-white/50 text-center">
              Drive the robot when a GO color appears.<br/>Stop immediately if a STOP color appears.
            </p>
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
