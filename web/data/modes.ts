export type ModeSlug =
  | "free-drive"
  | "challenge-arena"
  | "training-ground";

export type ModeAccent = "primary" | "accent" | "warning";

export type ModeMeta = {
  slug: ModeSlug;
  title: string;
  description: string;
  accent: ModeAccent;
};

export const modes: Record<ModeSlug, ModeMeta> = {
  "free-drive": {
    slug: "free-drive",
    title: "Free Drive",
    description: "Take control and explore freely.",
    accent: "primary",
  },
  "challenge-arena": {
    slug: "challenge-arena",
    title: "Challenge Arena",
    description: "Complete missions and beat your best score.",
    accent: "accent",
  },
  "training-ground": {
    slug: "training-ground",
    title: "Training Ground",
    description: "Practice your driving skills without restrictions.",
    accent: "warning",
  },
};

export function getModeMeta(slug: string | undefined): ModeMeta | undefined {
  if (!slug) return undefined;

  return modes[slug as ModeSlug];
}
