"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Award,
  CheckCircle2,
  Clock3,
  Gamepad2,
  Heart,
  SmilePlus,
  Swords,
  Trophy,
  Zap,
} from "lucide-react";

import { useBleContext } from "@/context/BleContext";

/* ─── Expression table ────────────────────────────── */
const EXPRESSIONS = [
  { id: 0,  label: "Happy"   },
  { id: 1,  label: "Sad"     },
  { id: 2,  label: "Heart"   },
  { id: 3,  label: "Star"    },
  { id: 4,  label: "Check"   },
  { id: 5,  label: "Cross"   },
  { id: 6,  label: "Warning" },
  { id: 7,  label: "Robot"   },
  { id: 8,  label: "Battery" },
  { id: 9,  label: "Sleep"   },
  { id: 10, label: "WiFi"    },
] as const;

type ExpressionId = (typeof EXPRESSIONS)[number]["id"];

/* ─── Challenge progress data ─────────────────────── */
const CHALLENGES = [
  {
    id: "colour-quest",
    name: "Colour Quest",
    icon: Zap,
    accent: "#00e5ff",
    done: 4,
    total: 10,
    score: 320,
  },
  {
    id: "echo-memory",
    name: "Echo Memory",
    icon: Trophy,
    accent: "#7c5cff",
    done: 7,
    total: 10,
    score: 580,
  },
  {
    id: "driving-pro",
    name: "Driving Pro",
    icon: Swords,
    accent: "#35e59a",
    done: 2,
    total: 10,
    score: 150,
  },
  {
    id: "reflex-dash",
    name: "Reflex Dash",
    icon: Award,
    accent: "#ffc857",
    done: 9,
    total: 10,
    score: 910,
  },
] as const;

/* ─── Mood map ────────────────────────────────────── */
const MOOD_LABELS: Record<ExpressionId, string> = {
  0:  "Happy",
  1:  "Sad",
  2:  "Loving",
  3:  "Starry",
  4:  "Accomplished",
  5:  "Frustrated",
  6:  "Alert",
  7:  "Robot Mode",
  8:  "Low Power",
  9:  "Sleepy",
  10: "Searching…",
};

/* ─── Preset light colors ─────────────────────────── */
const PRESET_COLORS = [
  { label: "Red",    hex: "#ff0000", r: 255, g: 0,   b: 0   },
  { label: "Green",  hex: "#00ff00", r: 0,   g: 255, b: 0   },
  { label: "Blue",   hex: "#0000ff", r: 0,   g: 0,   b: 255 },
  { label: "Yellow", hex: "#ffff00", r: 255, g: 255, b: 0   },
  { label: "Purple", hex: "#a020f0", r: 160, g: 32,  b: 240 },
  { label: "White",  hex: "#ffffff", r: 255, g: 255, b: 255 },
  { label: "Off",    hex: "#000000", r: 0,   g: 0,   b: 0   },
];

