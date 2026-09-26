import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import {
  calculateGameProgress,
  COLOUR_QUEST_LEVELS,
  isLevelUnlocked,
  normalizeGameSlug,
  normalizeStars,
} from "@/lib/colourQuest";
import { REFLEX_DASH_LEVELS } from "@/lib/reflexDash";
import { ECHO_MEMORY_LEVELS } from "@/lib/echoMemory";
import type { LevelProgress } from "@/types/colourQuest";

export async function GET(request: Request) {
  try {
    const user = await currentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const game = normalizeGameSlug(searchParams.get("game") || "color-quest");

    const dbMap: Record<number, LevelProgress> = {};

    try {
      const db = await getDatabase();
      const collection = db.collection("user_level_progress");
      const records = await collection
        .find({ userId: user.id, game })
        .toArray();

      for (const rec of records) {
        const lvl = Number(rec.level);
        if (lvl >= 1 && lvl <= 6) {
          dbMap[lvl] = {
            level: lvl,
            bestScore: typeof rec.bestScore === "number" ? rec.bestScore : 0,
            stars: normalizeStars(rec.stars),
            attempts: typeof rec.attempts === "number" ? rec.attempts : 0,
            unlocked: false,
            updatedAt: rec.updatedAt ? new Date(rec.updatedAt).toISOString() : undefined,
          };
        }
      }
    } catch (dbErr) {
      console.warn("[PROGRESS API] MongoDB read error/skipped:", dbErr);
    }

    // Authoritative unlock computation
    const levelsMap: Record<number, LevelProgress> = {};
    const gameLevels =
      game === "reflex-dash"
        ? REFLEX_DASH_LEVELS
        : game === "echo-memory"
          ? ECHO_MEMORY_LEVELS
          : COLOUR_QUEST_LEVELS;
    
    for (const lvlMeta of gameLevels) {
      const lvl = lvlMeta.id;
      const existing = dbMap[lvl];
      const unlocked = game === "echo-memory" ? lvl === 1 : isLevelUnlocked(lvl, dbMap);

      levelsMap[lvl] = {
        level: lvl,
        bestScore: existing?.bestScore ?? 0,
        stars: existing?.stars ?? 0,
        attempts: existing?.attempts ?? 0,
        unlocked,
        updatedAt: existing?.updatedAt,
      };
    }

    const totalLevels = gameLevels.length;
    let completedLevels = 0;
    for (let i = 1; i <= totalLevels; i++) {
      if (levelsMap[i] && levelsMap[i].stars > 0) {
        completedLevels++;
      }
    }
    const progressPercentage = Math.round((completedLevels / totalLevels) * 100);

    return NextResponse.json({
      success: true,
      game,
      completedLevels,
      totalLevels,
      progressPercentage,
      levels: levelsMap,
    });
  } catch (error) {
    console.error("[PROGRESS GET ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
