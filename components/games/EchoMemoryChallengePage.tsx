"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
    ArrowUp,
    ArrowRight,
    ArrowDown,
    ArrowLeft,
    Play,
    RotateCcw,
    AlertCircle,
    Bluetooth,
    BrainCircuit,
    Eye,
    Clock,
    Sparkles,
    CheckCircle2,
    XCircle,
    Megaphone,
    BookOpen,
} from "lucide-react";
import SubPageHeader from "@/components/SubPageHeader";
import ResultModal from "@/components/ResultModal";
import DPad, { type DPadButtonCustomStyle, type DPadDirection } from "@/components/DPad";
import { useBleContext } from "@/context/BleContext";
import {
    ECHO_COLOR_PALETTE,
    ECHO_MEMORY_MAPPING,
    createEchoMemoryAbortCommand,
    createEchoMemoryInputCommand,
    createEchoMemoryStartCommand,
    getEchoColorVisual,
    isValidEchoMemoryResult,
    type EchoMemoryLevelMeta,
} from "@/lib/echoMemory";
import { submitAndPersistLevelResult } from "@/lib/progressStore";
import type {
    EchoMemoryAction,
    EchoMemoryDirection,
    EchoMemoryGameState,
    EchoMemoryPhaseMessage,
    EchoMemoryResultMessage,
} from "@/types/echoMemory";

type StepResult = {
    answered: boolean;
    correct?: boolean;
    action?: EchoMemoryAction;
};

