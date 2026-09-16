"use client";

import { useRef, useState, type PointerEvent } from "react";

import { Gamepad2 } from "lucide-react";

export type JoystickDirection = {
  dx: number;
  dy: number;
};

type JoystickControllerProps = {
  disabled?: boolean;
  onDirectionChange?: (direction: JoystickDirection) => void;
  onRelease?: () => void;
};

const DEAD_ZONE = 0.08;
const DIAGONAL_AXIS_THRESHOLD = 0.2;
const DIAGONAL_CONTRIBUTION_RATIO = 0.35;
const MAX_TRAVEL_RATIO = 0.55;

function directionLabel({ dx, dy }: JoystickDirection): string {
  if (Math.abs(dx) < DEAD_ZONE && Math.abs(dy) < DEAD_ZONE) {
    return "IDLE";
  }

  const horizontalMagnitude = Math.abs(dx);
  const verticalMagnitude = Math.abs(dy);

  const hasMeaningfulHorizontal =
    horizontalMagnitude >= DIAGONAL_AXIS_THRESHOLD &&
    horizontalMagnitude >=
      verticalMagnitude * DIAGONAL_CONTRIBUTION_RATIO;

  const hasMeaningfulVertical =
    verticalMagnitude >= DIAGONAL_AXIS_THRESHOLD &&
    verticalMagnitude >=
      horizontalMagnitude * DIAGONAL_CONTRIBUTION_RATIO;

  if (!hasMeaningfulHorizontal || !hasMeaningfulVertical) {
    if (verticalMagnitude >= horizontalMagnitude) {
      return dy > 0 ? "FWD" : "REV";
    }

    return dx > 0 ? "RIGHT" : "LEFT";
  }

  const labels: string[] = [];

  if (dy > 0) labels.push("FWD");
  if (dy < 0) labels.push("REV");
  if (dx < 0) labels.push("LEFT");
  if (dx > 0) labels.push("RIGHT");

  return labels.join(" + ");
}

