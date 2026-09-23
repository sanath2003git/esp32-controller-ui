# Reflex Dash — Game Design & Specification

**Mode:** Reflex Dash · **Total levels in mode:** 10 (4 Easy, 4 Medium, 2 Hard)
**Core Mechanic:** Reaction-time "Red Light, Green Light" with the robot's mobility, scaling into cognitive color-mapping. 

The primary goal is for the user to react as quickly as possible to visual cues on the robot's LED strip.
*   **"GO" Signals:** The user must actively drive the robot (using the joystick).
*   **"STOP" Signals:** The user must immediately stop all movement. 

---

## 1. Identity

| Field | Value |
|---|---|
| Mode | Reflex Dash |
| Theme | Reaction Time / Cognitive Color Mapping |
| Input Method | Joystick (Driving) |
| Feedback | LED strip (Full strip flashes), OLED face, Buzzer |

---

## 2. Game Loop (General)

Each level consists of a set amount of time (e.g., 30-45 seconds) or a fixed number of "phases" where colors randomly flash on the strip.
1. **Trigger:** Level starts, OLED shows a countdown (and rule mappings for harder levels).
2. **Active Phase:** The strip flashes a **GO** color. The user must push the joystick to move. As long as a GO color is shown and the user is moving, they accumulate score.
3. **Stop Phase:** The strip flashes a **STOP** color. The user must let go of the joystick within a specific reaction window. 
4. **Scoring:** 
    *   Moving during a GO color = +Points (steady accumulation).
    *   Moving during a STOP color (failing to stop in time) = -Points / Penalty buzz.
    *   Stopping during a GO color (hesitation) = No points gained.
5. **Result:** After the time limit or phase count is reached, the final score dictates the stars earned.

---

## 3. Easy Tier (Levels 1–4)

**Focus:** Basic introduction to the mechanic. Slow, predictable pacing.
*   **Rules:** Standard mapping. **Green = GO**, **Red = STOP**.
*   **Timings:** 
    *   GO phases are long (3 to 5 seconds). 
    *   STOP phases are telegraphed or last long enough for the user to comfortably stop. 
    *   Reaction window to stop is forgiving (e.g., 800ms - 1000ms).
*   **Progression:** Levels 1 to 4 gradually decrease the reaction window slightly, and randomize the duration of the GO phases so the user can't just count the seconds.

---

## 4. Medium Tier (Levels 5–8)

**Focus:** Faster reactions and the introduction of a fixed multi-color rule set.
*   **Mechanic (Levels 5–6):** Still just **Green = GO** and **Red = STOP**, but with much faster transitions and tighter reaction windows (e.g., 500ms).
*   **Mechanic (Levels 7–8):** Introduction of the expanded color rules (the "Easy version" of multi-color mapping). The game uses 4 colors with a fixed mapping:
    *   **GO Colors:** Green and Blue
    *   **STOP Colors:** Red and Yellow
    *   The strip flashes these 4 colors randomly. The user must instantly remember whether the color shown belongs to the GO or STOP group.

---

## 5. Hard Tier (Levels 9–10)

**Focus:** Extreme reflexes and dynamic cognitive load.
*   **Mechanic:** **Dynamic Randomized Color Mapping**. 
    *   The rules are no longer fixed. At the start of the level, the OLED or app will display a new, randomized mapping of 6 colors (e.g., Red, Green, Blue, Yellow, Purple, Cyan).
    *   3 random colors will be assigned as **GO**.
    *   3 random colors will be assigned as **STOP**.
    *   The user must memorize this specific mapping before the level starts. 
*   **Level 9:** The dynamic mapping is introduced. The flashes are fast, requiring the user to process the color and recall the mapping under time pressure.
*   **Level 10:** The ultimate challenge. The dynamic mapping applies, and the flash phases are extremely short and chaotic. The reaction window to stop is punishingly small (e.g., 300ms).

---

## 6. Feedback Map

| Event | OLED | LEDs | Buzzer |
|---|---|---|---|
| "GO" Phase | Happy driving face | Solid GO Color (Full strip) | Gentle rolling hum/purr |
| "STOP" Phase | Alert/Stop face | Solid STOP Color (Full strip) | Sharp double-beep (Stop!) |
| Moving during GO | Animated motion lines | Pulsing GO Color | Positive chime on score tick |
| Moving during STOP | Angry/X face | Flashing STOP Color (Error) | Harsh buzzer / Penalty tone |
| Level Complete | Score % and Stars | Victory Rainbow | Win Jingle |

---

## 7. Star Thresholds (Suggested)

Scoring is based on a percentage of the maximum possible "safe driving time" achieved without hitting penalties.
- ★★★ — Score ≥ 90% (Near perfect reaction times & cognitive recall)
- ★★ — Score ≈ 70%
- ★ — Score ≈ 50%
- 0 Stars — Score < 50% (Too many STOP light violations)
