"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import SubPageHeader from "@/components/SubPageHeader";
import ResultModal from "@/components/ResultModal";
import { useBleContext } from "@/context/BleContext";
import { submitAndPersistLevelResult } from "@/lib/progressStore";
import { calculateStars } from "@/lib/colourQuest";
import { Play, AlertCircle, Gamepad2, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from "lucide-react";

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
  const { status, send, openModal, setColor, move, stop, lastMessage } = useBleContext();
  
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
    if (dir === null) {
      stop();
    } else {
      move(dir);
    }
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
    setGameState("completed");
    if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
    if (gameTimerRef.current) clearInterval(gameTimerRef.current);
    if (drivingScoreTimerRef.current) clearInterval(drivingScoreTimerRef.current);
    setCurrentColor(null);
    sendColorToRobot("#000000"); // turn off LED
    stop();
    
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
    setGameState("playing");
    setScore(0);
    setTimeLeft(totalDuration / 1000);
    
    // Start game timer just for visual countdown
    gameTimerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1 && status !== "connected") {
          // Only auto-end offline. If connected, wait for robot 'response'.
          const expectedPerfectScore = (totalDuration / 1000);
          const normalizedScore = Math.min(Math.max(score / expectedPerfectScore, 0), 1);
          handleLevelComplete(normalizedScore);
          return 0;
        }
        return Math.max(0, prev - 1);
      });
    }, 1000);

    if (status === "connected") {
      send({ command: "challenge", game: "reflex-dash", level: levelId });
    } else {
      nextPhase(); // Start offline mock loop
    }
  };

  const abortGame = useCallback(() => {
    setGameState("idle");
    if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
    if (gameTimerRef.current) clearInterval(gameTimerRef.current);
    if (drivingScoreTimerRef.current) clearInterval(drivingScoreTimerRef.current);
    setCurrentColor(null);
    sendColorToRobot("#000000"); // turn off LED
    stop();
    if (status === "connected") {
      send({ command: "abort" } as any);
    }
    router.push(`/playground/reflex-dash/challenges`);
  }, [router, send, status]);

  useEffect(() => {
    if (gameState !== "playing" || !lastMessage) return;
    
    const msg = lastMessage as any;
    if (msg.game === "reflex-dash") {
      if (msg.type === "event" && msg.event === "phase_start") {
        setCurrentColor({
          name: msg.colorName,
          hex: msg.hex,
          action: msg.isGo ? "GO" : "STOP",
        });
        setScore(Math.floor((msg.score || 0) * 100));
      } else if (msg.type === "response") {
        handleLevelComplete(msg.score);
      } else if (msg.type === "aborted") {
        abortGame();
      }
    }
  }, [lastMessage, gameState, handleLevelComplete, abortGame]);

  useEffect(() => {
    return () => {
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
      if (gameTimerRef.current) clearInterval(gameTimerRef.current);
      if (drivingScoreTimerRef.current) clearInterval(drivingScoreTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (gameState !== "playing") return; // Allow visual scoring to run while connected so UI is responsive

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
  }, [isDriving, currentColor, gameState, status]);


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
          <div 
            className="fixed inset-0 z-50 bg-[#0a0f16] flex flex-row items-center justify-between p-6 sm:p-10 overflow-hidden touch-none text-white select-none"
          >
            {/* Subtle Tech Grid Background */}
            <div className="absolute inset-0 pointer-events-none opacity-20" 
                 style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

            {/* Left controls: Circular Up/Down Pad */}
            <div className="relative w-40 h-40 sm:w-56 sm:h-56 rounded-full border-4 border-white/10 bg-white/5 flex flex-col overflow-hidden shrink-0 shadow-[0_0_30px_rgba(255,255,255,0.05)] backdrop-blur-md">
              <button 
                 className="flex-1 flex items-center justify-center bg-transparent active:bg-white/20 transition-colors"
                 onPointerDown={() => handleDrive("forward")} 
                 onPointerUp={() => handleDrive(null)}
                 onPointerLeave={() => handleDrive(null)}
                 onContextMenu={(e) => e.preventDefault()}
              >
                <ArrowUp size={48} className="text-white/50 pointer-events-none" />
              </button>
              
              {/* Center Divider / Crosshair detail */}
              <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-white/10 -translate-y-1/2 pointer-events-none" />
              <div className="absolute top-1/2 left-1/2 w-8 h-8 rounded-full border-2 border-white/20 -translate-x-1/2 -translate-y-1/2 pointer-events-none bg-[#0a0f16]" />

              <button 
                 className="flex-1 flex items-center justify-center bg-transparent active:bg-white/20 transition-colors"
                 onPointerDown={() => handleDrive("backward")} 
                 onPointerUp={() => handleDrive(null)}
                 onPointerLeave={() => handleDrive(null)}
                 onContextMenu={(e) => e.preventDefault()}
              >
                <ArrowDown size={48} className="text-white/50 pointer-events-none" />
              </button>
            </div>

            {/* Middle: Timer, Score, Current Color, Exit button */}
            <div className="flex flex-col items-center justify-center flex-1 mx-4 sm:mx-10 relative h-full">
              {/* HUD Header */}
              <div className="absolute top-0 flex items-center justify-between w-full max-w-sm text-white/50 font-black tracking-[0.2em] uppercase text-[10px] sm:text-xs">
                 <div className="flex flex-col items-center">
                   <span className="opacity-50">Time</span>
                   <span className="text-white text-lg sm:text-xl">{timeLeft}s</span>
                 </div>
                 <div className="flex flex-col items-center">
                   <span className="opacity-50">Score</span>
                   <span className="text-white text-lg sm:text-xl">{score}</span>
                 </div>
              </div>

              <div 
                className="w-full max-w-[280px] sm:max-w-xs aspect-video rounded-[2rem] flex flex-col items-center justify-center border-2 sm:border-4 transition-colors shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden mt-6"
                style={{ 
                  backgroundColor: currentColor ? `${currentColor.hex}15` : 'rgba(255,255,255,0.02)',
                  borderColor: currentColor ? currentColor.hex : 'rgba(255,255,255,0.1)'
                }}
              >
                {/* Internal HUD corners */}
                <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 opacity-50" style={{ borderColor: currentColor ? currentColor.hex : 'white' }} />
                <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 opacity-50" style={{ borderColor: currentColor ? currentColor.hex : 'white' }} />
                <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 opacity-50" style={{ borderColor: currentColor ? currentColor.hex : 'white' }} />
                <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 opacity-50" style={{ borderColor: currentColor ? currentColor.hex : 'white' }} />

                {currentColor ? (
                  <div className="flex flex-col items-center">
                     <span className="text-4xl sm:text-5xl font-black tracking-widest uppercase drop-shadow-lg" style={{ color: currentColor.hex, textShadow: `0 0 20px ${currentColor.hex}` }}>
                       {currentColor.name}
                     </span>
                     {message && (
                       <span className="mt-3 text-[10px] sm:text-xs font-bold uppercase tracking-widest opacity-90 animate-pulse bg-black/40 px-3 py-1 rounded-full" style={{ color: currentColor.hex }}>
                         {message}
                       </span>
                     )}
                  </div>
                ) : (
                  <span className="text-white/30 font-bold tracking-[0.2em] uppercase text-sm">Awaiting Signal</span>
                )}
              </div>

              <button 
                onClick={abortGame} 
                className="absolute bottom-0 text-white/30 text-[10px] sm:text-xs uppercase tracking-widest font-bold hover:text-white/80 transition-colors border border-white/10 px-4 py-2 rounded-full bg-white/5 active:bg-white/20"
              >
                Abort Challenge
              </button>
            </div>

            {/* Right controls: Circular Left/Right Pad */}
            <div className="relative w-40 h-40 sm:w-56 sm:h-56 rounded-full border-4 border-white/10 bg-white/5 flex flex-row overflow-hidden shrink-0 shadow-[0_0_30px_rgba(255,255,255,0.05)] backdrop-blur-md">
              <button 
                 className="flex-1 flex items-center justify-center bg-transparent active:bg-white/20 transition-colors"
                 onPointerDown={() => handleDrive("left")} 
                 onPointerUp={() => handleDrive(null)}
                 onPointerLeave={() => handleDrive(null)}
                 onContextMenu={(e) => e.preventDefault()}
              >
                <ArrowLeft size={48} className="text-white/50 pointer-events-none" />
              </button>
              
              {/* Center Divider / Crosshair detail */}
              <div className="absolute top-0 bottom-0 left-1/2 w-[2px] bg-white/10 -translate-x-1/2 pointer-events-none" />
              <div className="absolute top-1/2 left-1/2 w-8 h-8 rounded-full border-2 border-white/20 -translate-x-1/2 -translate-y-1/2 pointer-events-none bg-[#0a0f16]" />

              <button 
                 className="flex-1 flex items-center justify-center bg-transparent active:bg-white/20 transition-colors"
                 onPointerDown={() => handleDrive("right")} 
                 onPointerUp={() => handleDrive(null)}
                 onPointerLeave={() => handleDrive(null)}
                 onContextMenu={(e) => e.preventDefault()}
              >
                <ArrowRight size={48} className="text-white/50 pointer-events-none" />
              </button>
            </div>
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
