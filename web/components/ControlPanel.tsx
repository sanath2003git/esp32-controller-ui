"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bot,
  Compass,
  Gauge,
  OctagonX,
  TriangleAlert,
  Volume2,
  Target,
} from "lucide-react";

import { useBleContext } from "@/context/BleContext";
import type { MovementDirection, RgbColor } from "@/types/ble";

type ControlPanelMode = "free-ride" | "training" | "challenge";

type ActiveTaskInfo = {
  index: number;
  target: string;
  options: string[];
};

type ControlPanelProps = {
  mode?: ControlPanelMode;
  game?: string;
  isGameActive?: boolean;
  activeTask?: ActiveTaskInfo | null;
  onInputDirection?: (dir: "up" | "right" | "down" | "left") => void;
};

type ObstaclePosition = "front-left" | "front-right" | "rear-left" | "rear-right";

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

const modeLabel: Record<ControlPanelMode, string> = {
  "free-ride": "Free ride",
  training: "Training",
  challenge: "Challenge",
};

const obstaclePositionClass: Record<ObstaclePosition, string> = {
  "front-left": "left-0 top-3",
  "front-right": "right-0 top-3",
  "rear-left": "bottom-3 left-0",
  "rear-right": "bottom-3 right-0",
};

function ObstacleIndicator({
  label,
  position,
  detected,
}: ObstacleIndicatorProps) {
  const stateLabel = detected === null ? "Waiting" : detected ? "Obstacle" : "Clear";
  const hasObstacle = detected === true;
  const stateClass =
    detected === null
      ? "border-white/15 bg-white/5 text-white/45"
      : detected
        ? "border-danger bg-danger text-white"
        : "border-success/50 bg-success/15 text-success";

  return (
    <div
      className={`absolute flex items-center gap-1.5 rounded-full transition-all ${
        hasObstacle
          ? "border border-danger bg-danger/20 px-2.5 py-2 text-danger shadow-[0_0_24px_rgba(255,76,100,0.75)]"
          : "px-1 py-0.5"
      } ${obstaclePositionClass[position]}`}
    >
      <span
        aria-hidden="true"
        className={`h-3.5 w-3.5 rounded-full border shadow-[0_0_12px_currentColor] ${
          hasObstacle ? "animate-pulse" : ""
        } ${stateClass}`}
      />
      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/55">
        {label}
      </span>
      {hasObstacle && (
        <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.1em] text-white">
          <TriangleAlert size={13} aria-hidden="true" /> Obstacle
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
}: ControlPanelProps) {
  const { status, telemetry, send, move, stop, setColor, beep } = useBleContext();
  const [alertToast, setAlertToast] = useState<AlertToast | null>(null);
  const previousAlerts = useRef({ sudden: false, pit: false });
  const isConnected = status === "connected";
  const heading = telemetry?.direction ?? null;
  const obstacle = telemetry?.obstacle;

  const isColorQuestActive = (game === "color-quest" || mode === "challenge") && isGameActive;

  useEffect(() => {
    const sudden = telemetry?.motion.sudden ?? false;
    const pit = telemetry?.pit.detected ?? false;

    if (sudden && !previousAlerts.current.sudden) {
      setAlertToast({ id: Date.now(), message: "Sudden motion detected", tone: "warning" });
    } else if (pit && !previousAlerts.current.pit) {
      setAlertToast({ id: Date.now(), message: "Pit detected ahead", tone: "danger" });
    }

    previousAlerts.current = { sudden, pit };
  }, [telemetry?.motion.sudden, telemetry?.pit.detected]);

  useEffect(() => {
    if (!alertToast) return;

    const timeoutId = window.setTimeout(() => {
      setAlertToast((current) => (current?.id === alertToast.id ? null : current));
    }, 3_000);

    return () => window.clearTimeout(timeoutId);
  }, [alertToast]);

  const dirToRegionMap: Record<"up" | "right" | "down" | "left", "front" | "right" | "back" | "left"> = {
    up: "front",
    right: "right",
    down: "back",
    left: "left",
  };

  const handleNavigationClick = (
    dir: "up" | "right" | "down" | "left",
    moveDir: MovementDirection
  ) => {
    if (!isConnected) return;

    // Specifically for Colour Quest game when active, emit {"command":"input","region":...}
    if (isColorQuestActive) {
      const region = dirToRegionMap[dir];
      void send({ command: "input", region }).catch((error: unknown) => {
        console.error("[CONTROL PANEL] Colour Quest region input command failed", error);
      });
      onInputDirection?.(dir);
    } else {
      // For all other games/modes, send standard movement command
      void move(moveDir).catch((error: unknown) => {
        console.error("[CONTROL PANEL] Movement command failed", error);
      });
    }
  };

  const sendColor = (color: RgbColor) => {
    void setColor(color).catch((error: unknown) => {
      console.error("[CONTROL PANEL] Color command failed", error);
    });
  };

  const handleBeepTest = () => {
    void beep(2000, 150).catch((error: unknown) => {
      console.error("[CONTROL PANEL] Beep command failed", error);
    });
  };

  return (
    <section
      aria-label={`${modeLabel[mode]} robot controls`}
      className="overflow-hidden rounded-3xl border border-border bg-surface p-4 shadow-[0_24px_80px_rgba(0,0,0,0.22)] sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            Robo Control
          </p>
          {isColorQuestActive && (
            <span className="text-[10px] font-bold uppercase text-emerald-400">
              Colour Quest Mode Active
            </span>
          )}
        </div>

        <div
          className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
            isConnected
              ? "border-success/30 bg-success/10 text-success"
              : "border-white/10 bg-white/5 text-white/45"
          }`}
        >
          {isConnected ? "Live" : status === "connecting" ? "Connecting" : "Offline"}
        </div>
      </div>

      {!isConnected && (
        <p className="mt-4 rounded-2xl border border-warning/25 bg-warning/10 px-4 py-3 text-sm text-warning">
          {status === "connecting"
            ? "Connecting to robot. Controls will unlock when ready."
            : "Robot disconnected. Connect to unlock controls."}
        </p>
      )}

      {/* Colour Quest Active Task HUD Overlay */}
      {isColorQuestActive && activeTask && (
        <div className="mt-4 rounded-2xl border border-primary/30 bg-primary/10 p-3.5 text-center">
          <div className="flex items-center justify-between text-xs text-primary font-bold">
            <span className="flex items-center gap-1">
              <Target size={14} /> Task {activeTask.index + 1} / 10
            </span>
            <span className="uppercase tracking-wider text-white/60">Target LED</span>
          </div>
          <div className="mt-1 text-lg font-black uppercase tracking-wider text-white">
            Match: <span className="text-accent">{activeTask.target}</span>
          </div>
          {activeTask.options.length >= 4 && (
            <div className="mt-2 grid grid-cols-2 gap-1 text-[11px] font-medium text-white/70">
              <span>U: {activeTask.options[0]}</span>
              <span>R: {activeTask.options[1]}</span>
              <span>D: {activeTask.options[2]}</span>
              <span>L: {activeTask.options[3]}</span>
            </div>
          )}
        </div>
      )}

      <div className="mt-5 rounded-3xl border border-border bg-black/20 px-4 py-5">
        <div className="flex items-center justify-between text-xs text-white/45">
          <span className="flex items-center gap-1.5">
            <Compass size={14} className="text-accent" /> Heading
          </span>
          <strong className="font-mono text-sm text-white">
            {heading === null ? "--°" : `${Math.round(heading)}°`}
          </strong>
        </div>

        <div className="relative mx-auto mt-4 h-64 max-w-72">
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
              aria-label={heading === null ? "Robot heading unavailable" : `Robot heading ${Math.round(heading)} degrees`}
              className="flex h-32 w-32 items-center justify-center rounded-[2.25rem] border border-primary/50 bg-primary/10 shadow-[0_0_45px_rgba(124,92,255,0.32)] transition-transform duration-500"
              style={{ transform: `rotate(${heading ?? 0}deg)` }}
            >
              <div className="absolute top-3 h-0 w-0 border-x-[10px] border-b-[16px] border-x-transparent border-b-accent" />
              <Bot size={64} strokeWidth={1.65} className="text-primary" />
            </div>
          </div>

          <p className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
            Rear
          </p>
        </div>

        <div className="mt-2 flex items-center justify-center gap-2 text-center">
          <Gauge size={16} className="text-accent" />
          <span className="text-sm text-white/55">Front distance</span>
          <strong className="font-mono text-lg text-white">
            {telemetry?.distance.front === undefined || telemetry.distance.front === null
              ? "-- cm"
              : `${telemetry.distance.front} cm`}
          </strong>
        </div>
      </div>

      {alertToast && (
        <div className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2" role="alert">
          <p
            className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-xl backdrop-blur ${
              alertToast.tone === "warning"
                ? "border-warning/35 bg-warning/90 text-black"
                : "border-danger/35 bg-danger/90 text-white"
            }`}
          >
            <TriangleAlert size={18} /> {alertToast.message}
          </p>
        </div>
      )}

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
              Navigation
            </p>
            {isColorQuestActive && (
              <span className="text-[10px] font-bold text-accent uppercase">
                Sending Task Input
              </span>
            )}
          </div>

          <div className="mx-auto mt-3 grid max-w-56 grid-cols-3 gap-2">
            <div />
            <button
              type="button"
              aria-label="Move forward or Up input"
              disabled={!isConnected}
              onClick={() => handleNavigationClick("up", "forward")}
              className="control-button"
            >
              <ArrowUp size={22} />
            </button>
            <div />
            <button
              type="button"
              aria-label="Turn left or Left input"
              disabled={!isConnected}
              onClick={() => handleNavigationClick("left", "left")}
              className="control-button"
            >
              <ArrowLeft size={22} />
            </button>
            <button
              type="button"
              aria-label="Stop robot"
              disabled={!isConnected}
              onClick={() => void stop().catch((error: unknown) => console.error("[CONTROL PANEL] Stop command failed", error))}
              className="control-button border-danger/35 bg-danger/10 text-danger hover:bg-danger/20"
            >
              <OctagonX size={21} />
            </button>
            <button
              type="button"
              aria-label="Turn right or Right input"
              disabled={!isConnected}
              onClick={() => handleNavigationClick("right", "right")}
              className="control-button"
            >
              <ArrowRight size={22} />
            </button>
            <div />
            <button
              type="button"
              aria-label="Move backward or Down input"
              disabled={!isConnected}
              onClick={() => handleNavigationClick("down", "backward")}
              className="control-button"
            >
              <ArrowDown size={22} />
            </button>
            <div />
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
            RGB & Sound Test
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {([
              ["red", "Red", "bg-danger"],
              ["green", "Green", "bg-success"],
              ["blue", "Blue", "bg-accent"],
              ["off", "Off", "bg-white/30"],
            ] as const).map(([color, label, swatchClass]) => (
              <button
                key={color}
                type="button"
                disabled={!isConnected}
                onClick={() => sendColor(color)}
                className="flex min-h-12 items-center gap-2 rounded-xl border border-border bg-black/20 px-3 text-sm font-bold transition hover:border-primary/50 hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span aria-hidden="true" className={`h-3 w-3 rounded-full ${swatchClass}`} />
                {label}
              </button>
            ))}

            <button
              type="button"
              disabled={!isConnected}
              onClick={handleBeepTest}
              className="col-span-2 flex min-h-10 items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 text-xs font-bold text-amber-300 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Volume2 size={16} /> Test Buzzer (Beep)
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