export default function EchoMemoryGame({
    levelId,
    levelMeta,
}: {
    levelId: number;
    levelMeta: EchoMemoryLevelMeta;
}) {
    const router = useRouter();
    const { status, send, lastMessage, openModal } = useBleContext();

    const isImplemented = levelMeta.isImplemented;

    const [gameState, setGameState] = useState<EchoMemoryGameState>("idle");
    const gameStateRef = useRef<EchoMemoryGameState>("idle");
    useEffect(() => {
        gameStateRef.current = gameState;
    }, [gameState]);

    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [dynamicMapping, setDynamicMapping] = useState<Record<string, string> | null>(null);
    const [mappingTimer, setMappingTimer] = useState<number>(5);
    const [flashIndex, setFlashIndex] = useState<number>(0);
    const [waitTimer, setWaitTimer] = useState<number>(3);
    const [inputStep, setInputStep] = useState<number>(0);
    const [isSubmittingInput, setIsSubmittingInput] = useState<boolean>(false);
    const [stepResults, setStepResults] = useState<StepResult[]>(() =>
        Array.from({ length: levelMeta.sequenceLength }, () => ({ answered: false }))
    );
    const [stepFeedback, setStepFeedback] = useState<{
        correct: boolean;
        stepIndex: number;
    } | null>(null);

    const [currentResult, setCurrentResult] = useState<{
        score: number;
        scorePercent: number;
        stars: 0 | 1 | 2 | 3;
        correct: number;
        total: number;
    } | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const inputWatchdogRef = useRef<NodeJS.Timeout | null>(null);

    const clearTimers = useCallback(() => {
        if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
        }
        if (inputWatchdogRef.current) {
            clearTimeout(inputWatchdogRef.current);
            inputWatchdogRef.current = null;
        }
    }, []);

    useEffect(() => {
        return () => {
            clearTimers();
        };
    }, [clearTimers]);

    // Handle BLE disconnect while playing
    useEffect(() => {
        if (
            (gameState === "starting" ||
                gameState === "mapping" ||
                gameState === "flashing" ||
                gameState === "waiting" ||
                gameState === "input") &&
            status !== "connected"
        ) {
            clearTimers();
            const timer = setTimeout(() => {
                setGameState("error");
                setErrorMessage("Robot BLE disconnected during gameplay. Please reconnect.");
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [gameState, status, clearTimers]);

    // Handle incoming BLE messages from ESP32
    useEffect(() => {
        if (!lastMessage || gameState === "idle") return;

        // 1. Phase messages (mapping, flash, wait, input)
        if (lastMessage.type === "phase" && lastMessage.game === "echo-memory") {
            if (lastMessage.phase === "mapping") {
                clearTimers();
                const phaseMsg = lastMessage as EchoMemoryPhaseMessage;
                const duration = Math.max(1, Math.round((phaseMsg.durationMs ?? 5000) / 1000));
                const mappingObj = phaseMsg.mapping;
                setTimeout(() => {
                    if (mappingObj) {
                        setDynamicMapping(mappingObj as Record<string, string>);
                    }
                    setGameState("mapping");
                    setMappingTimer(duration);
                }, 0);

                const startTime = Date.now();
                countdownIntervalRef.current = setInterval(() => {
                    const elapsed = Math.floor((Date.now() - startTime) / 1000);
                    const remaining = Math.max(0, duration - elapsed);
                    setMappingTimer(remaining);
                    if (remaining <= 0 && countdownIntervalRef.current) {
                        clearInterval(countdownIntervalRef.current);
                        countdownIntervalRef.current = null;
                    }
                }, 200);
            } else if (lastMessage.phase === "flash") {
                clearTimers();
                const idx = lastMessage.index ?? 0;
                const len = lastMessage.length ?? levelMeta.sequenceLength;
                setTimeout(() => {
                    setGameState("flashing");
                    setFlashIndex(idx);
                    setStepFeedback(null);
                    setStepResults((prev) =>
                        prev.length === len
                            ? prev
                            : Array.from({ length: len }, () => ({ answered: false }))
                    );
                }, 0);
            } else if (lastMessage.phase === "wait") {
                clearTimers();
                setTimeout(() => {
                    setGameState("waiting");
                    setWaitTimer(3);
                }, 0);

                // 3-second wait countdown
                const startTime = Date.now();
                countdownIntervalRef.current = setInterval(() => {
                    const elapsed = Math.floor((Date.now() - startTime) / 1000);
                    const remaining = Math.max(0, 3 - elapsed);
                    setWaitTimer(remaining);
                    if (remaining <= 0 && countdownIntervalRef.current) {
                        clearInterval(countdownIntervalRef.current);
                        countdownIntervalRef.current = null;
                    }
                }, 200);
            } else if (lastMessage.phase === "input") {
                clearTimers();
                const len = lastMessage.length ?? levelMeta.sequenceLength;
                setTimeout(() => {
                    setGameState("input");
                    setInputStep(0);
                    setIsSubmittingInput(false);
                    setStepResults((prev) =>
                        prev.length === len
                            ? prev
                            : Array.from({ length: len }, () => ({ answered: false }))
                    );
                }, 0);
            }
        }

        // 2. Input feedback message (per-step evaluation)
        if (lastMessage.type === "input_result" && lastMessage.game === "echo-memory") {
            const idx = lastMessage.index;
            const isCorrect = lastMessage.correct;

            setTimeout(() => {
                setStepResults((prev) => {
                    const next = [...prev];
                    if (next[idx]) {
                        next[idx] = {
                            ...next[idx],
                            answered: true,
                            correct: isCorrect,
                        };
                    }
                    return next;
                });

                setStepFeedback({ correct: isCorrect, stepIndex: idx });
                setInputStep(idx + 1);
                setIsSubmittingInput(false);
            }, 0);
        }

        // 3. Final Level Result message from firmware
        if (isValidEchoMemoryResult(lastMessage)) {
            clearTimers();
            const resMsg = lastMessage as EchoMemoryResultMessage;

            const resultPayload = {
                score: resMsg.score,
                scorePercent: resMsg.scorePercent,
                stars: resMsg.stars,
                correct: resMsg.correct,
                total: resMsg.total,
            };

            setTimeout(() => {
                setGameState("completed");
                setCurrentResult(resultPayload);
                setIsModalOpen(true);
            }, 0);

            // Persist progress to local store & backend
            void submitAndPersistLevelResult("echo-memory", levelId, resMsg.score).catch(
                (err) => {
                    console.warn("[ECHO MEMORY] Progress submission failed:", err);
                }
            );
        }

        // 4. Firmware error notification
        if (lastMessage.type === "error") {
            const errMsg = lastMessage.message;
            setTimeout(() => {
                setErrorMessage(`Firmware error: ${errMsg}`);
            }, 0);
        }

        // 5. Aborted acknowledgement
        if (lastMessage.type === "aborted" && lastMessage.game === "echo-memory") {
            clearTimers();
            setTimeout(() => {
                setGameState("idle");
            }, 0);
        }
    }, [lastMessage, gameState, clearTimers, levelId, levelMeta.sequenceLength]);

    // Start Challenge
    const handleStartGame = async () => {
        if (status !== "connected") {
            openModal();
            return;
        }

        if (!isImplemented) {
            setErrorMessage("Echo Memory Levels 1 to 6 are currently implemented.");
            return;
        }

        try {
            setErrorMessage(null);
            setStepResults(
                Array.from({ length: levelMeta.sequenceLength }, () => ({ answered: false }))
            );
            setStepFeedback(null);
            setInputStep(0);
            setFlashIndex(0);
            setDynamicMapping(null);
            setGameState("starting");

            await send(createEchoMemoryStartCommand(levelId));
        } catch (err) {
            console.error("[ECHO MEMORY] Start command error:", err);
            setGameState("error");
            setErrorMessage(
                err instanceof Error ? err.message : "Failed to send start command to robot."
            );
        }
    };

    // Submit Action Input (Up, Down, Left, Right, Honk)
    const handleActionInput = async (action: EchoMemoryAction) => {
        if (gameState !== "input" || isSubmittingInput || inputStep >= levelMeta.sequenceLength) {
            return;
        }

        if (status !== "connected") {
            setErrorMessage("Robot disconnected. Please reconnect.");
            return;
        }

        try {
            setIsSubmittingInput(true);

            // Record visual step prediction
            setStepResults((prev) => {
                const next = [...prev];
                if (next[inputStep]) {
                    next[inputStep] = { ...next[inputStep], action };
                }
                return next;
            });

            await send(createEchoMemoryInputCommand(action));

            // Watchdog in case firmware misses reply
            if (inputWatchdogRef.current) clearTimeout(inputWatchdogRef.current);
            inputWatchdogRef.current = setTimeout(() => {
                setIsSubmittingInput(false);
            }, 2000);
        } catch (err) {
            console.warn("[ECHO MEMORY] Input send failed:", err);
            setIsSubmittingInput(false);
        }
    };

    // Abort / Exit
    const handleExit = () => {
        if (
            gameState === "starting" ||
            gameState === "mapping" ||
            gameState === "flashing" ||
            gameState === "waiting" ||
            gameState === "input"
        ) {
            void send(createEchoMemoryAbortCommand()).catch((err) =>
                console.warn("[ECHO MEMORY] Abort error:", err)
            );
        }
        clearTimers();
        router.push("/playground/echo-memory/challenges");
    };

    // Replay
    const handleReplay = () => {
        setIsModalOpen(false);
        setCurrentResult(null);
        setGameState("idle");
        void handleStartGame();
    };

    // If level > 6 (future levels not implemented)
    if (!isImplemented) {
        return (
            <main className="min-h-screen pb-16">
                <SubPageHeader
                    title={`Echo Memory \u00b7 Level ${levelId}`}
                    subtitle="Coming Soon"
                    backHref="/playground/echo-memory/challenges"
                />

                <div className="mx-auto min-h-screen max-w-md px-4 pb-10 pt-24">
                    <section className="flex flex-col items-center rounded-3xl border border-white/10 bg-surface p-6 text-center shadow-xl">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-accent/30 bg-accent/15 text-accent mb-4">
                            <Sparkles size={32} />
                        </div>

                        <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-accent">
                            Not Implemented Yet
                        </span>

                        <h2 className="mt-4 text-xl font-extrabold text-white">
                            Level {levelId} is Coming Soon!
                        </h2>

                        <p className="mt-2 text-sm leading-6 text-white/50">
                            Echo Memory Levels 1–6 are currently supported. Further levels are not available.
                        </p>

                        <button
                            type="button"
                            onClick={() => router.push("/playground/echo-memory/challenges/1")}
                            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 text-sm font-bold text-black transition hover:bg-primary/90 active:scale-[0.98]"
                        >
                            Back to Level 1
                        </button>
                    </section>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen pb-16">
            <SubPageHeader
                title={`Echo Memory \u00b7 Level ${levelMeta.id}`}
                subtitle={`${levelMeta.difficulty} \u00b7 ${levelMeta.sequenceLength}-step sequence`}
                backHref="/playground/echo-memory/challenges"
            />

            <div className="mx-auto min-h-screen max-w-md px-4 pb-10 pt-24 space-y-5">
                {/* Header & Mode Intro */}
                <section className="rounded-3xl border border-white/10 bg-surface p-5 shadow-xl flex flex-col items-center text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-accent/20 text-accent mb-3 shadow-inner shadow-accent/20">
                        <BrainCircuit size={32} />
                    </div>

                    <h1 className="text-2xl font-black tracking-tight text-white">
                        Echo Memory
                    </h1>

                    <div className="mt-3 flex items-center justify-between w-full border-t border-white/10 pt-3">
                        <span className="rounded-full border border-accent/30 bg-accent/10 px-3 py-0.5 text-xs font-bold text-accent">
                            Level {levelMeta.id} · {levelMeta.difficulty}
                        </span>
                        <span className="text-xs font-medium text-white/50">
                            {levelMeta.sequenceLength} Steps · {levelMeta.flashDuration} Flash
                        </span>
                    </div>
                </section>

                {/* Colour-to-Direction / Action Mapping Reference */}
                <section className="rounded-3xl border border-white/10 bg-surface p-5 shadow-lg">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-white/40">
                            {levelId === 6
                                ? "Dynamic Color-to-Action Mapping"
                                : levelId >= 4
                                    ? "Fixed Color-to-Action Mapping"
                                    : "Fixed Color Mapping"}
                        </span>
                        <span className="text-[11px] text-accent font-semibold">
                            {levelId === 6
                                ? dynamicMapping
                                    ? "Study mapping below!"
                                    : "Generated per game"
                                : levelId >= 4
                                    ? "Study the 6 actions"
                                    : "Study the directions"}
                        </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                        {levelId === 6 ? (
                            // Level 6 Dynamic Mapping
                            (
                                [
                                    { action: "up" as EchoMemoryAction, label: "UP" },
                                    { action: "down" as EchoMemoryAction, label: "DOWN" },
                                    { action: "left" as EchoMemoryAction, label: "LEFT" },
                                    { action: "right" as EchoMemoryAction, label: "RIGHT" },
                                    { action: "pet" as EchoMemoryAction, label: "PET", sub: "(Touch)" },
                                    { action: "honk" as EchoMemoryAction, label: "HONK", sub: "(Center)" },
                                ]
                            ).map((item) => {
                                const colorKey = dynamicMapping?.[item.action];
                                const visual = colorKey ? getEchoColorVisual(colorKey) : null;
                                return (
                                    <div
                                        key={item.action}
                                        className={`flex items-center gap-3 rounded-2xl border p-3 ${visual ? visual.borderClass : "border-white/10"
                                            } bg-black/20`}
                                    >
                                        <div
                                            className="h-4 w-4 rounded-full shadow-[0_0_10px_currentColor] shrink-0"
                                            style={{
                                                backgroundColor: visual ? visual.hex : "#555",
                                                color: visual ? visual.hex : "#555",
                                            }}
                                        />
                                        <div className="flex flex-col text-left">
                                            <span className="text-xs font-black uppercase text-white flex items-center gap-1">
                                                {item.label}
                                                {item.sub && (
                                                    <span className={`text-[9px] font-normal ${item.action === "pet" ? "text-purple-300" : "text-white"} opacity-80`}>
                                                        {item.sub}
                                                    </span>
                                                )}
                                            </span>
                                            <span className={`text-[11px] font-semibold ${visual ? visual.textClass : "text-white/40"}`}>
                                                {visual ? visual.color : "Pending start..."}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            // Levels 1-5 Fixed Mapping
                            (levelId >= 4
                                ? [
                                    ECHO_MEMORY_MAPPING.up,
                                    ECHO_MEMORY_MAPPING.down,
                                    ECHO_MEMORY_MAPPING.left,
                                    ECHO_MEMORY_MAPPING.right,
                                    ECHO_MEMORY_MAPPING.pet,
                                    ECHO_MEMORY_MAPPING.honk,
                                ]
                                : [
                                    ECHO_MEMORY_MAPPING.up,
                                    ECHO_MEMORY_MAPPING.down,
                                    ECHO_MEMORY_MAPPING.left,
                                    ECHO_MEMORY_MAPPING.right,
                                ]
                            ).map((item) => (
                                <div
                                    key={item.action}
                                    className={`flex items-center gap-3 rounded-2xl border p-3 ${item.borderClass} bg-black/20`}
                                >
                                    <div
                                        className="h-4 w-4 rounded-full shadow-[0_0_10px_currentColor] shrink-0"
                                        style={{ backgroundColor: item.hex, color: item.hex }}
                                    />
                                    <div className="flex flex-col text-left">
                                        <span className="text-xs font-black uppercase text-white flex items-center gap-1">
                                            {item.label}
                                            {item.action === "pet" && (
                                                <span className="text-[9px] font-normal text-purple-300 opacity-80">(Touch)</span>
                                            )}
                                            {item.action === "honk" && (
                                                <span className="text-[9px] font-normal text-white opacity-80">(Center)</span>
                                            )}
                                        </span>
                                        <span className={`text-[11px] font-semibold ${item.textClass}`}>
                                            {item.color}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    {levelId >= 4 && (
                        <p className="mt-3 text-[11px] text-white/50 leading-relaxed border-t border-white/5 pt-2">
                            Note: <span className="text-purple-300 font-bold">PET</span> is performed by physically touching the robot&apos;s touch sensor. <span className="text-white font-bold">HONK</span> is the center button on the controller.
                        </p>
                    )}
                </section>

                {/* Error notification */}
                {errorMessage && (
                    <section className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-300 flex items-start gap-3">
                        <AlertCircle size={20} className="shrink-0 mt-0.5" />
                        <div className="text-xs leading-5 flex-1">
                            <span className="font-bold block">Error</span>
                            {errorMessage}
                        </div>
                    </section>
                )}

                {/* Primary Game State Display */}
                {gameState === "idle" && (
                    <section className="rounded-3xl border border-white/10 bg-surface p-6 text-center space-y-4 shadow-xl">
                        <div className="flex flex-col items-center">
                            <span className="text-lg font-bold text-white">Ready to begin?</span>
                            <p className="mt-1 text-xs leading-5 text-white/60">
                                {levelId === 6 ? (
                                    <>
                                        1. Study the randomly generated color-to-action mapping.<br />
                                        2. Watch your robot flash 7 colors across the full strip.<br />
                                        3. Wait 3 seconds, then echo the 7 actions using D-pad, Honk, or Pet!
                                    </>
                                ) : (
                                    <>
                                        1. Watch your robot flash {levelMeta.sequenceLength} {levelId >= 4 ? "colors across the full strip" : "lights"} one by one.<br />
                                        2. Wait 3 seconds for the signal.<br />
                                        3. Echo the {levelMeta.sequenceLength} {levelId >= 4 ? "actions using D-pad, Honk button, or Pet sensor" : "directions on your controller"}!
                                    </>
                                )}
                            </p>
                        </div>

                        {status !== "connected" ? (
                            <button
                                type="button"
                                onClick={openModal}
                                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-4 text-sm font-bold text-black transition-all hover:bg-amber-400 active:scale-[0.98] shadow-lg shadow-amber-500/20"
                            >
                                <Bluetooth size={18} /> Connect Robot BLE to Start
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleStartGame}
                                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-4 text-base font-bold text-black transition-all hover:bg-accent/90 active:scale-[0.98] shadow-lg shadow-accent/20"
                            >
                                <Play size={20} fill="currentColor" /> Start Level {levelMeta.id} Challenge
                            </button>
                        )}
                    </section>
                )}

                {gameState === "starting" && (
                    <section className="rounded-3xl border border-accent/30 bg-accent/10 p-6 text-center shadow-xl animate-pulse">
                        <div className="flex items-center justify-center gap-3 text-accent font-bold text-sm">
                            <RotateCcw size={18} className="animate-spin" />
                            Starting challenge on robot...
                        </div>
                    </section>
                )}

                {/* Phase 0: Mapping Phase (Level 6 Dynamic Mapping) */}
                {gameState === "mapping" && (
                    <section className="rounded-3xl border border-accent/40 bg-surface-light p-6 text-center shadow-2xl space-y-4">
                        <div className="flex items-center justify-center gap-2 text-xs font-bold text-accent uppercase tracking-widest">
                            <BookOpen size={18} className="animate-pulse" />
                            Phase 0: Study Generated Mapping
                        </div>

                        <div className="my-3 flex flex-col items-center">
                            <div className="h-20 w-20 rounded-full border-2 border-accent bg-accent/10 flex items-center justify-center text-accent text-4xl font-black animate-pulse shadow-[0_0_30px_rgba(0,229,255,0.4)]">
                                {mappingTimer}s
                            </div>
                            <span className="mt-3 text-xs text-white/50 font-semibold uppercase tracking-wider">
                                Study the mapping · Sequence begins shortly
                            </span>
                        </div>

                        <p className="text-xs text-white/70 max-w-xs mx-auto leading-relaxed">
                            Each action has been assigned a dynamic color for this game. Memorize the color mapping before the LEDs flash!
                        </p>
                    </section>
                )}

                {/* Phase 1: Flashing Phase */}
                {gameState === "flashing" && (
                    <section className="rounded-3xl border border-accent/40 bg-surface-light p-6 text-center shadow-2xl space-y-4">
                        <div className="flex items-center justify-center gap-2 text-xs font-bold text-accent uppercase tracking-widest">
                            <Eye size={18} className="animate-pulse" />
                            Phase 1: Watch Robot LEDs
                        </div>

                        <div className="my-3 flex flex-col items-center">
                            <div className="h-20 w-20 rounded-full border-2 border-accent bg-accent/10 flex items-center justify-center text-accent text-3xl font-black animate-pulse shadow-[0_0_30px_rgba(0,229,255,0.4)]">
                                {flashIndex + 1}
                            </div>
                            <span className="mt-3 text-xs text-white/50 font-semibold uppercase tracking-wider">
                                Flashing step {flashIndex + 1} of {levelMeta.sequenceLength}
                            </span>
                        </div>

                        <p className="text-xs text-white/70 max-w-xs mx-auto leading-relaxed">
                            {levelId >= 4
                                ? "Look closely at the robot's entire LED strip. Remember each action colour in order!"
                                : "Look closely at the robot's physical LED strip. Remember each directional colour in order!"}
                        </p>
                    </section>
                )}

                {/* Phase 2: Wait Phase (3 Seconds) */}
                {gameState === "waiting" && (
                    <section className="rounded-3xl border border-warning/40 bg-surface-light p-6 text-center shadow-2xl space-y-4">
                        <div className="flex items-center justify-center gap-2 text-xs font-bold text-warning uppercase tracking-widest">
                            <Clock size={18} className="animate-spin" />
                            Phase 2: Get Ready...
                        </div>

                        <div className="my-3 flex flex-col items-center">
                            <div className="h-20 w-20 rounded-full border-2 border-warning bg-warning/10 flex items-center justify-center text-warning text-4xl font-black animate-bounce shadow-[0_0_30px_rgba(255,200,87,0.4)]">
                                {waitTimer}s
                            </div>
                            <span className="mt-3 text-xs text-white/50 font-semibold uppercase tracking-wider">
                                LEDs off \u00b7 Prepare your answer
                            </span>
                        </div>

                        <p className="text-xs text-white/70 max-w-xs mx-auto leading-relaxed">
                            Input will be accepted in {waitTimer} seconds. Recall the sequence!
                        </p>
                    </section>
                )}

                {/* Phase 3: Input Phase (Interactive D-Pad) */}
                {gameState === "input" && (
                    <section className="rounded-3xl border border-emerald-500/40 bg-surface-light p-5 text-center shadow-2xl space-y-4">
                        <div className="flex items-center justify-between text-xs text-white/60">
                            <span className="font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                                <Sparkles size={16} /> Phase 3: Echo Sequence
                            </span>
                            <span className="font-semibold text-white/80">
                                Step {Math.min(inputStep + 1, levelMeta.sequenceLength)} / {levelMeta.sequenceLength}
                            </span>
                        </div>

                        {/* Sequence Step Tracker */}
                        <div
                            className={`grid gap-2 pt-1 ${levelMeta.sequenceLength === 7
                                ? "grid-cols-7"
                                : levelMeta.sequenceLength === 6
                                    ? "grid-cols-6"
                                    : levelMeta.sequenceLength === 5
                                        ? "grid-cols-5"
                                        : "grid-cols-4"
                                }`}
                        >
                            {stepResults.map((step, idx) => {
                                const isActive = inputStep === idx;
                                return (
                                    <div
                                        key={idx}
                                        className={`h-12 rounded-2xl border flex items-center justify-center transition-all ${step.answered
                                            ? step.correct
                                                ? "border-emerald-500 bg-emerald-500/20 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                                                : "border-rose-500 bg-rose-500/20 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.3)]"
                                            : isActive
                                                ? "border-accent bg-accent/15 text-accent animate-pulse shadow-[0_0_15px_rgba(0,229,255,0.3)]"
                                                : "border-white/10 bg-white/5 text-white/30"
                                            }`}
                                    >
                                        {step.answered ? (
                                            step.correct ? (
                                                <CheckCircle2 size={20} />
                                            ) : (
                                                <XCircle size={20} />
                                            )
                                        ) : (
                                            <span className="text-xs font-bold">{idx + 1}</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Step Feedback Banner */}
                        {stepFeedback && (
                            <div
                                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${stepFeedback.correct
                                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                                    : "border-rose-500/40 bg-rose-500/10 text-rose-300"
                                    }`}
                            >
                                {stepFeedback.correct
                                    ? `Step ${stepFeedback.stepIndex + 1}: Correct! \u2728`
                                    : `Step ${stepFeedback.stepIndex + 1}: Missed! Keep going... \ud83d\udca1`}
                            </div>
                        )}

                        {/* Directional Input D-Pad (Colour Quest styled) */}
                        {(() => {
                            const isDynamic = levelId === 6 && Boolean(dynamicMapping);
                            const upVisual = isDynamic
                                ? getEchoColorVisual(dynamicMapping?.up)
                                : getEchoColorVisual("red");
                            const rightVisual = isDynamic
                                ? getEchoColorVisual(dynamicMapping?.right)
                                : getEchoColorVisual("yellow");
                            const downVisual = isDynamic
                                ? getEchoColorVisual(dynamicMapping?.down)
                                : getEchoColorVisual("green");
                            const leftVisual = isDynamic
                                ? getEchoColorVisual(dynamicMapping?.left)
                                : getEchoColorVisual("blue");
                            const honkVisual = isDynamic
                                ? getEchoColorVisual(dynamicMapping?.honk)
                                : getEchoColorVisual("white");

                            return (
                                <DPad
                                    className="pt-2 pb-2"
                                    onDirection={(dir) => handleActionInput(dir)}
                                    onCenter={() => handleActionInput("honk")}
                                    showCenter={levelId >= 4}
                                    centerIcon={<Megaphone size={30} />}
                                    centerAriaLabel={`Honk (${honkVisual.color})`}
                                    centerId="echo-btn-honk"
                                    centerStyle={{
                                        borderClass: honkVisual.borderClass,
                                        bgClass: honkVisual.bgClass,
                                        textClass: honkVisual.textClass,
                                        glowClass: honkVisual.glowClass,
                                        label: isDynamic ? honkVisual.badgeText : "HONK",
                                    }}
                                    directionStyles={{
                                        up: {
                                            borderClass: upVisual.borderClass,
                                            bgClass: upVisual.bgClass,
                                            textClass: upVisual.textClass,
                                            glowClass: upVisual.glowClass,
                                            label: upVisual.badgeText,
                                        },
                                        left: {
                                            borderClass: leftVisual.borderClass,
                                            bgClass: leftVisual.bgClass,
                                            textClass: leftVisual.textClass,
                                            glowClass: leftVisual.glowClass,
                                            label: leftVisual.badgeText,
                                        },
                                        right: {
                                            borderClass: rightVisual.borderClass,
                                            bgClass: rightVisual.bgClass,
                                            textClass: rightVisual.textClass,
                                            glowClass: rightVisual.glowClass,
                                            label: rightVisual.badgeText,
                                        },
                                        down: {
                                            borderClass: downVisual.borderClass,
                                            bgClass: downVisual.bgClass,
                                            textClass: downVisual.textClass,
                                            glowClass: downVisual.glowClass,
                                            label: downVisual.badgeText,
                                        },
                                    }}
                                    disabled={isSubmittingInput || inputStep >= levelMeta.sequenceLength}
                                />
                            );
                        })()}

                        <p className="text-[11px] text-white/40">
                            {levelId >= 4
                                ? "Tap matching arrow/honk button, or touch robot sensor to Pet. Mistakes will not stop the game!"
                                : "Tap the color button matching each step. Mistakes will not stop the game!"}
                        </p>
                    </section>
                )}

                {/* Exit / Abort Button */}
                <button
                    type="button"
                    onClick={handleExit}
                    className="flex w-full items-center justify-center rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3.5 text-sm font-bold text-rose-400 hover:bg-rose-500/20 transition-all"
                >
                    Exit Challenge
                </button>
            </div>

            {/* Result Modal */}
            {currentResult && (
                <ResultModal
                    isOpen={isModalOpen}
                    level={levelId}
                    score={currentResult.score}
                    stars={currentResult.stars}
                    bestScore={currentResult.score}
                    hasNextLevel={levelId < 6}
                    isNextUnlocked={levelId < 6 && currentResult.stars >= 3}
                    onReplay={handleReplay}
                    onNextLevel={() => {
                        setIsModalOpen(false);
                        setCurrentResult(null);
                        setGameState("idle");
                        router.push(`/playground/echo-memory/challenges/${levelId + 1}`);
                    }}
                    onBackToLevels={handleExit}
                />
            )}
        </main>
    );
}