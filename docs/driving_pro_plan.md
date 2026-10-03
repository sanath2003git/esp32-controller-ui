# Driving Pro — Game Design & Specification

**Mode:** Driving Pro · **Total levels in mode:** 3  
**Current implementation:** Level 1 (Easy)  
**Core Mechanic:** Continuous forward driving with left/right steering and collision avoidance.

The robot is authoritative for task timing, movement behavior, collision detection, turn counting, scoring, and final result.

In this game there is only three levels ## Level-1 : Easy In level 1, there is three tasks. Complete each task will give one star. Task 1: Ride the toy without hitting anywhere for the next 7 seconds. On clicking start level, the task will be displayed on UI and on clicking GO, the actual mission starts, timer starts and the toy starts moving front. It cannot be stopped by the user until the game is over. The user can only turn the toy left or right. The directions up, down, none will not work, just left or right. If the toy hits anywhere, instantly the game is over and game over message is shown and game exits. User can only do the second task after completing the first task. When the first task is successfully completed, a success message is shown. Then the next task is shown with the GO button. On selecting the GO button, the second mission starts, timer starts, the toy again moves forward automatically, only left and right turns possible. But now the second task is to ride the toy for 7 seconds without hitting anywhere and take atleast 4 turns too. Then as like the first task if toy hits, game over, else on completion, success message shows, next task instructions appear, on pressing GO the third task starts execution. The third task is to ride the toy for 9 secs, don't hit anywhere, take atleast 2 left turn and 3 right turns. On completion of all these three tasks the level is completed, result score is is shown in the score card. When game is over in between, a game over modal appears with current progress score of that level. 

Level 1 Task 1: - automatic forward movement - 9 second task - up/down input ignored - left/right used for turning - releasing turn returns to forward - collision ends/fails task 
Level 1 Task 2: - same basic behavior - minimum required turns 
Level 1 Task 3: - required left/right turn counts 

---

## 1. Identity

| Field | Value |
|---|---|
| Mode | Driving Pro |
| Level | 1 — Easy |
| Input Method | Joystick |
| Feedback | Mobile UI, OLED, LEDs/Buzzer where applicable |
| Telemetry | Required during gameplay |
| Tasks | 3 sequential tasks |

---

## 2. Level 1 — Easy

### Task Summary

| Task | Duration | Requirement |
|---|---:|---|
| 1 | 7 sec | No collision |
| 2 | 7 sec | At least 4 turns |
| 3 | 9 sec | At least 2 left turns and 3 right turns |

Each successfully completed task awards **1 star**.

---

## 3. Game Flow

1. Mobile selects `driving_pro`.
2. Mobile selects Level `1`.
3. Robot enters the task instruction state.
4. Mobile displays the current task instructions and `GO`.
5. When `GO` is pressed, the robot starts the task.
6. Robot automatically moves forward.
7. During the task:
   - `left` turns left.
   - `right` turns right.
   - Releasing the joystick returns to forward movement.
   - `up` and `down` do not control movement.
8. Telemetry is always sent to the mobile UI.
9. A collision immediately fails the current task and ends the game.
10. If the task duration completes without collision, the task requirement is evaluated.
11. On success, the next task instructions and `GO` are shown.
12. After Task 3 succeeds, Level 1 is completed and the final result is sent.

---

## 4. Task Rules

### Task 1

Ride continuously for **7 seconds without collision**.

Success:

```text
time >= 7 seconds
AND
no collision
```

Failure:

```text
collision detected
```

### Task 2

Ride continuously for **7 seconds** and perform at least **4 turns**.

A turn is counted when the steering direction changes into a left or right turn. Holding the same direction continuously counts as one turn.

Success:

```text
time >= 7 seconds
AND
no collision
AND
totalTurns >= 4
```

Failure:

```text
collision
OR
totalTurns < 4 at timeout
```

### Task 3

Ride continuously for **9 seconds** with:

```text
minimum left turns  = 2
minimum right turns = 3
```

Success:

```text
time >= 9 seconds
AND
no collision
AND
leftTurns >= 2
AND
rightTurns >= 3
```

Failure:

```text
collision
OR
leftTurns < 2 at timeout
OR
rightTurns < 3 at timeout
```

---

## 5. JSON Contract

### 5.1 Game Start

Mobile → ESP32:

```json
{
  "v": 1,
  "type": "command",
  "command": "game_start",
  "id": "game-001",
  "payload": {
    "gameId": "driving_pro",
    "level": 1
  }
}
```

ESP32 → Mobile:

```json
{
  "v": 1,
  "type": "response",
  "response": "game_started",
  "id": "game-001",
  "payload": {
    "gameId": "driving_pro",
    "level": 1,
    "status": "started"
  }
}
```

---

### 5.2 Start Task

Mobile → ESP32:

```json
{
  "v": 1,
  "type": "command",
  "command": "task_start",
  "id": "task-001",
  "payload": {
    "gameId": "driving_pro",
    "level": 1,
    "taskId": 1
  }
}
```

