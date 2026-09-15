"use client";

import { useState } from "react";
import {
  Award,
  CheckCircle2,
  Clock3,
  Heart,
  ShieldCheck,
  Star,
  Trophy,
} from "lucide-react";

import { useBleContext } from "@/context/BleContext";
import type { RgbColor } from "@/types/ble";

const robotColors = [
  {
    color: "red" as RgbColor,
    label: "Red",
    className: "bg-danger",
  },
  {
    color: "green" as RgbColor,
    label: "Green",
    className: "bg-success",
  },
  {
    color: "blue" as RgbColor,
    label: "Blue",
    className: "bg-accent",
  },
  {
    color: "off" as RgbColor,
    label: "Off",
    className: "bg-white/30",
  },
];

export default function HomeDashboard() {
  const { status, setColor } = useBleContext();
  const [selectedColor, setSelectedColor] =
    useState<RgbColor>("off");

  const isConnected = status === "connected";

  const sendColor = async (color: RgbColor) => {
    try {
      await setColor(color);
      setSelectedColor(color);
    } catch (error) {
      console.error(
        "[HOME DASHBOARD] Color command failed",
        error,
      );
    }
  };

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

      {/* Robot Lights */}
      <div className="mt-5 rounded-3xl border border-border bg-black/20 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
              Robot Lights
            </p>

            <p className="mt-1 text-sm text-white/55">
              Choose your robot&apos;s light
            </p>
          </div>

          <div
            className={`h-4 w-4 rounded-full shadow-[0_0_18px_currentColor] ${
              selectedColor === "red"
                ? "bg-danger text-danger"
                : selectedColor === "green"
                  ? "bg-success text-success"
                  : selectedColor === "blue"
                    ? "bg-accent text-accent"
                    : "bg-white/20 text-white/20"
            }`}
          />
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2">
          {robotColors.map(
            ({ color, label, className }) => {
              const selected =
                selectedColor === color;

              return (
                <button
                  key={color}
                  type="button"
                  disabled={!isConnected}
                  onClick={() => void sendColor(color)}
                  aria-label={`Set robot lights to ${label}`}
                  aria-pressed={selected}
                  className={`flex min-h-16 flex-col items-center justify-center gap-2 rounded-2xl border transition ${
                    selected
                      ? "border-primary bg-primary/10"
                      : "border-border bg-black/20 hover:border-primary/50 hover:bg-primary/10"
                  } disabled:cursor-not-allowed disabled:opacity-40`}
                >
                  <span
                    aria-hidden="true"
                    className={`h-5 w-5 rounded-full shadow-[0_0_14px_currentColor] ${className}`}
                  />

                  <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-white/65">
                    {label}
                  </span>
                </button>
              );
            },
          )}
        </div>
      </div>

      {/* Pet Face Display */}
      <div className="mt-5 rounded-3xl border border-border bg-black/20 p-5">
        <div className="flex items-center gap-2">
          <Heart
            size={16}
            className="text-accent"
          />

          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
            Pet Face
          </p>
        </div>

        <div className="mt-4 flex flex-col items-center">
          <div className="relative flex h-40 w-40 items-center justify-center rounded-[2.75rem] border border-primary/40 bg-primary/10 shadow-[0_0_45px_rgba(124,92,255,0.22)]">
            {/* Eyes */}
            <div className="absolute left-10 top-12 h-4 w-4 rounded-full bg-white" />
            <div className="absolute right-10 top-12 h-4 w-4 rounded-full bg-white" />

            {/* Nose */}
            <div className="absolute top-[76px] h-3 w-3 rounded-full bg-accent" />

            {/* Smile */}
            <div className="absolute bottom-10 h-5 w-12 rounded-b-full border-b-2 border-white/70" />
          </div>

          <p className="mt-4 text-lg font-bold text-white">
            {isConnected
              ? "Happy to see you!"
              : "Waiting for my robot..."}
          </p>

          <p className="mt-1 text-center text-sm text-white/45">
            {isConnected
              ? "Keep playing and take care of your Robo."
              : "Connect your robot to get started."}
          </p>
        </div>
      </div>

      {/* Today's Progress */}
      <div className="mt-5">
        <div className="flex items-center gap-2">
          <Trophy
            size={16}
            className="text-accent"
          />

          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
            Today&apos;s Progress
          </p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          {/* Daily Challenge */}
          <div className="rounded-2xl border border-border bg-black/20 p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2
                size={16}
                className="text-success"
              />

              <span className="text-xs text-white/45">
                Daily Challenge
              </span>
            </div>

            <p className="mt-2 text-2xl font-black text-white">
              3<span className="text-sm text-white/35">/10</span>
            </p>

            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-success"
                style={{ width: "30%" }}
              />
            </div>
          </div>

          {/* Total Stars */}
          <div className="rounded-2xl border border-border bg-black/20 p-4">
            <div className="flex items-center gap-2">
              <Star
                size={16}
                className="text-warning"
              />

              <span className="text-xs text-white/45">
                Total Stars
              </span>
            </div>

            <p className="mt-2 text-2xl font-black text-white">
              12
            </p>

            <p className="mt-1 text-xs text-white/35">
              Stars earned
            </p>
          </div>

          {/* Best Score */}
          <div className="rounded-2xl border border-border bg-black/20 p-4">
            <div className="flex items-center gap-2">
              <Award
                size={16}
                className="text-accent"
              />

              <span className="text-xs text-white/45">
                Best Score
              </span>
            </div>

            <p className="mt-2 text-2xl font-black text-white">
              1,250
            </p>

            <p className="mt-1 text-xs text-white/35">
              Personal best
            </p>
          </div>

          {/* Daily Play Time */}
          <div className="rounded-2xl border border-border bg-black/20 p-4">
            <div className="flex items-center gap-2">
              <Clock3
                size={16}
                className="text-accent"
              />

              <span className="text-xs text-white/45">
                Play Time
              </span>
            </div>

            <p className="mt-2 text-2xl font-black text-white">
              20<span className="text-sm text-white/35">m</span>
            </p>

            <p className="mt-1 text-xs text-white/35">
              of 30m today
            </p>
          </div>
        </div>

        {/* Trust Level */}
        <div className="mt-3 rounded-2xl border border-border bg-black/20 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <ShieldCheck
                  size={21}
                  className="text-primary"
                />
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/40">
                  Trust Level
                </p>

                <p className="mt-1 text-lg font-black text-white">
                  Level 2
                </p>
              </div>
            </div>

            <span className="text-sm font-bold text-primary">
              58%
            </span>
          </div>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: "58%" }}
            />
          </div>

          <p className="mt-2 text-xs text-white/35">
            Keep playing to build trust with your Robo.
          </p>
        </div>
      </div>
    </section>
  );
}