export default function JoystickController({
  disabled = false,
  onDirectionChange,
  onRelease,
}: JoystickControllerProps) {
  const padRef = useRef<HTMLDivElement>(null);
  const activePointerId = useRef<number | null>(null);

  const [direction, setDirection] =
    useState<JoystickDirection>({
      dx: 0,
      dy: 0,
    });

  const [isDragging, setIsDragging] =
    useState(false);

  const updateFromPointer = (
    event: PointerEvent<HTMLDivElement>,
  ) => {
    const pad = padRef.current;
    if (!pad) return;

    const bounds = pad.getBoundingClientRect();

    const radius =
      Math.min(bounds.width, bounds.height) / 2;

    const maxTravel =
      radius * MAX_TRAVEL_RATIO;

    const rawX =
      event.clientX -
      bounds.left -
      bounds.width / 2;

    const rawY =
      event.clientY -
      bounds.top -
      bounds.height / 2;

    const distance = Math.hypot(rawX, rawY);

    const scale =
      distance > maxTravel && distance > 0
        ? maxTravel / distance
        : 1;

    const nextDirection = {
      dx: (rawX * scale) / maxTravel,
      dy: (-rawY * scale) / maxTravel,
    };

    setDirection(nextDirection);
    onDirectionChange?.(nextDirection);
  };

  const finishInteraction = (
    pointerId: number,
  ) => {
    if (
      activePointerId.current !==
      pointerId
    ) {
      return;
    }

    activePointerId.current = null;
    setIsDragging(false);

    setDirection({
      dx: 0,
      dy: 0,
    });

    onRelease?.();
  };

  const handlePointerDown = (
    event: PointerEvent<HTMLDivElement>,
  ) => {
    if (
      disabled ||
      event.button !== 0
    ) {
      return;
    }

    event.preventDefault();

    activePointerId.current =
      event.pointerId;

    event.currentTarget.setPointerCapture(
      event.pointerId,
    );

    setIsDragging(true);
    updateFromPointer(event);
  };

  const handlePointerMove = (
    event: PointerEvent<HTMLDivElement>,
  ) => {
    if (
      disabled ||
      activePointerId.current !==
        event.pointerId
    ) {
      return;
    }

    event.preventDefault();
    updateFromPointer(event);
  };

  const handlePointerEnd = (
    event: PointerEvent<HTMLDivElement>,
  ) => {
    if (
      activePointerId.current !==
      event.pointerId
    ) {
      return;
    }

    event.preventDefault();

    finishInteraction(
      event.pointerId,
    );
  };

  const thumbOffsetX =
    direction.dx *
    MAX_TRAVEL_RATIO *
    100;

  const thumbOffsetY =
    -direction.dy *
    MAX_TRAVEL_RATIO *
    100;

  return (
    <section
      aria-label="Joystick navigation control"
      className={`h-[clamp(195px,32vh,265px)] overflow-hidden rounded-2xl border border-border bg-surface ${
        disabled ? "opacity-40" : ""
      }`}
    >
      {/* Joystick header */}
      <div className="flex items-center gap-2 px-4 pt-3">
        <Gamepad2
          size={14}
          className="text-primary"
          aria-hidden="true"
        />

        <p className="text-[10px] font-extrabold tracking-[0.2em] text-primary">
          JOYSTICK
        </p>

        <span className="ml-auto text-[10px] font-semibold tracking-[0.05em] text-white/40">
          {directionLabel(direction)}
        </span>
      </div>

      {/* Joystick area */}
      <div className="flex h-[calc(100%_-_42px)] items-center justify-center px-2 pb-1 pt-1">
        <div
          ref={padRef}
          role="slider"
          aria-label="Robot movement joystick"
          aria-valuemin={-1}
          aria-valuemax={1}
          aria-valuenow={Math.max(
            Math.abs(direction.dx),
            Math.abs(direction.dy),
          )}
          aria-valuetext={directionLabel(
            direction,
          )}
          aria-disabled={disabled}
          onPointerDown={
            handlePointerDown
          }
          onPointerMove={
            handlePointerMove
          }
          onPointerUp={
            handlePointerEnd
          }
          onPointerCancel={
            handlePointerEnd
          }
          onLostPointerCapture={
            handlePointerEnd
          }
          className={`relative h-[clamp(150px,24vh,220px)] w-[clamp(150px,24vh,220px)] shrink-0 select-none rounded-full border-[1.5px] border-border bg-surface touch-none ${
            disabled
              ? "cursor-not-allowed"
              : "cursor-grab active:cursor-grabbing"
          }`}
        >
          {/* Vertical guide */}
          <div className="absolute left-1/2 top-[22.5%] h-[55%] w-px -translate-x-1/2 bg-border" />

          {/* Horizontal guide */}
          <div className="absolute left-[22.5%] top-1/2 h-px w-[55%] -translate-y-1/2 bg-border" />

          {/* Inner travel circle */}
          <div className="absolute left-[22.5%] top-[22.5%] h-[55%] w-[55%] rounded-full border border-primary/12" />

          {/* Direction ticks */}
          {Array.from(
            { length: 8 },
            (_, index) => {
              const angle =
                (index * Math.PI) / 4;

              const x =
                50 +
                Math.cos(angle) * 32;

              const y =
                50 +
                Math.sin(angle) * 32;

              return (
                <span
                  key={index}
                  aria-hidden="true"
                  className="absolute h-[7px] w-[1.5px] rounded-full bg-primary/50"
                  style={{
                    left: `${x}%`,
                    top: `${y}%`,
                    transform: `translate(-50%, -50%) rotate(${
                      index * 45 + 90
                    }deg)`,
                  }}
                />
              );
            },
          )}

          {/* Direction chevrons */}
          <Chevron
            className="left-1/2 top-[14%]"
            rotation={0}
          />

          <Chevron
            className="left-1/2 top-[86%]"
            rotation={180}
          />

          <Chevron
            className="left-[14%] top-1/2"
            rotation={-90}
          />

          <Chevron
            className="left-[86%] top-1/2"
            rotation={90}
          />

          {/* Joystick thumb */}
          <div
            aria-hidden="true"
            className={`absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 ${
              isDragging
                ? "border-primary bg-primary shadow-[0_0_22px_rgba(124,92,255,0.5)]"
                : "border-primary/55 bg-surface-light"
            } ${
              isDragging
                ? "transition-none"
                : "transition-[left,top] duration-[180ms] ease-[cubic-bezier(0.215,0.61,0.355,1)]"
            }`}
            style={{
              left: `${
                50 + thumbOffsetX
              }%`,
              top: `${
                50 + thumbOffsetY
              }%`,
            }}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isDragging
                  ? "bg-white"
                  : "bg-primary/80"
              }`}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function Chevron({
  className,
  rotation,
}: {
  className: string;
  rotation: number;
}) {
  return (
    <span
      aria-hidden="true"
      className={`absolute h-0 w-0 border-x-[5px] border-b-[7px] border-x-transparent border-b-primary/25 ${className}`}
      style={{
        transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
      }}
    />
  );
}