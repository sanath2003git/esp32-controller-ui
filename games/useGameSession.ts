"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBleContext } from "@/context/BleContext";
import type { CanonicalGameId, GameResultPayload } from "@/types/protocol";

export type GameSessionStatus = "idle" | "starting" | "playing" | "completed" | "error";

type UseGameSessionOptions = {
  game: CanonicalGameId;
  level?: number;
  timeoutMs?: number;
  onResult: (result: GameResultPayload) => void | Promise<void>;
};

export function useGameSession({ game, level, timeoutMs = 120_000, onResult }: UseGameSessionOptions) {
  const {
    status: bleStatus, startGame, abortGame,
    lastMessage, gameResult, openModal,
  } = useBleContext();
  const [status, setStatus] = useState<GameSessionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const statusRef = useRef<GameSessionStatus>("idle");
  const resultHandlerRef = useRef(onResult);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processedResultRef = useRef<string | null>(null);
  const baselineResultRef = useRef(gameResult);
  const baselineMessageRef = useRef(lastMessage);

  useEffect(() => {
    resultHandlerRef.current = onResult;
  }, [onResult]);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }, []);

  const setSessionStatus = useCallback((next: GameSessionStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const reset = useCallback(() => {
    clearTimer();
    processedResultRef.current = null;
    setError(null);
    setSessionStatus("idle");
  }, [clearTimer, setSessionStatus]);

  const start = useCallback(async () => {
    if (statusRef.current === "starting" || statusRef.current === "playing") return;
    if (bleStatus !== "connected") {
      setError("Robot is not connected over BLE. Please connect your device.");
      openModal();
      return;
    }

    clearTimer();
    setError(null);
    processedResultRef.current = null;
    baselineResultRef.current = gameResult;
    baselineMessageRef.current = lastMessage;
    setSessionStatus("starting");
    try {
      const started = await startGame(game, level);
      if (!started) throw new Error("The robot disconnected before the game could start.");
      if (started.gameId !== game || (level !== undefined && started.level !== level)) {
        throw new Error("The robot started a different game or level than requested.");
      }
      setSessionStatus("playing");
      timeoutRef.current = setTimeout(() => {
        if (statusRef.current === "playing" || statusRef.current === "starting") {
          setError("Robot response timed out. Please verify your robot firmware.");
          setSessionStatus("error");
        }
      }, timeoutMs);
    } catch (cause) {
      console.error("[GAME SESSION] Start failed", cause);
      setError(cause instanceof Error ? cause.message : "Failed to start the game.");
      setSessionStatus("error");
    }
  }, [bleStatus, clearTimer, game, gameResult, lastMessage, level, openModal, setSessionStatus, startGame, timeoutMs]);

  const abort = useCallback(async () => {
    clearTimer();
    if (bleStatus === "connected") await abortGame();
    setSessionStatus("idle");
  }, [abortGame, bleStatus, clearTimer, setSessionStatus]);

  useEffect(() => {
    const freshResult = gameResult !== baselineResultRef.current ? gameResult : null;
    const freshMessage = lastMessage !== baselineMessageRef.current ? lastMessage : null;
    const result = freshResult && freshResult.gameId === game && (freshResult.level === undefined || freshResult.level === level)
      ? freshResult
      : freshMessage?.type === "response" && freshMessage.response === "game_result" && freshMessage.gameId === game && freshMessage.level === level
        ? freshMessage
        : null;
    if (result) {
      if (result.status === "aborted") {
        clearTimer();
        setSessionStatus("idle");
        return;
      }
      const key = `${result.gameId}:${result.level}:${result.score}:${result.stars}`;
      if (processedResultRef.current === key) return;
      processedResultRef.current = key;
      clearTimer();
      setSessionStatus("completed");
      void resultHandlerRef.current(result);
      return;
    }
    if (status === "playing" && freshMessage?.type === "error") {
      const message = `Firmware error: ${freshMessage.payload.message ?? "Protocol error"}`;
      const timer = setTimeout(() => setError(message), 0);
      return () => clearTimeout(timer);
    }
  }, [clearTimer, game, gameResult, lastMessage, level, setSessionStatus, status]);

  useEffect(() => {
    if ((status === "playing" || status === "starting") && bleStatus !== "connected") {
      clearTimer();
      const timer = setTimeout(() => {
        setError("BLE connection lost while playing. Please reconnect.");
        setSessionStatus("error");
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [bleStatus, clearTimer, setSessionStatus, status]);

  useEffect(() => clearTimer, [clearTimer]);

  return { status, error, setError, start, abort, reset };
}
