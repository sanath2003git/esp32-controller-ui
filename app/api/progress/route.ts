import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { getGameDefinition } from "@/data/gameCatalog";
import {
  calculateGameProgress,
  isLevelUnlocked,
  normalizeGameSlug,
  normalizeStars,
} from "@/lib/colourQuest";
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
    const rawGame = searchParams.get("game") || "color-quest";
    const gameDef = getGameDefinition(rawGame);
    const game = normalizeGameSlug(rawGame);

    const levels = gameDef?.levels ?? [];
    const totalLevels = levels.length;
    const dbMap: Record<number, LevelProgress> = {};

    try {
      const db = await getDatabase();
      const collection = db.collection("user_level_progress");
      
      // Ensure compound index for fast structured queries
      await collection.createIndex({ userId: 1, game: 1, level: 1 }, { unique: true }).catch(() => {});

      const records = await collection
        .find({ userId: user.id, game })
        .toArray();

      for (const rec of records) {
        const lvl = Number(rec.level);
        if (lvl >= 1 && lvl <= totalLevels) {
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
    for (const lvlMeta of levels) {
      const lvl = lvlMeta.id;
      const existing = dbMap[lvl];
      const unlocked = isLevelUnlocked(lvl, dbMap, totalLevels);

      levelsMap[lvl] = {
        level: lvl,
        bestScore: existing?.bestScore ?? 0,
        stars: existing?.stars ?? 0,
        attempts: existing?.attempts ?? 0,
        unlocked,
        updatedAt: existing?.updatedAt,
      };
    }

    const progressInfo = calculateGameProgress(levelsMap, totalLevels);

    return NextResponse.json({
      success: true,
      game,
      completedLevels: progressInfo.completedLevels,
      totalLevels: progressInfo.totalLevels,
      progressPercentage: progressInfo.progressPercentage,
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
