"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/* ─── Preset light colors ─────────────────────────── */
export const PRESET_COLORS = [
  { label: "Red",    hex: "#ff0000", r: 255, g: 0,   b: 0   },
  { label: "Green",  hex: "#00ff00", r: 0,   g: 255, b: 0   },
  { label: "Blue",   hex: "#0000ff", r: 0,   g: 0,   b: 255 },
  { label: "Yellow", hex: "#ffff00", r: 255, g: 255, b: 0   },
  { label: "Purple", hex: "#a020f0", r: 160, g: 32,  b: 240 },
  { label: "White",  hex: "#ffffff", r: 255, g: 255, b: 255 },
  { label: "Off",    hex: "#000000", r: 0,   g: 0,   b: 0   },
];

/* ─── Canvas Color Wheel Modal ────────────────────── */
export default function ColorWheelModal({
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
