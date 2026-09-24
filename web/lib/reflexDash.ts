import type { LevelDifficulty } from "@/data/levels";

export type LevelMeta = {
  id: number;
  title: string;
  description: string;
  difficulty: LevelDifficulty;
  timing?: string;
};

export const REFLEX_DASH_LEVELS: LevelMeta[] = [
  {
    id: 1,
    title: "Level 1",
    description: "Two colors: Red (Stop) and Green (Go). Get moving when it's green!",
    difficulty: "Easy",
    timing: "15 seconds",
  },
  {
    id: 2,
    title: "Level 2",
    description: "Four colors. Two for Go, Two for Stop. React quickly!",
    difficulty: "Medium",
    timing: "20 seconds",
  },
  {
    id: 3,
    title: "Level 3",
    description: "Six colors. Three for Go, Three for Stop. Maximum cognitive load!",
    difficulty: "Hard",
    timing: "25 seconds",
  }
];

export function getReflexDashLevel(id: number): LevelMeta | undefined {
  return REFLEX_DASH_LEVELS.find((l) => l.id === id);
}
