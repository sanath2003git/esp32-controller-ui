"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Clock,
  Star,
  Volume2,
  Palette,
  ChevronLeft,
  AlertTriangle,
  CheckCircle2,
  Play,
  RotateCcw,
} from "lucide-react";
import JoystickController, {
  type JoystickDirection,
} from "@/components/JoystickController";
import { useBleContext } from "@/context/BleContext";
import ColorWheelModal from "@/components/ColorWheelModal";
import type { MovementDirection } from "@/types/ble";
import {
  useDrivingProGame,
  L1_FWD_TARGET_MS,
  L1_REV_TARGET_MS,
  L1_LEFT_TARGET,
  L1_RIGHT_TARGET,
  L1_TOTAL_SECONDS,
  type L3DiagnosticSystem,
} from "@/lib/useDrivingProGame";

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

// ── Small progress row ────────────────────────────────────────
function CheckRow({
  label,
  value,
  target,
  unit,
}: {
  label: string;
  value: number;
  target: number;
  unit?: string;
}) {
  const pct = Math.min(value / target, 1);
  const done = pct >= 1;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-[11px] font-bold">
        <span className={done ? "text-success" : "text-white/60"}>{label}</span>
        <span className={done ? "text-success" : "text-white"}>
          {unit === "s"
            ? `${(value / 1000).toFixed(1)}/${target / 1000}s`
            : `${value}/${target}`}
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

export default function DrivingProChallengePage() {
  const params = useParams<{ levelId: string }>();
  const router = useRouter();
  const levelId = Number(params.levelId);

  const { status, telemetry, move, stop, send } = useBleContext();
  const game = useDrivingProGame(levelId);
  const { state } = game;

  const [colorWheelOpen, setColorWheelOpen] = useState(false);
  const [ledHex, setLedHex] = useState<string | null>(null);
  const [repairFeedback, setRepairFeedback] = useState<
    "correct" | "wrong" | null
  >(null);

  // Track active direction for the game engine AND BLE
  const activeDir = useRef<MovementDirection | null>(null);
  const AXIS_MARGIN = 1.2;

  const handleJoystick = ({ dx, dy }: JoystickDirection) => {
    if (state.phase === "l3_malfunction") return;

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

      dir = useVert
        ? dy > 0
          ? "forward"
          : "backward"
        : dx > 0
          ? "right"
          : "left";
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

  // Feed telemetry into game engine
  useEffect(() => {
    if (telemetry && state.phase !== "idle" && state.phase !== "finished") {
      game.handleTelemetry(telemetry);
    }
  }, [telemetry]);

  // Peripheral helpers
  const sendRgb = (r: number, g: number, b: number) => {
    setLedHex(
      `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`
    );
    void send({ command: "color", r, g, b }).catch(console.error);
  };
  const toggleLight = () => sendRgb(255, 255, 255);
  const honk = () =>
    void send({ command: "buzz", freq: 1000, duration: 1000 }).catch(
      console.error
    );

  const obstacle = telemetry?.obstacle;
  const distance = telemetry?.distance?.front;

  const handleRepair = (key: L3DiagnosticSystem) => {
    const correct = game.submitRepair(key);
    setRepairFeedback(correct ? "correct" : "wrong");
    if (!correct) setTimeout(() => setRepairFeedback(null), 1200);
  };

  const isJoystickLocked = state.phase === "l3_malfunction";

  // ── Finished screen ───────────────────────────────────────
  if (state.phase === "finished") {
    const score = state.finalScore ?? 0;
    const stars = score >= 80 ? 3 : score >= 50 ? 2 : score >= 20 ? 1 : 0;
    return (
      <main
        className="flex flex-col bg-background text-white"
        style={{ height: "100dvh", overflow: "hidden" }}
      >
        <header className="flex h-[60px] shrink-0 items-center justify-between border-b border-white/10 bg-surface/50 px-4 backdrop-blur-md">
          <span className="font-black text-primary">◉ DRIVING PRO · LV {levelId}</span>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/20 text-primary shadow-[0_0_40px_rgba(124,92,255,0.3)]">
            <CheckCircle2 size={40} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary">
              Mission Complete
            </p>
            <h1 className="mt-2 text-5xl font-black tabular-nums">{score}</h1>
            <p className="mt-1 text-sm text-white/50">out of 100 points</p>
          </div>
          <div className="flex gap-1">
            {[1, 2, 3].map((n) => (
              <Star
                key={n}
                size={28}
                className={n <= stars ? "fill-amber-400 text-amber-400" : "text-white/20"}
              />
            ))}
          </div>
          <div className="flex w-full max-w-xs flex-col gap-3">
            <button
              onClick={() => {
                game.stopGame();
                void stop().catch(console.error);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 font-bold text-black transition hover:bg-primary/90 active:scale-95"
            >
              <RotateCcw size={18} /> Play Again
            </button>
            <Link
              href="/playground/driving-pro/challenges"
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 font-bold transition hover:bg-white/10"
            >
              <ChevronLeft size={18} /> Back to Levels
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // ── Game Area content by level ────────────────────────────
  const renderGameArea = () => {
    // IDLE — start screen
    if (state.phase === "idle") {
      return (
        <section className="flex h-full flex-col items-center justify-center rounded-2xl border border-white/10 bg-surface p-6 text-center shadow-lg">
          <h2 className="text-xl font-bold text-white mb-2">Level {levelId}</h2>
          <p className="text-sm text-white/60 mb-6 max-w-[240px]">
            {levelId === 1 &&
              "Complete forward 20s, reverse 5s, 3 left turns and 3 right turns within 60 seconds."}
            {levelId === 2 &&
              "Follow 3 rounds of randomly generated driving commands and react to emergency stops."}
            {levelId === 3 &&
              "Drive for 30s, diagnose a system failure, then complete a final emergency sequence."}
          </p>
          <button
            onClick={game.startGame}
            className="flex w-full max-w-[200px] items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-bold text-black shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95"
          >
            <Play size={18} fill="currentColor" /> Start Mission
          </button>
          {status !== "connected" && (
            <p className="mt-4 text-[10px] text-amber-400 font-bold uppercase tracking-widest">
              Testing Mode · Not Connected
            </p>
          )}
        </section>
      );
    }

    // ── Level 1 ──────────────────────────────────────────────
    if (levelId === 1 && state.l1) {
      const l1 = state.l1;
      const timeLeftSec = Math.ceil(l1.timeLeftMs / 1000);
      const totalPct =
        ((Math.min(l1.forwardMs, L1_FWD_TARGET_MS) / L1_FWD_TARGET_MS +
          Math.min(l1.reverseMs, L1_REV_TARGET_MS) / L1_REV_TARGET_MS +
          Math.min(l1.leftTurns, L1_LEFT_TARGET) / L1_LEFT_TARGET +
          Math.min(l1.rightTurns, L1_RIGHT_TARGET) / L1_RIGHT_TARGET) /
          4) *
        100;

      return (
        <div className="flex h-full flex-col gap-4">
          <section className="rounded-2xl border border-white/10 bg-surface p-4 shadow-lg flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-primary">
                Checklist
              </h2>
              <span className="text-xs font-bold text-white/50">
                {l1.collisions} collision{l1.collisions !== 1 ? "s" : ""} (−{l1.collisions * 10}pts)
              </span>
            </div>
            <CheckRow label="Drive Forward" value={l1.forwardMs} target={L1_FWD_TARGET_MS} unit="s" />
            <CheckRow label="Reverse" value={l1.reverseMs} target={L1_REV_TARGET_MS} unit="s" />
            <CheckRow label="Left Turns" value={l1.leftTurns} target={L1_LEFT_TARGET} />
            <CheckRow label="Right Turns" value={l1.rightTurns} target={L1_RIGHT_TARGET} />
            <div className="mt-1 flex items-center gap-3">
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-black/40 border border-white/5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-300"
                  style={{ width: `${totalPct}%` }}
                />
              </div>
              <span className="text-xs font-black text-white/60 w-10 text-right">
                {Math.round(totalPct)}%
              </span>
            </div>
          </section>

          <section className="flex-1 rounded-2xl border border-white/10 bg-surface p-4 shadow-lg flex items-center justify-center">
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
      );
    }

    // ── Level 2 ──────────────────────────────────────────────
    if (levelId === 2 && state.l2) {
      const l2 = state.l2;
      const step = l2.steps[l2.stepIndex];
      const isEmergency = step?.kind === "emergency";
      const cmd = step?.kind === "command" ? step.command : null;

      const arrowMap: Record<string, string> = {
        forward: "↑",
        backward: "↓",
        left: "←",
        right: "→",
      };

      return (
        <section className="flex h-full flex-col items-center justify-center rounded-2xl border border-white/10 bg-surface p-6 shadow-lg text-center gap-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-primary">
            Round {l2.round} / {l2.totalRounds} · Step {l2.stepIndex + 1} / {l2.steps.length}
          </div>

          {isEmergency ? (
            <div className="flex flex-col items-center gap-2">
              <AlertTriangle size={48} className="text-danger animate-pulse" />
              <div className="text-2xl font-black text-danger tracking-tight">
                EMERGENCY STOP!
              </div>
              <p className="text-xs text-danger/70">Release the joystick NOW</p>
            </div>
          ) : cmd ? (
            <div className="flex flex-col items-center gap-2">
              <div className="text-7xl font-black text-white leading-none">
                {arrowMap[cmd]}
              </div>
              <div className="text-xl font-black tracking-tight uppercase text-white">
                {cmd}
              </div>
              <p className="text-xs text-white/50">Hold for 1.5s to confirm</p>
            </div>
          ) : (
            <div className="text-sm text-white/50">Preparing next command…</div>
          )}

          <div className="text-xs font-semibold text-white/40">
            Score: {l2.score} pts · {l2.collisions} collision{l2.collisions !== 1 ? "s" : ""}
          </div>
        </section>
      );
    }

    // ── Level 3: drive phase ─────────────────────────────────
    if (levelId === 3 && state.l3) {
      const l3 = state.l3;

      if (state.phase === "l3_malfunction") {
        const scenario = l3.scenario!;
        return (
          <section className="relative flex h-full flex-col rounded-2xl border border-danger/40 bg-danger/10 p-6 shadow-[0_0_30px_rgba(255,77,103,0.15)] overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-danger animate-pulse" />
            <div className="flex flex-col items-center justify-center flex-1 text-center gap-3">
              <AlertTriangle size={32} className="text-danger animate-pulse" />
              <h2 className="text-xl font-black text-danger">SYSTEM FAILURE</h2>
              <p className="text-xs text-danger/80 mb-2">
                Diagnose the fault to resume driving.
              </p>

              {repairFeedback === "wrong" && (
                <div className="text-xs font-bold text-danger bg-danger/20 border border-danger/30 rounded-xl px-4 py-2 mb-2">
                  Wrong — try again (−15 pts)
                </div>
              )}
              {repairFeedback === "correct" && (
                <div className="text-xs font-bold text-success bg-success/20 border border-success/30 rounded-xl px-4 py-2 mb-2">
                  ✓ Correct! System restored (+30 pts)
                </div>
              )}

              <div className="w-full space-y-2 text-xs font-mono mb-3">
                {scenario.systems.map((sys) => (
                  <div
                    key={sys.key}
                    className={`flex justify-between p-2 rounded-lg border ${
                      sys.ok
                        ? "border-success/20 bg-success/10"
                        : "border-danger/30 bg-danger/10"
                    }`}
                  >
                    <span className="text-white/80">{sys.name}</span>
                    <span className={sys.ok ? "text-success" : "text-danger font-black"}>
                      {sys.ok ? "✓ ONLINE" : "✕ ERROR"}
                    </span>
                  </div>
                ))}
              </div>

              <p className="text-xs font-bold text-white/70 mb-2">
                Which system failed?
              </p>
              <div className="grid grid-cols-2 gap-2 w-full text-xs">
                {scenario.systems.map((sys) => (
                  <button
                    key={sys.key}
                    onClick={() => handleRepair(sys.key as L3DiagnosticSystem)}
                    className="rounded-xl border border-white/10 bg-white/5 p-2 font-bold text-white/70 hover:bg-white/15 transition active:scale-95"
                  >
                    {sys.name}
                  </button>
                ))}
              </div>
            </div>
          </section>
        );
      }

      if (state.phase === "l3_final" && l3.finalSteps.length > 0) {
        const step = l3.finalSteps[l3.finalStepIndex];
        const isEmergency = step?.kind === "emergency";
        const cmd = step?.kind === "command" ? step.command : null;
        const arrowMap: Record<string, string> = { forward: "↑", backward: "↓", left: "←", right: "→" };
        return (
          <section className="flex h-full flex-col items-center justify-center rounded-2xl border border-white/10 bg-surface p-6 shadow-lg text-center gap-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-primary">
              FINAL SEQUENCE · {l3.finalStepIndex + 1} / {l3.finalSteps.length}
            </div>
            {isEmergency ? (
              <div className="flex flex-col items-center gap-2">
                <AlertTriangle size={48} className="text-danger animate-pulse" />
                <div className="text-2xl font-black text-danger">EMERGENCY STOP!</div>
              </div>
            ) : cmd ? (
              <div className="flex flex-col items-center gap-2">
                <div className="text-7xl font-black leading-none">{arrowMap[cmd]}</div>
                <div className="text-xl font-black uppercase">{cmd}</div>
              </div>
            ) : null}
            <div className="text-xs text-white/40">Score: {l3.score} pts</div>
          </section>
        );
      }

      // l3 drive phase
      return (
        <section className="flex h-full flex-col items-center justify-center rounded-2xl border border-white/10 bg-surface p-6 shadow-lg text-center gap-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2">
            Phase 1: Drive
          </div>
          <div className="text-sm text-white/60 max-w-[220px]">
            Drive freely. A system failure will trigger in about 30 seconds…
          </div>
          <div className="relative w-40">
            <div className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2 text-center">FRONT</div>
            <div className="flex justify-between text-white text-[10px]">
              <span className={obstacle?.frontLeft ? "text-danger" : "text-primary"}>● FL</span>
              <span className={obstacle?.frontRight ? "text-danger" : "text-primary"}>FR ●</span>
            </div>
            <div className="text-2xl my-3 text-center opacity-50">🤖</div>
            <div className="flex justify-between text-white text-[10px]">
              <span className={obstacle?.rearLeft ? "text-danger" : "text-primary"}>● RL</span>
              <span className={obstacle?.rearRight ? "text-danger" : "text-primary"}>RR ●</span>
            </div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-white/30 mt-2 text-center">REAR</div>
          </div>
          <div className="font-mono text-xs text-success border border-success/30 bg-success/10 rounded-full px-3 py-1">
            {distance !== undefined && distance !== null ? `${distance}cm` : "--cm"}
          </div>
        </section>
      );
    }

    return null;
  };

  // ── Compute HUD values ────────────────────────────────────
  let hudTimeStr = "00:00";
  let hudScore = 0;

  if (state.l1) {
    const sec = Math.ceil(state.l1.timeLeftMs / 1000);
    hudTimeStr = `00:${sec.toString().padStart(2, "0")}`;
    const fwdPct = Math.min(state.l1.forwardMs / L1_FWD_TARGET_MS, 1);
    const revPct = Math.min(state.l1.reverseMs / L1_REV_TARGET_MS, 1);
    const lPct = Math.min(state.l1.leftTurns / L1_LEFT_TARGET, 1);
    const rPct = Math.min(state.l1.rightTurns / L1_RIGHT_TARGET, 1);
    hudScore = Math.max(
      0,
      Math.round(((fwdPct + revPct + lPct + rPct) / 4) * 100 - state.l1.collisions * 10)
    );
  } else if (state.l2) {
    hudScore = state.l2.score;
  } else if (state.l3) {
    hudScore = state.l3.score;
  }

  return (
    <main
      className="flex flex-col bg-background text-white"
      style={{ height: "100dvh", overflow: "hidden" }}
    >
      {/* HUD */}
      <header className="flex h-[60px] shrink-0 items-center justify-between border-b border-white/10 bg-surface/50 px-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link
            href="/playground/driving-pro/challenges"
            onClick={() => { game.stopGame(); void stop().catch(console.error); }}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 transition hover:bg-white/10"
          >
            <ChevronLeft size={20} />
          </Link>
          <div className="flex items-center gap-2 font-black">
            <span className="text-primary">◉ DRIVING PRO</span>
            <span className="text-white/40">LV {levelId}</span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm font-bold">
          {state.l1 && (
            <div className="flex items-center gap-1.5 text-warning">
              <Clock size={16} />
              {hudTimeStr}
            </div>
          )}
          <div className="flex items-center gap-1.5 text-accent">
            <Star size={16} /> {hudScore}
          </div>
        </div>
      </header>

      {/* Game Area */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="h-full min-h-[200px]">{renderGameArea()}</div>
      </div>

      {/* Control Dock */}
      <div className="shrink-0 border-t border-white/10 bg-surface/80 backdrop-blur-xl">
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

        <div className="h-[280px] p-4 pt-1 relative">
          <JoystickController
            disabled={isJoystickLocked}
            onDirectionChange={handleJoystick}
            onRelease={handleRelease}
          />
          {isJoystickLocked && (
            <div className="absolute inset-4 rounded-2xl flex items-center justify-center bg-black/60 backdrop-blur-[2px] z-10 border border-danger/30">
              <span className="flex items-center gap-2 text-danger font-bold text-sm tracking-widest">
                <AlertTriangle size={18} /> CONTROLS LOCKED
              </span>
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
