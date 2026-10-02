# Direction Invert — Game Description

## 1. Overview

**Direction Invert** is a drive-based Challenge game built on the same **Drive With the Stick** control grammar as Driving Pro. The player drives the robot while the relationship between joystick input and robot movement is deliberately changed.

The player must suppress the normal driving response, understand the currently active direction mapping, and complete driving tasks using the inverted controls.

This implementation combines:

- The **Inverted Drive** learning progression from the Elxie Gamification Design.
- The current **Driving Pro** task approach, including timed driving, collision avoidance, turn counting, and left/right turn counting.
- The **Direction Invert — Game Logic & Behaviour Documentation** for mapping, task state, evaluation, safety, feedback, and result handling.

The current implementation uses **6 levels**, with **3 tasks per level**, for a total of **18 tasks**.

> **Status:** Proposed implementation specification. The Elxie design identifies the standalone-mode vs Driving Pro-modifier decision as an open decision. This document describes the gameplay and architecture behaviour without requiring that final product decision.

---

## 2. Core Game Mechanic

Direction Invert changes the relationship between joystick input and robot movement.

### Normal Mapping

| Joystick Input | Robot Movement |
|---|---|
| UP | FORWARD |
| DOWN | BACKWARD |
| LEFT | LEFT |
| RIGHT | RIGHT |

### Forward/Backward Invert

| Joystick Input | Robot Movement |
|---|---|
| UP | BACKWARD |
| DOWN | FORWARD |
| LEFT | LEFT |
| RIGHT | RIGHT |

### Steering Invert

| Joystick Input | Robot Movement |
|---|---|
| UP | FORWARD |
| DOWN | BACKWARD |
| LEFT | RIGHT |
| RIGHT | LEFT |

### Full Invert

| Joystick Input | Robot Movement |
|---|---|
| UP | BACKWARD |
| DOWN | FORWARD |
| LEFT | RIGHT |
| RIGHT | LEFT |

The mapping is applied to gameplay movement only. Safety processing remains independent of the mapping.

---

## 3. Control Architecture

The Direction Invert movement pipeline is:

```text
Joystick Input
      ↓
Logical Direction
      ↓
Active Direction Mapping
      ↓
Requested Robot Direction
      ↓
Safety Checks
      ↓
Motor Command
```

The mapping layer must not modify, invert, disable, or bypass safety behaviour.

This allows Direction Invert to reuse the normal driving and motor-control infrastructure while changing only the control relationship.

---

## 4. Game Flow

The high-level game flow is:

```text
Enter Challenge
      ↓
Select Direction Invert
      ↓
Select Level
      ↓
Load Level
      ↓
Load Active Mapping
      ↓
Initialize Task
      ↓
Show Instruction / Mapping
      ↓
Ready
      ↓
Active Driving
      ↓
Apply Direction Mapping
      ↓
Run Safety Checks
      ↓
Evaluate Task
      ↓
Success / Failure / Timeout / Safety Stop
      ↓
Feedback
      ↓
Next Task
      ↓
After 3 Tasks → Level Result
      ↓
Score / Stars / Result
```

### Task State Machine

```text
IDLE
  ↓
TASK_START
  ↓
SHOW_MAPPING / INSTRUCTION
  ↓
READY
  ↓
ACTIVE_PLAY
  ├── SUCCESS
  ├── FAILURE
  ├── TIMEOUT
  └── SAFETY_STOP
          ↓
       FEEDBACK
          ↓
      NEXT_TASK
          ↓
     LEVEL_RESULT
```

---

# 5. Level Structure

Direction Invert follows the Elxie learning progression:

```text
L1–L2 → Forward/Backward Inversion
L3–L4 → Steering Inversion
L5    → Full Inversion
L6    → Intermittent / Dynamic Inversion
```

Each level contains exactly **3 tasks**.

### Standard Task Pattern

Every level uses the same three task categories:

1. **Short Driving Movement**
   - Complete a short driving movement without collision.

2. **Turn Count**
   - Perform a minimum required number of turns.

3. **Left/Right Turn Count**
   - Perform a required number of left and right turns.

The task structure remains consistent so that the main difficulty progression comes from the active direction mapping and its constraints.

---

# 6. Level 1 — Forward/Backward Invert

