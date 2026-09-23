# Echo Memory — Easy Tier Specification (Levels 1–4)

**Mode:** Echo Memory · **Total levels in mode:** 10 (4 Easy, 4 Medium, 2 Hard)
**Scope of this document:** Easy tier only (Levels 1–4). Medium (5–8) and Hard (9–10) tiers are placeholders for a follow-up pass once Easy is confirmed and tested.

Structured to match the level-definition contract from the software brief (Identity → Tasks → Star thresholds → Feedback map) so it slots into the same schema the robot and app will share for every mode.

---

## 1. Identity

| Field | Value |
|---|---|
| Mode | Echo Memory |
| Tier | Easy |
| Levels covered | 1–4 |
| Core mechanic | Sequence recall + directional joystick input (watch the lights, then repeat the pattern) |

> Note: this redefines Echo Memory away from the brief's original "single-colour alert/safe-point" reaction-time framing, toward a sequence-memory mechanic. The structure of 10 levels × 1 sequence-task each is an intentional mode-specific format for Echo Memory.

---

## 2. Colour → Direction mapping (fixed for the whole Easy tier)

| Direction | Colour |
|---|---|
| Up | Red |
| Down | Green |
| Left | Blue |
| Right | Yellow |

---

## 3. LED strip region mapping

The external strip has 30 LEDs. For this game it's split into 4 contiguous regions, one per direction, each region lighting solid in its assigned colour during the flash phase.

*Note: The exact LED index ranges per region are predefined in the robot firmware.*

---

## 4. Game loop (applies to every level in this tier)

1. **Trigger** — level starts (selected via app or on-device menu).
2. **Sequence generation** — the system picks a random order of the 4 directions. The sequence length scales per level (5 to 8).
3. **Flash phase** — each region lights in its colour, one direction at a time, in the generated order.
   - **Odd levels (1, 3):** 3.0 seconds between flashes.
   - **Even levels (2, 4):** 1.5 seconds between flashes.
4. **Wait phase** — 3.0 seconds, all LEDs off, no input accepted. Signals "get ready to answer."
5. **Input phase** — user reproduces the sequence via joystick direction moves, one move per remembered step.
6. **Scoring** — progress starts at 100%. Each incorrect direction at a step deducts `100 ÷ sequence length`% (e.g., 20% per mistake for a sequence length of 5). If the user makes a mistake, the game does **not** end on the spot; it continues accepting the remaining steps and the final result is taken.
7. **Result** — final progress % is the level's success score, converted to stars.

---

## 5. Level-by-level parameters

| Level | Flash interval | Sequence length | Wait time | Notes |
|---|---|---|---|---|
| 1 | 3.0s | 5 | 3.0s | First exposure, slow pace |
| 2 | 1.5s | 6 | 3.0s | Faster pace, slightly longer sequence |
| 3 | 3.0s | 7 | 3.0s | Slow pace, longer sequence |
| 4 | 1.5s | 8 | 3.0s | Fast pace, longest easy sequence |

---

## 6. Feedback map

| Event | OLED | LEDs | Buzzer | Remote haptic |
|---|---|---|---|---|
| Correct step | — | Brief green flash on matched region | Short high chime | Short pulse |
| Incorrect step | — | Brief red flash on matched region | Short low/descending tone | Longer pulse |
| Level result | Shows % and stars earned | Victory animation (all regions) if ≥50%, dim pulse if lower | Short win jingle / neutral tone | — |

---

## 7. Star thresholds

Applied to this level's single progress score instead of a 10-task average. There is **no progress floor** (any attempt counts as "passed" with correspondingly fewer stars):

- ★★★ — progress ≥ 90%
- ★★ — progress ≈ 70%
- ★ — progress ≈ 50%
- 0 Stars — progress < 50%
