import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  calculateEchoMemoryStars,
  createEchoMemoryAbortCommand,
  createEchoMemoryInputCommand,
  createEchoMemoryStartCommand,
  getEchoMemoryLevel,
  isEchoMemoryLevelUnlocked,
  isValidEchoMemoryResult,
  ECHO_MEMORY_LEVELS,
  ECHO_MEMORY_MAPPING,
} from "./echoMemory.js";

describe("Echo Memory Domain Logic & Progression", () => {
  describe("6-Level Matrix", () => {
    test("defines exactly 6 levels with L1-L6 fully implemented", () => {
      assert.equal(ECHO_MEMORY_LEVELS.length, 6);

      // L1: 4 steps, 3.0s flash, 3.0s wait, Easy
      assert.equal(ECHO_MEMORY_LEVELS[0].id, 1);
      assert.equal(ECHO_MEMORY_LEVELS[0].difficulty, "Easy");
      assert.equal(ECHO_MEMORY_LEVELS[0].sequenceLength, 4);
      assert.equal(ECHO_MEMORY_LEVELS[0].flashDuration, "3.0s");
      assert.equal(ECHO_MEMORY_LEVELS[0].waitDuration, "3.0s");
      assert.equal(ECHO_MEMORY_LEVELS[0].isImplemented, true);

      // L2: 5 steps, 1.5s flash, 3.0s wait, Easy
      assert.equal(ECHO_MEMORY_LEVELS[1].id, 2);
      assert.equal(ECHO_MEMORY_LEVELS[1].difficulty, "Easy");
      assert.equal(ECHO_MEMORY_LEVELS[1].sequenceLength, 5);
      assert.equal(ECHO_MEMORY_LEVELS[1].flashDuration, "1.5s");
      assert.equal(ECHO_MEMORY_LEVELS[1].waitDuration, "3.0s");
      assert.equal(ECHO_MEMORY_LEVELS[1].isImplemented, true);

      // L3: 6 steps, 1.5s flash, 3.0s wait, Easy
      assert.equal(ECHO_MEMORY_LEVELS[2].id, 3);
      assert.equal(ECHO_MEMORY_LEVELS[2].difficulty, "Easy");
      assert.equal(ECHO_MEMORY_LEVELS[2].sequenceLength, 6);
      assert.equal(ECHO_MEMORY_LEVELS[2].flashDuration, "1.5s");
      assert.equal(ECHO_MEMORY_LEVELS[2].waitDuration, "3.0s");
      assert.equal(ECHO_MEMORY_LEVELS[2].isImplemented, true);

      // L4: 5 steps, 3.0s flash, 3.0s wait, Medium, implemented
      assert.equal(ECHO_MEMORY_LEVELS[3].id, 4);
      assert.equal(ECHO_MEMORY_LEVELS[3].difficulty, "Medium");
      assert.equal(ECHO_MEMORY_LEVELS[3].sequenceLength, 5);
      assert.equal(ECHO_MEMORY_LEVELS[3].flashDuration, "3.0s");
      assert.equal(ECHO_MEMORY_LEVELS[3].waitDuration, "3.0s");
      assert.equal(ECHO_MEMORY_LEVELS[3].isImplemented, true);

      // L5: 6 steps, 1.5s flash, 3.0s wait, Medium, implemented
      assert.equal(ECHO_MEMORY_LEVELS[4].id, 5);
      assert.equal(ECHO_MEMORY_LEVELS[4].difficulty, "Medium");
      assert.equal(ECHO_MEMORY_LEVELS[4].sequenceLength, 6);
      assert.equal(ECHO_MEMORY_LEVELS[4].flashDuration, "1.5s");
      assert.equal(ECHO_MEMORY_LEVELS[4].waitDuration, "3.0s");
      assert.equal(ECHO_MEMORY_LEVELS[4].isImplemented, true);

      // L6: 7 steps, 1.5s flash, 3.0s wait, Hard, IMPLEMENTED
      assert.equal(ECHO_MEMORY_LEVELS[5].id, 6);
      assert.equal(ECHO_MEMORY_LEVELS[5].difficulty, "Hard");
      assert.equal(ECHO_MEMORY_LEVELS[5].sequenceLength, 7);
      assert.equal(ECHO_MEMORY_LEVELS[5].isImplemented, true);
    });
  });

  describe("Six Echo Memory Actions & Fixed Colors", () => {
    test("maps actions to the specified colors", () => {
      assert.equal(ECHO_MEMORY_MAPPING.up.color, "Red");
      assert.equal(ECHO_MEMORY_MAPPING.down.color, "Green");
      assert.equal(ECHO_MEMORY_MAPPING.left.color, "Blue");
      assert.equal(ECHO_MEMORY_MAPPING.right.color, "Yellow");
      assert.equal(ECHO_MEMORY_MAPPING.pet.color, "Purple");
      assert.equal(ECHO_MEMORY_MAPPING.honk.color, "White");
    });
  });

  describe("Unlocking Progression (L1 -> L6)", () => {
    test("L1 is unlocked by default; L2-L6 are initially locked", () => {
      const emptyProgress = {};
      assert.equal(isEchoMemoryLevelUnlocked(1, emptyProgress), true);
      assert.equal(isEchoMemoryLevelUnlocked(2, emptyProgress), false);
      assert.equal(isEchoMemoryLevelUnlocked(3, emptyProgress), false);
      assert.equal(isEchoMemoryLevelUnlocked(4, emptyProgress), false);
      assert.equal(isEchoMemoryLevelUnlocked(5, emptyProgress), false);
      assert.equal(isEchoMemoryLevelUnlocked(6, emptyProgress), false);
      assert.equal(isEchoMemoryLevelUnlocked(7, emptyProgress), false);
    });

    test("sequential unlocking requires 3 stars on previous level", () => {
      const progress: Record<number, { stars: number }> = {};

      // Need 3 stars on L1 to unlock L2
      progress[1] = { stars: 2 };
      assert.equal(isEchoMemoryLevelUnlocked(2, progress), false);
      progress[1] = { stars: 3 };
      assert.equal(isEchoMemoryLevelUnlocked(2, progress), true);

      // Need 3 stars on L2 to unlock L3
      progress[2] = { stars: 2 };
      assert.equal(isEchoMemoryLevelUnlocked(3, progress), false);
      progress[2] = { stars: 3 };
      assert.equal(isEchoMemoryLevelUnlocked(3, progress), true);

      // Need 3 stars on L3 to unlock L4
      progress[3] = { stars: 2 };
      assert.equal(isEchoMemoryLevelUnlocked(4, progress), false);
      progress[3] = { stars: 3 };
      assert.equal(isEchoMemoryLevelUnlocked(4, progress), true);

      // Need 3 stars on L4 to unlock L5
      progress[4] = { stars: 2 };
      assert.equal(isEchoMemoryLevelUnlocked(5, progress), false);
      progress[4] = { stars: 3 };
      assert.equal(isEchoMemoryLevelUnlocked(5, progress), true);

      // Need 3 stars on L5 to unlock L6
      progress[5] = { stars: 2 };
      assert.equal(isEchoMemoryLevelUnlocked(6, progress), false);
      progress[5] = { stars: 3 };
      assert.equal(isEchoMemoryLevelUnlocked(6, progress), true);

      // Levels beyond 6 remain locked
      progress[6] = { stars: 3 };
      assert.equal(isEchoMemoryLevelUnlocked(7, progress), false);
    });
  });

  describe("Star Calculation Thresholds", () => {
    test("calculates 3 stars for >= 90%", () => {
      assert.equal(calculateEchoMemoryStars(100), 3);
      assert.equal(calculateEchoMemoryStars(90), 3);
    });

    test("calculates 2 stars for >= 70% and < 90%", () => {
      assert.equal(calculateEchoMemoryStars(89), 2);
      assert.equal(calculateEchoMemoryStars(75), 2);
      assert.equal(calculateEchoMemoryStars(70), 2);
    });

    test("calculates 1 star for >= 50% and < 70%", () => {
      assert.equal(calculateEchoMemoryStars(69), 1);
      assert.equal(calculateEchoMemoryStars(55), 1);
      assert.equal(calculateEchoMemoryStars(50), 1);
    });

    test("calculates 0 stars for < 50%", () => {
      assert.equal(calculateEchoMemoryStars(49), 0);
      assert.equal(calculateEchoMemoryStars(25), 0);
      assert.equal(calculateEchoMemoryStars(0), 0);
    });
  });

  describe("Command Generators & Result Validation", () => {
    test("creates start command", () => {
      assert.deepEqual(createEchoMemoryStartCommand(4), {
        command: "challenge",
        game: "echo-memory",
        level: 4,
      });
    });

    test("creates input command supporting directions and honk", () => {
      assert.deepEqual(createEchoMemoryInputCommand("up"), {
        command: "input",
        game: "echo-memory",
        action: "up",
        dir: "up",
      });
      assert.deepEqual(createEchoMemoryInputCommand("honk"), {
        command: "input",
        game: "echo-memory",
        action: "honk",
        dir: "honk",
      });
    });

    test("creates abort command", () => {
      assert.deepEqual(createEchoMemoryAbortCommand(), {
        command: "abort",
      });
    });

    test("validates result payload correctly", () => {
      const valid = {
        type: "response",
        game: "echo-memory",
        level: 4,
        score: 1.0,
        scorePercent: 100,
        stars: 3,
        correct: 5,
        total: 5,
      };
      assert.equal(isValidEchoMemoryResult(valid), true);

      const invalidGame = { ...valid, game: "reflex-dash" };
      assert.equal(isValidEchoMemoryResult(invalidGame), false);

      const missingScore = { ...valid, score: undefined };
      assert.equal(isValidEchoMemoryResult(missingScore), false);
    });
  });
});