### Mapping

```text
UP    → BACKWARD
DOWN  → FORWARD
LEFT  → LEFT
RIGHT → RIGHT
```

Only the forward/backward axis is inverted.

The mapping remains stable during the level.

### Purpose

Introduce the player to the concept of inverted driving with the smallest control change.

### Tasks

**Task 1 — Short Driving Movement**
- Complete a short driving movement.
- Do not collide.
- Complete within `maxTime`.

**Task 2 — Turn Count**
- Perform the configured minimum number of turns.
- Complete within `maxTime`.

**Task 3 — Left/Right Turn Count**
- Perform the required number of left turns.
- Perform the required number of right turns.
- Complete within `maxTime`.

---

# 7. Level 2 — Forward/Backward Invert

### Mapping

Same as L1:

```text
UP    → BACKWARD
DOWN  → FORWARD
LEFT  → LEFT
RIGHT → RIGHT
```

### Purpose

Reinforce forward/backward inversion while increasing the driving constraint.

Possible progression variables include:

- More turns.
- More precise driving.
- Tighter route constraints.
- Reduced effective task time if testing supports it.

### Tasks

**Task 1 — Short Driving Movement**
- Complete the movement without collision.

**Task 2 — Turn Count**
- Reach the configured minimum turn count.

**Task 3 — Left/Right Turn Count**
- Reach the configured left and right turn requirements.

The mapping remains stable throughout the level.

---

# 8. Level 3 — Steering Invert

### Mapping

```text
UP    → FORWARD
DOWN  → BACKWARD
LEFT  → RIGHT
RIGHT → LEFT
```

Only steering is inverted.

### Purpose

Introduce reversed steering after the player has learned forward/backward inversion.

### Tasks

**Task 1 — Short Driving Movement**
- Complete a short movement without collision.

**Task 2 — Turn Count**
- Perform the configured minimum number of turns.

**Task 3 — Left/Right Turn Count**
- Perform the configured number of left and right turns.

The mapping remains stable during the level.

---

# 9. Level 4 — Steering Invert

### Mapping

Same as L3:

```text
UP    → FORWARD
DOWN  → BACKWARD
LEFT  → RIGHT
RIGHT → LEFT
```

### Purpose

Apply reversed steering under more demanding driving conditions.

Possible progression variables include:

- More turns.
- More left/right requirements.
- Tighter routes.
- Greater time pressure.
- More constrained driving.

### Tasks

**Task 1 — Short Driving Movement**
- Complete without collision.

**Task 2 — Turn Count**
- Reach the configured minimum number of turns.

**Task 3 — Left/Right Turn Count**
- Reach the configured left/right turn requirements.

---

# 10. Level 5 — Full Invert

### Mapping

```text
UP    → BACKWARD
DOWN  → FORWARD
LEFT  → RIGHT
RIGHT → LEFT
```

Both axes are inverted.

### Purpose

Test the player against the hardest stable mapping.

The mapping remains constant throughout each task.

### Tasks

**Task 1 — Short Driving Movement**
- Complete the movement without collision.

**Task 2 — Turn Count**
- Perform the configured minimum number of turns.

**Task 3 — Left/Right Turn Count**
- Perform the required number of left and right turns.

The tasks can use tighter constraints than previous levels.

---

# 11. Level 6 — Dynamic / Intermittent Inversion

L6 introduces mapping changes during active driving.

The intended sequence is:

```text
NORMAL
   ↓
Player drives
   ↓
Switch Trigger
   ↓
Reverse Animation
   ↓
INVERTED
   ↓
Player continues driving
   ↓
Second Switch Trigger
   ↓
Reverse Animation
   ↓
NORMAL
```

The player must adapt to the new mapping and continue the current task.

### Initial Mapping

The task begins with:

```text
Normal Mapping
```

### First Switch

A defined game event triggers the control change.

The robot:

1. Stops or briefly manages the transition according to the approved transition behaviour.
2. Plays the direction-reversal animation.
3. Changes the active mapping.
4. Gives the player the configured feedback.
5. Continues the task.

### Second Switch

The same mechanism can switch the mapping back to normal.

The exact switch trigger and transition timing must remain configurable.

---

# 12. L6 Switch Signal

