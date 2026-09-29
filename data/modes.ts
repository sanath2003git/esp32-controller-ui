export type ModeSlug =
  | "colour-quest"
  | "echo-memory"
  | "driving-pro"
  | "reflex-dash";

export type ModeAccent = "primary" | "accent" | "warning";

export type ModeMeta = {
  slug: ModeSlug;
  title: string;
  description: string;
  accent: ModeAccent;
};

export const modes: Record<ModeSlug, ModeMeta> = {
  "colour-quest": {
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
    slug:"driving-pro",
    title: "Driving Pro",
    description: "Basic driving tasks (straight, no collision, precision turns).",
    accent: "primary"
  },
  "reflex-dash": {
    slug: "reflex-dash",
    title: "Reflex Dash",
    description: "Single-colour alert / safe point reflex testing.",
    accent: "warning",
  },
};

export function getModeMeta(slug: string | undefined): ModeMeta | undefined {
  if (!slug) return undefined;

  return modes[slug as ModeSlug];
}
