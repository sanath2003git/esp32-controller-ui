"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Clock, Star, Volume2, Palette, ChevronLeft } from "lucide-react";
import JoystickController, { type JoystickDirection } from "@/components/JoystickController";
import { useBleContext } from "@/context/BleContext";
import ColorWheelModal from "@/components/ColorWheelModal";
import type { MovementDirection } from "@/types/ble";

const HeadlightIcon = ({ size = 24, className = "" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M14 17V7c2.8 0 5 2.2 5 5s-2.2 5-5 5Z" />
    <line x1="9" y1="9" x2="3" y2="9" />
    <line x1="9" y1="12" x2="3" y2="12" />
    <line x1="9" y1="15" x2="3" y2="15" />
  </svg>
);

export default function DrivingProTraining() {
  const { status, telemetry, move, stop, send } = useBleContext();
  const [colorWheelOpen, setColorWheelOpen] = useState(false);
  const [ledHex, setLedHex] = useState<string | null>(null);

  // Example state for Level 1 Mission
  const [timeLeft, setTimeLeft] = useState(60);
  const [fwdTime, setFwdTime] = useState(0);
  const [revTime, setRevTime] = useState(0);
  const [leftTurns, setLeftTurns] = useState(0);
  const [rightTurns, setRightTurns] = useState(0);
  const [score, setScore] = useState(100);

  // Joystick handling
  const activeDir = useRef<MovementDirection | null>(null);

  const handleJoystick = ({ dx, dy }: JoystickDirection) => {
    let dir: MovementDirection | null = null;
    if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
      if (Math.abs(dy) > Math.abs(dx)) {
        dir = dy > 0 ? "forward" : "backward";
      } else {
        dir = dx > 0 ? "right" : "left";
      }
    }
    
    if (dir !== activeDir.current) {
      if (dir) {
        void move(dir).catch(console.error);
      } else {
        void stop().catch(console.error);
      }
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

  return (
    <main className="flex flex-col bg-background text-white" style={{ height: "100dvh", overflow: "hidden" }}>
      {/* HUD (Zone 1) */}
      <header className="flex h-[60px] shrink-0 items-center justify-between border-b border-white/10 bg-surface/50 px-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link href="/playground/driving-pro" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 transition hover:bg-white/10">
            <ChevronLeft size={20} />
          </Link>
          <div className="flex items-center gap-2 font-black">
            <span className="text-primary">◉ DRIVING PRO</span>
            <span className="text-white/40">LV 1</span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm font-bold">
          <div className="flex items-center gap-1.5 text-warning">
            <Clock size={16} /> 00:{timeLeft.toString().padStart(2, "0")}
          </div>
          <div className="flex items-center gap-1.5 text-accent">
            <Star size={16} /> {score}
          </div>
        </div>
      </header>

      {/* Dynamic Game Area (Zone 2) */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full md:h-auto">
          
          {/* Mission Card */}
          <section className="rounded-2xl border border-white/10 bg-surface p-4 shadow-lg flex flex-col justify-center">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-3">MISSION</h2>
            <div className="grid grid-cols-4 gap-2 text-xs font-semibold mb-3">
              <div><span className="text-white/50">FWD</span> 0/20s</div>
              <div><span className="text-white/50">REV</span> 0/5s</div>
              <div><span className="text-white/50">L</span> 0/3</div>
              <div><span className="text-white/50">R</span> 0/3</div>
            </div>
            {/* Progress bar */}
            <div className="flex items-center gap-3">
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-black/40 border border-white/5">
                <div className="h-full w-[0%] bg-primary transition-all duration-300" />
              </div>
              <span className="text-[10px] font-black w-8 text-right text-white/50">0%</span>
            </div>
          </section>

          {/* Robot Status Card */}
          <section className="rounded-2xl border border-white/10 bg-surface p-4 shadow-lg flex items-center justify-center">
             <div className="relative w-48 text-center text-[10px] font-bold uppercase tracking-widest text-white/30">
               <div className="mb-2">FRONT</div>
               
               <div className="flex justify-between my-2 text-white">
                 <span className="flex items-center gap-1">
                   <span className={obstacle?.frontLeft ? "text-danger" : "text-primary"}>●</span> FL
                 </span>
                 <span className="flex items-center gap-1">
                   FR <span className={obstacle?.frontRight ? "text-danger" : "text-primary"}>●</span>
                 </span>
               </div>
               
               <div className="text-3xl my-4 opacity-50">🤖</div>
               
               <div className="flex justify-between my-2 text-white">
                 <span className="flex items-center gap-1">
                   <span className={obstacle?.rearLeft ? "text-danger" : "text-primary"}>●</span> RL
                 </span>
                 <span className="flex items-center gap-1">
                   RR <span className={obstacle?.rearRight ? "text-danger" : "text-primary"}>●</span>
                 </span>
               </div>
               
               <div className="mt-2">REAR</div>
               
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-mono font-bold text-success text-xs bg-success/10 border border-success/30 px-2.5 py-1 rounded-full shadow-[0_0_12px_rgba(53,229,154,0.3)]">
                 {distance !== undefined && distance !== null ? `${distance}cm` : "--cm"}
               </div>
             </div>
          </section>
        </div>
      </div>

      {/* Control Dock (Zone 3) */}
      <div className="shrink-0 border-t border-white/10 bg-surface/80 backdrop-blur-xl">
        {/* Peripherals */}
        <div className="flex items-center justify-between gap-2 p-2 px-4 h-[55px]">
          <button 
            onClick={() => setColorWheelOpen(true)} 
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/5 bg-black/20 h-full text-xs font-bold text-white/60 hover:text-white hover:bg-white/10 transition"
          >
            <div
              className="flex h-4 w-4 items-center justify-center rounded-full border border-white/20 shadow-inner"
              style={{
                background: ledHex ?? "transparent",
                boxShadow: ledHex ? `0 0 10px ${ledHex}88` : "none",
              }}
            >
              <Palette size={10} className={ledHex ? "mix-blend-difference text-white/90" : ""} />
            </div>
            LED
          </button>
          
          <button 
            onClick={honk} 
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/5 bg-black/20 h-full text-xs font-bold text-white/60 hover:text-white hover:bg-white/10 transition"
          >
            <Volume2 size={16} /> HORN
          </button>
          
          <button 
            onClick={toggleLight} 
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/5 bg-black/20 h-full text-xs font-bold text-white/60 hover:text-white hover:bg-white/10 transition"
          >
            <HeadlightIcon size={16} /> LIGHT
          </button>
        </div>
        
        {/* Joystick Area */}
        <div className="h-[280px] p-4 pt-1">
          <JoystickController onDirectionChange={handleJoystick} onRelease={handleRelease} />
        </div>
      </div>

      {colorWheelOpen && (
        <ColorWheelModal onClose={() => setColorWheelOpen(false)} sendRgb={sendRgb} />
      )}
    </main>
  );
}
