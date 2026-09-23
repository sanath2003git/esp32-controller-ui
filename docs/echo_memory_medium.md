# Echo Memory — Medium Tier Specification (Levels 5–8)

**Mode:** Echo Memory · **Total levels in mode:** 10 (4 Easy, 4 Medium, 2 Hard)
**Scope of this document:** Medium tier only (Levels 5–8).

Structured to match the level-definition contract from the software brief.

---

## 1. Identity

| Field | Value |
|---|---|
| Mode | Echo Memory |
| Tier | Medium |
| Levels covered | 5–8 |
| Core mechanic | Sequence recall + joystick & physical action input (colors flash across the **entire strip**, user must map the color to the correct action/direction) |

---

## 2. Colour → Action/Direction mapping (fixed for the whole Medium tier)

Two new actions (Petting and Honking) are introduced. Since the colors now flash across all regions, the user must memorize the color sequence and perform the corresponding physical interactions or joystick moves.

| Action / Direction | Colour |
|---|---|
| Up | Red |
| Down | Green |
| Left | Blue |
| Right | Yellow |
| Petting (Touch Sensor) | Purple |
| Honking (Action Button/Joystick Press) | Orange |

---

## 3. LED strip region mapping

For the Medium tier, the flash phase **does not** use targeted regions. Instead, the assigned color flashes across **all 30 LEDs (the entire strip) simultaneously**. This removes the positional hint that was present in the Easy tier, forcing the user to rely entirely on memorizing the color-to-action mappings.

---

## 4. Game loop (applies to every level in this tier)

1. **Trigger** — level starts (selected via app or on-device menu).
2. **Sequence generation** — the system picks a random order of the 6 possible actions. The sequence length is 5 for the first two levels, and 6 for the next two.
3. **Flash phase** — the **entire strip** lights up solid in the generated color, one step at a time.
   - **Odd levels (5, 7):** 3.0 seconds between flashes.
   - **Even levels (6, 8):** 1.5 seconds between flashes.
4. **Wait phase** — 3.0 seconds, all LEDs off, no input accepted. Signals "get ready to answer."
5. **Input phase** — user reproduces the sequence via joystick direction moves, touch (petting), or button press (honking), one move/action per remembered step.
6. **Scoring** — progress starts at 100%. Each incorrect action/direction at a step deducts `100 ÷ sequence length`%. If the user makes a mistake, the game does **not** end on the spot; it continues accepting the remaining steps and the final result is taken.
7. **Result** — final progress % is the level's success score, converted to stars.

---

## 5. Level-by-level parameters

| Level | Flash interval | Sequence length | Wait time | Notes |
|---|---|---|---|---|
| 5 | 3.0s | 5 | 3.0s | Intro to full-strip flashes + new actions, slow pace |
| 6 | 1.5s | 5 | 3.0s | Same sequence length, faster pace |
| 7 | 3.0s | 6 | 3.0s | Increased sequence length, slow pace |
| 8 | 1.5s | 6 | 3.0s | Fast pace, longest medium sequence |

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
