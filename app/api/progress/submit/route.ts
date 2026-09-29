import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import {
  calculateGameProgress,
  calculateStars,
  COLOUR_QUEST_LEVELS,
  isLevelUnlocked,
  mergeBestScore,
  mergeBestStars,
  normalizeGameSlug,
  normalizeStars,
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

    const body = await request.json();
    const rawGame = body.game;
    const game = normalizeGameSlug(rawGame);
    const { level, score } = body;

    if (
      game !== "color-quest" ||
      typeof level !== "number" ||
      level < 1 ||
      level > 6 ||
      typeof score !== "number" ||
      !Number.isFinite(score) ||
      score < 0
    ) {
      console.error("[PROGRESS SUBMIT] Validation failed for payload:", { game, level, score });
      return NextResponse.json(
        { success: false, error: "Invalid payload parameters" },
        { status: 400 }
      );
    }

    const db = await getDatabase();
    const collection = db.collection("user_level_progress");

    // Fetch existing levels to check if target level is unlocked
    const existingRecords = await collection
      .find({ userId: user.id, game })
      .toArray();

    const existingMap: Record<number, LevelProgress> = {};
    for (const rec of existingRecords) {
      const lvl = Number(rec.level);
      existingMap[lvl] = {
        level: lvl,
        bestScore: typeof rec.bestScore === "number" ? rec.bestScore : 0,
        stars: normalizeStars(rec.stars),
        attempts: typeof rec.attempts === "number" ? rec.attempts : 0,
        unlocked: false,
      };
    }

    if (!isLevelUnlocked(level, existingMap)) {
      return NextResponse.json(
        { success: false, error: "Level is currently locked" },
        { status: 403 }
      );
    }

    const awardedStars = calculateStars(score);
    const currentLevelRec = existingMap[level];

    const newBestScore = mergeBestScore(currentLevelRec?.bestScore, score);
    const newBestStars = mergeBestStars(currentLevelRec?.stars, awardedStars);

    // Update DB record
    await collection.updateOne(
      { userId: user.id, game, level },
      {
        $set: {
          bestScore: newBestScore,
          stars: newBestStars,
          updatedAt: new Date(),
        },
        $inc: { attempts: 1 },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );

    // Re-fetch all level progress to build authoritative progress state
    const updatedRecords = await collection
      .find({ userId: user.id, game })
      .toArray();

    const updatedDbMap: Record<number, LevelProgress> = {};
    for (const rec of updatedRecords) {
      const lvl = Number(rec.level);
      updatedDbMap[lvl] = {
        level: lvl,
        bestScore: typeof rec.bestScore === "number" ? rec.bestScore : 0,
        stars: normalizeStars(rec.stars),
        attempts: typeof rec.attempts === "number" ? rec.attempts : 0,
        unlocked: false,
        updatedAt: rec.updatedAt ? new Date(rec.updatedAt).toISOString() : undefined,
      };
    }

    const levelsMap: Record<number, LevelProgress> = {};
    for (const lvlMeta of COLOUR_QUEST_LEVELS) {
      const lvl = lvlMeta.id;
      const existing = updatedDbMap[lvl];
      const unlocked = isLevelUnlocked(lvl, updatedDbMap);

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
      level,
      score,
      awardedStars,
      bestScore: newBestScore,
      bestStars: newBestStars,
      completedLevels: progressInfo.completedLevels,
      totalLevels: progressInfo.totalLevels,
      progressPercentage: progressInfo.progressPercentage,
      levels: levelsMap,
    });
  } catch (error) {
    console.error("[PROGRESS SUBMIT ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
