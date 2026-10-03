# Reflex Dash — Game Design & Specification

**Mode:** Reflex Dash · **Total levels in mode:** 10 (4 Easy, 4 Medium, 2 Hard)
**Core Mechanic:** Reaction-time "Red Light, Green Light" with the robot's mobility, scaling into cognitive color-mapping.

The primary goal is for the user to react as quickly as possible to visual cues on the robot's LED strip.

- **"GO" Signals:** The user must actively drive the robot (using the joystick).
- **"STOP" Signals:** The user must immediately stop all movement.

---

## 1. Identity

| Field        | Value                                           |
| ------------ | ----------------------------------------------- |
| Mode         | Reflex Dash                                     |
| Theme        | Reaction Time / Cognitive Color Mapping         |
| Input Method | Joystick (Driving)                              |
| Feedback     | LED strip (Full strip shows), OLED face, Buzzer |

---

## 2. Game Loop (General)

Each level consists of a set amount of time (e.g., 30-45 seconds) or a fixed number of "phases" where colors randomly show on the strip.

1. **Trigger:** Level starts, OLED shows a countdown (and rule mappings for harder levels).
2. **Active Phase:** The strip shows a **GO** color. The user must push the joystick to move. As long as a GO color is shown and the user is moving, they accumulate score.
3. **Stop Phase:** The strip shows a **STOP** color. The user must let go of the joystick within a specific reaction window.
4. **Scoring:**
   - Moving during a GO color = +Points (steady accumulation).
   - Moving during a STOP color (failing to stop in time) = -Points / Penalty buzz.
   - Stopping during a GO color (hesitation) = No points gained.
5. **Result:** After the time limit or phase count is reached, the final score dictates the stars earned.

---

## 3. Easy Tier (Levels 1–4)

**Focus:** Basic introduction to the mechanic. Slow, predictable pacing.

- **Rules:** Standard mapping. **Green = GO**, **Red = STOP**.
- **Timings:**
  - GO phases are long (3 to 5 seconds).
  - STOP phases are telegraphed or last long enough for the user to comfortably stop.
  - Reaction window to stop is forgiving (e.g., 800ms - 1000ms).
- **Progression:** Levels 1 to 4 gradually decrease the reaction window slightly, and randomize the duration of the GO phases so the user can't just count the seconds.

---

## 4. Medium Tier (Levels 5–8)

**Focus:** Faster reactions and the introduction of a fixed multi-color rule set.

- **Mechanic (Levels 5–6):** Still just **Green = GO** and **Red = STOP**, but with much faster transitions and tighter reaction windows (e.g., 500ms).
- **Mechanic (Levels 7–8):** Introduction of the expanded color rules (the "Easy version" of multi-color mapping). The game uses 4 colors with a fixed mapping:
  - **GO Colors:** Green and Blue
  - **STOP Colors:** Red and Yellow
  - The strip shows these 4 colors randomly. The user must instantly remember whether the color shown belongs to the GO or STOP group.

---

## 5. Hard Tier (Levels 9–10)

**Focus:** Extreme reflexes and dynamic cognitive load.

- **Mechanic:** **Dynamic Randomized Color Mapping**.
  - The rules are no longer fixed. At the start of the level, the OLED or app will display a new, randomized mapping of 6 colors (e.g., Red, Green, Blue, Yellow, Purple, Cyan).
  - 3 random colors will be assigned as **GO**.
  - 3 random colors will be assigned as **STOP**.
  - The user must memorize this specific mapping before the level starts.
- **Level 9:** The dynamic mapping is introduced. The shows are fast, requiring the user to process the color and recall the mapping under time pressure.
- **Level 10:** The ultimate challenge. The dynamic mapping applies, and the flash phases are extremely short and chaotic. The reaction window to stop is punishingly small (e.g., 300ms).

---

## 6. Feedback Map

