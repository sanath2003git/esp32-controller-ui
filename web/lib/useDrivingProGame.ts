// ============================================================
// useDrivingProGame.ts
// Web-side game engine for Driving Pro.
// The firmware does NOT need changes — this hook listens to
// joystick commands the UI is about to send to determine
// mission state, and subscribes to telemetry for collision
// penalties.
// ============================================================

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RobotTelemetry } from "@/types/ble";

// ── Level 1 constants ────────────────────────────────────────
export const L1_TOTAL_SECONDS = 60;
export const L1_FWD_TARGET_MS = 20_000;
export const L1_REV_TARGET_MS = 5_000;
export const L1_LEFT_TARGET = 3;
export const L1_RIGHT_TARGET = 3;
export const L1_COLLISION_PENALTY = 10; // pts per collision

// ── Level 2 constants ────────────────────────────────────────
const L2_ROUNDS = 3;
const L2_CMD_MIN = 5;
const L2_CMD_MAX = 7;
const L2_MATCH_HOLD_MS = 1_500; // player must hold correct direction for this long
const L2_EMSTOP_WINDOW_MS = 2_000; // window to hit STOP after EMERGENCY
const L2_EMSTOP_CHANCE = 0.25; // probability per command slot
type L2Command = "forward" | "backward" | "left" | "right";
const L2_COMMANDS: L2Command[] = ["forward", "backward", "left", "right"];

function randChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ── Level 3 constants ────────────────────────────────────────
const L3_MALFUNCTION_AFTER_MS = 30_000;
const L3_FINAL_CMD_COUNT = 10;

// ── Shared types ─────────────────────────────────────────────

export type DPPhase =
  | "idle"
  | "l1_training"
  | "l2_challenge"
  | "l3_drive"
  | "l3_malfunction"
  | "l3_repair"
  | "l3_final"
  | "finished";

export type L1State = {
  timeLeftMs: number;
  forwardMs: number;
  reverseMs: number;
  leftTurns: number;
  rightTurns: number;
  collisions: number;
  score: number;
};

export type L2StepKind = "command" | "emergency";
export type L2Step = {
  kind: L2StepKind;
  command?: L2Command;
};
export type L2State = {
  round: number; // 1-indexed
  totalRounds: number;
  steps: L2Step[];
  stepIndex: number;
  holdStartMs: number | null; // when the player started holding the right dir
  emergencyReactMs: number | null; // when EMERGENCY flashed
  score: number;
  collisions: number;
};

export type L3DiagnosticSystem =
  | "battery"
  | "bluetooth"
  | "left_motor"
  | "right_motor";
export type L3FaultScenario = {
  faultSystem: L3DiagnosticSystem;
  systems: { name: string; key: L3DiagnosticSystem; ok: boolean }[];
};
export type L3State = {
  driveStartMs: number;
  malfunctionAt: number;
  phase: "drive" | "malfunction" | "repair" | "final";
  scenario: L3FaultScenario | null;
  repairCorrect: boolean | null;
  finalSteps: L2Step[];
  finalStepIndex: number;
  finalHoldStart: number | null;
  score: number;
  collisions: number;
};

export type DrivingProGameState = {
  phase: DPPhase;
  l1: L1State | null;
  l2: L2State | null;
  l3: L3State | null;
  finalScore: number | null;
};

// ── Hook ─────────────────────────────────────────────────────

