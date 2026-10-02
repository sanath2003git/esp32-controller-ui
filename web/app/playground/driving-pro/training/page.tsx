"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Clock, Star, Volume2, Palette, ChevronLeft, Play, RotateCcw, CheckCircle2 } from "lucide-react";
import JoystickController, { type JoystickDirection } from "@/components/JoystickController";
import { useBleContext } from "@/context/BleContext";
import ColorWheelModal from "@/components/ColorWheelModal";
import type { MovementDirection } from "@/types/ble";
import {
  useDrivingProGame,
  L1_FWD_TARGET_MS,
  L1_REV_TARGET_MS,
  L1_LEFT_TARGET,
  L1_RIGHT_TARGET,
} from "@/lib/useDrivingProGame";

const HeadlightIcon = ({ size = 24, className = "" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M14 17V7c2.8 0 5 2.2 5 5s-2.2 5-5 5Z" />
    <line x1="9" y1="9" x2="3" y2="9" />
    <line x1="9" y1="12" x2="3" y2="12" />
    <line x1="9" y1="15" x2="3" y2="15" />
  </svg>
);

function CheckRow({ label, value, target, unit }: { label: string; value: number; target: number; unit?: string }) {
  const pct = Math.min(value / target, 1);
  const done = pct >= 1;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-[11px] font-bold">
        <span className={done ? "text-success" : "text-white/60"}>{label}</span>
        <span className={done ? "text-success" : "text-white"}>
          {unit === "s" ? `${(value / 1000).toFixed(1)}/${target / 1000}s` : `${value}/${target}`}
          {done && " ✓"}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-black/40 border border-white/5">
        <div
          className={`h-full transition-all duration-300 rounded-full ${done ? "bg-success" : "bg-primary"}`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  );
}

export default function DrivingProTraining() {
  const { status, telemetry, move, stop, send } = useBleContext();
  const game = useDrivingProGame(1); // Level 1 for training
  const { state } = game;

  const [colorWheelOpen, setColorWheelOpen] = useState(false);
  const [ledHex, setLedHex] = useState<string | null>(null);

  const activeDir = useRef<MovementDirection | null>(null);
  const AXIS_MARGIN = 1.2;

  const handleJoystick = ({ dx, dy }: JoystickDirection) => {
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    let dir: MovementDirection | null = null;

    if (absDx > 0.08 || absDy > 0.08) {
      const cur = activeDir.current;
      const isVert = cur === "forward" || cur === "backward";
      const isHoriz = cur === "left" || cur === "right";
      let useVert: boolean;
      if (isVert) useVert = absDy * AXIS_MARGIN >= absDx;
      else if (isHoriz) useVert = absDy > absDx * AXIS_MARGIN;
      else useVert = absDy >= absDx;

      dir = useVert ? (dy > 0 ? "forward" : "backward") : dx > 0 ? "right" : "left";
    }

    if (dir !== activeDir.current) {
      activeDir.current = dir;
      if (dir) void move(dir).catch(console.error);
      else void stop().catch(console.error);
      game.notifyDirection(dir);
    }
  };

  const handleRelease = () => {
    activeDir.current = null;
    game.notifyDirection(null);
    void stop().catch(console.error);
  };

  useEffect(() => {
    if (telemetry && state.phase !== "idle" && state.phase !== "finished") {
      game.handleTelemetry(telemetry);
    }
  }, [telemetry]);

  const sendRgb = (r: number, g: number, b: number) => {
    setLedHex(`#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`);
    void send({ command: "color", r, g, b }).catch(console.error);
  };
  const toggleLight = () => sendRgb(255, 255, 255);
  const honk = () => void send({ command: "buzz", freq: 1000, duration: 1000 }).catch(console.error);

  const obstacle = telemetry?.obstacle;
  const distance = telemetry?.distance?.front;

  const l1 = state.l1;
  const timeLeftSec = l1 ? Math.ceil(l1.timeLeftMs / 1000) : 60;
  const hudTimeStr = `00:${timeLeftSec.toString().padStart(2, "0")}`;

  const totalPct = l1
    ? ((Math.min(l1.forwardMs, L1_FWD_TARGET_MS) / L1_FWD_TARGET_MS +
        Math.min(l1.reverseMs, L1_REV_TARGET_MS) / L1_REV_TARGET_MS +
        Math.min(l1.leftTurns, L1_LEFT_TARGET) / L1_LEFT_TARGET +
        Math.min(l1.rightTurns, L1_RIGHT_TARGET) / L1_RIGHT_TARGET) /
      4) * 100
    : 0;

  // Finished screen
  if (state.phase === "finished") {
    const score = state.finalScore ?? 0;
    const stars = score >= 80 ? 3 : score >= 50 ? 2 : score >= 20 ? 1 : 0;
    return (
      <main className="flex flex-col bg-background text-white" style={{ height: "100dvh", overflow: "hidden" }}>
        <header className="flex h-[60px] shrink-0 items-center border-b border-white/10 bg-surface/50 px-4 backdrop-blur-md">
          <span className="font-black text-primary">◉ DRIVING PRO · Training</span>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/20 text-primary shadow-[0_0_40px_rgba(124,92,255,0.3)]">
            <CheckCircle2 size={40} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary">Training Complete</p>
            <h1 className="mt-2 text-5xl font-black tabular-nums">{score}</h1>
            <p className="mt-1 text-sm text-white/50">out of 100 points</p>
          </div>
          <div className="flex gap-1">
            {[1, 2, 3].map((n) => (
              <Star key={n} size={28} className={n <= stars ? "fill-amber-400 text-amber-400" : "text-white/20"} />
            ))}
          </div>
          <div className="flex w-full max-w-xs flex-col gap-3">
            <button
              onClick={() => { game.stopGame(); void stop().catch(console.error); }}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 font-bold text-black transition hover:bg-primary/90 active:scale-95"
            >
              <RotateCcw size={18} /> Try Again
            </button>
            <Link href="/playground/driving-pro" className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 font-bold transition hover:bg-white/10">
              <ChevronLeft size={18} /> Back
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col bg-background text-white" style={{ height: "100dvh", overflow: "hidden" }}>
      {/* HUD */}
      <header className="flex h-[60px] shrink-0 items-center justify-between border-b border-white/10 bg-surface/50 px-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link href="/playground/driving-pro" onClick={() => { game.stopGame(); void stop().catch(console.error); }} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 transition hover:bg-white/10">
            <ChevronLeft size={20} />
          </Link>
          <div className="flex items-center gap-2 font-black">
            <span className="text-primary">◉ DRIVING PRO</span>
            <span className="text-white/40">Training</span>
          </div>
        </div>
        {state.phase === "l1_training" && (
          <div className="flex items-center gap-4 text-sm font-bold">
            <div className="flex items-center gap-1.5 text-warning"><Clock size={16} />{hudTimeStr}</div>
          </div>
        )}
      </header>

      {/* Game Area */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {state.phase === "idle" ? (
          <section className="flex h-full flex-col items-center justify-center rounded-2xl border border-white/10 bg-surface p-6 text-center shadow-lg min-h-[200px]">
            <h2 className="text-xl font-bold mb-2">Driver Training</h2>
            <p className="text-sm text-white/60 mb-6 max-w-[240px]">
              Practice the basic maneuvers: 20s forward, 5s reverse, 3 left turns and 3 right turns — all in 60 seconds.
            </p>
            <button onClick={game.startGame} className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-bold text-black shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95">
              <Play size={18} fill="currentColor" /> Start Training
            </button>
            {status !== "connected" && (
              <p className="mt-4 text-[10px] text-amber-400 font-bold uppercase tracking-widest">Testing Mode · Not Connected</p>
            )}
          </section>
        ) : l1 ? (
          <div className="flex flex-col gap-4">
            <section className="rounded-2xl border border-white/10 bg-surface p-4 shadow-lg flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-[10px] font-bold uppercase tracking-widest text-primary">Checklist</h2>
                <span className="text-xs font-bold text-white/50">{l1.collisions} collision{l1.collisions !== 1 ? "s" : ""} (−{l1.collisions * 10}pts)</span>
              </div>
              <CheckRow label="Drive Forward" value={l1.forwardMs} target={L1_FWD_TARGET_MS} unit="s" />
              <CheckRow label="Reverse" value={l1.reverseMs} target={L1_REV_TARGET_MS} unit="s" />
              <CheckRow label="Left Turns" value={l1.leftTurns} target={L1_LEFT_TARGET} />
              <CheckRow label="Right Turns" value={l1.rightTurns} target={L1_RIGHT_TARGET} />
              <div className="flex items-center gap-3 mt-1">
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-black/40 border border-white/5">
                  <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-300" style={{ width: `${totalPct}%` }} />
                </div>
                <span className="text-xs font-black text-white/60 w-10 text-right">{Math.round(totalPct)}%</span>
              </div>
            </section>

            <section className="flex-1 rounded-2xl border border-white/10 bg-surface p-4 shadow-lg flex items-center justify-center min-h-[140px]">
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
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-mono font-bold text-success text-xs bg-success/10 border border-success/30 px-2.5 py-1 rounded-full">
                  {distance !== undefined && distance !== null ? `${distance}cm` : "--cm"}
                </div>
              </div>
            </section>
          </div>
        ) : null}
      </div>

      {/* Control Dock */}
      <div className="shrink-0 border-t border-white/10 bg-surface/80 backdrop-blur-xl">
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
        <div className="h-[280px] p-4 pt-1">
          <JoystickController onDirectionChange={handleJoystick} onRelease={handleRelease} />
        </div>
      </div>

      {colorWheelOpen && <ColorWheelModal onClose={() => setColorWheelOpen(false)} sendRgb={sendRgb} />}
    </main>
  );
}
