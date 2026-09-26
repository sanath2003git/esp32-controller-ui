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
import { REFLEX_DASH_LEVELS } from "@/lib/reflexDash";
import {
  ECHO_MEMORY_LEVELS,
  calculateEchoMemoryStars,
  isEchoMemoryLevelUnlocked,
} from "@/lib/echoMemory";
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

    const maxLevels =
      game === "color-quest"
        ? COLOUR_QUEST_LEVELS.length
        : game === "reflex-dash"
          ? REFLEX_DASH_LEVELS.length
          : game === "echo-memory"
            ? ECHO_MEMORY_LEVELS.length
            : 0;

    if (
      (game !== "color-quest" && game !== "reflex-dash" && game !== "echo-memory") ||
      typeof level !== "number" ||
      level < 1 ||
      level > maxLevels ||
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

    if (game === "echo-memory" && level > 3) {
      return NextResponse.json(
        { success: false, error: "Echo Memory levels 4-6 are not implemented yet" },
        { status: 403 }
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

    const isUnlocked =
      game === "echo-memory"
        ? isEchoMemoryLevelUnlocked(level, existingMap)
        : isLevelUnlocked(level, existingMap);

    if (!isUnlocked) {
      return NextResponse.json(
        { success: false, error: "Level is currently locked" },
        { status: 403 }
      );
    }

    // For Reflex Dash, if score is out of 100 or something, we may need to normalize it to 0..1 for calculateStars
    // But Reflex Dash provides the score directly right now as an integer. Let's assume the frontend sends normalized score for calculateStars.
    // Actually, in ReflexDashGame.tsx, it sends raw score?
    // Let's use the provided calculateStars, but if Reflex Dash needs custom star logic, we do it here.
    const awardedStars = game === "reflex-dash" 
        ? normalizeStars(Math.min(Math.max(Math.floor(score / 5), 0), 3)) // example custom logic for reflex dash (this is bad, better if client sends normalized score)
        : calculateStars(score);
    // WAIT! Let's just use `calculateStars` for both and expect the client to send a normalized score (0 to 1).
    // Oh, the payload validation says `score < 0`. If score is raw, calculateStars(raw) might give 3 if raw >= 0.8.
    // If raw is 10, calculateStars(10) > 0.8 -> returns 3!
    
    // So the client must send a normalized score for calculateStars to work properly, or we should use custom logic here.
    // Let's check what ReflexDashGame sends. It sends `score`, which is an integer. 
    // We should normalize it based on some max score. Wait, let's fix ReflexDashGame instead.
    const finalAwardedStars =
      game === "echo-memory"
        ? calculateEchoMemoryStars(Math.round(score * 100))
        : calculateStars(score);

    const currentLevelRec = existingMap[level];

    const newBestScore = mergeBestScore(currentLevelRec?.bestScore, score);
    const newBestStars = mergeBestStars(currentLevelRec?.stars, finalAwardedStars);

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
    const gameLevels =
      game === "reflex-dash"
        ? REFLEX_DASH_LEVELS
        : game === "echo-memory"
          ? ECHO_MEMORY_LEVELS
          : COLOUR_QUEST_LEVELS;
    
    for (const lvlMeta of gameLevels) {
      const lvl = lvlMeta.id;
      const existing = updatedDbMap[lvl];
      const unlocked =
        game === "echo-memory"
          ? isEchoMemoryLevelUnlocked(lvl, updatedDbMap)
          : isLevelUnlocked(lvl, updatedDbMap);

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
      level,
      score,
      awardedStars: finalAwardedStars,
      bestScore: newBestScore,
      bestStars: newBestStars,
      completedLevels,
      totalLevels,
      progressPercentage,
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
