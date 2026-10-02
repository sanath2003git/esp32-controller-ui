export type DrivingProLevelMeta = {
  id: number;
  title: string;
  description: string;
  difficulty: "Easy" | "Medium" | "Hard";
};

export const DRIVING_PRO_LEVELS: DrivingProLevelMeta[] = [
  {
    id: 1,
    title: "Driver Training",
    description: "Learn basic maneuvers and collision avoidance.",
    difficulty: "Easy",
  },
  {
    id: 2,
    title: "Reaction Challenge",
    description: "Follow random instructions and react to emergency stops.",
    difficulty: "Medium",
  },
  {
    id: 3,
    title: "System Failure",
    description: "Diagnose a sudden malfunction mid-drive.",
    difficulty: "Hard",
  },
];

export function getDrivingProLevel(id: number): DrivingProLevelMeta | undefined {
  return DRIVING_PRO_LEVELS.find((l) => l.id === id);
}
