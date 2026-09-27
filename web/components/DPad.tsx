import React from "react";
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from "lucide-react";

export type DPadDirection = "up" | "right" | "down" | "left";

export type DPadButtonCustomStyle = {
  borderClass?: string;
  bgClass?: string;
  textClass?: string;
  glowClass?: string;
  label?: string;
};

export type DPadProps = {
  onDirection?: (dir: DPadDirection) => void;
  onCenter?: () => void;
  showCenter?: boolean;
  centerIcon?: React.ReactNode;
  centerAriaLabel?: string;
  centerId?: string;
  centerStyle?: DPadButtonCustomStyle;
  directionStyles?: Partial<Record<DPadDirection, DPadButtonCustomStyle>>;
  disabled?: boolean;
  className?: string;
};

export default function DPad({
  onDirection,
  onCenter,
  showCenter = false,
  centerIcon,
  centerAriaLabel = "Center",
  centerId,
  centerStyle,
  directionStyles,
  disabled = false,
  className = "",
}: DPadProps) {
  const getDirStyle = (dir: DPadDirection) => {
    const custom = directionStyles?.[dir];
    if (custom) {
      return {
        border: custom.borderClass ?? "border-primary/40",
        bg: custom.bgClass ?? "bg-primary/20 hover:bg-primary/30",
        text: custom.textClass ?? "text-primary",
        glow: custom.glowClass ?? "",
        label: custom.label,
      };
    }
    return {
      border: "border-primary/40",
      bg: "bg-primary/20 hover:bg-primary/30",
      text: "text-primary",
      glow: "",
      label: undefined,
    };
  };

  const upStyle = getDirStyle("up");
  const downStyle = getDirStyle("down");
  const leftStyle = getDirStyle("left");
  const rightStyle = getDirStyle("right");

  return (
    <div className={`mx-auto grid max-w-[200px] grid-cols-3 gap-2 ${className}`}>
      {/* Top Left: Empty */}
      <div />

      {/* Top Center: UP */}
      <button
        type="button"
        id="echo-btn-up"
        disabled={disabled}
        onClick={() => onDirection?.("up")}
        className={`flex aspect-square flex-col items-center justify-center rounded-2xl border transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none ${upStyle.border} ${upStyle.bg} ${upStyle.text} ${upStyle.glow}`}
        aria-label="Up"
      >
        <ArrowUp size={32} />
        {upStyle.label && (
          <span className="text-[10px] font-black uppercase mt-0.5">{upStyle.label}</span>
        )}
      </button>

      {/* Top Right: Empty */}
      <div />

      {/* Middle Left: LEFT */}
      <button
        type="button"
        id="echo-btn-left"
        disabled={disabled}
        onClick={() => onDirection?.("left")}
        className={`flex aspect-square flex-col items-center justify-center rounded-2xl border transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none ${leftStyle.border} ${leftStyle.bg} ${leftStyle.text} ${leftStyle.glow}`}
        aria-label="Left"
      >
        <ArrowLeft size={32} />
        {leftStyle.label && (
          <span className="text-[10px] font-black uppercase mt-0.5">{leftStyle.label}</span>
        )}
      </button>

      {/* Center Slot: either center action button or empty space */}
      {showCenter && onCenter ? (
        <button
          type="button"
          id={centerId ?? "echo-btn-center"}
          disabled={disabled}
          onClick={onCenter}
          className={`flex aspect-square flex-col items-center justify-center rounded-2xl border transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none ${centerStyle?.borderClass ?? "border-primary/40"
            } ${centerStyle?.bgClass ?? "bg-primary/20 hover:bg-primary/30"} ${centerStyle?.textClass ?? "text-primary"
            } ${centerStyle?.glowClass ?? ""}`}
          aria-label={centerAriaLabel}
        >
          {centerIcon}
          {centerStyle?.label && (
            <span className="text-[10px] font-black uppercase mt-0.5">
              {centerStyle.label}
            </span>
          )}
        </button>
      ) : (
        <div />
      )}

      {/* Middle Right: RIGHT */}
      <button
        type="button"
        id="echo-btn-right"
        disabled={disabled}
        onClick={() => onDirection?.("right")}
        className={`flex aspect-square flex-col items-center justify-center rounded-2xl border transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none ${rightStyle.border} ${rightStyle.bg} ${rightStyle.text} ${rightStyle.glow}`}
        aria-label="Right"
      >
        <ArrowRight size={32} />
        {rightStyle.label && (
          <span className="text-[10px] font-black uppercase mt-0.5">{rightStyle.label}</span>
        )}
      </button>

      {/* Bottom Left: Empty */}
      <div />

      {/* Bottom Center: DOWN */}
      <button
        type="button"
        id="echo-btn-down"
        disabled={disabled}
        onClick={() => onDirection?.("down")}
        className={`flex aspect-square flex-col items-center justify-center rounded-2xl border transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none ${downStyle.border} ${downStyle.bg} ${downStyle.text} ${downStyle.glow}`}
        aria-label="Down"
      >
        <ArrowDown size={32} />
        {downStyle.label && (
          <span className="text-[10px] font-black uppercase mt-0.5">{downStyle.label}</span>
        )}
      </button>

      {/* Bottom Right: Empty */}
      <div />
    </div>
  );
}
