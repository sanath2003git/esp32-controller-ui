"use client";

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
} from "lucide-react";

import { useBleContext } from "@/context/BleContext";
import type { MovementDirection, RgbColor } from "@/types/ble";

type ControlPanelMode = "free-ride" | "training" | "challenge";

type ControlPanelProps = {
  mode?: ControlPanelMode;
};

type ObstaclePosition = "front-left" | "front-right" | "rear-left" | "rear-right";

type ObstacleIndicatorProps = {
  label: string;
  position: ObstaclePosition;
  detected: boolean | null;
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
  const stateClass =
    detected === null
      ? "border-white/15 bg-white/5 text-white/45"
      : detected
        ? "border-danger/50 bg-danger/15 text-danger"
        : "border-success/50 bg-success/15 text-success";

  return (
    <div
      className={`absolute flex items-center gap-1.5 ${obstaclePositionClass[position]}`}
    >
      <span
        aria-hidden="true"
        className={`h-3.5 w-3.5 rounded-full border shadow-[0_0_12px_currentColor] ${stateClass}`}
      />
      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/55">
        {label}
      </span>
      <span className="sr-only">{stateLabel}</span>
    </div>
  );
}

export default function ControlPanel({ mode = "free-ride" }: ControlPanelProps) {
  const { status, telemetry, move, stop, setColor } = useBleContext();
  const isConnected = status === "connected";
  const heading = telemetry?.direction ?? null;
  const obstacle = telemetry?.obstacle;

  const sendMove = (direction: MovementDirection) => {
    void move(direction).catch((error: unknown) => {
      console.error("[CONTROL PANEL] Movement command failed", error);
    });
  };

  const sendColor = (color: RgbColor) => {
    void setColor(color).catch((error: unknown) => {
      console.error("[CONTROL PANEL] Color command failed", error);
    });
  };

  return (
    <section
      aria-label={`${modeLabel[mode]} robot controls`}
      className="mt-8 overflow-hidden rounded-3xl border border-border bg-surface p-4 shadow-[0_24px_80px_rgba(0,0,0,0.22)] sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            {modeLabel[mode]} control
          </p>
          <h2 className="mt-1 text-xl font-black tracking-tight">Robot command deck</h2>
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

      {(telemetry?.motion.sudden || telemetry?.pit.detected) && (
        <div className="mt-4 space-y-2" role="alert">
          {telemetry.motion.sudden && (
            <p className="flex items-center gap-2 rounded-2xl border border-warning/35 bg-warning/10 px-4 py-3 text-sm font-semibold text-warning">
              <TriangleAlert size={18} /> Sudden motion detected
            </p>
          )}
          {telemetry.pit.detected && (
            <p className="flex items-center gap-2 rounded-2xl border border-danger/35 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
              <TriangleAlert size={18} /> Pit detected ahead
            </p>
          )}
        </div>
      )}

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
            Navigation
          </p>
          <div className="mx-auto mt-3 grid max-w-56 grid-cols-3 gap-2">
            <div />
            <button
              type="button"
              aria-label="Move forward"
              disabled={!isConnected}
              onClick={() => sendMove("forward")}
              className="control-button"
            >
              <ArrowUp size={22} />
            </button>
            <div />
            <button
              type="button"
              aria-label="Turn left"
              disabled={!isConnected}
              onClick={() => sendMove("left")}
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
              aria-label="Turn right"
              disabled={!isConnected}
              onClick={() => sendMove("right")}
              className="control-button"
            >
              <ArrowRight size={22} />
            </button>
            <div />
            <button
              type="button"
              aria-label="Move backward"
              disabled={!isConnected}
              onClick={() => sendMove("backward")}
              className="control-button"
            >
              <ArrowDown size={22} />
            </button>
            <div />
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
            RGB lights
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
          </div>
        </div>
      </div>
    </section>
  );
}
