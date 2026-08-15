"use client";

import {
  useCallback,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { useBleContext } from "@/context/BleContext";

type Direction = "forward" | "backward" | "left" | "right";

const directionConfig: Record<
  Direction,
  { icon: typeof ChevronUp; label: string; position: string }
> = {
  forward: {
    icon: ChevronUp,
    label: "Up",
    position: "col-start-2 row-start-1",
  },
  left: {
    icon: ChevronLeft,
    label: "Left",
    position: "col-start-1 row-start-2",
  },
  right: {
    icon: ChevronRight,
    label: "Right",
    position: "col-start-3 row-start-2",
  },
  backward: {
    icon: ChevronDown,
    label: "Down",
    position: "col-start-2 row-start-3",
  },
};

const directions = Object.keys(directionConfig) as Direction[];

export default function DPad() {
  const { status, send } = useBleContext();
  const isConnected = status === "connected";

  const [activeDirection, setActiveDirection] =
    useState<Direction | null>(null);

  const activeRef = useRef<Direction | null>(null);

  const sendMove = useCallback(
    async (direction: Direction) => {
      activeRef.current = direction;
      setActiveDirection(direction);

      try {
        await send({
          type: "command",
          id: crypto.randomUUID(),
          command: "move",
          direction,
        });
      } catch (error) {
        console.error("[DPAD MOVE]", error);
      }
    },
    [send]
  );

  const sendStop = useCallback(async () => {
    if (!activeRef.current) return;

    activeRef.current = null;
    setActiveDirection(null);

    try {
      await send({
        type: "command",
        id: crypto.randomUUID(),
        command: "stop",
      });
    } catch (error) {
      console.error("[DPAD STOP]", error);
    }
  }, [send]);

  function handlePointerDown(direction: Direction) {
    return (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault();

      if (!isConnected) return;

      sendMove(direction);
    };
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      {!isConnected && (
        <p className="mb-5 rounded-xl bg-black/20 p-3 text-center text-xs text-white/50">
          Connect your robot from the home screen to enable movement
          controls.
        </p>
      )}

      <div
        className="mx-auto grid w-full max-w-[260px] touch-none select-none grid-cols-3 grid-rows-3 gap-3"
        onPointerUp={sendStop}
        onPointerLeave={sendStop}
        onPointerCancel={sendStop}
      >
        {directions.map((direction) => {
          const { icon: Icon, label, position } =
            directionConfig[direction];

          const isActive = activeDirection === direction;

          return (
            <button
              key={direction}
              type="button"
              aria-label={label}
              disabled={!isConnected}
              onPointerDown={handlePointerDown(direction)}
              className={`flex h-16 w-16 items-center justify-center rounded-2xl border transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${position} ${
                isActive
                  ? "border-primary bg-primary/25 text-primary shadow-[0_0_16px_rgba(124,92,255,0.5)]"
                  : "border-border bg-surface-light text-white/70 hover:bg-white/5"
              }`}
            >
              <Icon size={26} strokeWidth={2.4} />
            </button>
          );
        })}

        <button
          type="button"
          aria-label="Stop"
          disabled={!isConnected}
          onClick={sendStop}
          className="col-start-2 row-start-2 flex h-16 w-16 items-center justify-center rounded-2xl border border-danger/40 bg-danger/10 text-xs font-black tracking-wide text-danger transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          STOP
        </button>
      </div>

      <p className="mt-5 text-center text-xs text-white/35">
        Press and hold a direction to move. Release to stop.
      </p>
    </div>
  );
}
