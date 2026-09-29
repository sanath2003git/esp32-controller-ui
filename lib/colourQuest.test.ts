import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  calculateStars,
  isLevelUnlocked,
  mergeBestScore,
  mergeBestStars,
  calculateGameProgress,
  isValidColorQuestResult,
  normalizeGameSlug,
  createColorQuestRegionCommand,
  COLOUR_QUEST_LEVELS,
} from "./colourQuest.js";

describe("Colour Quest Domain Logic & Protocol", () => {
  describe("6-Level Matrix", () => {
    test("defines exact 6 levels with difficulties and timings", () => {
      assert.equal(COLOUR_QUEST_LEVELS.length, 6);
      assert.equal(COLOUR_QUEST_LEVELS[0].timing, "Normal");
      assert.equal(COLOUR_QUEST_LEVELS[1].timing, "Fast");
      assert.equal(COLOUR_QUEST_LEVELS[2].timing, "Normal");
      assert.equal(COLOUR_QUEST_LEVELS[3].timing, "Faster");
      assert.equal(COLOUR_QUEST_LEVELS[4].timing, "Fast");
      assert.equal(COLOUR_QUEST_LEVELS[5].timing, "Fastest");
    });
  });

  describe("normalizeGameSlug", () => {
    test("normalizes game slug variants to color-quest", () => {
      assert.equal(normalizeGameSlug("colour-quest"), "color-quest");
      assert.equal(normalizeGameSlug("color-quest"), "color-quest");
      assert.equal(normalizeGameSlug("COLOUR-QUEST"), "color-quest");
      assert.equal(normalizeGameSlug(""), "color-quest");
    });
  });

  describe("createColorQuestRegionCommand", () => {
    test("creates valid region input payload", () => {
      assert.deepEqual(createColorQuestRegionCommand("front"), {
        command: "input",
        region: "front",
      });
      assert.deepEqual(createColorQuestRegionCommand("back"), {
        command: "input",
        region: "back",
      });
    });
  });

  describe("calculateStars", () => {
    test("handles 80%/60%/40% thresholds correctly", () => {
      assert.equal(calculateStars(0), 0);
      assert.equal(calculateStars(0.39), 0);
      assert.equal(calculateStars(0.4), 1);
      assert.equal(calculateStars(0.59), 1);
      assert.equal(calculateStars(0.6), 2);
      assert.equal(calculateStars(0.79), 2);
      assert.equal(calculateStars(0.8), 3);
      assert.equal(calculateStars(1.0), 3);
    });
  });

  describe("isLevelUnlocked", () => {
    test("L1 is unlocked initially while L2-L6 are locked", () => {
      const emptyProgress = {};
      assert.equal(isLevelUnlocked(1, emptyProgress), true);
      assert.equal(isLevelUnlocked(2, emptyProgress), false);
      assert.equal(isLevelUnlocked(3, emptyProgress), false);
      assert.equal(isLevelUnlocked(4, emptyProgress), false);
      assert.equal(isLevelUnlocked(5, emptyProgress), false);
      assert.equal(isLevelUnlocked(6, emptyProgress), false);
    });

    test("sequential 3-star unlocking", () => {
      const progress = {
        1: { stars: 3 },
        2: { stars: 3 },
      };
      assert.equal(isLevelUnlocked(2, progress), true);
      assert.equal(isLevelUnlocked(3, progress), true);
      assert.equal(isLevelUnlocked(4, progress), false);
    });

    test("failure to unlock next level with 0, 1, or 2 stars", () => {
      assert.equal(isLevelUnlocked(2, { 1: { stars: 0 } }), false);
      assert.equal(isLevelUnlocked(2, { 1: { stars: 1 } }), false);
      assert.equal(isLevelUnlocked(2, { 1: { stars: 2 } }), false);
      assert.equal(isLevelUnlocked(2, { 1: { stars: 3 } }), true);
    });
  });

  describe("mergeBestScore and mergeBestStars", () => {
    test("preserves highest score", () => {
      assert.equal(mergeBestScore(undefined, 0.5), 0.5);
      assert.equal(mergeBestScore(0.75, 0.6), 0.75);
      assert.equal(mergeBestScore(0.75, 0.85), 0.85);
    });

    test("preserves highest stars", () => {
      assert.equal(mergeBestStars(undefined, 2), 2);
      assert.equal(mergeBestStars(3, 1), 3);
      assert.equal(mergeBestStars(2, 3), 3);
    });
  });

  describe("calculateGameProgress", () => {
    test("calculates completed levels ratio and percentage", () => {
      const progressMap = {
        1: { stars: 3 },
        2: { stars: 2 },
      };
      const result = calculateGameProgress(progressMap);
      assert.equal(result.completedLevels, 2);
      assert.equal(result.totalLevels, 6);
      assert.equal(result.progressPercentage, 33);
    });
  });

  describe("isValidColorQuestResult", () => {
    test("validates legitimate BLE response with score and optional level/correct metrics", () => {
      assert.equal(
        isValidColorQuestResult({
          type: "response",
          game: "color-quest",
          score: 0.7,
          level: 1,
          correct: 7,
          tasks: 10,
        }),
        true
      );
    });

    test("rejects invalid score, wrong game, or malformed structure", () => {
      assert.equal(isValidColorQuestResult(null), false);
      assert.equal(isValidColorQuestResult({ type: "response", game: "color-quest", score: -0.1 }), false);
      assert.equal(isValidColorQuestResult({ type: "response", game: "color-quest", score: 1.5 }), false);
      assert.equal(isValidColorQuestResult({ type: "response", game: "echo-memory", score: 0.8 }), false);
      assert.equal(isValidColorQuestResult({ type: "telemetry" }), false);
    });
  });
});
