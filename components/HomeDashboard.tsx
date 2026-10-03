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
  type LucideIcon,
} from "lucide-react";

import { useBleContext } from "@/context/BleContext";
import ColorWheelModal from "@/components/ColorWheelModal";
import { fetchAndSyncProgress, getTrustLevel } from "@/lib/progressStore";

/* ─── Trust tips ──────────────────────────────────── */
const TRUST_TIPS = [
  "Pet ELXIE using the physical touch sensor",
  "Complete challenge levels to earn stars",
  "Play with ELXIE regularly every day",
  "Unlock higher difficulty game modes",
] as const;

/* ─── Dynamic Mood Definition based on Trust & Connection ─── */
type PetMood = {
  image: string;
  label: string;
  title: string;
  tip: string;
  badgeBg: string;
  badgeText: string;
  color: string;
};

function getPetMood(isConnected: boolean, trustLevel: number): PetMood {
  if (!isConnected) {
    return {
      image: "/sleep.png",
      label: "Offline",
      title: "ELXIE is Sleeping…",
      tip: "Connect Bluetooth to wake up ELXIE and start playing!",
      badgeBg: "bg-white/10 border-white/20",
      badgeText: "text-white/60",
      color: "#94a3b8",
    };
  }

  if (trustLevel <= 20) {
    return {
      image: "/sad.png",
      label: "Shy & Distrustful",
      title: "Feeling Shy & Distrustful",
      tip: "ELXIE feels distant. Pet ELXIE's touch sensor or play easy challenges to build trust!",
      badgeBg: "bg-rose-500/15 border-rose-500/30",
      badgeText: "text-rose-400",
      color: "#ff4d67",
    };
  }

  if (trustLevel <= 40) {
    return {
      image: "/warning.png",
      label: "Cautious",
      title: "Warming Up To You",
      tip: "ELXIE is getting curious about you. Keep spending time together!",
      badgeBg: "bg-amber-500/15 border-amber-500/30",
      badgeText: "text-amber-400",
      color: "#ffc857",
    };
  }

  if (trustLevel <= 60) {
    return {
      image: "/happy.png",
      label: "Content",
      title: "Happy & Content",
      tip: "ELXIE loves hanging out with you! Try completing a new challenge level together.",
      badgeBg: "bg-emerald-500/15 border-emerald-500/30",
      badgeText: "text-emerald-400",
      color: "#35e59a",
    };
  }

  if (trustLevel <= 80) {
    return {
      image: "/star.png",
      label: "Joyful",
      title: "Excited & Joyful!",
      tip: "ELXIE sparkles whenever you interact! You are building a strong bond.",
      badgeBg: "bg-cyan-500/15 border-cyan-500/30",
      badgeText: "text-cyan-400",
      color: "#00e5ff",
    };
  }

  return {
    image: "/heart.png",
    label: "Best Friends",
    title: "Best Friends Forever! ❤️",
    tip: "ELXIE trusts you completely! You are the ultimate companion.",
    badgeBg: "bg-primary/20 border-primary/40",
    badgeText: "text-primary",
    color: "#7c5cff",
  };
}

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
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-72 rounded-3xl border border-border bg-surface p-6 shadow-[0_24px_80px_rgba(0,0,0,0.8)]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close trust details"
          className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white/50 hover:bg-white/20"
        >
          <X size={14} />
        </button>

        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
          Trust Level
        </p>

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

        <p className="mt-3 text-center text-2xl font-black" style={{ color: tier.color }}>
          {tier.label}
        </p>
        <p className="mt-0.5 text-center text-sm text-white/40">{pct}% trust filled</p>

        <div className="mt-5">
          <div className="mb-2.5 flex items-center gap-1.5">
            <Lightbulb size={13} className="text-warning" />
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
              How to improve
            </p>
          </div>
          <ul className="space-y-2">
            {TRUST_TIPS.map((tip) => (
              <li key={tip} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-white/25" />
                <span className="text-xs leading-4 text-white/60">{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
  return typeof document !== "undefined" ? createPortal(modal, document.body) : null;
}

type ChallengeData = {
  id: string;
  name: string;
  icon: LucideIcon;
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
    id: "reflex-dash",
    name: "Reflex Dash",
    icon: TrafficCone,
    accent: "#ffc857",
    done: 0,
    total: 10,
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
    total: 6,
    score: 0,
    stars: 0,
    playTime: null,
  },
  {
    id: "driving-pro",
    name: "Driving Pro",
    icon: Gamepad2,
    accent: "#35e59a",
    done: 0,
    total: 3,
    score: 0,
    stars: 0,
    playTime: null,
  },
];

/* ─── Today's Progress & Carousel ──────────────────────────── */
function ChallengeCarousel() {
  const router = useRouter();
  const [active, setActive] = useState(0);
  const [challenges, setChallenges] = useState<ChallengeData[]>(INITIAL_CHALLENGES);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      fetchAndSyncProgress("color-quest").catch(() => null),
      fetchAndSyncProgress("reflex-dash").catch(() => null),
    ]).then(([cqData, rdData]) => {
      if (!isMounted) return;
      setChallenges((prev) =>
        prev.map((c) => {
          if (c.id === "colour-quest" && cqData?.success && cqData.levels) {
            let totalScore = 0;
            let totalStars = 0;
            for (const lvl of Object.values(cqData.levels)) {
              totalScore += lvl.bestScore;
              totalStars += lvl.stars;
            }
            return {
              ...c,
              done: cqData.completedLevels,
              total: cqData.totalLevels,
              score: Math.round(totalScore * 100),
              stars: totalStars,
            };
          }
          if (c.id === "reflex-dash" && rdData?.success && rdData.levels) {
            let totalScore = 0;
            let totalStars = 0;
            for (const lvl of Object.values(rdData.levels)) {
              totalScore += lvl.bestScore;
              totalStars += lvl.stars;
            }
            return {
              ...c,
              done: rdData.completedLevels,
              total: rdData.totalLevels,
              score: Math.round(totalScore * 100),
              stars: totalStars,
            };
          }
          return c;
        })
      );
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const overallStars = challenges.reduce((sum, c) => sum + (c.stars || 0), 0);
  const overallGamesDone = challenges.filter((c) => c.done > 0).length;
  const overallGamesTotal = challenges.length;

  const startAuto = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setActive((p) => (p + 1) % challenges.length);
    }, 4500);
  };

  useEffect(() => {
    startAuto();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [challenges.length]);

  const goTo = (i: number) => {
    setActive(i);
    startAuto();
  };

  const ch = challenges[active];
  const Icon = ch.icon;
  const pct = Math.round((ch.done / (ch.total || 1)) * 100);

  // SVG parameters for circular progress
  const r = 22;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <div className="mt-4 rounded-3xl border border-border bg-black/40 p-4 shadow-xl">
      {/* Title Row */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy size={16} className="text-accent" />
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-white">
            Today&apos;s Progress
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/playground")}
          className="text-xs font-bold text-primary transition hover:text-primary/80"
        >
          View All <ChevronRight size={14} className="inline -ml-0.5" />
        </button>
      </div>

      {/* Sliding Card */}
      <div className="relative flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-3.5 shadow-inner">
        {/* Left: Icon + Title */}
        <div
          className="flex w-[32%] flex-col items-center justify-center gap-1.5 overflow-hidden rounded-xl border border-white/10 py-2.5 px-2 text-center shadow-md"
          style={{
            background: `linear-gradient(135deg, ${ch.accent}33 0%, rgba(0,0,0,0.5) 100%)`,
          }}
        >
          <Icon size={22} style={{ color: ch.accent }} />
          <span className="w-full truncate text-xs font-extrabold text-white">{ch.name}</span>
        </div>

        {/* Circular Progress Ring */}
        <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
          <svg className="absolute inset-0 h-full w-full -rotate-90">
            <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4.5" />
            <circle
              cx="28"
              cy="28"
              r={r}
              fill="none"
              stroke={ch.accent}
              strokeWidth="4.5"
              strokeDasharray={c}
              strokeDashoffset={offset}
              strokeLinecap="round"
              className="transition-all duration-700 ease-in-out"
              style={{ filter: `drop-shadow(0 0 6px ${ch.accent}88)` }}
            />
          </svg>
          <span className="text-xs font-black text-white">{pct}%</span>
        </div>

        {/* Text Stats */}
        <div className="flex flex-col items-center gap-0.5">
          <p className="text-base font-black text-white">
            {ch.done}/{ch.total}
          </p>
          <p className="text-[9px] font-bold uppercase tracking-wider text-white/40">completed</p>
        </div>

        <div className="flex flex-col items-center gap-0.5">
          <div className="flex items-center gap-1">
            <Star size={12} className="text-warning fill-warning" />
            <span className="text-base font-black text-white">{ch.stars ?? 0}</span>
          </div>
          <p className="text-[9px] font-bold uppercase tracking-wider text-white/40">stars</p>
        </div>

        {/* Next Button */}
        <button
          type="button"
          onClick={() => goTo((active + 1) % challenges.length)}
          aria-label="Next game"
          className="ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 active:scale-95"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Pagination Dots */}
      <div className="mt-3 flex justify-center gap-1.5">
        {challenges.map((c, i) => (
          <button
            key={c.id}
            type="button"
            aria-label={`Go to ${c.name}`}
            onClick={() => goTo(i)}
            className="h-1 rounded-full transition-all duration-300"
            style={{
              width: i === active ? "18px" : "6px",
              background: i === active ? ch.accent : "rgba(255,255,255,0.2)",
            }}
          />
        ))}
      </div>

      {/* Summary Footer */}
      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-white/10 pt-3">
        <div className="flex items-center justify-center gap-2.5">
          <Star size={22} className="shrink-0 text-warning fill-warning drop-shadow-[0_0_8px_rgba(255,200,87,0.5)]" />
          <div className="flex flex-col text-left">
            <span className="text-base font-black leading-tight text-white">{overallStars}</span>
            <span className="text-[9px] font-semibold uppercase leading-tight tracking-wider text-white/45">
              Total Stars
            </span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2.5">
          <Gamepad2 size={22} className="shrink-0 text-primary drop-shadow-[0_0_8px_rgba(124,92,255,0.5)]" />
          <div className="flex flex-col text-left">
            <span className="text-base font-black leading-tight text-white">
              {overallGamesDone}/{overallGamesTotal}
            </span>
            <span className="text-[9px] font-semibold uppercase leading-tight tracking-wider text-white/45">
              Games Active
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main component ──────────────────────────────── */
export default function HomeDashboard() {
  const { status, openModal, setLedColor } = useBleContext();
  const router = useRouter();

  const isConnected = status === "connected";

  const [colorWheelOpen, setColorWheelOpen] = useState(false);
  const [petFullscreen, setPetFullscreen] = useState(false);
  const [trustOpen, setTrustOpen] = useState(false);
  const [trustLevel, setTrustLevel] = useState<number>(getTrustLevel);

  // Listen for trust changes
  useEffect(() => {
    const onTrustChange = (e: Event) => {
      const ce = e as CustomEvent<number>;
      setTrustLevel(ce.detail);
    };
    window.addEventListener("trustLevelChanged", onTrustChange);
    return () => window.removeEventListener("trustLevelChanged", onTrustChange);
  }, []);

  /* Hide/show AppHeader + BottomNav during fullscreen */
  useEffect(() => {
    if (petFullscreen) {
      document.body.classList.add("pet-fullscreen");
    } else {
      document.body.classList.remove("pet-fullscreen");
    }
    return () => document.body.classList.remove("pet-fullscreen");
  }, [petFullscreen]);

  /* Send hardware LED color command via BLE */
  const sendRgb = (r: number, g: number, b: number) => {
    if (isConnected) {
      void setLedColor(r, g, b).catch((err) =>
        console.warn("[HOME] setLedColor failed:", err)
      );
    } else {
      openModal();
    }
  };

  const handleControllerButton = () => {
    if (!isConnected) {
      openModal();
    } else {
      router.push("/rc-mode");
    }
  };

  const mood = getPetMood(isConnected, trustLevel);

  return (
    <section
      aria-label="Home dashboard"
      className="overflow-hidden rounded-3xl border border-border bg-surface p-4 shadow-[0_24px_80px_rgba(0,0,0,0.22)] sm:p-5 select-none"
    >
      {/* ELXIE Branding Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          <h2 className="text-base font-black tracking-wider text-white uppercase">ELXIE</h2>
        </div>
        <span
          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-widest ${
            isConnected
              ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
              : "border-white/10 bg-white/5 text-white/40"
          }`}
        >
          {isConnected ? "Connected" : "Offline"}
        </span>
      </div>

      {/* ── Pet Status Card ── */}
      <div
        className={`mt-3 rounded-3xl border border-border bg-black p-4 transition-all duration-300 ${
          petFullscreen
            ? "fixed inset-0 z-[200] m-0 rounded-none overflow-y-auto border-0 p-6"
            : ""
        }`}
      >
        {/* Header: label left | fullscreen & controller btns right */}
        <div className={`flex items-center justify-between ${petFullscreen ? "pt-safe" : ""}`}>
          <div className="flex items-center gap-2">
            <Heart size={16} className="text-accent" />
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-white/40">
              Pet Status
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Fullscreen toggle button */}
            <button
              type="button"
              id="pet-status-fullscreen-btn"
              onClick={() => setPetFullscreen((v) => !v)}
              aria-label={petFullscreen ? "Exit fullscreen" : "Fullscreen pet status"}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/8 border border-white/10 transition hover:bg-white/12 active:scale-95 text-white/70"
            >
              {petFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>

            {/* Controller button */}
            <button
              type="button"
              id="pet-status-controller-btn"
              onClick={handleControllerButton}
              aria-label={isConnected ? "Open controller" : "Connect to robot"}
              className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/8 border border-white/10 transition hover:bg-white/12 active:scale-95 text-white/70"
            >
              <Gamepad2 size={18} />
              <span
                aria-hidden="true"
                className={`absolute right-0 top-0 h-2.5 w-2.5 rounded-full border-2 border-black transition-colors ${
                  isConnected
                    ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]"
                    : status === "connecting"
                    ? "bg-amber-400 animate-pulse"
                    : "bg-rose-500"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Normal mode: compact face image + side buttons */}
        {!petFullscreen && (
          <div className="mt-3 relative flex items-center justify-center">
            {/* Centered Compact Pet Face Image (h-32 w-32 / 128px) */}
            <div className="relative flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-black border border-white/10 shadow-2xl transition-all duration-300">
              <Image
                src={mood.image}
                alt={`ELXIE expression: ${mood.label}`}
                width={128}
                height={128}
                className="h-full w-full object-cover"
                priority
              />
            </div>

            {/* Right-Side Action Column: Trust & LED Buttons */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2.5">
              {/* Trust Level button */}
              {(() => {
                const pct = trustLevel;
                const tier =
                  pct >= 67
                    ? { label: "High Trust", color: "#35e59a" }
                    : pct >= 34
                    ? { label: "Medium Trust", color: "#ffc857" }
                    : { label: "Low Trust", color: "#ff4d67" };
                return (
                  <div className="flex flex-col items-center gap-0.5">
                    <button
                      type="button"
                      id="pet-trust-btn"
                      onClick={() => setTrustOpen(true)}
                      aria-label={`Trust level: ${tier.label}`}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-white/8 border border-white/10 transition hover:bg-white/12 active:scale-95"
                    >
                      <svg width="20" height="18" viewBox="0 0 32 30" aria-hidden="true">
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
                    <p className="text-[8px] font-bold uppercase tracking-wider text-white/30">Trust</p>
                  </div>
                );
              })()}

              {/* LED Color Wheel Button */}
              <div className="flex flex-col items-center gap-0.5">
                <button
                  type="button"
                  id="pet-color-wheel-btn"
                  aria-label="Open robot light color picker"
                  onClick={() => setColorWheelOpen(true)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/8 border border-white/10 transition hover:bg-white/12 active:scale-95"
                >
                  <svg width="18" height="18" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <defs>
                      <radialGradient id="pet-rg" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="white" stopOpacity="0.9" />
                        <stop offset="100%" stopColor="white" stopOpacity="0" />
                      </radialGradient>
                      <linearGradient id="pet-hg" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#ff0000" />
                        <stop offset="16%" stopColor="#ffff00" />
                        <stop offset="33%" stopColor="#00ff00" />
                        <stop offset="50%" stopColor="#00ffff" />
                        <stop offset="66%" stopColor="#0000ff" />
                        <stop offset="83%" stopColor="#ff00ff" />
                        <stop offset="100%" stopColor="#ff0000" />
                      </linearGradient>
                    </defs>
                    <circle cx="8" cy="8" r="7.5" fill="url(#pet-hg)" />
                    <circle cx="8" cy="8" r="7.5" fill="url(#pet-rg)" />
                    <circle cx="8" cy="8" r="3" fill="#080b14" />
                  </svg>
                </button>
                <p className="text-[8px] font-bold uppercase tracking-wider text-white/30">LED</p>
              </div>
            </div>
          </div>
        )}

        {/* Fullscreen Mode */}
        {petFullscreen && (
          <div className="fixed inset-0 z-[201] bg-black">
            <button
              type="button"
              id="pet-exit-fullscreen-btn"
              onClick={() => setPetFullscreen(false)}
              aria-label="Exit fullscreen"
              style={{ position: "absolute", top: "24px", right: "24px", zIndex: 202 }}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 border border-white/20 text-white backdrop-blur-md transition hover:bg-white/20 active:scale-95"
            >
              <Minimize2 size={18} />
            </button>

            <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
              <div className="relative w-full max-w-xs aspect-square max-h-[60vh] overflow-hidden rounded-[3rem] border border-white/10 shadow-2xl">
                <Image
                  src={mood.image}
                  alt={`ELXIE expression: ${mood.label}`}
                  fill
                  className="object-cover"
                  priority
                />
              </div>

              <div className="mt-6 text-center">
                <span className={`inline-block rounded-full border px-3 py-1 text-xs font-black uppercase tracking-widest ${mood.badgeBg} ${mood.badgeText}`}>
                  {mood.label}
                </span>
                <h3 className="mt-3 text-2xl font-black text-white">{mood.title}</h3>
                <p className="mt-2 text-sm text-white/60 max-w-xs">{mood.tip}</p>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Status Text & Emotional Tips (Non-fullscreen) */}
        {!petFullscreen && (
          <div className="mt-3 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${mood.badgeBg} ${mood.badgeText}`}>
                {mood.label}
              </span>
            </div>
            <h3 className="text-base font-extrabold text-white leading-snug">{mood.title}</h3>
            <p className="mt-1 text-xs leading-4 text-white/50 px-2">{mood.tip}</p>
          </div>
        )}
      </div>

      {/* ── Today's Progress Dashboard Card ── */}
      <ChallengeCarousel />

      {/* Color wheel modal */}
      {colorWheelOpen && (
        <ColorWheelModal
          onClose={() => setColorWheelOpen(false)}
          sendRgb={sendRgb}
        />
      )}

      {/* Trust modal */}
      {trustOpen &&
        (() => {
          const pct = trustLevel;
          const tier =
            pct >= 67
              ? { label: "High Trust", color: "#35e59a" }
              : pct >= 34
              ? { label: "Medium Trust", color: "#ffc857" }
              : { label: "Low Trust", color: "#ff4d67" };
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