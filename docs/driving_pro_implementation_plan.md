# Driving Pro - Full Implementation Plan

This document outlines the finalized architecture and concrete implementation steps for the "Driving Pro" game mode in the ESP32 Robo Controller app.

## Core Principle
The game relies entirely on the web controller to define missions, send instructions, and evaluate success. We do not track the robot's physical location; instead, we monitor the command stream and collision reports from the robot over BLE.

---

## 1. Level 1: Driver Training (Basic Controls)

**Objective:** Teach the player to control the robot while introducing basic driving discipline. 

**Mission Parameters:**
- **Time Limit:** 60 seconds
- **Checklist Requirements:**
  - Drive Forward for a total of 20 seconds.
  - Reverse for a total of 5 seconds.
  - Make exactly 3 left turns.
  - Make exactly 3 right turns.

**Step-by-Step Mechanics:**
1. **Start:** The UI displays the DRIVER TRAINING dashboard with the checklist and a 60-second countdown timer.
2. **Command Tracking:** The controller listens to joystick input and accumulates the active duration of Forward and Reverse commands. It also increments counters each time a discrete Left or Right turn command is sent.
3. **Collision Penalty:** Instead of an instant fail, every collision notification received from the ESP32 deducts a flat 10 points from the base score.
4. **Completion:** The level ends when the checklist is fully completed or the 60-second timer runs out.
5. **Scoring:** The score is calculated based on checklist completion percentage minus collision penalties, out of a maximum of 100 points.

---

## 2. Level 2: Driver Challenge (Reaction & Instructions)

**Objective:** Test the player's ability to react accurately to a dynamically changing sequence of instructions.

**Mission Parameters:**
- **Rounds:** 3 distinct sequences per game.
- **Sequence Length:** 5 to 7 random commands per round.

**Step-by-Step Mechanics:**
1. **Command Sequence Generation:** The engine generates a random sequence of standard commands (e.g., Forward, Turn Right, Reverse, Turn Left).
2. **Prompting:** The UI displays one command at a time. The player must execute the exact command shown. 
3. **Execution & Validation:** The controller verifies if the player's joystick input matches the displayed command. Once matched for a required duration (e.g., 2 seconds), the next command in the sequence is revealed.
4. **Emergency Stop Event:** Randomly during a sequence, the UI flashes "⚠️ EMERGENCY!". The player must immediately release all controls or press a dedicated STOP button. The game records the reaction time in milliseconds.
5. **Scoring Breakdown:**
   - **Correct Commands:** 40 points (deductions for wrong inputs).
   - **Reaction Time:** 25 points (scaled based on how quickly STOP was pressed).
   - **Collision Avoidance:** 25 points (deductions for obstacle hits).
   - **Completion Time:** 10 points (bonus for completing the sequence quickly).

---

## 3. Level 3: System Failure (Emergency Mission)

**Objective:** Combine driving skill with problem-solving by forcing the player to diagnose a simulated hardware failure mid-drive.

**Phase 1: The Initial Drive**
1. The player begins a standard driving challenge following random on-screen instructions.
2. After 30 seconds of driving, the game forcefully triggers a "System Failure" event.

**Phase 2: The Malfunction & Puzzle**
1. **Control Lockout:** The UI locks the joystick, preventing further movement commands from being sent to the ESP32.
2. **Diagnostic Panel UI:** A modal appears displaying simulated diagnostic symptoms. 
   - *Example Scenario (Right Motor Failure):* The panel shows `Bluetooth: ONLINE`, `Battery: ONLINE`, `Left Motor: ONLINE`, `Right Motor: ERROR`.
3. **Resolution:** The player is asked "Which component is causing the failure?" and must select the correct subsystem from a multiple-choice list.
4. **Restoration:** Once the correct component is selected, the UI displays "✅ SYSTEM RESTORED" and unlocks the joystick.

**Phase 3: The Final Challenge**
1. A final, highly demanding command sequence is presented (e.g., 10 commands).
2. The sequence will frequently interrupt with "⚠️ OBSTACLE!" requiring instant stops before resuming.
3. The mission concludes upon completing this final sequence.

---

## Technical Implementation Steps

### 1. State Management (`useDrivingProGame.ts`)
- **Action accumulators:** State variables to track `forwardTimeMs`, `reverseTimeMs`, `leftTurnsCount`, `rightTurnsCount`.
- **Phase Control:** State enum for `IDLE`, `TRAINING`, `CHALLENGE`, `MALFUNCTION`, `REPAIR_PUZZLE`, `FINAL_CHALLENGE`, `FINISHED`.
- **Timer Management:** RequestAnimationFrame or set intervals to track active command durations accurately.

### 2. BLE Integration (`BleContext.tsx` updates)
- **Obstacle Listener:** Ensure the BLE service listens for specific characteristic notifications related to IR sensor triggers (collisions).
- **Callback Hook:** Expose an `onCollision` event that `useDrivingProGame` can subscribe to for applying point penalties.

### 3. UI Component Development
- **`MissionDashboard.tsx`:** Renders the checklist with live progress bars for Level 1, and the current active command for Levels 2 & 3.
- **`DiagnosticsModal.tsx`:** Renders the Level 3 repair puzzle, taking a `faultScenario` prop to dynamically generate the correct symptom UI and options.
- **`ScoreReport.tsx`:** Renders the final score breakdown screen upon phase `FINISHED`.