/* ─── Canvas Color Wheel Modal ────────────────────── */
function ColorWheelModal({
  onClose,
  sendRgb,
}: {
  onClose: () => void;
  sendRgb: (r: number, g: number, b: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pickedColor, setPickedColor] = useState<{ r: number; g: number; b: number } | null>(null);
  const [indicator, setIndicator] = useState<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);
  const SIZE = 220;
  const RADIUS = SIZE / 2;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    for (let angle = 0; angle < 360; angle++) {
      const startAngle = ((angle - 1) * Math.PI) / 180;
      const endAngle   = ((angle + 1) * Math.PI) / 180;
      const gradient = ctx.createRadialGradient(RADIUS, RADIUS, 0, RADIUS, RADIUS, RADIUS);
      gradient.addColorStop(0,   "white");
      gradient.addColorStop(0.5, `hsl(${angle}, 100%, 50%)`);
      gradient.addColorStop(1,   "black");
      ctx.beginPath();
      ctx.moveTo(RADIUS, RADIUS);
      ctx.arc(RADIUS, RADIUS, RADIUS, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();
    }
  }, [RADIUS]);

  const sampleColor = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0]!.clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0]!.clientY : e.clientY;
    const x = (clientX - rect.left) * (SIZE / rect.width);
    const y = (clientY - rect.top)  * (SIZE / rect.height);
    const dx = x - RADIUS, dy = y - RADIUS;
    if (Math.sqrt(dx * dx + dy * dy) > RADIUS) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pixel = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
    const r = pixel[0]!, g = pixel[1]!, b = pixel[2]!;
    setPickedColor({ r, g, b });
    setIndicator({ x: clientX - rect.left, y: clientY - rect.top });
    sendRgb(r, g, b);
  };

  const toHex = (c: { r: number; g: number; b: number }) =>
    `#${[c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;

  const modal = (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative rounded-3xl border border-border bg-surface p-6 shadow-[0_24px_80px_rgba(0,0,0,0.7)]" style={{ width: "280px" }}>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Pick a Color</p>
          <button type="button" onClick={onClose} className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white/50 hover:bg-white/20" aria-label="Close">✕</button>
        </div>
        <div className="relative mx-auto" style={{ width: SIZE, height: SIZE }}>
          <canvas
            ref={canvasRef} width={SIZE} height={SIZE}
            className="cursor-crosshair rounded-full"
            style={{ display: "block", width: SIZE, height: SIZE }}
            onMouseDown={(e) => { dragging.current = true; sampleColor(e); }}
            onMouseMove={(e) => { if (dragging.current) sampleColor(e); }}
            onMouseUp={() => { dragging.current = false; }}
            onMouseLeave={() => { dragging.current = false; }}
            onTouchStart={(e) => { dragging.current = true; sampleColor(e); }}
            onTouchMove={(e) => { if (dragging.current) sampleColor(e); }}
            onTouchEnd={() => { dragging.current = false; }}
          />
          {indicator && (
            <div className="pointer-events-none absolute" style={{
              left: indicator.x - 8, top: indicator.y - 8, width: 16, height: 16,
              borderRadius: "50%", border: "2.5px solid white",
              boxShadow: pickedColor ? `0 0 0 1.5px rgba(0,0,0,0.6), 0 0 8px ${toHex(pickedColor)}` : "0 0 0 1.5px rgba(0,0,0,0.6)",
              background: pickedColor ? toHex(pickedColor) : "transparent",
            }} />
          )}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <div className="h-10 w-10 shrink-0 rounded-xl border border-white/15"
            style={{ background: pickedColor ? toHex(pickedColor) : "rgba(255,255,255,0.08)", boxShadow: pickedColor ? `0 0 14px ${toHex(pickedColor)}88` : "none" }}
          />
          <p className="text-xs text-white/40">{pickedColor ? toHex(pickedColor).toUpperCase() : "Drag on wheel to pick"}</p>
        </div>
        <div className="mt-4">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">Presets</p>
          <div className="grid grid-cols-7 gap-1.5">
            {PRESET_COLORS.map(({ label, hex, r, g, b }) => (
              <button key={label} type="button" title={label}
                onClick={() => { sendRgb(r, g, b); onClose(); }}
                className="group flex flex-col items-center gap-1"
              >
                <span className="h-7 w-7 rounded-full border-2 border-white/10 transition group-hover:scale-110 group-hover:border-white/40"
                  style={{ background: hex, boxShadow: hex === "#000000" ? "0 0 0 1px rgba(255,255,255,0.15) inset" : `0 0 8px ${hex}88` }}
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modal, document.body) : null;
}

/* ─── Challenge Carousel ──────────────────────────── */
function ChallengeCarousel() {
  const [active, setActive] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startAuto = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setActive((p) => (p + 1) % CHALLENGES.length);
    }, 3000);
  };

  useEffect(() => {
    startAuto();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goTo = (i: number) => {
    setActive(i);
    startAuto();
  };

  const ch = CHALLENGES[active];
  const Icon = ch.icon;
  const pct = Math.round((ch.done / ch.total) * 100);

  return (
    <div className="mt-3 rounded-2xl border border-border bg-black/20 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={15} style={{ color: ch.accent }} />
          <span
            className="text-sm font-bold"
            style={{ color: ch.accent }}
          >
            {ch.name}
          </span>
        </div>
        <span className="text-xs text-white/40">
          {ch.done}/{ch.total} completed
        </span>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: ch.accent, boxShadow: `0 0 8px ${ch.accent}88` }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-white/40">
        <span>{pct}% done</span>
        <span className="font-bold text-white">{ch.score} pts</span>
      </div>

      {/* Dots */}
      <div className="mt-3 flex justify-center gap-2">
        {CHALLENGES.map((c, i) => (
          <button
            key={c.id}
            type="button"
            aria-label={`Go to ${c.name}`}
            onClick={() => goTo(i)}
            className="h-1.5 rounded-full transition-all duration-300"
            style={{
              width: i === active ? "20px" : "6px",
              background: i === active ? ch.accent : "rgba(255,255,255,0.2)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* ─── Main component ──────────────────────────────── */
export default function HomeDashboard() {
  const { status, send, openModal } = useBleContext();
  const router = useRouter();

  const [selectedExpression, setSelectedExpression] = useState<ExpressionId>(0);
  const [expressionAnimating, setExpressionAnimating] = useState(false);
  const [colorWheelOpen, setColorWheelOpen] = useState(false);

  const isConnected = status === "connected";

  const sendRgb = (r: number, g: number, b: number) => {
    void send({ command: "color", r, g, b }).catch((err: unknown) => {
      console.error("[HOME] Color send failed", err);
    });
  };

  /* Send expression to robot */
  const sendExpression = async (id: ExpressionId) => {
    setSelectedExpression(id);
    setExpressionAnimating(true);
    setTimeout(() => setExpressionAnimating(false), 700);
    try {
      // Custom command — extend as needed with your firmware protocol
      await send({ command: "move", direction: "forward" } as Parameters<typeof send>[0]);
      // TODO: replace with real expression command when firmware supports it
    } catch {
      // silently ignore when disconnected
    }
  };

  const handleExpressionChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    void sendExpression(Number(e.target.value) as ExpressionId);
  };

  const handleControllerButton = () => {
    if (!isConnected) {
      openModal();
    } else {
      router.push("/playground/free-drive");
    }
  };

  const currentMood = MOOD_LABELS[selectedExpression];

  return (
    <section
      aria-label="Home dashboard"
      className="overflow-hidden rounded-3xl border border-border bg-surface p-4 shadow-[0_24px_80px_rgba(0,0,0,0.22)] sm:p-5"
    >
      {/* Robo Control header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            Robo Control
          </p>
        </div>

        <div
          className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
            isConnected
              ? "border-success/30 bg-success/10 text-success"
              : status === "connecting"
                ? "border-warning/30 bg-warning/10 text-warning"
                : "border-white/10 bg-white/5 text-white/45"
          }`}
        >
          {isConnected
            ? "Live"
            : status === "connecting"
              ? "Connecting"
              : "Offline"}
        </div>
      </div>

      {/* Connection banner */}
      {!isConnected && (
        <p className="mt-4 rounded-2xl border border-warning/25 bg-warning/10 px-4 py-3 text-sm text-warning">
          {status === "connecting"
            ? "Connecting to robot. Home controls will unlock when ready."
            : "Robot disconnected. Connect to unlock robot controls."}
        </p>
      )}

      {/* ── Robot Status Card ── */}
      <div className="mt-5 rounded-3xl border border-border bg-black/20 p-4">
        <div className="flex items-stretch gap-2" style={{ minHeight: "86px" }}>

          {/* Column 1: Mood — centred */}
          <div className="flex flex-1 flex-col items-center justify-center gap-1.5">
            <SmilePlus size={22} className="text-accent" />
            <p className="text-lg font-bold text-white leading-tight text-center">{currentMood}</p>
          </div>

          {/* Divider */}
          <div className="w-px self-stretch bg-white/8 rounded-full" />

          {/* Column 2: Trust Level — partially filled heart + label, centred */}
          <div className="flex flex-1 flex-col items-center justify-center gap-1.5">
            {(() => {
              const pct = 58;
              const tier =
                pct >= 67
                  ? { label: "Best Friend", color: "#35e59a" }
                  : pct >= 34
                  ? { label: "Unsure",      color: "#ffc857" }
                  : { label: "Broken Bond", color: "#ff4d67" };
              const fillPct = pct; // 0–100

              return (
                <>
                  {/* Partially filled heart via SVG clipPath */}
                  <svg
                    width="32" height="30" viewBox="0 0 32 30"
                    aria-label={`Trust level ${fillPct}%`}
                  >
                    <defs>
                      <clipPath id="heart-fill-clip">
                        {/* Rectangle that grows upward as fillPct increases */}
                        <rect
                          x="0"
                          y={30 - (30 * fillPct) / 100}
                          width="32"
                          height={( 30 * fillPct) / 100}
                        />
                      </clipPath>
                    </defs>
                    {/* Outline heart (empty) */}
                    <path
                      d="M16 27 C16 27 2 18 2 9.5 C2 5.36 5.36 2 9.5 2 C12.04 2 14.28 3.28 16 5.34 C17.72 3.28 19.96 2 22.5 2 C26.64 2 30 5.36 30 9.5 C30 18 16 27 16 27Z"
                      fill="none"
                      stroke="rgba(255,255,255,0.15)"
                      strokeWidth="1.5"
                    />
                    {/* Filled portion */}
                    <path
                      d="M16 27 C16 27 2 18 2 9.5 C2 5.36 5.36 2 9.5 2 C12.04 2 14.28 3.28 16 5.34 C17.72 3.28 19.96 2 22.5 2 C26.64 2 30 5.36 30 9.5 C30 18 16 27 16 27Z"
                      fill={tier.color}
                      clipPath="url(#heart-fill-clip)"
                      style={{ filter: `drop-shadow(0 0 6px ${tier.color}aa)` }}
                    />
                  </svg>
                  <span
                    className="text-[11px] font-bold uppercase tracking-[0.08em] text-center"
                    style={{ color: tier.color }}
                  >
                    {tier.label}
                  </span>
                </>
              );
            })()}
          </div>

          {/* Divider */}
          <div className="w-px self-stretch bg-white/8 rounded-full" />

          {/* Column 3: Color Wheel */}
          <div className="flex flex-1 flex-col items-center justify-center">
            <button
              type="button"
              id="color-wheel-btn"
              aria-label="Open robot light color picker"
              onClick={() => setColorWheelOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/30 transition hover:border-primary/50 hover:bg-primary/10"
            >
              <svg width="20" height="20" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <defs>
                  <radialGradient id="rg2" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="white" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="white" stopOpacity="0" />
                  </radialGradient>
                  <linearGradient id="hg2" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%"   stopColor="#ff0000" />
                    <stop offset="16%"  stopColor="#ffff00" />
                    <stop offset="33%"  stopColor="#00ff00" />
                    <stop offset="50%"  stopColor="#00ffff" />
                    <stop offset="66%"  stopColor="#0000ff" />
                    <stop offset="83%"  stopColor="#ff00ff" />
                    <stop offset="100%" stopColor="#ff0000" />
                  </linearGradient>
                </defs>
                <circle cx="8" cy="8" r="7.5" fill="url(#hg2)" />
                <circle cx="8" cy="8" r="7.5" fill="url(#rg2)" />
                <circle cx="8" cy="8" r="3" fill="#080b14" />
              </svg>
            </button>
          </div>

          {/* Divider */}
          <div className="w-px self-stretch bg-white/8 rounded-full" />

          {/* Column 4: Controller button */}
          <button
            type="button"
            id="controller-connect-btn"
            onClick={handleControllerButton}
            aria-label={isConnected ? "Open controller" : "Connect to robot"}
            style={{ width: "86px" }}
            className={`self-stretch shrink-0 flex items-center justify-center rounded-xl border transition ${
              isConnected
                ? "border-success/30 bg-success/10 hover:bg-success/20"
                : "border-white/15 bg-white/5 hover:border-accent/40 hover:bg-accent/10"
            }`}
          >
            <Gamepad2
              size={28}
              className={isConnected ? "text-success" : "text-white/40"}
            />
          </button>

        </div>
      </div>

      {/* ── Pet Status ── */}
      <div className="mt-5 rounded-3xl border border-border bg-black/20 p-5">
        <div className="flex items-center gap-2">
          <Heart size={16} className="text-accent" />
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
            Pet Status
          </p>
        </div>

        <div className="mt-4 flex flex-col items-center">
          {/* Robot face image */}
          <div
            className={`relative flex h-44 w-44 items-center justify-center overflow-hidden rounded-[2.75rem] border border-primary/40 bg-black shadow-[0_0_45px_rgba(0,229,255,0.25)] transition-all duration-300 ${
              expressionAnimating
                ? "scale-105 shadow-[0_0_60px_rgba(0,229,255,0.5)]"
                : ""
            }`}
          >
            <Image
              src="/robot-face.jpg"
              alt={`Robot expression: ${EXPRESSIONS.find((e) => e.id === selectedExpression)?.label ?? "Happy"}`}
              width={176}
              height={176}
              className="h-full w-full object-cover"
              priority
            />
          </div>

          <p className="mt-4 text-lg font-bold text-white">
            {isConnected
              ? `Feeling ${currentMood}!`
              : "Waiting for my robot…"}
          </p>

          <p className="mt-1 text-center text-sm text-white/45">
            {isConnected
              ? "Keep playing and take care of your Robo."
              : "Connect your robot to get started."}
          </p>

          {/* Expression picker dropdown */}
          <div className="mt-4 w-full">
            <label
              htmlFor="expression-select"
              className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.15em] text-white/40"
            >
              Face Expression
            </label>
            <select
              id="expression-select"
              value={selectedExpression}
              onChange={handleExpressionChange}
              disabled={!isConnected}
              className="w-full rounded-xl border border-border bg-black/40 px-3 py-2.5 text-sm font-semibold text-white transition focus:border-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
              style={{ colorScheme: "dark" }}
            >
              {EXPRESSIONS.map(({ id, label }) => (
                <option key={id} value={id}>
                  #{id} — {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Today's Progress ── */}
      <div className="mt-5">
        <div className="flex items-center gap-2">
          <Trophy size={16} className="text-accent" />
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
            Today&apos;s Progress
          </p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          {/* Daily Challenge */}
          <div className="rounded-2xl border border-border bg-black/20 p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-success" />
              <span className="text-xs text-white/45">Daily Challenge</span>
            </div>
            <p className="mt-2 text-2xl font-black text-white">
              3<span className="text-sm text-white/35">/10</span>
            </p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-success" style={{ width: "30%" }} />
            </div>
          </div>

          {/* Total Stars */}
          <div className="rounded-2xl border border-border bg-black/20 p-4">
            <div className="flex items-center gap-2">
              <Award size={16} className="text-warning" />
              <span className="text-xs text-white/45">Total Stars</span>
            </div>
            <p className="mt-2 text-2xl font-black text-white">12</p>
            <p className="mt-1 text-xs text-white/35">Stars earned</p>
          </div>

          {/* Best Score */}
          <div className="rounded-2xl border border-border bg-black/20 p-4">
            <div className="flex items-center gap-2">
              <Trophy size={16} className="text-accent" />
              <span className="text-xs text-white/45">Best Score</span>
            </div>
            <p className="mt-2 text-2xl font-black text-white">1,250</p>
            <p className="mt-1 text-xs text-white/35">Personal best</p>
          </div>

          {/* Daily Play Time */}
          <div className="rounded-2xl border border-border bg-black/20 p-4">
            <div className="flex items-center gap-2">
              <Clock3 size={16} className="text-accent" />
              <span className="text-xs text-white/45">Play Time</span>
            </div>
            <p className="mt-2 text-2xl font-black text-white">
              20<span className="text-sm text-white/35">m</span>
            </p>
            <p className="mt-1 text-xs text-white/35">of 30m today</p>
          </div>
        </div>

        {/* Challenge Carousel */}
        <ChallengeCarousel />
      </div>

      {/* Color wheel modal — portalled to body */}
      {colorWheelOpen && (
        <ColorWheelModal
          onClose={() => setColorWheelOpen(false)}
          sendRgb={sendRgb}
        />
      )}
    </section>
  );
}