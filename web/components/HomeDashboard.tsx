"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  BrainCircuit,
  ChevronRight,
  Gamepad2,
  Heart,
  Lightbulb,
  Maximize2,
  Minimize2,
  Palette,
  Star,
  TrafficCone,
  Trophy,
  X,
} from "lucide-react";

import { useBleContext } from "@/context/BleContext";
import ColorWheelModal from "@/components/ColorWheelModal";
import { fetchAndSyncProgress, getTrustLevel, incrementTrustLevel } from "@/lib/progressStore";

/* ─── Trust tips ──────────────────────────────────── */
const TRUST_TIPS = [
  "Pet the robot using the touch sensor",
  "Complete learning challenges",
  "Play with the robot regularly",
  "Unlock new levels",
] as const;

/* ─── Trust Modal ─────────────────────────────────── */
function TrustModal({
  pct,
  tier,
  onClose,
}: {
  pct: number;
  tier: { label: string; color: string };
  onClose: () => void;
}) {
  const modal = (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-72 rounded-3xl border border-border bg-surface p-6 shadow-[0_24px_80px_rgba(0,0,0,0.8)]">
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close trust details"
          className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white/50 hover:bg-white/20"
        >
          <X size={14} />
        </button>

        {/* Header */}
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Trust Level</p>

        {/* Large heart */}
        <div className="mt-5 flex justify-center">
          <svg width="90" height="82" viewBox="0 0 32 30" aria-label={`Trust ${pct}%`}>
            <defs>
              <clipPath id="trust-modal-clip">
                <rect x="0" y={27 - (25 * pct) / 100} width="32" height={(25 * pct) / 100} />
              </clipPath>
            </defs>
            <path
              d="M16 27 C16 27 2 18 2 9.5 C2 5.36 5.36 2 9.5 2 C12.04 2 14.28 3.28 16 5.34 C17.72 3.28 19.96 2 22.5 2 C26.64 2 30 5.36 30 9.5 C30 18 16 27 16 27Z"
              fill="none"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="1"
            />
            <path
              d="M16 27 C16 27 2 18 2 9.5 C2 5.36 5.36 2 9.5 2 C12.04 2 14.28 3.28 16 5.34 C17.72 3.28 19.96 2 22.5 2 C26.64 2 30 5.36 30 9.5 C30 18 16 27 16 27Z"
              fill={tier.color}
              clipPath="url(#trust-modal-clip)"
            />
          </svg>
        </div>

        {/* Level label */}
        <p className="mt-3 text-center text-2xl font-black" style={{ color: tier.color }}>
          {tier.label}
        </p>
        <p className="mt-0.5 text-center text-sm text-white/40">{pct}% trust filled</p>

        {/* Tips */}
        <div className="mt-5">
          <div className="mb-2.5 flex items-center gap-1.5">
            <Lightbulb size={13} className="text-warning" />
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">How to improve</p>
          </div>
          <ul className="space-y-2">
            {TRUST_TIPS.map((tip) => (
              <li key={tip} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-white/25" />
                <span className="text-sm text-white/60">{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
  return typeof document !== "undefined" ? createPortal(modal, document.body) : null;
}


/* ─── Expression table ────────────────────────────── */
const EXPRESSIONS = [
  { id: 0,  label: "Happy",   image: "/happy.png" },
  { id: 1,  label: "Sad",     image: "/sad.png" },
  { id: 2,  label: "Heart",   image: "/heart.png" },
  { id: 3,  label: "Star",    image: "/star.png" },
  { id: 4,  label: "Check",   image: "/check.png" },
  { id: 5,  label: "Cross",   image: "/cross.png" },
  { id: 6,  label: "Warning", image: "/warning.png" },
  { id: 7,  label: "Robot",   image: "/happy.png" },
  { id: 8,  label: "Battery", image: "/battery.png" },
  { id: 9,  label: "Sleep",   image: "/sleep.png" },
  { id: 10, label: "WiFi",    image: "/wifi.png" },
] as const;

type ExpressionId = (typeof EXPRESSIONS)[number]["id"];

type ChallengeData = {
  id: string;
  name: string;
  icon: any;
  accent: string;
  done: number;
  total: number;
  score: number;
  stars?: number;
  playTime?: string | null;
};

const INITIAL_CHALLENGES: ChallengeData[] = [
  {
    id: "colour-quest",
    name: "Colour Quest",
    icon: Palette,
    accent: "#7c5cff",
    done: 0,
    total: 6,
    score: 0,
    stars: 0,
    playTime: null,
  },
  {
    id: "echo-memory",
    name: "Echo Memory",
    icon: BrainCircuit,
    accent: "#00e5ff",
    done: 0,
    total: 10,
    score: 0,
    playTime: null,
  },
  {
    id: "driving-pro",
    name: "Driving Pro",
    icon: Gamepad2,
    accent: "#ffc857",
    done: 0,
    total: 10,
    score: 0,
    playTime: null,
  },
  {
    id: "reflex-dash",
    name: "Reflex Dash",
    icon: TrafficCone,
    accent: "#ffc857",
    done: 0,
    total: 10,
    score: 0,
    playTime: null,
  },
];

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

/* ─── Today's Progress & Carousel ──────────────────────────── */
function ChallengeCarousel() {
  const [active, setActive] = useState(0);
  const [challenges, setChallenges] = useState<ChallengeData[]>(INITIAL_CHALLENGES);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let isMounted = true;
    fetchAndSyncProgress("color-quest").then((data) => {
      if (isMounted && data.success) {
        let totalScore = 0;
        let totalStars = 0;
        if (data.levels) {
          for (const lvl of Object.values(data.levels)) {
            totalScore += lvl.bestScore;
            totalStars += lvl.stars;
          }
        }
        setChallenges(prev => prev.map(c => 
          c.id === "colour-quest" 
            ? { ...c, done: data.completedLevels, total: data.totalLevels, score: totalScore, stars: totalStars }
            : c
        ));
      }
    }).catch(err => console.warn("[HOME] Failed to fetch colour quest progress", err));
    return () => { isMounted = false; };
  }, []);

  const overallStars = challenges.reduce((sum, c) => sum + (c.stars || 0), 0);
  const overallGamesDone = challenges.filter((c) => c.done > 0).length;
  const overallGamesTotal = challenges.length;

  const startAuto = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setActive((p) => (p + 1) % challenges.length);
    }, 4000);
  };

  useEffect(() => {
    startAuto();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const goTo = (i: number) => {
    setActive(i);
    startAuto();
  };

  const ch = challenges[active];
  const Icon = ch.icon;
  const pct = Math.round((ch.done / ch.total) * 100);

  // SVG parameters for circular progress
  const r = 20;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <div className="mt-5 rounded-3xl border border-border bg-black/30 p-4 pb-5">
      {/* Title Row */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy size={16} className="text-accent" />
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white">
            Today&apos;s Progress
          </p>
        </div>
        <button className="text-[10px] font-semibold text-primary transition hover:text-primary-dark">
          View All <ChevronRight size={12} className="inline -ml-0.5" />
        </button>
      </div>

      {/* Sliding Card */}
      <div className="relative flex items-center justify-between rounded-2xl border border-white/5 bg-white/5 p-3">
        
        {/* Left: Icon + Title */}
        <div 
          className="flex w-[28%] flex-col items-center justify-center gap-1.5 overflow-hidden rounded-xl border border-white/5 py-2 px-1 text-center"
          style={{ background: `linear-gradient(135deg, ${ch.accent}33 0%, rgba(0,0,0,0.4) 100%)` }}
        >
          <Icon size={20} style={{ color: ch.accent }} />
          <span className="w-full truncate text-[10px] font-bold text-white">{ch.name}</span>
        </div>

        {/* Circular Progress */}
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
          <svg className="absolute inset-0 h-full w-full -rotate-90">
            <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
            <circle
              cx="24" cy="24" r={r}
              fill="none"
              stroke={ch.accent}
              strokeWidth="4"
              strokeDasharray={c}
              strokeDashoffset={offset}
              strokeLinecap="round"
              className="transition-all duration-700 ease-in-out"
              style={{ filter: `drop-shadow(0 0 4px ${ch.accent}88)` }}
            />
          </svg>
          <span className="text-[10px] font-black text-white">{pct}%</span>
        </div>

        {/* Text Stats */}
        <div className="flex flex-col items-center gap-0.5">
          <p className="text-sm font-bold text-white">{ch.done}/{ch.total}</p>
          <p className="text-[8px] uppercase tracking-[0.05em] text-white/40">completed</p>
        </div>

        <div className="flex flex-col items-center gap-0.5">
          <div className="flex items-center gap-1">
            <Star size={10} className="text-warning" />
            <span className="text-sm font-bold text-white">{ch.score}</span>
          </div>
          <p className="text-[8px] uppercase tracking-[0.05em] text-white/40">best score</p>
        </div>

        {/* Play Time (Only shown if space permits or if data exists) */}
        {ch.playTime && (
          <div className="hidden sm:flex flex-col items-center gap-0.5">
            <div className="flex items-center gap-1">
              <Clock size={10} className="text-accent" />
              <span className="text-sm font-bold text-white">{ch.playTime}</span>
            </div>
            <p className="text-[8px] uppercase tracking-[0.05em] text-white/40">play time</p>
          </div>
        )}

        {/* Right Arrow Button */}
        <button
          onClick={() => goTo((active + 1) % challenges.length)}
          aria-label="Next game"
          className="ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 active:scale-95"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Dots */}
      <div className="mt-3 mb-5 flex justify-center gap-1.5">
        {challenges.map((c, i) => (
          <button
            key={c.id}
            type="button"
            aria-label={`Go to ${c.name}`}
            onClick={() => goTo(i)}
            className="h-1 rounded-full transition-all duration-300"
            style={{
              width: i === active ? "16px" : "6px",
              background: i === active ? ch.accent : "rgba(255,255,255,0.2)",
            }}
          />
        ))}
      </div>

      {/* Bottom Summary (2 columns) */}
      <div className="mt-2 grid grid-cols-2 gap-3 border-t border-border/60 pt-4">
        {/* Total Stars */}
        <div className="flex items-center justify-center gap-2.5">
          <Star size={24} className="shrink-0 text-warning drop-shadow-[0_0_6px_rgba(255,200,87,0.5)]" />
          <div className="flex flex-col text-left">
            <span className="text-sm font-black leading-tight text-white">{overallStars}</span>
            <span className="text-[8px] uppercase leading-tight tracking-wider text-white/45 mt-0.5">Total Stars<br />earned</span>
          </div>
        </div>
        {/* Games Played */}
        <div className="flex items-center justify-center gap-2.5">
          <Gamepad2 size={24} className="shrink-0 text-[#7c5cff] drop-shadow-[0_0_6px_rgba(124,92,255,0.5)]" />
          <div className="flex flex-col text-left">
            <span className="text-sm font-black leading-tight text-white">{overallGamesDone}/{overallGamesTotal}</span>
            <span className="text-[8px] uppercase leading-tight tracking-wider text-white/45 mt-0.5">Games Played<br />today</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main component ──────────────────────────────── */
export default function HomeDashboard() {
  const { status, send, openModal, lastMessage } = useBleContext();
  const router = useRouter();

  const isConnected = status === "connected";

  const [selectedExpression, setSelectedExpression] = useState<ExpressionId>(
    isConnected ? 0 : 9
  );
  const [expressionAnimating, setExpressionAnimating] = useState(false);
  const [colorWheelOpen, setColorWheelOpen] = useState(false);
  const [petFullscreen, setPetFullscreen] = useState(false);
  const [trustOpen, setTrustOpen] = useState(false);
  
  const [trustLevel, setTrustLevel] = useState(50);

  // Initialize and listen for trust changes
  useEffect(() => {
    setTrustLevel(getTrustLevel());
    
    const onTrustChange = (e: Event) => {
      const ce = e as CustomEvent<number>;
      setTrustLevel(ce.detail);
    };
    window.addEventListener("trustLevelChanged", onTrustChange);
    return () => window.removeEventListener("trustLevelChanged", onTrustChange);
  }, []);



  /* Auto-switch expression based on connection status */
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isConnected) {
        setSelectedExpression(0); // Happy
      } else {
        setSelectedExpression(9); // Sleep
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [isConnected]);

  /* Hide/show AppHeader + BottomNav during fullscreen */
  useEffect(() => {
    if (petFullscreen) {
      document.body.classList.add("pet-fullscreen");
    } else {
      document.body.classList.remove("pet-fullscreen");
    }
    return () => document.body.classList.remove("pet-fullscreen");
  }, [petFullscreen]);

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
      await send({ command: "oled_emoji", emoji_id: id } as Parameters<typeof send>[0]);
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
      router.push("/rc-mode");
    }
  };

  const currentMood = MOOD_LABELS[selectedExpression];

  return (
    <section
      aria-label="Home dashboard"
      className="overflow-hidden rounded-3xl border border-border bg-surface p-4 shadow-[0_24px_80px_rgba(0,0,0,0.22)] sm:p-5"
    >
      {/* Robo Control header */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          Robo Control
        </p>
      </div>



      {/* ── Pet Status ── */}
      <div
        className={`mt-4 rounded-3xl border border-border bg-black p-5 transition-all duration-300 ${
          petFullscreen
            ? "fixed inset-0 z-[200] m-0 rounded-none overflow-y-auto border-0"
            : ""
        }`}
      >

        {/* Header: label left | fullscreen btn + controller btn right */}
        <div className={`flex items-center justify-between ${petFullscreen ? "pt-safe" : ""}`}>
          <div className="flex items-center gap-2">
            <Heart size={16} className="text-accent" />
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
              Pet Status
            </p>
          </div>

          {/* Right-side button group */}
          <div className="flex items-center gap-2">
            {/* Fullscreen toggle button */}
            <button
              type="button"
              id="pet-status-fullscreen-btn"
              onClick={() => setPetFullscreen((v) => !v)}
              aria-label={petFullscreen ? "Exit fullscreen" : "Fullscreen pet status"}
              className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white/8 border border-white/10 transition hover:bg-white/12 active:scale-95"
            >
              {petFullscreen
                ? <Minimize2 size={18} className="text-white/70" />
                : <Maximize2 size={18} className="text-white/70" />}
            </button>

            {/* Controller button — dark circle, gamepad icon, connection dot */}
            <button
              type="button"
              id="pet-status-controller-btn"
              onClick={handleControllerButton}
              aria-label={isConnected ? "Open controller" : "Connect to robot"}
              className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white/8 border border-white/10 transition hover:bg-white/12 active:scale-95"
            >
              <Gamepad2 size={22} className="text-white/70" />
              {/* Connection notification dot */}
              <span
                aria-hidden="true"
                className={`absolute right-0.5 top-0.5 h-3 w-3 rounded-full border-2 border-black transition-colors ${
                  isConnected
                    ? "bg-success shadow-[0_0_6px_rgba(53,229,154,0.9)]"
                    : status === "connecting"
                      ? "bg-warning animate-pulse shadow-[0_0_6px_rgba(255,200,87,0.7)]"
                      : "bg-danger shadow-[0_0_6px_rgba(255,77,103,0.9)]"
                }`}
              />
            </button>
          </div>
        </div>

        {/* ── Normal mode: face centred + side buttons ── */}
        {!petFullscreen && (
          <div className="mt-4 relative flex items-start justify-center">

            {/* Robot face image — centred, borderless */}
            <div
              className={`relative flex h-44 w-44 shrink-0 items-center justify-center overflow-hidden rounded-[2.75rem] bg-black transition-all duration-300 ${
                expressionAnimating ? "scale-105" : ""
              }`}
            >
              <Image
                src={EXPRESSIONS.find((e) => e.id === selectedExpression)?.image ?? "/happy.png"}
                alt={`Robot expression: ${EXPRESSIONS.find((e) => e.id === selectedExpression)?.label ?? "Happy"}`}
                width={176}
                height={176}
                className="h-full w-full object-cover"
                priority
              />
            </div>

            {/* Vertical button column — Trust + LED — absolutely pinned to the right */}
            <div className="absolute right-0 top-0 flex flex-col items-center gap-3">

              {/* Trust Level button */}
              {(() => {
                const pct = trustLevel;
                const tier =
                  pct >= 67
                    ? { label: "High Trust",   color: "#35e59a" }
                    : pct >= 34
                    ? { label: "Medium Trust", color: "#ffc857" }
                    : { label: "Low Trust",    color: "#ff4d67" };
                return (
                  <div className="flex flex-col items-center gap-1">
                    <button
                      type="button"
                      id="pet-trust-btn"
                      onClick={() => setTrustOpen(true)}
                      aria-label={`Trust level: ${tier.label}`}
                      className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white/8 border border-white/10 transition hover:bg-white/12 active:scale-95"
                    >
                      <svg width="22" height="20" viewBox="0 0 32 30" aria-hidden="true">
                        <defs>
                          <clipPath id="pet-heart-clip">
                            <rect x="0" y={27 - (25 * pct) / 100} width="32" height={(25 * pct) / 100} />
                          </clipPath>
                        </defs>
                        <path
                          d="M16 27 C16 27 2 18 2 9.5 C2 5.36 5.36 2 9.5 2 C12.04 2 14.28 3.28 16 5.34 C17.72 3.28 19.96 2 22.5 2 C26.64 2 30 5.36 30 9.5 C30 18 16 27 16 27Z"
                          fill="none"
                          stroke="#3b82f6"
                          strokeWidth="1.5"
                        />
                        <path
                          d="M16 27 C16 27 2 18 2 9.5 C2 5.36 5.36 2 9.5 2 C12.04 2 14.28 3.28 16 5.34 C17.72 3.28 19.96 2 22.5 2 C26.64 2 30 5.36 30 9.5 C30 18 16 27 16 27Z"
                          fill={tier.color}
                          clipPath="url(#pet-heart-clip)"
                        />
                      </svg>
                    </button>
                    <p className="text-[9px] uppercase tracking-[0.15em] text-white/30">Trust</p>
                  </div>
                );
              })()}

              {/* LED Color button */}
              <div className="flex flex-col items-center gap-1">
                <button
                  type="button"
                  id="pet-color-wheel-btn"
                  aria-label="Open robot light color picker"
                  onClick={() => setColorWheelOpen(true)}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-white/8 border border-white/10 transition hover:bg-white/12 active:scale-95"
                >
                  <svg width="20" height="20" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <defs>
                      <radialGradient id="pet-rg" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="white" stopOpacity="0.9" />
                        <stop offset="100%" stopColor="white" stopOpacity="0" />
                      </radialGradient>
                      <linearGradient id="pet-hg" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%"   stopColor="#ff0000" />
                        <stop offset="16%"  stopColor="#ffff00" />
                        <stop offset="33%"  stopColor="#00ff00" />
                        <stop offset="50%"  stopColor="#00ffff" />
                        <stop offset="66%"  stopColor="#0000ff" />
                        <stop offset="83%"  stopColor="#ff00ff" />
                        <stop offset="100%" stopColor="#ff0000" />
                      </linearGradient>
                    </defs>
                    <circle cx="8" cy="8" r="7.5" fill="url(#pet-hg)" />
                    <circle cx="8" cy="8" r="7.5" fill="url(#pet-rg)" />
                    <circle cx="8" cy="8" r="3" fill="#080b14" />
                  </svg>
                </button>
                <p className="text-[9px] uppercase tracking-[0.15em] text-white/30">LED</p>
              </div>

            </div>
          </div>
        )}

        {/* ── Fullscreen mode: face centred with padding + exit button overlay ── */}
        {petFullscreen && (
          <div className="fixed inset-0 z-[201] bg-black">
            {/* Exit fullscreen button — absolute top-right overlay */}
            <button
              type="button"
              id="pet-exit-fullscreen-btn"
              onClick={() => setPetFullscreen(false)}
              aria-label="Exit fullscreen"
              style={{ position: 'absolute', top: '24px', right: '24px', zIndex: 202 }}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 border border-white/20 text-white backdrop-blur-md transition hover:bg-white/20 active:scale-95"
            >
              <Minimize2 size={20} />
            </button>

            {/* Centering wrapper for the face */}
            <div className="absolute inset-0 flex items-center justify-center p-8">
              <div
                className={`relative w-full max-w-sm aspect-square max-h-[70vh] overflow-hidden rounded-[3rem] transition-transform duration-300 ${
                  expressionAnimating ? "scale-105" : ""
                }`}
              >
                <Image
                  src={EXPRESSIONS.find((e) => e.id === selectedExpression)?.image ?? "/happy.png"}
                  alt={`Robot expression: ${EXPRESSIONS.find((e) => e.id === selectedExpression)?.label ?? "Happy"}`}
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            </div>
          </div>
        )}

        {/* Status text — hidden in fullscreen */}
        {!petFullscreen && (
          <div className="mt-4 text-center">
            <p className="text-lg font-bold text-white">
              {isConnected ? `Feeling ${currentMood}!` : "Waiting for my robot…"}
            </p>
            <p className="mt-1 text-sm text-white/45">
              {isConnected
                ? "Keep playing and take care of your Robo."
                : "Connect your robot to get started."}
            </p>
          </div>
        )}

        {/* ── Mood stat row — commented out, not needed ──
        <div className="mt-5 flex w-full items-stretch gap-0 rounded-2xl border border-border bg-black/30 overflow-hidden">
          <div className="flex flex-1 flex-col items-center justify-center gap-1.5 py-3 px-2">
            <SmilePlus size={18} className="text-accent" />
            <p className="text-sm font-bold text-white leading-tight text-center">{currentMood}</p>
            <p className="text-[9px] uppercase tracking-[0.15em] text-white/30">Mood</p>
          </div>
        </div>
        ── */}

        {/* Expression picker — hidden in fullscreen */}
        {!petFullscreen && (
          <div className="mt-4">
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
              className="w-full rounded-xl border border-border bg-black/40 px-3 py-2.5 text-sm font-semibold text-white transition focus:border-accent focus:outline-none"
              style={{ colorScheme: "dark" }}
            >
              {EXPRESSIONS.map(({ id, label }) => (
                <option key={id} value={id}>
                  #{id} — {label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ── Today's Progress (Sliding Card Layout) ── */}
      <ChallengeCarousel />

      {/* Color wheel modal — portalled to body */}
      {colorWheelOpen && (
        <ColorWheelModal
          onClose={() => setColorWheelOpen(false)}
          sendRgb={sendRgb}
        />
      )}

      {/* Trust modal — portalled to body, rendered at section level so close btn works */}
      {trustOpen && (() => {
        const pct = trustLevel;
        const tier =
          pct >= 67
            ? { label: "High Trust",   color: "#35e59a" }
            : pct >= 34
            ? { label: "Medium Trust", color: "#ffc857" }
            : { label: "Low Trust",    color: "#ff4d67" };
        return (
          <TrustModal
            pct={pct}
            tier={tier}
            onClose={() => setTrustOpen(false)}
          />
        );
      })()}
    </section>
  );
}