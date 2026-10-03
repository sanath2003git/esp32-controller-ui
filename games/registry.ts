import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { getGameDefinition } from "@/data/gameCatalog";
import type { CanonicalGameId } from "@/types/protocol";

export interface GameChallengeStrategy {
  Component: ComponentType;
}

const challengeStrategies: Partial<Record<CanonicalGameId, GameChallengeStrategy>> = {
  color_quest: {
    Component: dynamic(() => import("@/components/games/ColorQuestChallengePage")),
  },
  reflex_dash: {
    Component: dynamic(() => import("@/components/games/ReflexDashChallengePage")),
  },
  echo_memory: {
    Component: dynamic(() => import("@/components/games/EchoMemoryChallengePage")),
  },
};

export function getChallengeRuntime(slug: string | undefined): GameChallengeStrategy | undefined {
  const game = getGameDefinition(slug);
  return game ? challengeStrategies[game.id] : undefined;
}
