"use client";

import { useEffect, useRef, useState } from "react";

import {
  Bot,
  Compass,
  Gauge,
  Palette,
  Target,
  TriangleAlert,
  Volume2,
} from "lucide-react";

const PerformanceModeIcon = ({ size = 24, className = "" }) => (
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
    {/* Tachometer / Gauge Outer Arch */}
    <path d="M3 14A9 9 0 0 1 19.5 7.5" />

    {/* Gauge Needle pointing towards high performance (top-right) */}
    <line x1="12" y1="14" x2="17" y2="9" />
    <circle cx="12" cy="14" r="1" fill="currentColor" />

    {/* Lightning bolt inside the gauge */}
    <path d="M11 14h3l-3.5 5.5v-3.5H8l3.5-5.5v3.5Z" />
  </svg>
);

import JoystickController, {
  type JoystickDirection,
} from "@/components/JoystickController";
import ColorWheelModal from "@/components/ColorWheelModal";

import { useBleContext } from "@/context/BleContext";
import { JoyStickDir } from "@/types/protocol";

type ControlPanelMode = "free-ride" | "training" | "challenge";

type ActiveTaskInfo = {
  index: number;
  target?: string;
  options?: string[];
};

type ControlPanelProps = {
  mode?: ControlPanelMode;
  game?: string;
  isGameActive?: boolean;
  activeTask?: ActiveTaskInfo | null;
  onInputDirection?: (dir: "up" | "right" | "down" | "left") => void;
  customTelemetry?: React.ReactNode;
  customControls?: React.ReactNode;
};

type ObstaclePosition =
  | "front-left"
  | "front-right"
  | "rear-left"
  | "rear-right";

type ObstacleIndicatorProps = {
  label: string;
  position: ObstaclePosition;
  detected: boolean | null;
};

type AlertToast = {
  id: number;
  message: string;
  tone: "warning" | "danger";
};

const AXIS_SWITCH_MARGIN = 1.2;

const modeLabel: Record<ControlPanelMode, string> = {
  "free-ride": "Free ride",
  training: "Training",
  challenge: "Challenge",
};

const obstaclePositionClass: Record<ObstaclePosition, string> = {
  "front-left": "left-0 top-1 sm:top-3",
  "front-right": "right-0 top-1 sm:top-3",
  "rear-left": "bottom-1 sm:bottom-3 left-0",
  "rear-right": "bottom-1 sm:bottom-3 right-0",
};

function ObstacleIndicator({
  label,
  position,
  detected,
}: ObstacleIndicatorProps) {
  const stateLabel =
    detected === null
      ? "Waiting"
      : detected
        ? "Obstacle"
        : "Clear";

  const hasObstacle = detected === true;

  const stateClass =
    detected === null
      ? "border-white/15 bg-white/5 text-white/45"
      : detected
        ? "border-danger bg-danger text-white"
        : "border-success/50 bg-success/15 text-success";

  return (
    <div
      className={`absolute flex items-center gap-1.5 rounded-full transition-all ${hasObstacle
        ? "border border-danger bg-danger/20 px-2.5 py-2 text-danger shadow-[0_0_24px_rgba(255,76,100,0.75)]"
        : "px-1 py-0.5"
        } ${obstaclePositionClass[position]}`}
    >
      <span
        aria-hidden="true"
        className={`h-3.5 w-3.5 rounded-full border shadow-[0_0_12px_currentColor] ${hasObstacle ? "animate-pulse" : ""
          } ${stateClass}`}
      />

      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/55">
        {label}
      </span>

      {hasObstacle && (
        <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.1em] text-white">
          <TriangleAlert size={13} aria-hidden="true" />
          Obstacle
        </span>
      )}

      <span className="sr-only">{stateLabel}</span>
    </div>
  );
}

