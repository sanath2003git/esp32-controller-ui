# Echo Memory — 6-Level Specification

**Mode:** Echo Memory  
**Total levels:** 6  
**Structure:** 3 Easy, 2 Medium, 1 Hard

---

## 1. Identity

| Field | Value |
|---|---|
| Mode | Echo Memory |
| Levels | 1–6 |
| Core mechanic | Sequence recall using LED color cues and joystick/physical action input |

The 6-level version compacts the original 10-level Echo Memory mode while preserving the intended progression:

**Directional memory → Expanded physical actions → Dynamic color mapping**

---

## 2. Colour → Direction Mapping — Easy Tier

The Easy tier uses a fixed color-to-direction mapping:

| Direction | Colour |
|---|---|
| Up | Red |
| Down | Green |
| Left | Blue |
| Right | Yellow |

The LED strip is divided into four directional regions. Each region lights in its assigned color during the flash phase.

---

## 3. Colour → Action Mapping — Medium Tier

The Medium tier introduces two physical actions:

| Action / Direction | Colour |
|---|---|
| Up | Red |
| Down | Green |
| Left | Blue |
| Right | Yellow |
| Petting (Touch Sensor) | Purple |
| Honking (Action Button/Joystick Press) | Orange |

For the Medium tier, the entire 30-LED strip flashes the assigned color. No directional LED-region hint is provided.

---

## 4. Dynamic Mapping — Hard Tier

The Hard level uses all six actions:

- Up
- Down
- Left
- Right
- Petting
- Honking

The color-to-action mapping is randomly generated at the beginning of the level and displayed to the user through the OLED or app screen.

The entire 30-LED strip flashes the generated color during the sequence.

---

## 5. Game Loop

The following game loop applies to all six levels:

1. **Trigger** — The level starts.
2. **Mapping Phase** — Required only when the level uses a color-to-action mapping that the player must study.
3. **Sequence Generation** — The system generates a random sequence.
4. **Flash Phase** — The LED strip displays one color at a time according to the generated sequence.
5. **Wait Phase** — 3.0 seconds. All LEDs are off and no input is accepted.
6. **Input Phase** — The player reproduces the sequence using the required joystick directions or physical actions.
7. **Scoring** — Progress starts at 100%. Each incorrect response deducts `100 ÷ sequence length`%.
8. **Result** — The final progress percentage is converted into stars.

If the player makes a mistake, the game does **not** end immediately. The player continues entering the remaining steps.

---

## 6. Level-by-Level Parameters

| Level | Tier | Flash Interval | Sequence Length | Wait Time | Main Change |
|---|---|---:|---:|---:|---|
| 1 | Easy | 3.0s | 4 | 3.0s | Introduction to directional memory |
| 2 | Easy | 1.5s | 5 | 3.0s | Faster recall |
| 3 | Easy | 1.5s | 6 | 3.0s | Longer sequence |
| 4 | Medium | 3.0s | 5 | 3.0s | Full-strip colors + Petting/Honking |
| 5 | Medium | 1.5s | 6 | 3.0s | Faster + longer sequence |
| 6 | Hard | 1.5s | 7 | 3.0s | Dynamic color mapping + all 6 actions |

---

## 7. Level Details

### Level 1 — Easy Introduction

- 4-step sequence
- 3.0-second flash interval
- Fixed four-color directional mapping
- Direction-specific LED regions
- Joystick direction input
- Purpose: introduce the basic Echo Memory mechanic

### Level 2 — Easy Speed

- 5-step sequence
- 1.5-second flash interval
- Same four-color directional mapping
- Direction-specific LED regions
- Joystick direction input
- Main difficulty increase: faster sequence

### Level 3 — Easy Challenge

- 6-step sequence
- 1.5-second flash interval
- Same four-color directional mapping
- Direction-specific LED regions
- Joystick direction input
- Main difficulty increase: longer sequence

### Level 4 — Medium Introduction

- 5-step sequence
- 3.0-second flash interval
- Six possible actions
- Fixed color-to-action mapping
- Entire 30-LED strip flashes
- Supports joystick directions, Petting, and Honking
- Main difficulty increase: removal of positional LED hints and introduction of physical actions

### Level 5 — Medium Challenge

- 6-step sequence
- 1.5-second flash interval
- Same six fixed color-to-action mappings
- Entire 30-LED strip flashes
- Supports joystick directions, Petting, and Honking
- Main difficulty increase: faster sequence and longer memory requirement

### Level 6 — Hard / Final

- 7-step sequence
- 1.5-second flash interval
- Six possible actions
- Random color-to-action mapping generated at the beginning of the level
- Mapping displayed before the sequence
- Entire 30-LED strip flashes
- Supports joystick directions, Petting, and Honking
- Main difficulty increase: the player must memorize a new mapping before recalling the sequence

---

## 8. Feedback Map

| Event | OLED | LEDs | Buzzer | Remote Haptic |
|---|---|---|---|---|
| Correct step | — | Brief green flash on matched region / entire strip depending on tier | Short high chime | Short pulse |
| Incorrect step | — | Brief red flash on matched region / entire strip depending on tier | Short low/descending tone | Longer pulse |
| Level result | Shows % and stars earned | Victory animation if ≥50%, dim pulse if lower | Short win jingle / neutral tone | — |

---

## 9. Star Thresholds

The star calculation uses the final progress percentage for the level.

- ★★★ — progress ≥ 90%
- ★★ — progress ≈ 70%
- ★ — progress ≈ 50%
- 0 Stars — progress < 50%

There is no progress floor. Every attempt receives the corresponding number of stars based on its final score.

---

## 10. Difficulty Progression

| Stage | Levels | Difficulty Focus |
|---|---|---|
| Directional Memory | 1–3 | Learn fixed color-to-direction mapping and increasingly longer/faster sequences |
| Expanded Actions | 4–5 | Memorize six actions, use full-strip flashes, and perform physical actions |
| Dynamic Memory | 6 | Learn a randomly generated mapping and recall a longer sequence at high speed |

### Overall Progression

**Level 1**  
Learn directions → 4 steps → slow

↓

**Level 2**  
Directions → 5 steps → fast

↓

**Level 3**  
Directions → 6 steps → fast

↓

**Level 4**  
6 actions → 5 steps → slow → full strip

↓

**Level 5**  
6 actions → 6 steps → fast → full strip

↓

**Level 6**  
6 actions → 7 steps → fast → random mapping