ESP32 → Mobile:

```json
{
  "v": 1,
  "type": "response",
  "response": "task_started",
  "id": "task-001",
  "payload": {
    "gameId": "driving_pro",
    "level": 1,
    "taskId": 1,
    "durationMs": 7000
  }
}
```

The same structure is used for Task 2 and Task 3 with their respective `taskId` and duration.

---

### 5.3 Game Input

Mobile → ESP32:

```json
{
  "v": 1,
  "type": "input",
  "id": "input-1001",
  "ts": 123456789,
  "payload": {
    "inputType": "joystick",
    "dir": "left",
    "magnitude": 1.0
  }
}
```

Right turn:

```json
{
  "v": 1,
  "type": "input",
  "id": "input-1002",
  "ts": 123456799,
  "payload": {
    "inputType": "joystick",
    "dir": "right",
    "magnitude": 1.0
  }
}
```

Joystick release:

```json
{
  "v": 1,
  "type": "input",
  "id": "input-1003",
  "ts": 123456899,
  "payload": {
    "inputType": "joystick",
    "dir": "none",
    "magnitude": 0.0
  }
}
```

During Driving Pro Level 1, `up` and `down` must not change the robot's movement.

---

### 5.4 Task Result

ESP32 → Mobile:

```json
{
  "v": 1,
  "type": "response",
  "response": "task_result",
  "gameId": "driving_pro",
  "level": 1,
  "taskId": 1,
  "payload": {
    "status": "passed",
    "score": 1,
    "stars": 1
  }
}
```

Failed task:

```json
{
  "v": 1,
  "type": "response",
  "response": "task_result",
  "gameId": "driving_pro",
  "level": 1,
  "taskId": 2,
  "payload": {
    "status": "failed",
    "score": 1,
    "stars": 1
  }
}
```

The `score` and `stars` represent completed tasks so far.

---

### 5.5 Game Over

ESP32 → Mobile:

```json
{
  "v": 1,
  "type": "response",
  "response": "game_over",
  "gameId": "driving_pro",
  "level": 1,
  "reason": "collision",
  "payload": {
    "tasksCompleted": 1,
    "tasksTotal": 3,
    "score": 1,
    "stars": 1
  }
}
```

For a task requirement failure:

```json
{
  "v": 1,
  "type": "response",
  "response": "game_over",
  "gameId": "driving_pro",
  "level": 1,
  "reason": "task_failed",
  "payload": {
    "tasksCompleted": 1,
    "tasksTotal": 3,
    "score": 1,
    "stars": 1
  }
}
```

---

### 5.6 Game Result

ESP32 → Mobile after all three tasks succeed:

```json
{
  "v": 1,
  "type": "response",
  "response": "game_result",
  "gameId": "driving_pro",
  "level": 1,
  "score": 3,
  "stars": 3,
  "tasksCompleted": 3,
  "tasksTotal": 3
}
```

---

### 5.7 Game Abort

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

ESP32 → Mobile:

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

## 6. Telemetry

During Driving Pro gameplay, the existing telemetry contract is used.

Obstacle telemetry uses the existing normalized C1–C4 mapping. The game must use the sensor state supplied by the firmware sensor layer.

---

## 7. ESP-NOW Compatibility

When Driving Pro is played using the physical remote:

- The same Level 1 game rules apply.
- The remote joystick supplies the normalized input.
- The robot remains responsible for task timing, collision detection, turn counting, and result generation.
- OLED provides task instructions and gameplay feedback.
- If BLE is disconnected, the result may be retained for later mobile synchronization according to the existing architecture.

---

## 8. Task State Flow

```text
LEVEL_SELECTED
      ↓
TASK_INSTRUCTIONS
      ↓
GO
      ↓
TASK_RUNNING
      ├── collision ──→ GAME_OVER
      └── timeout ────→ TASK_EVALUATION
                              ├── pass ──→ NEXT TASK
                              └── fail ──→ GAME_OVER

TASK 3 PASS
      ↓
LEVEL_COMPLETE
      ↓
GAME_RESULT
```

The robot must stop movement before transitioning to `GAME_OVER`, `LEVEL_COMPLETE`, or `GAME_ABORTED`.

---

## 9. Implementation Requirements

1. Implement only **Driving Pro Level 1**.
2. Use the existing Protocol v1 JSON structure used by the other games.
3. Keep game logic inside the robot-side `GameEngine`.
4. Mobile sends commands and inputs; it does not calculate authoritative results.
5. Do not send motor/PWM commands from the mobile application.
6. Task timers must be non-blocking.
7. Collision must take priority over timeout evaluation.
8. Turn counting must be performed by the robot.
9. Task 2 counts total turns.
10. Task 3 counts left and right turns independently.
11. Successful tasks accumulate score/stars.
12. A failed task ends the game.
13. Do not implement Levels 2 and 3 in this phase.
