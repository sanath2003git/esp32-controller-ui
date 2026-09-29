export type ModeSlug =
  | "colour-quest"
  | "color-quest"
  | "echo-memory"
  | "driving-pro"
  | "reflex-arc"
  | "reflex-dash";

export type ModeAccent = "primary" | "accent" | "warning";

export type ModeMeta = {
  slug: ModeSlug;
  title: string;
  description: string;
  accent: ModeAccent;
};

export const modes: Record<string, ModeMeta> = {
  "colour-quest": {
    slug: "colour-quest",
    title: "Colour Quest",
    description: "Identify colours and complete challenges with your robot.",
    accent: "primary",
  },
  "color-quest": {
    slug: "colour-quest",
    title: "Colour Quest",
    description: "Identify colours and complete challenges with your robot.",
    accent: "primary",
  },
  "echo-memory": {
    slug: "echo-memory",
    title: "Echo Memory",
    description: "Single-colour direction sequence, echo on joystick.",
    accent: "accent",
  },
  "driving-pro": {
    slug: "driving-pro",
    title: "Driving Pro",
    description: "Basic driving tasks (straight, no collision, precision turns).",
    accent: "primary",
  },
  "reflex-arc": {
    slug: "reflex-arc",
    title: "Reflex Arc",
    description: "Single-colour alert / safe point reflex testing.",
    accent: "warning",
  },
  "reflex-dash": {
    slug: "reflex-arc",
    title: "Reflex Arc",
    description: "Single-colour alert / safe point reflex testing.",
    accent: "warning",
  },
};

export function getModeMeta(slug: string | undefined): ModeMeta | undefined {
  if (!slug) return undefined;
  return modes[slug.toLowerCase().trim()];
}