| Event              | OLED                  | LEDs                          | Buzzer                       |
| ------------------ | --------------------- | ----------------------------- | ---------------------------- |
| "GO" Phase         | Happy driving face    | Solid GO Color (Full strip)   | Gentle rolling hum/purr      |
| "STOP" Phase       | Alert/Stop face       | Solid STOP Color (Full strip) | Sharp double-beep (Stop!)    |
| Moving during GO   | Animated motion lines | Pulsing GO Color              | Positive chime on score tick |
| Moving during STOP | Angry/X face          | Flashing STOP Color (Error)   | Harsh buzzer / Penalty tone  |
| Level Complete     | Score % and Stars     | Victory Rainbow               | Win Jingle                   |

---

## 7. Star Thresholds

Scoring is based on a percentage of the maximum possible "safe driving time" achieved without hitting penalties.

- ★★★ — Score ≥ 90% (Near perfect reaction times & cognitive recall)
- ★★ — Score ≥ 70%
- ★ — Score ≥ 50%
- 0 Stars — Score < 50% (Too many STOP light violations)

---

## 8. Level Summary Table

| Level | Tier   | Phase Count | Reaction Window | Color Mapping Mode | Colors Used                            | Mapping Rule                     |
| ----: | :----- | ----------: | --------------: | :----------------- | :------------------------------------- | :------------------------------- |
|     1 | Easy   |    6 phases |         1000 ms | Fixed 2-Color      | Green, Red                             | Green = GO, Red = STOP           |
|     2 | Easy   |    8 phases |          900 ms | Fixed 2-Color      | Green, Red                             | Green = GO, Red = STOP           |
|     3 | Easy   |    8 phases |          800 ms | Fixed 2-Color      | Green, Red                             | Green = GO, Red = STOP           |
|     4 | Easy   |   10 phases |          700 ms | Fixed 2-Color      | Green, Red                             | Green = GO, Red = STOP           |
|     5 | Medium |   10 phases |          500 ms | Fixed 2-Color      | Green, Red                             | Green = GO, Red = STOP           |
|     6 | Medium |   10 phases |          450 ms | Fixed 2-Color      | Green, Red                             | Green = GO, Red = STOP           |
|     7 | Medium |   10 phases |          500 ms | Fixed 4-Color      | Green, Blue, Red, Yellow               | GO: Green/Blue, STOP: Red/Yellow |
|     8 | Medium |   12 phases |          400 ms | Fixed 4-Color      | Green, Blue, Red, Yellow               | GO: Green/Blue, STOP: Red/Yellow |
|     9 | Hard   |   12 phases |          350 ms | Dynamic 6-Color    | Red, Green, Blue, Yellow, Purple, Cyan | 3 GO / 3 STOP (Randomized)       |
|    10 | Hard   |   14 phases |          300 ms | Dynamic 6-Color    | Red, Green, Blue, Yellow, Purple, Cyan | 3 GO / 3 STOP (Randomized)       |

---

## 9. JSON Contract (Mobile BLE Interface)

### 9.1 Game Start

Mobile → ESP32:

```json
{
  "v": 1,
  "type": "command",
  "command": "game_start",
  "id": "game-001",
  "payload": {
    "gameId": "reflex_dash",
    "level": 1
  }
}
```

ESP32 Response (Levels 1–6 - Fixed 2-Color Mapping):

```json
{
  "v": 1,
  "type": "response",
  "response": "game_started",
  "id": "game-001",
  "payload": {
    "gameId": "reflex_dash",
    "level": 1,
    "status": "started",
    "mapping": {
      "go": ["green"],
      "stop": ["red"]
    }
  }
}
```

ESP32 Response (Levels 7–8 - Fixed 4-Color Mapping):

```json
{
  "v": 1,
  "type": "response",
  "response": "game_started",
  "id": "game-001",
  "payload": {
    "gameId": "reflex_dash",
    "level": 7,
    "status": "started",
    "mapping": {
      "go": ["green", "blue"],
      "stop": ["red", "yellow"]
    }
  }
}
```

ESP32 Response (Levels 9–10 - Dynamic 6-Color Mapping):

```json
{
  "v": 1,
  "type": "response",
  "response": "game_started",
  "id": "game-001",
  "payload": {
    "gameId": "reflex_dash",
    "level": 9,
    "status": "started",
    "mapping": {
      "go": ["green", "purple", "cyan"],
      "stop": ["red", "yellow", "blue"]
    }
  }
}
```