The control switch should have a highly visible animation inspired by the **UNO Reverse symbol**.

The visual concept is:

```text
     ↶       ↷
   ↶           ↷
     ↶       ↷
```

The animation represents the direction/control relationship being reversed.

The switch feedback should combine:

- Reverse-direction animation.
- OLED/face animation.
- Colour/LED feedback.
- Sound/buzzer.
- Optional remote haptic feedback.

The animation occurs **at the mapping-change event**, not continuously.

Example:

```text
Mapping = NORMAL

      ↓
Switch Event

      ↓
[ Reverse Animation ]

      ↓
Mapping = INVERTED
```

For the return switch:

```text
Mapping = INVERTED

      ↓
Switch Event

      ↓
[ Reverse Animation ]

      ↓
Mapping = NORMAL
```

---

# 13. Timing

Every task has a configurable:

```text
maxTime
```

The player must satisfy the task objective before the timer expires.

### Initial Implementation Limit

For the first implementation:

```text
0 < maxTime <= 30 seconds
```

`maxTime` must remain configurable per task rather than being hardcoded into the game logic.

Suggested initial timing values:

| Difficulty | maxTime |
|---|---:|
| Easy | 20s |
| Medium | 20s |
| More Complex | 30s |

Suggested initial level-based values:

| Level | maxTime |
|---|---:|
| L1 | 20s |
| L2 | 20s |
| L3 | 20s |
| L4 | 20s |
| L5 | 25s |
| L6 | 30s |

These are initial implementation values and can be adjusted during hardware testing and playtesting.

### Timing Events

The game should support:

- Task start time.
- Active task timer.
- Timeout detection.
- Optional pre-task countdown.
- L6 mapping-switch timing.
- Optional mapping-switch countdown.

---

# 14. Task Definitions

Tasks should be data-driven.

A task should contain at least:

```text
taskId
type
mapping
instruction
successConditions
failureConditions
parameters
feedback
```

Example:

```json
{
  "taskId": "DI-L1-T02",
  "type": "turn_count",
  "mapping": "FORWARD_BACKWARD_INVERT",
  "parameters": {
    "requiredTurns": 5,
    "maxTime": 20
  }
}
```

For a left/right task:

```json
{
  "taskId": "DI-L1-T03",
  "type": "directional_turn_count",
  "mapping": "FORWARD_BACKWARD_INVERT",
  "parameters": {
    "requiredLeftTurns": 3,
    "requiredRightTurns": 2,
    "maxTime": 20
  }
}
```

The exact task values can be changed without changing the underlying game engine.

---

# 15. Task Evaluation

## Task 1 — Short Driving Movement

Success requires:

- Required movement completed.
- No collision.
- Within `maxTime`.

Failure can occur due to:

- Collision.
- Timeout.
- Safety stop.
- Other configured task failure condition.

## Task 2 — Turn Count

Success requires:

```text
actualTurns >= requiredTurns
AND
within maxTime
AND
no configured failure condition
```

The turn count should be based on the robot's actual detected driving behaviour, not simply the number of joystick inputs.

## Task 3 — Left/Right Turn Count

Success requires:

```text
actualLeftTurns  >= requiredLeftTurns
AND
actualRightTurns >= requiredRightTurns
AND
within maxTime
```

Again, the evaluator should count actual robot turns.

---

# 16. Driving-System Reuse

Direction Invert should reuse the common driving infrastructure being developed for Driving Pro.

Potential shared components include:

- Joystick processing.
- Throttle/acceleration.
- Motor control.
- Turn detection.
- Turn counting.
- Left/right turn counting.
- Collision detection.
- Task timer.
- Task state machine.
- Task evaluation.
- Feedback.
- Result handling.

The primary Direction Invert-specific component is the **direction-mapping layer**.

```text
                 Driving System
                       │
              ┌────────┴────────┐
              │                 │
         Driving Pro      Direction Invert
              │                 │
       Normal Mapping     Inverted Mapping
              │                 │
              └────────┬────────┘
                       ↓
                Shared Driving
                  Infrastructure
```

This prevents duplication of motor and driving logic.

---

# 17. Safety

Direction inversion must never affect the robot's safety system.

The correct order is:

