import type { CanonicalGameId } from "@/types/protocol";

export type GameSlug =
  | "colour-quest"
  | "echo-memory"
  | "driving-pro"
  | "reflex-arc"
  | "inverted-drive";
export type GameAccent = "primary" | "accent" | "warning";
export type GameIcon = "game" | "memory" | "reflex" | "drive";
export type TrainingIcon = "palette" | "eye" | "sparkles" | "help" | "trophy";
export type GameLevel = {
  id: number; title: string; description: string; difficulty: "Easy" | "Medium" | "Hard";
  concept?: string; timing?: string;
};
export type TrainingStep = { icon: TrainingIcon; title: string; description: string };
export type GameDefinition = {
  id: CanonicalGameId; slug: GameSlug; aliases?: string[]; title: string; description: string;
  accent: GameAccent; icon: GameIcon; comingSoon: boolean;
  trainingSteps: TrainingStep[]; levels: GameLevel[]; progressSupported?: boolean;
};

export const gameCatalog: GameDefinition[] = [
  {
    id: "color_quest", slug: "colour-quest", aliases: ["color-quest"],
    title: "Colour Quest", description: "Identify colours and complete challenges with your robot.",
    accent: "primary", icon: "game", comingSoon: false, progressSupported: true,
    trainingSteps: [
      { icon: "palette", title: "Colour Quest Mechanics", description: "Colour Quest tests your speed and color recognition across 6 levels of 10 tasks each." },
      { icon: "eye", title: "Memorize Phase (0–5s)", description: "The robot illuminates 4 physical LED regions simultaneously (Front, Right, Back, Left)." },
      { icon: "sparkles", title: "Identify the Target Region", description: "Find the primary color, secondary color, or target tint specified by the level objective." },
      { icon: "help", title: "Answer Phase (5–10s)", description: "LEDs turn off, but your answer remains open. Select the target region (Front, Right, Back, Left) via the screen or joystick." },
      { icon: "trophy", title: "Score & Unlock Levels", description: "Complete all 10 tasks in a level. Earn 3 stars (90%+ accuracy) to unlock the next challenge level!" },
    ],
    levels: [
      { id: 1, title: "Level 1", description: "🍎 Find the basic colours among the mixed ones! Nice and easy.", concept: "1 primary target + 3 secondary distractors", difficulty: "Easy", timing: "5 seconds" },
      { id: 2, title: "Level 2", description: "⚡ Same as before, but you gotta be quick! Gotta go fast!", concept: "1 primary target + 3 secondary distractors", difficulty: "Easy", timing: "2.5 seconds" },
      { id: 3, title: "Level 3", description: "🍊 Now find the mixed colours hidden among the basics!", concept: "1 secondary target + 3 primary distractors", difficulty: "Medium", timing: "5 seconds" },
      { id: 4, title: "Level 4", description: "🚀 Find the mixed colours, but at super speed! Don't blink!", concept: "1 secondary target + 3 primary distractors", difficulty: "Medium", timing: "2.5 seconds" },
      { id: 5, title: "Level 5", description: "🕵️‍♂️ Tricky! Spot the rare Orange or Purple colour hidden in the mix!", concept: "Tertiary target vs primary/secondary noise", difficulty: "Hard", timing: "5 seconds" },
      { id: 6, title: "Level 6", description: "👑 The Ultimate Boss Level! Spot the rare colour at max speed. Good luck!", concept: "Tertiary target vs primary/secondary noise", difficulty: "Hard", timing: "2.5 seconds" },
    ],
  },
  { id: "echo_memory", slug: "echo-memory", title: "Echo Memory", description: "Single-colour direction sequence, echo on joystick.", accent: "accent", icon: "memory", comingSoon: true, trainingSteps: [], levels: [] },
  { id: "driving_pro", slug: "driving-pro", title: "Driving Pro", description: "Basic driving tasks (straight, no collision, precision turns).", accent: "warning", icon: "drive", comingSoon: true, trainingSteps: [], levels: [] },
  { id: "reflex_arc", slug: "reflex-arc", aliases: ["reflex-dash"], title: "Reflex Arc", description: "Single-colour alert / safe point reflex testing.", accent: "warning", icon: "reflex", comingSoon: true, trainingSteps: [], levels: [] },
];

export function getGameDefinition(slug: string | undefined): GameDefinition | undefined {
  if (!slug) return undefined;
  const normalized = slug.toLowerCase().trim();
  return gameCatalog.find((game) => game.slug === normalized || game.aliases?.includes(normalized));
}
