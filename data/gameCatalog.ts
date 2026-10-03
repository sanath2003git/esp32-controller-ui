import type { CanonicalGameId } from "@/types/protocol";

export type GameSlug =
  | "colour-quest"
  | "echo-memory"
  | "driving-pro"
  | "reflex-dash"
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
  { 
    id: "echo_memory", 
    slug: "echo-memory", 
    title: "Echo Memory", 
    description: "Single-colour direction sequence, echo on joystick.", 
    accent: "accent", 
    icon: "memory", 
    comingSoon: false, 
    progressSupported: true,
    trainingSteps: [
      { icon: "eye", title: "Watch & Memorize", description: "Watch the Robo flash the directional LED sequence." },
      { icon: "sparkles", title: "Wait", description: "After the sequence, all LEDs turn off for 3 seconds. Remember the pattern." },
      { icon: "help", title: "Echo the Sequence", description: "Use the controller D-pad to reproduce the directions in the same order. Fixed mapping: Up = Red, Right = Yellow, Down = Green, Left = Blue." },
      { icon: "trophy", title: "Score & Stars", description: "Each mistake reduces your score percentage. Earn stars based on your final accuracy score (90%+ for 3 stars)." },
    ],
    levels: [
      { id: 1, title: "Level 1", description: "Watch the 4-step light pattern on your robot, wait 3 seconds, then echo the sequence!", difficulty: "Easy", timing: "3.0s flash / 3.0s wait", concept: "4-step sequence" },
      { id: 2, title: "Level 2", description: "5-step pattern at a faster pace. Watch closely, wait 3 seconds, then echo the sequence!", difficulty: "Easy", timing: "1.5s flash / 3.0s wait", concept: "5-step sequence" },
      { id: 3, title: "Level 3", description: "6-step challenge sequence at high speed. Wait 3 seconds, then echo the sequence!", difficulty: "Easy", timing: "1.5s flash / 3.0s wait", concept: "6-step sequence" },
      { id: 4, title: "Level 4", description: "Medium tier: 5-step sequence with physical actions (Pet & Honk). The entire LED strip flashes!", difficulty: "Medium", timing: "3.0s flash / 3.0s wait", concept: "5-step sequence with actions" },
      { id: 5, title: "Level 5", description: "Medium tier challenge: 6-step fast sequence with all actions across the entire strip!", difficulty: "Medium", timing: "1.5s flash / 3.0s wait", concept: "6-step sequence with actions" },
      { id: 6, title: "Level 6", description: "Hard tier: 7-step sequence with dynamic color-to-action mapping across all 6 actions!", difficulty: "Hard", timing: "1.5s flash / 3.0s wait", concept: "7-step sequence with dynamic mapping" },
    ],
  },
  { 
    id: "driving_pro", 
    slug: "driving-pro", 
    title: "Driving Pro", 
    description: "Basic driving tasks (straight, no collision, precision turns).", 
    accent: "primary", 
    icon: "drive", 
    comingSoon: false, 
    progressSupported: true,
    trainingSteps: [
      { icon: "palette", title: "Driver Training", description: "Learn basic maneuvers and collision avoidance." },
      { icon: "sparkles", title: "Reaction Challenge", description: "Follow random instructions and react to emergency stops." },
      { icon: "trophy", title: "System Failure", description: "Diagnose a sudden malfunction mid-drive." },
    ],
    levels: [
      { id: 1, title: "Driver Training", description: "Learn basic maneuvers and collision avoidance.", difficulty: "Easy" },
      { id: 2, title: "Reaction Challenge", description: "Follow random instructions and react to emergency stops.", difficulty: "Medium" },
      { id: 3, title: "System Failure", description: "Diagnose a sudden malfunction mid-drive.", difficulty: "Hard" },
    ],
  },
  { 
    id: "reflex_dash", 
    slug: "reflex-dash", 
    title: "Reflex Dash", 
    description: "Single-colour alert / safe point reflex testing.", 
    accent: "warning", 
    icon: "reflex", 
    comingSoon: false, 
    progressSupported: true,
    trainingSteps: [
      { icon: "palette", title: "1. Watch the Colors", description: "The screen will show different colors. Easy: Green (Go), Red (Stop). Medium: 2 Go Colors, 2 Stop Colors. Hard: 3 Go Colors, 3 Stop Colors." },
      { icon: "sparkles", title: "2. GO Action", description: "When a GO color appears, immediately press the GO button (or drive the robot). Do it as fast as you can to score points!" },
      { icon: "help", title: "3. STOP Action", description: "When a STOP color appears, do NOT press anything! Pressing during a STOP phase results in a penalty." },
      { icon: "trophy", title: "4. Score & Timing", description: "Each level lasts a fixed duration (15s, 20s, or 25s). Rack up points by reacting quickly to GO phases." },
    ],
    levels: [
      { id: 1, title: "Level 1", description: "Standard Red/Green signals. Drive on Green, stop on Red!", difficulty: "Easy", timing: "1000ms window", concept: "Fixed 2-Color · 6 phases" },
      { id: 2, title: "Level 2", description: "Faster transitions with unpredictable signal durations.", difficulty: "Easy", timing: "900ms window", concept: "Fixed 2-Color · 8 phases" },
      { id: 3, title: "Level 3", description: "Reflex speed test! Quick reaction required when light turns Red.", difficulty: "Easy", timing: "800ms window", concept: "Fixed 2-Color · 8 phases" },
      { id: 4, title: "Level 4", description: "Final Easy challenge. Tight 700ms reaction window!", difficulty: "Easy", timing: "700ms window", concept: "Fixed 2-Color · 10 phases" },
      { id: 5, title: "Level 5", description: "Medium tier unlocked! Rapid signals requiring fast reflexes.", difficulty: "Medium", timing: "500ms window", concept: "Fixed 2-Color · 10 phases" },
      { id: 6, title: "Level 6", description: "Ultra fast 2-color sprint! Can you stop in time?", difficulty: "Medium", timing: "450ms window", concept: "Fixed 2-Color · 10 phases" },
      { id: 7, title: "Level 7", description: "Expanded 4-color rules introduced! GO: Green & Blue. STOP: Red & Yellow.", difficulty: "Medium", timing: "500ms window", concept: "Fixed 4-Color · 10 phases" },
      { id: 8, title: "Level 8", description: "High-speed 4-color test! Process colors instantly before driving.", difficulty: "Medium", timing: "400ms window", concept: "Fixed 4-Color · 12 phases" },
      { id: 9, title: "Level 9", description: "Hard tier! Dynamic 6-color mapping randomized on level start. Memorize and drive!", difficulty: "Hard", timing: "350ms window", concept: "Dynamic 6-Color · 12 phases" },
      { id: 10, title: "Level 10", description: "Ultimate Boss Challenge! Extreme reaction speed & dynamic color recall.", difficulty: "Hard", timing: "300ms window", concept: "Dynamic 6-Color · 14 phases" },
    ],
  },
];

export function getGameDefinition(slug: string | undefined): GameDefinition | undefined {
  if (!slug) return undefined;
  const normalized = slug.toLowerCase().trim();
  return gameCatalog.find((game) => game.slug === normalized || game.aliases?.includes(normalized));
}