```text
Joystick Input
      ↓
Direction Mapping
      ↓
Requested Movement
      ↓
Safety Checks
      ↓
Motor Command
```

Safety checks may include:

- Collision danger.
- Edge/boundary danger.
- Sensor reliability.
- Remote input loss.

If a safety condition is triggered, safety takes priority over the active game mapping and the robot must stop according to the safety policy.

---

# 18. Inputs

### Primary Inputs

- Joystick direction/vector.
- Joystick magnitude/throttle where supported by the driving system.

### Optional Inputs

- Buttons for task-specific actions.
- Sensor readings used for collision and movement evaluation.
- Game events used to trigger L6 mapping changes.

The remote remains an input/output peripheral; the game mapping is maintained by the game engine.

---

# 19. Outputs

Direction Invert can produce:

### Robot Movement

- Forward/backward movement.
- Left/right steering.
- Acceleration/throttle behaviour.

### Visual Feedback

- OLED instructions.
- Active mapping indication.
- Reverse animation.
- Success/failure feedback.
- Level completion animation.

### Audio / Haptic Feedback

- Buzzer/sound.
- Remote haptic feedback.
- Warning feedback.
- Mapping-change notification.

### Game Results

- Task success/failure.
- Successful task count.
- Score.
- Stars.
- Level result.

---

# 20. Responsibilities

## Robot / Game Engine

The robot handles real-time gameplay:

1. Load the task.
2. Load the active mapping.
3. Read joystick input.
4. Convert input into logical direction.
5. Apply the direction mapping.
6. Apply driving/throttle behaviour.
7. Perform safety checks.
8. Send motor commands.
9. Monitor sensors.
10. Count turns.
11. Evaluate task conditions.
12. Detect success/failure/timeout.
13. Trigger feedback.
14. Calculate the temporary level result.
15. Store results when synchronization is unavailable.

---

## Remote / Controller

The remote is responsible for:

- Sending joystick input.
- Sending required button input.
- Receiving/providing haptic feedback.

The Direction Invert mapping should not be duplicated inside the remote.

---

## App / Web

The app/web handles:

- Challenge/game selection.
- Level selection.
- Progression.
- Unlocks.
- Persistent results.
- Stars.
- Best scores.
- Result display.
- Content synchronization.

Active driving should not depend on the phone being continuously connected.

---

## BLE / NUS

BLE/NUS handles:

- Result synchronization.
- Content synchronization where required.
- Unlock/progression synchronization.
- Optional telemetry.

If BLE is unavailable during play, the robot can temporarily retain the result and synchronize it later.

---

# 21. Scoring and Stars

Each level contains **3 tasks**.

The existing Elxie Challenge design proposes stars based on average task success:

| Stars | Average Success |
|---|---:|
| ★ | ≈ 50% |
| ★★ | ≈ 70% |
| ★★★ | ≥ 90% |

These thresholds remain configurable and can be tuned during testing.

The detailed score can later incorporate:

- Successful tasks.
- Completion time.
- Collisions.
- Turn-count performance.
- Mapping mistakes.

The final weighted scoring formula should be agreed before final implementation.

---

# 22. Level Result

After the three tasks are completed:

```text
Task 1 Result
      +
Task 2 Result
      +
Task 3 Result
      ↓
Level Result
      ↓
Score / Stars
      ↓
Feedback
      ↓
Store / Sync Result
```

Example:

```json
{
  "mode": "direction_invert",
  "level": 3,
  "tasks": 3,
  "successfulTasks": 2,
  "score": 67,
  "stars": 1
}
```

The exact score calculation remains configurable.

---

# 23. Error Handling

| Condition | Behaviour |
|---|---|
| BLE disconnected | Continue gameplay; retain result temporarily |
| Remote input lost | Stop safely and apply configured pause/fail policy |
| Sensor unreliable | Safety state takes priority |
| Invalid mapping | Do not execute invalid mapping |
| Invalid task data | Do not start task |
| Safety trigger | Stop movement immediately |
| Timer expires | Enter TIMEOUT state |

---

# 24. Architecture Summary

Direction Invert should be implemented as a **driving game with a configurable control-mapping layer**.