export default function ControlPanel({
  mode = "free-ride",
  game,
  isGameActive = false,
  activeTask,
  onInputDirection,
  customTelemetry,
  customControls,
}: ControlPanelProps) {
  const { status, telemetry, robotState, sendJoystickInput } = useBleContext();

  const [colorWheelOpen, setColorWheelOpen] = useState(false);
  const [ledColor, setLedColor] = useState<{ r: number; g: number; b: number } | null>(null);
  const [alertToast, setAlertToast] = useState<AlertToast | null>(null);
  const [performanceMode, setPerformanceMode] = useState(false);

  const previousAlerts = useRef({
    sudden: false,
    pit: false,
  });

  const gameStartRef = useRef<number>(0);
  useEffect(() => {
    gameStartRef.current = Date.now();
  }, [game]);

  const activeMovementDirection = useRef<JoyStickDir | null>(null);

  const isConnected = status === "connected";
  const isRobotInGame = robotState === "GAME" || telemetry?.state === "GAME";
  const isColorQuestActive = game === "color-quest" && isGameActive;

  const heading = telemetry?.direction ?? null;
  const obstacle = telemetry?.obstacle;

  useEffect(() => {
    const sudden = telemetry?.motion.sudden ?? false;
    const pit = telemetry?.pit.detected ?? false;

    if (sudden && !previousAlerts.current.sudden) {
      const isGameJustStarted = Date.now() - gameStartRef.current < 2500;
      if (!isGameJustStarted) {
        setAlertToast({
          id: Date.now(),
          message: "Sudden motion detected",
          tone: "warning",
        });
      }
    } else if (pit && !previousAlerts.current.pit) {
      setAlertToast({
        id: Date.now(),
        message: "Pit detected ahead",
        tone: "danger",
      });
    }

    previousAlerts.current = { sudden, pit };
  }, [telemetry?.motion.sudden, telemetry?.pit.detected]);

  useEffect(() => {
    if (!alertToast) return;

    const timeoutId = window.setTimeout(() => {
      setAlertToast((current) =>
        current?.id === alertToast.id ? null : current,
      );
    }, 3_000);

    return () => window.clearTimeout(timeoutId);
  }, [alertToast]);

  const handleJoystickDirection = ({ dx, dy }: JoystickDirection) => {
    if (!isConnected) return;

    const magnitude = performanceMode ? 0.9 : 0.6;

    if (Math.abs(dx) < 0.08 && Math.abs(dy) < 0.08) {
      if (activeMovementDirection.current !== null) {
        activeMovementDirection.current = null;
        void sendJoystickInput("none", isRobotInGame ? undefined : 0).catch((error: unknown) => {
          console.error("[CONTROL PANEL] Joystick stop command failed", error);
        });
      }
      return;
    }

    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    const current = activeMovementDirection.current;
    const currentAxisIsVertical = current === "up" || current === "down";
    const currentAxisIsHorizontal = current === "right" || current === "left";

    let useVerticalAxis: boolean;
    if (currentAxisIsVertical) {
      useVerticalAxis = absDy * AXIS_SWITCH_MARGIN >= absDx;
    } else if (currentAxisIsHorizontal) {
      useVerticalAxis = absDy > absDx * AXIS_SWITCH_MARGIN;
    } else {
      useVerticalAxis = absDy >= absDx;
    }

    const nextDirection: JoyStickDir = useVerticalAxis
      ? dy > 0
        ? "up"
        : "down"
      : dx > 0
        ? "right"
        : "left";

    if (activeMovementDirection.current === nextDirection) {
      return;
    }

    activeMovementDirection.current = nextDirection;
    const inputDirection = nextDirection;

    void sendJoystickInput(nextDirection, isRobotInGame ? undefined : magnitude).catch((error: unknown) => {
      console.error("[CONTROL PANEL] Joystick input command failed", error);
    });
    onInputDirection?.(inputDirection);
  };

  const handleJoystickRelease = () => {
    if (activeMovementDirection.current === null || !isConnected) return;

    activeMovementDirection.current = null;
    void sendJoystickInput("none", isRobotInGame ? undefined : 0).catch((error: unknown) => {
      console.error("[CONTROL PANEL] Joystick release stop failed", error);
    });
  };

  const sendRgb = (r: number, g: number, b: number) => {
    setLedColor({ r, g, b });
    console.log("[Control Panel]: sendColor", { r, g, b });
  };

  const togglePerfomanceMode = () => {
    setPerformanceMode((active) => !active);
  };

  const sendHonk = () => {
    console.log("[Control Panel]: sending honk");
  };

  const ledHex = ledColor
    ? `#${[ledColor.r, ledColor.g, ledColor.b]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")}`
    : null;

  return (
    <section
      aria-label={`${modeLabel[mode]} robot controls`}
      className="flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-surface p-4 shadow-[0_24px_80px_rgba(0,0,0,0.22)] sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            Robo Control
          </p>
        </div>

        <div
          className={`rounded-full border px-3 py-1.5 text-xs font-bold ${isConnected
            ? "border-success/30 bg-success/10 text-success"
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

      <div
        className={`mt-3 flex min-h-0 flex-col gap-2 ${game === "reflex-dash" ? "flex-[3]" : "flex-1"
          }`}
      >
        {customTelemetry ? (
          <div className="flex-1 overflow-hidden">{customTelemetry}</div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col justify-between rounded-3xl border border-border bg-black/20 px-4 py-4">
            <div className="flex shrink-0 items-center justify-between text-xs text-white/45">
              <span className="flex items-center gap-1.5">
                <Compass size={14} className="text-accent" />
                Heading
              </span>

              <strong className="font-mono text-sm text-white">
                {heading === null ? "--°" : `${Math.round(heading)}°`}
              </strong>
            </div>

            <div className="relative mx-auto flex min-h-0 flex-1 w-full max-w-56 flex-col items-center justify-center">
              <p className="absolute left-1/2 top-0 -translate-x-1/2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
                Front
              </p>

              <ObstacleIndicator
                label="FL"
                position="front-left"
                detected={obstacle?.frontLeft ?? null}
              />
              <ObstacleIndicator
                label="FR"
                position="front-right"
                detected={obstacle?.frontRight ?? null}
              />
              <ObstacleIndicator
                label="RL"
                position="rear-left"
                detected={obstacle?.rearLeft ?? null}
              />
              <ObstacleIndicator
                label="RR"
                position="rear-right"
                detected={obstacle?.rearRight ?? null}
              />

              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                <div
                  aria-label={
                    heading === null
                      ? "Robot heading unavailable"
                      : `Robot heading ${Math.round(heading)} degrees`
                  }
                  className={`flex items-center justify-center rounded-2xl border border-primary/50 bg-primary/10 shadow-[0_0_45px_rgba(124,92,255,0.32)] transition-transform duration-500 ${game === "reflex-dash" ? "h-10 w-10" : "h-14 w-14"
                    }`}
                  style={{
                    transform: `rotate(${heading ?? 0}deg)`,
                  }}
                >
                  <div
                    className={`absolute h-0 w-0 border-x-transparent border-b-accent ${game === "reflex-dash"
                      ? "top-1 border-x-[4px] border-b-[6px]"
                      : "top-1.5 border-x-[6px] border-b-[8px]"
                      }`}
                  />
                  <Bot
                    size={game === "reflex-dash" ? 20 : 28}
                    strokeWidth={1.65}
                    className="text-primary"
                  />
                </div>
              </div>

              <p className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
                Rear
              </p>
            </div>

            <div className="flex shrink-0 items-center justify-center gap-2 text-center">
              <Gauge size={16} className="text-accent" />
              <span className="text-sm text-white/55">Front distance</span>
              <strong className="font-mono text-lg text-white">
                {telemetry?.distance.front === undefined ||
                  telemetry.distance.front === null
                  ? "-- cm"
                  : `${telemetry.distance.front} cm`}
              </strong>
            </div>
          </div>
        )}

        <div className="flex w-full shrink-0 justify-between gap-2">
          <button
            type="button"
            onClick={() => setColorWheelOpen(true)}
            aria-label="Set LED Color"
            className="flex h-14 flex-1 flex-col items-center justify-center gap-1 rounded-2xl border border-border bg-black/20 text-white/50 transition hover:bg-white/10 hover:text-white"
          >
            <div
              className="flex h-5 w-5 items-center justify-center rounded-full border border-white/20 shadow-inner"
              style={{
                background: ledHex ?? "transparent",
                boxShadow: ledHex ? `0 0 10px ${ledHex}88` : "none",
              }}
            >
              <Palette
                size={12}
                className={ledHex ? "mix-blend-difference text-white/90" : ""}
              />
            </div>
            <span className="text-[9px] font-bold uppercase tracking-wider">
              LED
            </span>
          </button>

          <button
            type="button"
            onClick={sendHonk}
            aria-label="Honk"
            className="flex h-14 flex-1 flex-col items-center justify-center gap-1 rounded-2xl border border-border bg-black/20 text-white/50 transition hover:bg-white/10 hover:text-white"
          >
            <Volume2 size={16} />
            <span className="text-[9px] font-bold uppercase tracking-wider">
              Honk
            </span>
          </button>

          <button
            type="button"
            onClick={togglePerfomanceMode}
            aria-label="Performance mode"
            aria-pressed={performanceMode}
            className={`flex h-14 flex-1 flex-col items-center justify-center gap-1 rounded-2xl border transition ${performanceMode ? "border-primary bg-primary/15 text-primary" : "border-border bg-black/20 text-white/50 hover:bg-white/10 hover:text-white"}`}
          >
            <PerformanceModeIcon size={18} />
            <span className="text-[9px] font-bold uppercase tracking-wider">
              Performance {performanceMode ? "On" : "Off"}
            </span>
          </button>
        </div>
      </div>

      {alertToast && (
        <div
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2"
          role="alert"
        >
          <p
            className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-xl backdrop-blur ${alertToast.tone === "warning"
              ? "border-warning/35 bg-warning/90 text-black"
              : "border-danger/35 bg-danger/90 text-white"
              }`}
          >
            <TriangleAlert size={18} />
            {alertToast.message}
          </p>
        </div>
      )}

      {isColorQuestActive && activeTask && (
        <div className="mt-4 rounded-2xl border border-primary/30 bg-primary/10 p-3.5 text-center">
          <div className="flex items-center justify-between text-xs font-bold text-primary">
            <span className="flex items-center gap-1">
              <Target size={14} /> Task {activeTask.index + 1} / 10
            </span>
            <span className="uppercase tracking-wider text-white/60">
              Colour Quest
            </span>
          </div>
          <div className="mt-1 text-sm font-bold text-white">
            Use Joystick or Region Buttons to submit answer
          </div>
        </div>
      )}

      <div
        className={`mt-3 flex min-h-0 flex-col ${game === "reflex-dash" ? "flex-[7]" : "flex-1"
          }`}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center justify-end">
            {isColorQuestActive && (
              <span className="text-[10px] font-bold uppercase text-accent">
                Sending task input
              </span>
            )}
          </div>
          {customControls && (
            <div className="my-2 z-10 w-full shrink-0">{customControls}</div>
          )}

          <div className="mx-auto mt-1 flex min-h-0 flex-1 w-full flex-col justify-center">
            <JoystickController
              disabled={!isConnected}
              onDirectionChange={handleJoystickDirection}
              onRelease={handleJoystickRelease}
            />
          </div>
        </div>
      </div>

      {colorWheelOpen && (
        <ColorWheelModal
          onClose={() => setColorWheelOpen(false)}
          sendRgb={sendRgb}
        />
      )}
    </section>
  );
}