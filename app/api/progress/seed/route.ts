import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import {
  calculateGameProgress,
  COLOUR_QUEST_LEVELS,
  isLevelUnlocked,
  normalizeGameSlug,
} from "@/lib/colourQuest";
import type { LevelProgress } from "@/types/colourQuest";

export async function POST(request: Request) {
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

    const db = await getDatabase();
    const collection = db.collection("user_level_progress");

    await collection.createIndex(
      { userId: 1, game: 1, level: 1 },
      { unique: true }
    );

    // Seed level 1 if no progress exists for this user
    const count = await collection.countDocuments({ userId: user.id, game });

    if (count === 0) {
      const now = new Date();
      await collection.insertOne({
        userId: user.id,
        game,
        level: 1,
        bestScore: 0,
        stars: 0,
        attempts: 0,
        createdAt: now,
        updatedAt: now,
      });
    }

    const records = await collection
      .find({ userId: user.id, game })
      .toArray();

    const dbMap: Record<number, LevelProgress> = {};
    for (const rec of records) {
      const lvl = Number(rec.level);
      if (lvl >= 1 && lvl <= 6) {
        dbMap[lvl] = {
          level: lvl,
          bestScore: typeof rec.bestScore === "number" ? rec.bestScore : 0,
          stars: (typeof rec.stars === "number" && rec.stars >= 0 && rec.stars <= 3 ? rec.stars : 0) as 0 | 1 | 2 | 3,
          attempts: typeof rec.attempts === "number" ? rec.attempts : 0,
          unlocked: false,
          updatedAt: rec.updatedAt ? new Date(rec.updatedAt).toISOString() : undefined,
        };
      }
    }

    const levelsMap: Record<number, LevelProgress> = {};
    for (const lvlMeta of COLOUR_QUEST_LEVELS) {
      const lvl = lvlMeta.id;
      const existing = dbMap[lvl];
      const unlocked = isLevelUnlocked(lvl, dbMap);

      levelsMap[lvl] = {
        level: lvl,
        bestScore: existing?.bestScore ?? 0,
        stars: existing?.stars ?? 0,
        attempts: existing?.attempts ?? 0,
        unlocked,
        updatedAt: existing?.updatedAt,
      };
    }

    const progressInfo = calculateGameProgress(levelsMap);

    return NextResponse.json({
      success: true,
      game,
      seeded: count === 0,
      completedLevels: progressInfo.completedLevels,
      totalLevels: progressInfo.totalLevels,
      progressPercentage: progressInfo.progressPercentage,
      levels: levelsMap,
    });
  } catch (error) {
    console.error("[PROGRESS SEED ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