```text
                  Direction Invert
                         │
              ┌──────────┴──────────┐
              │                     │
          Task Layer          Mapping Layer
              │                     │
      What must be done?      How input is
                              transformed
              │                     │
              └──────────┬──────────┘
                         ↓
                  Driving System
                         ↓
                   Safety Layer
                         ↓
                   Motor Control
                         ↓
                      Robot
```

The task layer defines **what the player must accomplish**.

The mapping layer defines **how joystick input translates into robot movement**.

The driving system handles **movement, throttle, turns and common driving behaviour**.

The safety layer determines **whether the requested movement is safe**.

This separation allows Direction Invert to reuse the Driving Pro infrastructure while adding its own inverted-control behaviour.

---

# 25. Complete Level Summary

| Level | Mapping | Task 1 | Task 2 | Task 3 |
|---|---|---|---|---|
| **L1** | Forward/backward inverted | Short drive, no collision | Minimum turns | Left/right turns |
| **L2** | Forward/backward inverted | Short drive, no collision | Higher turn requirement | Higher left/right requirement |
| **L3** | Steering inverted | Short drive, no collision | Minimum turns | Left/right turns |
| **L4** | Steering inverted | Short drive, no collision | Higher turn requirement | Higher left/right requirement |
| **L5** | Full inverted | Short drive, no collision | Minimum turns | Left/right turns |
| **L6** | Normal ↔ inverted | Short drive, no collision | Minimum turns | Left/right turns |

**Total: 6 levels × 3 tasks = 18 tasks.**

The primary progression is:

**Forward/backward inversion → steering inversion → full inversion → dynamic switching.**

---

# 26. Implementation Checklist

### Core

- [ ] Implement Direction Invert game state.
- [ ] Implement configurable direction mapping.
- [ ] Implement logical joystick direction conversion.
- [ ] Integrate mapping with the shared driving system.
- [ ] Keep safety processing after mapping.
- [ ] Implement configurable task timer.
- [ ] Implement the 3 task types.
- [ ] Implement turn counting.
- [ ] Implement left/right turn counting.
- [ ] Implement collision evaluation.
- [ ] Implement task state machine.

### Levels

- [ ] Implement L1 forward/backward inversion.
- [ ] Implement L2 forward/backward inversion.
- [ ] Implement L3 steering inversion.
- [ ] Implement L4 steering inversion.
- [ ] Implement L5 full inversion.
- [ ] Implement L6 dynamic switching.

### L6

- [ ] Implement mapping switch event.
- [ ] Implement reverse-style animation.
- [ ] Implement colour/LED feedback.
- [ ] Implement face/OLED feedback.
- [ ] Implement sound/buzzer feedback.
- [ ] Implement optional haptic feedback.
- [ ] Make switch timing configurable.

### Results

- [ ] Implement task results.
- [ ] Implement level result.
- [ ] Implement score.
- [ ] Implement stars.
- [ ] Implement temporary/offline result storage.
- [ ] Implement BLE/NUS synchronization.
- [ ] Verify app/web progression handling.

---

## 27. Open Decisions

The following remain configurable/open until confirmed by the team:

1. Whether Direction Invert is a standalone mode or a modifier layered onto Driving Pro.
2. Exact task thresholds for each level.
3. Exact timing for each level/task.
4. Whether later levels reduce `maxTime`.
5. Exact L6 switch trigger.
6. Exact duration of the reverse animation.
7. Whether the robot pauses briefly during the switch or continues moving.
8. Whether the mapping switches once or twice in each L6 task.
9. Wrong-movement handling.
10. Final score formula.
11. Final star calculation.
12. Final OLED/LED/buzzer/haptic patterns.

The core implementation should therefore keep **mapping, timing, task thresholds, and L6 switch behaviour data-driven/configurable** rather than hardcoded.

---

## Final Implementation Principle

**Direction Invert is not a separate motor-control system.**

It is a **driving-task game built on the shared Driving Pro driving infrastructure**, with a Direction Invert mapping layer placed between joystick interpretation and the driving command.

```text
Joystick
   ↓
Direction Invert Mapping
   ↓
Shared Driving System
   ↓
Safety
   ↓
Robot
```

The player-facing progression is:

**learn one inverted axis → master the other inverted axis → handle full inversion → adapt when the mapping switches during driving.**