export function useDrivingProGame(levelId: number) {
  const [state, setState] = useState<DrivingProGameState>({
    phase: "idle",
    l1: null,
    l2: null,
    l3: null,
    finalScore: null,
  });

  // refs for mutable loop state (avoids stale closure in rAF)
  const phaseRef = useRef<DPPhase>("idle");
  const l1Ref = useRef<L1State | null>(null);
  const l2Ref = useRef<L2State | null>(null);
  const l3Ref = useRef<L3State | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);

  // Current active driving direction (set from joystick)
  const activeDirectionRef = useRef<"forward" | "backward" | "left" | "right" | null>(null);

  // ── helpers ──────────────────────────────────────────────

  const flush = useCallback(() => {
    setState({
      phase: phaseRef.current,
      l1: l1Ref.current ? { ...l1Ref.current } : null,
      l2: l2Ref.current ? { ...l2Ref.current } : null,
      l3: l3Ref.current ? { ...l3Ref.current } : null,
      finalScore: null,
    });
  }, []);

  const finishGame = useCallback((score: number) => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    phaseRef.current = "finished";
    setState((prev) => ({ ...prev, phase: "finished", finalScore: score }));
  }, []);

  // ── Level 1 tick ─────────────────────────────────────────

  const tickL1 = useCallback((deltaMs: number) => {
    const s = l1Ref.current;
    if (!s) return;

    // Accumulate driving time
    const dir = activeDirectionRef.current;
    if (dir === "forward") s.forwardMs = Math.min(s.forwardMs + deltaMs, L1_FWD_TARGET_MS);
    if (dir === "backward") s.reverseMs = Math.min(s.reverseMs + deltaMs, L1_REV_TARGET_MS);

    // Countdown
    s.timeLeftMs = Math.max(0, s.timeLeftMs - deltaMs);

    // Check win/timeout
    const fwdDone = s.forwardMs >= L1_FWD_TARGET_MS;
    const revDone = s.reverseMs >= L1_REV_TARGET_MS;
    const leftDone = s.leftTurns >= L1_LEFT_TARGET;
    const rightDone = s.rightTurns >= L1_RIGHT_TARGET;
    const checklistComplete = fwdDone && revDone && leftDone && rightDone;

    if (checklistComplete || s.timeLeftMs <= 0) {
      // Calculate score
      const fwdPct = Math.min(s.forwardMs / L1_FWD_TARGET_MS, 1);
      const revPct = Math.min(s.reverseMs / L1_REV_TARGET_MS, 1);
      const leftPct = Math.min(s.leftTurns / L1_LEFT_TARGET, 1);
      const rightPct = Math.min(s.rightTurns / L1_RIGHT_TARGET, 1);
      const checklistScore = ((fwdPct + revPct + leftPct + rightPct) / 4) * 100;
      const penalty = s.collisions * L1_COLLISION_PENALTY;
      const finalScore = Math.max(0, Math.round(checklistScore - penalty));
      finishGame(finalScore);
      return;
    }

    flush();
  }, [flush, finishGame]);

  // ── Level 2 helpers ───────────────────────────────────────

  const buildL2Round = (round: number): L2State => {
    const cmdCount = randInt(L2_CMD_MIN, L2_CMD_MAX);
    const steps: L2Step[] = [];
    for (let i = 0; i < cmdCount; i++) {
      if (i > 0 && Math.random() < L2_EMSTOP_CHANCE) {
        steps.push({ kind: "emergency" });
      }
      steps.push({ kind: "command", command: randChoice(L2_COMMANDS) });
    }
    return {
      round,
      totalRounds: L2_ROUNDS,
      steps,
      stepIndex: 0,
      holdStartMs: null,
      emergencyReactMs: null,
      score: 0,
      collisions: 0,
    };
  };

  const tickL2 = useCallback((deltaMs: number, nowMs: number) => {
    const s = l2Ref.current;
    if (!s) return;

    const step = s.steps[s.stepIndex];
    if (!step) return;

    if (step.kind === "emergency") {
      // Player must release joystick (null direction) within window
      if (s.emergencyReactMs === null) {
        s.emergencyReactMs = nowMs;
      }
      const elapsed = nowMs - s.emergencyReactMs;
      const dir = activeDirectionRef.current;
      if (dir === null) {
        // Reacted! Score based on speed
        const reactionMs = elapsed;
        const reactionScore = Math.max(0, Math.round(25 * (1 - reactionMs / L2_EMSTOP_WINDOW_MS)));
        s.score += reactionScore;
        s.emergencyReactMs = null;
        s.stepIndex++;
      } else if (elapsed > L2_EMSTOP_WINDOW_MS) {
        // Too slow — no score for this step
        s.emergencyReactMs = null;
        s.stepIndex++;
      }
    } else if (step.kind === "command") {
      const dir = activeDirectionRef.current;
      if (dir === step.command) {
        if (s.holdStartMs === null) {
          s.holdStartMs = nowMs;
        } else if (nowMs - s.holdStartMs >= L2_MATCH_HOLD_MS) {
          // Correct match held long enough
          s.score += 8; // per correct command
          s.holdStartMs = null;
          s.stepIndex++;
        }
      } else {
        s.holdStartMs = null;
        // Wrong input -> no penalty, just reset hold
      }
    }

    // Advance round or finish
    if (s.stepIndex >= s.steps.length) {
      if (s.round < L2_ROUNDS) {
        l2Ref.current = buildL2Round(s.round + 1);
        l2Ref.current.score = s.score;
        l2Ref.current.collisions = s.collisions;
      } else {
        const penalty = s.collisions * 10;
        finishGame(Math.max(0, s.score - penalty));
        return;
      }
    }

    flush();
  }, [flush, finishGame]);

  // ── Level 3 helpers ───────────────────────────────────────

  const buildL3Scenario = (): L3FaultScenario => {
    const faults: L3DiagnosticSystem[] = ["battery", "bluetooth", "left_motor", "right_motor"];
    const faultSystem = randChoice(faults);
    const systems: L3FaultScenario["systems"] = [
      { name: "Battery", key: "battery", ok: faultSystem !== "battery" },
      { name: "Bluetooth", key: "bluetooth", ok: faultSystem !== "bluetooth" },
      { name: "Left Motor", key: "left_motor", ok: faultSystem !== "left_motor" },
      { name: "Right Motor", key: "right_motor", ok: faultSystem !== "right_motor" },
    ];
    return { faultSystem, systems };
  };

  const buildL3FinalSteps = (): L2Step[] => {
    const steps: L2Step[] = [];
    for (let i = 0; i < L3_FINAL_CMD_COUNT; i++) {
      if (i > 0 && Math.random() < 0.3) {
        steps.push({ kind: "emergency" });
      }
      steps.push({ kind: "command", command: randChoice(L2_COMMANDS) });
    }
    return steps;
  };

  const tickL3 = useCallback((deltaMs: number, nowMs: number) => {
    const s = l3Ref.current;
    if (!s) return;

    if (s.phase === "drive") {
      // Check malfunction trigger
      if (nowMs - s.driveStartMs >= s.malfunctionAt) {
        s.phase = "malfunction";
        s.scenario = buildL3Scenario();
        phaseRef.current = "l3_malfunction";
        flush();
        return;
      }
    }

    if (s.phase === "final") {
      const step = s.finalSteps[s.finalStepIndex];
      if (!step) {
        finishGame(Math.max(0, s.score - s.collisions * 10));
        return;
      }

      const dir = activeDirectionRef.current;
      if (step.kind === "emergency") {
        if (s.finalHoldStart === null) {
          s.finalHoldStart = nowMs;
        }
        if (dir === null) {
          s.score += 10;
          s.finalHoldStart = null;
          s.finalStepIndex++;
        } else if (nowMs - s.finalHoldStart > L2_EMSTOP_WINDOW_MS) {
          s.finalHoldStart = null;
          s.finalStepIndex++;
        }
      } else if (step.kind === "command") {
        if (dir === step.command) {
          if (s.finalHoldStart === null) {
            s.finalHoldStart = nowMs;
          } else if (nowMs - s.finalHoldStart >= L2_MATCH_HOLD_MS) {
            s.score += 8;
            s.finalHoldStart = null;
            s.finalStepIndex++;
          }
        } else {
          s.finalHoldStart = null;
        }
      }
    }

    flush();
  }, [flush, finishGame]);

  // ── Main rAF loop ─────────────────────────────────────────

  const tick = useCallback(() => {
    const now = performance.now();
    const delta = lastTickRef.current ? Math.min(now - lastTickRef.current, 100) : 16;
    lastTickRef.current = now;

    const phase = phaseRef.current;
    if (phase === "l1_training") tickL1(delta);
    else if (phase === "l2_challenge") tickL2(delta, now);
    else if (phase === "l3_drive" || phase === "l3_final") tickL3(delta, now);

    if (phaseRef.current !== "idle" && phaseRef.current !== "finished") {
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [tickL1, tickL2, tickL3]);

  // ── Public API ────────────────────────────────────────────

  const startGame = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    lastTickRef.current = 0;

    if (levelId === 1) {
      phaseRef.current = "l1_training";
      l1Ref.current = {
        timeLeftMs: L1_TOTAL_SECONDS * 1000,
        forwardMs: 0,
        reverseMs: 0,
        leftTurns: 0,
        rightTurns: 0,
        collisions: 0,
        score: 100,
      };
      l2Ref.current = null;
      l3Ref.current = null;
    } else if (levelId === 2) {
      phaseRef.current = "l2_challenge";
      l1Ref.current = null;
      l2Ref.current = buildL2Round(1);
      l3Ref.current = null;
    } else if (levelId === 3) {
      const scenario = null; // built on malfunction
      phaseRef.current = "l3_drive";
      l1Ref.current = null;
      l2Ref.current = null;
      l3Ref.current = {
        driveStartMs: performance.now(),
        malfunctionAt: L3_MALFUNCTION_AFTER_MS,
        phase: "drive",
        scenario,
        repairCorrect: null,
        finalSteps: [],
        finalStepIndex: 0,
        finalHoldStart: null,
        score: 50,
        collisions: 0,
      };
    }

    flush();
    rafRef.current = requestAnimationFrame(tick);
  }, [levelId, flush, tick]);

  // Notified by UI when joystick direction changes
  const notifyDirection = useCallback(
    (dir: "forward" | "backward" | "left" | "right" | null) => {
      const prev = activeDirectionRef.current;
      activeDirectionRef.current = dir;

      // Count discrete turn events for Level 1
      if (levelId === 1 && l1Ref.current) {
        if (dir === "left" && prev !== "left") l1Ref.current.leftTurns++;
        if (dir === "right" && prev !== "right") l1Ref.current.rightTurns++;
      }
    },
    [levelId]
  );

  // Notified by UI when a telemetry update with collision arrives
  const notifyCollision = useCallback(() => {
    if (levelId === 1 && l1Ref.current) {
      l1Ref.current.collisions++;
    } else if (levelId === 2 && l2Ref.current) {
      l2Ref.current.collisions++;
    } else if (levelId === 3 && l3Ref.current) {
      l3Ref.current.collisions++;
    }
  }, [levelId]);

  // Level 3: player submits a repair guess
  const submitRepair = useCallback(
    (key: L3DiagnosticSystem): boolean => {
      const s = l3Ref.current;
      if (!s || s.phase !== "malfunction") return false;

      const correct = s.scenario?.faultSystem === key;
      s.repairCorrect = correct;

      if (correct) {
        s.score += 30;
        s.phase = "final";
        s.finalSteps = buildL3FinalSteps();
        s.finalStepIndex = 0;
        phaseRef.current = "l3_final";
        flush();
        // Resume rAF
        lastTickRef.current = 0;
        rafRef.current = requestAnimationFrame(tick);
      } else {
        s.score = Math.max(0, s.score - 15);
        flush();
      }

      return correct;
    },
    [flush, tick]
  );

  // Stop game (abort)
  const stopGame = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    phaseRef.current = "idle";
    l1Ref.current = null;
    l2Ref.current = null;
    l3Ref.current = null;
    setState({ phase: "idle", l1: null, l2: null, l3: null, finalScore: null });
  }, []);

  // Hook for telemetry — call this inside the page via useEffect
  const handleTelemetry = useCallback(
    (t: RobotTelemetry) => {
      const anyObstacle =
        t.obstacle.frontLeft ||
        t.obstacle.frontRight ||
        t.obstacle.rearLeft ||
        t.obstacle.rearRight;
      if (anyObstacle) notifyCollision();
    },
    [notifyCollision]
  );

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return { state, startGame, stopGame, notifyDirection, notifyCollision, handleTelemetry, submitRepair };
}
