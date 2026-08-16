export type LevelDifficulty = "Easy" | "Medium" | "Hard";

export type LevelMeta = {
  id: number;
  title: string;
  description: string;
  difficulty: LevelDifficulty;
};

export const levels: LevelMeta[] = [
  {
    id: 1,
    title: "Level 1",
    description: "A straight course to learn the controls.",
    difficulty: "Easy",
  },
  {
    id: 2,
    title: "Level 2",
    description: "A few gentle turns added to the mix.",
    difficulty: "Easy",
  },
  {
    id: 3,
    title: "Level 3",
    description: "Tighter corners, less room for error.",
    difficulty: "Medium",
  },
  {
    id: 4,
    title: "Level 4",
    description: "Obstacles appear along the route.",
    difficulty: "Medium",
  },
  {
    id: 5,
    title: "Level 5",
    description: "A tight, fast course for confident drivers.",
    difficulty: "Hard",
  },
  {
    id: 6,
    title: "Level 6",
    description: "The full gauntlet. Beat it without a collision.",
    difficulty: "Hard",
  },
];

export function getLevelMeta(id: number): LevelMeta | undefined {
  return levels.find((level) => level.id === id);
}