---

### 9.2 Start Sequence (`run_seq`)

For Hard levels (Levels 9–10), the color-action mapping is displayed on the mobile UI for the player to memorize. On clicking the "GO" button on the mobile UI, the `run_seq` command is sent to start sequence execution:

Mobile → ESP32:

```json
{
  "v": 1,
  "type": "command",
  "command": "run_seq",
  "id": "seq-001",
  "payload": {
    "gameId": "reflex_dash",
    "level": 9
  }
}
```

---

### 9.3 Game Events & Signal Phase Broadcast

When the robot transitions between GO and STOP signal states, the ESP32 broadcasts a `signal_change` event to sync the visual state with the mobile UI:

ESP32 → Mobile (Signal GO Cue):

```json
{
  "v": 1,
  "type": "game_event",
  "event": "signal_change",
  "gameId": "reflex_dash",
  "level": 1,
  "phaseIndex": 1,
  "signal": "GO",
  "color": "green",
  "durationMs": 4000
}
```

ESP32 → Mobile (Signal STOP Cue):

```json
{
  "v": 1,
  "type": "game_event",
  "event": "signal_change",
  "gameId": "reflex_dash",
  "level": 1,
  "phaseIndex": 2,
  "signal": "STOP",
  "color": "red",
  "durationMs": 2500
}
```

---

### 9.4 Game Input

The player controls robot movement using standard normalized mobile joystick commands:

Mobile → ESP32 (Driving / Movement Input):

```json
{
  "v": 1,
  "type": "input",
  "id": "input-1001",
  "ts": 123456789,
  "payload": {
    "inputType": "joystick",
    "dir": "up",
    "magnitude": 0.96
  }
}
```

Mobile → ESP32 (Joystick Release / Stop Movement):

```json
{
  "v": 1,
  "type": "input",
  "id": "input-1002",
  "ts": 123456899,
  "payload": {
    "inputType": "joystick",
    "dir": "none",
    "magnitude": 0.0
  }
}
```

---

### 9.5 Game Task Feedback

Robot → Mobile after evaluating player response against the current signal phase:

```json
{
  "v": 1,
  "type": "response",
  "response": "game_feedback",
  "gameId": "reflex_dash",
  "level": 1,
  "taskId": 1,
  "correct": true,
  "correctCount": 1
}
```

Violation feedback (when player continues driving during a STOP cue):

```json
{
  "v": 1,
  "type": "response",
  "response": "game_feedback",
  "gameId": "reflex_dash",
  "level": 1,
  "taskId": 2,
  "correct": false,
  "correctCount": 1
}
```

---

### 9.6 Game Result

Robot → Mobile after level completion:

```json
{
  "v": 1,
  "type": "response",
  "response": "game_result",
  "gameId": "reflex_dash",
  "level": 1,
  "score": 10,
  "stars": 3,
  "tasksCompleted": 10,
  "tasksTotal": 10
}
```

---

### 9.7 Game Abort

Mobile → ESP32:

```json
{
  "v": 1,
  "type": "command",
  "command": "game_abort",
  "id": "abort-001",
  "payload": {}
}
```

ESP32 → Mobile Response:

```json
{
  "v": 1,
  "type": "response",
  "response": "game_aborted",
  "id": "abort-001",
  "payload": {
    "status": "aborted"
  }
}
```

---

## 10. ESP-NOW Compatibility

When playing **Reflex Dash** using the physical ESP-NOW remote:

- **Joystick Driving**: Pushing the physical joystick in any direction (`up`, `down`, `left`, `right`) generates driving movement (GO action). Releasing the joystick into deadzone stops movement (STOP action).
- **OLED Display**: Renders current cue (`GO` vs `STOP`), remaining reaction window timer, and current score.
- **Hard Tier (Levels 9–10)**: Displays dynamic color-to-action rules on the OLED screen for 5 seconds during the initial mapping phase. Pressing joystick centre button (`sw`) skips the study phase and starts the level immediately.
- **Double Press `btn2`**: Double-pressing `btn2` (<400ms) instantly aborts gameplay and exits to the `MAIN_MENU`.
