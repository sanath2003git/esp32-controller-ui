"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Clock, Star, Volume2, Palette, ChevronLeft, AlertTriangle } from "lucide-react";
import JoystickController, { type JoystickDirection } from "@/components/JoystickController";
import { useBleContext } from "@/context/BleContext";
import ColorWheelModal from "@/components/ColorWheelModal";
import type { MovementDirection } from "@/types/ble";

const HeadlightIcon = ({ size = 24, className = "" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M14 17V7c2.8 0 5 2.2 5 5s-2.2 5-5 5Z" />
    <line x1="9" y1="9" x2="3" y2="9" />
    <line x1="9" y1="12" x2="3" y2="12" />
    <line x1="9" y1="15" x2="3" y2="15" />
  </svg>
);

export default function DrivingProChallengePage() {
  const params = useParams<{ levelId: string }>();
  const router = useRouter();
  const levelId = Number(params.levelId);
  const { status, telemetry, move, stop, send } = useBleContext();
  
  const [colorWheelOpen, setColorWheelOpen] = useState(false);
  const [ledHex, setLedHex] = useState<string | null>(null);

  // Common State
  const [gameState, setGameState] = useState<"idle" | "playing" | "malfunction" | "repair" | "completed">("idle");
  const [score, setScore] = useState(100);

  // Joystick handling
  const activeDir = useRef<MovementDirection | null>(null);
  
  // Joystick locked state for Level 3
  const isJoystickLocked = gameState === "malfunction" || gameState === "repair";

  const handleJoystick = ({ dx, dy }: JoystickDirection) => {
    if (isJoystickLocked) return;
    
    let dir: MovementDirection | null = null;
    if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
      if (Math.abs(dy) > Math.abs(dx)) {
        dir = dy > 0 ? "forward" : "backward";
      } else {
        dir = dx > 0 ? "right" : "left";
      }
    }
    
    if (dir !== activeDir.current) {
      if (dir) void move(dir).catch(console.error);
      else void stop().catch(console.error);
      activeDir.current = dir;
    }
  };

  const handleRelease = () => {
    void stop().catch(console.error);
    activeDir.current = null;
  };

  // Peripheral actions
  const sendRgb = (r: number, g: number, b: number) => {
    setLedHex(`#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`);
    void send({ command: "color", r, g, b }).catch(console.error);
  };
  const toggleLight = () => sendRgb(255, 255, 255);
  const honk = () => void send({ command: "buzz", freq: 1000, duration: 1000 }).catch(console.error);

  const obstacle = telemetry?.obstacle;
  const distance = telemetry?.distance?.front;

  const startGame = () => {
    // Intentionally omitting 'status !== connected' check for testing purposes
    setGameState("playing");
    
    // Auto-trigger malfunction for Level 3 demo after a few seconds
    if (levelId === 3) {
      setTimeout(() => {
        setGameState("malfunction");
      }, 5000);
    }
  };

  const renderGameArea = () => {
    if (gameState === "idle") {
      return (
        <section className="rounded-2xl border border-white/10 bg-surface p-6 shadow-lg flex flex-col items-center text-center h-full justify-center">
          <h2 className="text-xl font-bold mb-2 text-white">Level {levelId} Ready</h2>
          <p className="text-sm text-white/60 mb-6 max-w-[250px]">
            {levelId === 1 && "Complete the driving tasks checklist."}
            {levelId === 2 && "React quickly to the commands on screen."}
            {levelId === 3 && "Be prepared for sudden system malfunctions."}
          </p>
          <button 
            onClick={startGame} 
            className="w-full max-w-[200px] rounded-xl bg-primary px-4 py-3 font-bold text-black shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95"
          >
            Start Mission
          </button>
          
          {status !== "connected" && (
            <p className="mt-4 text-[10px] text-amber-400 font-bold uppercase tracking-widest">
              Testing Mode: Not Connected
            </p>
          )}
        </section>
      );
    }

    if (levelId === 1) {
      return (
        <section className="rounded-2xl border border-white/10 bg-surface p-4 shadow-lg flex flex-col justify-center h-full">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-3">MISSION PROGRESS</h2>
          <div className="grid grid-cols-4 gap-2 text-xs font-semibold mb-3 text-center">
            <div className="bg-white/5 rounded-lg py-2 border border-white/10"><div className="text-white/50 text-[10px] uppercase mb-1">FWD</div><div>0/20s</div></div>
            <div className="bg-white/5 rounded-lg py-2 border border-white/10"><div className="text-white/50 text-[10px] uppercase mb-1">REV</div><div>0/5s</div></div>
            <div className="bg-white/5 rounded-lg py-2 border border-white/10"><div className="text-white/50 text-[10px] uppercase mb-1">LEFT</div><div>0/3</div></div>
            <div className="bg-white/5 rounded-lg py-2 border border-white/10"><div className="text-white/50 text-[10px] uppercase mb-1">RIGHT</div><div>0/3</div></div>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-black/40 border border-white/5">
              <div className="h-full w-[0%] bg-primary transition-all duration-300" />
            </div>
            <span className="text-[10px] font-black w-8 text-right text-white/50">0%</span>
          </div>
        </section>
      );
    }

    if (levelId === 2) {
      return (
        <section className="rounded-2xl border border-white/10 bg-surface p-6 shadow-lg flex flex-col items-center justify-center h-full text-center">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">CHALLENGE • ROUND 1/3</h2>
          <div className="text-xs text-white/50 mb-6">STEP 1 / 5</div>
          
          <div className="flex flex-col items-center bg-black/30 rounded-2xl p-6 border border-white/10 w-full max-w-[200px]">
            <div className="text-3xl mb-2">↗</div>
            <div className="font-black text-xl tracking-tight">TURN RIGHT</div>
          </div>
          
          <div className="mt-6 w-full max-w-[200px] h-2 bg-black/40 rounded-full overflow-hidden">
            <div className="h-full bg-primary w-1/5" />
          </div>
        </section>
      );
    }

    if (levelId === 3) {
      if (gameState === "malfunction") {
        return (
          <section className="rounded-2xl border border-danger/40 bg-danger/10 p-6 shadow-[0_0_30px_rgba(255,77,103,0.15)] flex flex-col items-center justify-center h-full text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-danger animate-pulse" />
            
            <AlertTriangle size={32} className="text-danger mb-3 animate-pulse" />
            <h2 className="text-xl font-black text-danger tracking-tight mb-2">SYSTEM FAILURE</h2>
            <p className="text-sm text-danger/80 mb-6">
              Driving temporarily locked. Robot is unresponsive.
            </p>
            
            <button 
              onClick={() => setGameState("repair")}
              className="w-full max-w-[200px] rounded-xl bg-danger px-4 py-3 font-bold text-white shadow-lg hover:bg-danger/80 transition-all active:scale-95"
            >
              Diagnose
            </button>
          </section>
        );
      }
      
      if (gameState === "repair") {
        return (
          <section className="rounded-2xl border border-white/10 bg-surface p-4 shadow-lg flex flex-col h-full text-sm">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-3">SYSTEM DIAGNOSTICS</h2>
            
            <div className="flex-1 overflow-y-auto space-y-2 pr-2 mb-4 font-mono text-xs">
              <div className="flex justify-between p-2 rounded bg-white/5"><span>🔋 Battery</span><span className="text-success">✓ ONLINE</span></div>
              <div className="flex justify-between p-2 rounded bg-white/5"><span>📡 Bluetooth</span><span className="text-success">✓ ONLINE</span></div>
              <div className="flex justify-between p-2 rounded bg-white/5"><span>⚙ Controller</span><span className="text-success">✓ ONLINE</span></div>
              <div className="flex justify-between p-2 rounded bg-white/5"><span>◀ Left Motor</span><span className="text-success">✓ ONLINE</span></div>
              <div className="flex justify-between p-2 rounded border border-danger/30 bg-danger/10"><span>▶ Right Motor</span><span className="text-danger font-bold">✕ ERROR</span></div>
            </div>
            
            <div className="font-bold text-xs text-white/80 mb-2">Which system failed?</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button className="bg-black/30 border border-white/10 p-2 rounded-lg hover:bg-white/10">Battery</button>
              <button className="bg-black/30 border border-white/10 p-2 rounded-lg hover:bg-white/10">Bluetooth</button>
              <button className="bg-black/30 border border-white/10 p-2 rounded-lg hover:bg-white/10">Left Motor</button>
              <button 
                onClick={() => {
                  setGameState("playing");
                  setScore(prev => prev + 20); // Reward
                }}
                className="bg-primary/20 border border-primary/50 text-primary p-2 rounded-lg hover:bg-primary/30 font-bold"
              >
                Right Motor
              </button>
            </div>
          </section>
        );
      }
      
      return (
        <section className="rounded-2xl border border-white/10 bg-surface p-6 shadow-lg flex flex-col items-center justify-center h-full text-center">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">EMERGENCY MISSION</h2>
          <div className="text-3xl mb-2 mt-4">↑</div>
          <div className="font-black text-xl tracking-tight text-success">DRIVE FORWARD</div>
        </section>
      );
    }
  };

  return (
    <main className="flex flex-col bg-background text-white" style={{ height: "100dvh", overflow: "hidden" }}>
      {/* HUD (Zone 1) */}
      <header className="flex h-[60px] shrink-0 items-center justify-between border-b border-white/10 bg-surface/50 px-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link href="/playground/driving-pro/challenges" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 transition hover:bg-white/10">
            <ChevronLeft size={20} />
          </Link>
          <div className="flex items-center gap-2 font-black">
            <span className="text-primary">◉ DRIVING PRO</span>
            <span className="text-white/40">LV {levelId}</span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm font-bold">
          <div className="flex items-center gap-1.5 text-warning">
            <Clock size={16} /> 00:60
          </div>
          <div className="flex items-center gap-1.5 text-accent">
            <Star size={16} /> {score}
          </div>
        </div>
      </header>

      {/* Dynamic Game Area (Zone 2) */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        
        {/* For Level 1 we show the side-by-side robot status on desktop, else stack */}
        <div className={`grid grid-cols-1 ${levelId === 1 ? 'md:grid-cols-2' : ''} gap-4 h-full md:h-auto min-h-0 flex-1`}>
          
          {renderGameArea()}

          {/* Robot Status Card (Always visible for L1, hidden/compact for L2/L3 to save space, but let's just show it side-by-side or below) */}
          {(levelId === 1 || levelId === 3) && gameState !== "repair" && (
            <section className="rounded-2xl border border-white/10 bg-surface p-4 shadow-lg flex items-center justify-center h-full max-h-[300px]">
               <div className="relative w-48 text-center text-[10px] font-bold uppercase tracking-widest text-white/30">
                 <div className="mb-2">FRONT</div>
                 <div className="flex justify-between my-2 text-white">
                   <span className="flex items-center gap-1"><span className={obstacle?.frontLeft ? "text-danger" : "text-primary"}>●</span> FL</span>
                   <span className="flex items-center gap-1">FR <span className={obstacle?.frontRight ? "text-danger" : "text-primary"}>●</span></span>
                 </div>
                 <div className="text-3xl my-4 opacity-50">🤖</div>
                 <div className="flex justify-between my-2 text-white">
                   <span className="flex items-center gap-1"><span className={obstacle?.rearLeft ? "text-danger" : "text-primary"}>●</span> RL</span>
                   <span className="flex items-center gap-1">RR <span className={obstacle?.rearRight ? "text-danger" : "text-primary"}>●</span></span>
                 </div>
                 <div className="mt-2">REAR</div>
                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-mono font-bold text-success text-xs bg-success/10 border border-success/30 px-2.5 py-1 rounded-full shadow-[0_0_12px_rgba(53,229,154,0.3)]">
                   {distance !== undefined && distance !== null ? `${distance}cm` : "--cm"}
                 </div>
               </div>
            </section>
          )}
        </div>
      </div>

      {/* Control Dock (Zone 3) */}
      <div className="shrink-0 border-t border-white/10 bg-surface/80 backdrop-blur-xl">
        {/* Peripherals */}
        <div className="flex items-center justify-between gap-2 p-2 px-4 h-[55px]">
          <button onClick={() => setColorWheelOpen(true)} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/5 bg-black/20 h-full text-xs font-bold text-white/60 hover:text-white hover:bg-white/10 transition">
            <div className="flex h-4 w-4 items-center justify-center rounded-full border border-white/20 shadow-inner" style={{ background: ledHex ?? "transparent", boxShadow: ledHex ? `0 0 10px ${ledHex}88` : "none" }}>
              <Palette size={10} className={ledHex ? "mix-blend-difference text-white/90" : ""} />
            </div>
            LED
          </button>
          <button onClick={honk} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/5 bg-black/20 h-full text-xs font-bold text-white/60 hover:text-white hover:bg-white/10 transition">
            <Volume2 size={16} /> HORN
          </button>
          <button onClick={toggleLight} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/5 bg-black/20 h-full text-xs font-bold text-white/60 hover:text-white hover:bg-white/10 transition">
            <HeadlightIcon size={16} /> LIGHT
          </button>
        </div>
        
        {/* Joystick Area */}
        <div className="h-[280px] p-4 pt-1 relative">
          <JoystickController disabled={isJoystickLocked} onDirectionChange={handleJoystick} onRelease={handleRelease} />
          
          {isJoystickLocked && (
            <div className="absolute inset-4 rounded-2xl flex items-center justify-center bg-black/50 backdrop-blur-[2px] z-10 border border-white/10">
              <span className="flex items-center gap-2 text-danger font-bold text-sm tracking-widest"><AlertTriangle size={18} /> DISABLED</span>
            </div>
          )}
        </div>
      </div>

      {colorWheelOpen && (
        <ColorWheelModal onClose={() => setColorWheelOpen(false)} sendRgb={sendRgb} />
      )}
    </main>
  );
}
