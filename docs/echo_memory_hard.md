# Echo Memory — Hard Tier Specification (Levels 9–10)

**Mode:** Echo Memory · **Total levels in mode:** 10 (4 Easy, 4 Medium, 2 Hard)
**Scope of this document:** Hard tier only (Levels 9–10).

Structured to match the level-definition contract from the software brief.

---

## 1. Identity

| Field | Value |
|---|---|
| Mode | Echo Memory |
| Tier | Hard |
| Levels covered | 9–10 |
| Core mechanic | Sequence recall + joystick & physical action input (dynamic color mappings per level, colors flash across the **entire strip**) |

---

## 2. Colour → Action/Direction mapping (Dynamic per level)

Unlike the Easy and Medium tiers, the Colour-to-Action mapping in the Hard tier is **not fixed**. A new mapping is randomly generated at the start of each level and displayed to the user via the OLED or app screen. 

The mapping will assign 6 distinct colors to the following 6 actions:

| Action / Direction | Colour |
|---|---|
| Up | Randomly assigned |
| Down | Randomly assigned |
| Left | Randomly assigned |
| Right | Randomly assigned |
| Petting (Touch Sensor) | Randomly assigned |
| Honking (Action Button/Joystick Press) | Randomly assigned |

*Note: The user must study and memorize this new mapping before the sequence begins.*

---

## 3. LED strip region mapping

Similar to the Medium tier, the flash phase **does not** use targeted regions. The assigned color flashes across **all 30 LEDs (the entire strip) simultaneously**.

---

## 4. Game loop (applies to every level in this tier)

1. **Mapping Phase** — level starts, and a randomized color-to-action map is generated and presented to the user.
2. **Sequence generation** — the system picks a random order of the 6 possible actions. The sequence length is 6 for level 9, and 7 for level 10.
3. **Flash phase** — the **entire strip** lights up solid in the generated color, one step at a time.
   - **Level 9:** 3.0 seconds between flashes.
   - **Level 10:** 1.5 seconds between flashes.
4. **Wait phase** — 3.0 seconds, all LEDs off, no input accepted. Signals "get ready to answer."
5. **Input phase** — user reproduces the sequence via joystick direction moves, touch (petting), or button press (honking), one move/action per remembered step.
6. **Scoring** — progress starts at 100%. Each incorrect action/direction at a step deducts `100 ÷ sequence length`%. If the user makes a mistake, the game does **not** end on the spot; it continues accepting the remaining steps and the final result is taken.
7. **Result** — final progress % is the level's success score, converted to stars.

---

## 5. Level-by-level parameters

| Level | Flash interval | Sequence length | Wait time | Notes |
|---|---|---|---|---|
| 9 | 3.0s | 6 | 3.0s | Intro to dynamic mappings, slow pace |
| 10 | 1.5s | 7 | 3.0s | The ultimate challenge: fast pace, dynamic map, longest sequence |

---

## 6. Feedback map

| Event | OLED | LEDs | Buzzer | Remote haptic |
|---|---|---|---|---|
| Correct step | — | Brief green flash on entire strip | Short high chime | Short pulse |
| Incorrect step | — | Brief red flash on entire strip | Short low/descending tone | Longer pulse |
| Level result | Shows % and stars earned | Victory animation (all regions) if ≥50%, dim pulse if lower | Short win jingle / neutral tone | — |

---

## 7. Star thresholds

Applied to this level's single progress score instead of a 10-task average. There is **no progress floor** (any attempt counts as "passed" with correspondingly fewer stars):

- ★★★ — progress ≥ 90%
- ★★ — progress ≈ 70%
- ★ — progress ≈ 50%
- 0 Stars — progress < 50%
