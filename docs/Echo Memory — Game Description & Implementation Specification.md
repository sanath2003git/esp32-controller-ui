
## 1. Game Overview

**Echo Memory** is a sequence-memory game. The robot presents a sequence of visual/action cues to the player. The player must observe the complete sequence, wait for the input phase, and then reproduce the same sequence in the exact order.

The game has **6 levels**. Difficulty increases through:

- Longer sequences
- Faster sequence playback
- Additional player actions
- A randomized color-to-action mapping in Level 6

The **game logic should own the sequence, timing, validation, score, and level progression**. The UI/client should receive game-state events and send player actions.

---

## 2. Common Game Flow

Every level follows this basic flow:

```text
START
  ↓
Configure Level
  ↓
Generate Sequence
  ↓
[Level 6: Show Color/Action Mapping]
  ↓
Play Sequence
  ↓
3-Second Wait
  ↓
Player Input
  ↓
Validate Each Input
  ↓
Correct / Incorrect Feedback
  ↓
Sequence Complete
  ↓
Calculate Score + Stars
  ↓
Show Result
  ↓
END
```

The game should be implemented as a **non-blocking state machine/game loop**, so timing and input handling do not block the rest of the robot system.

---

# 3. Actions

Echo Memory supports six possible actions:

|Action|ID|Default Color|
|---|--:|---|
|Up|0|Red|
|Right|1|Yellow|
|Down|2|Green|
|Left|3|Blue|
|Pet|4|Purple|
|Honk|5|White|

### Action availability

|Levels|Available Actions|
|---|---|
|1–3|Up, Right, Down, Left|
|4–6|Up, Right, Down, Left, Pet, Honk|

For Levels 1–5, the action-to-color mapping is fixed.

Level 6 uses a randomized mapping.

---

# 4. Level Specifications

## Level 1 — Basic Direction Memory

**Purpose:** Introduce the basic sequence-memory mechanic.

```text
Sequence Length: 4
Available Actions: Up, Right, Down, Left
Flash Interval: 3 seconds
LED Mode: Directional/Regional
Mapping: Fixed
```

### Flow

```text
Generate 4-action sequence
        ↓
Display each action
        ↓
Wait 3 seconds
        ↓
Player repeats 4 actions
        ↓
Validate each action
        ↓
Calculate result
```

The player uses the D-pad to reproduce the sequence.

---

## Level 2 — Longer Direction Sequence

```text
Sequence Length: 5
Available Actions: Up, Right, Down, Left
Flash Interval: 1.5 seconds
LED Mode: Directional/Regional
Mapping: Fixed
```

The same four directional actions are used, but the sequence is increased to 5 actions and the playback becomes faster.

---

## Level 3 — Advanced Direction Memory

```text
Sequence Length: 6
Available Actions: Up, Right, Down, Left
Flash Interval: 1.5 seconds
LED Mode: Directional/Regional
Mapping: Fixed
```

The sequence length increases to 6 while maintaining the faster playback speed.

---

## Level 4 — Multi-Action Memory

```text
Sequence Length: 5
Available Actions: Up, Right, Down, Left, Pet, Honk
Flash Interval: 3 seconds
LED Mode: Full LED Strip
Mapping: Fixed
```

The player now has six possible actions.

The player can respond using:

- D-pad → directional actions
- Pet → Pet action
- Honk → Honk action

---

## Level 5 — Faster Multi-Action Memory

```text
Sequence Length: 6
Available Actions: Up, Right, Down, Left, Pet, Honk
Flash Interval: 1.5 seconds
LED Mode: Full LED Strip
Mapping: Fixed
```

The sequence becomes longer and is played faster.

---

## Level 6 — Random Mapping Memory

Level 6 introduces an additional memory challenge.

```text
Sequence Length: 7
Available Actions: Up, Right, Down, Left, Pet, Honk
Flash Interval: 1.5 seconds
LED Mode: Full LED Strip
Mapping: Random
Mapping Learning Time: 5 seconds
```

### Step 1 — Generate Mapping

The game randomly assigns the six colors to the six actions.

Example:

```text
Up     → Blue
Right  → White
Down   → Red
Left   → Purple
Pet    → Yellow
Honk   → Green
```

The mapping must be generated at the beginning of the level.

### Step 2 — Mapping Phase

Display the complete mapping to the player for:

```text
5 seconds
```

The player uses this time to learn the new color/action relationships.

### Step 3 — Generate Sequence

After the mapping phase, generate a random **7-action sequence**.

The sequence uses the six available actions.

### Step 4 — Play Sequence

Display the sequence using the newly generated color mapping.

### Step 5 — Input Phase

After the sequence and the standard 3-second wait, the player reproduces the sequence using the corresponding physical actions.

---

# 5. Sequence Playback Timing

The terminology should be implemented as follows.

### Flash Interval

The configured flash interval represents the time allocated to each sequence cue.

Current configurations:

```text
Level 1, Level 4 → 3 seconds
Level 2, Level 3, Level 5, Level 6 → 1.5 seconds
```

Each cue is followed by a fixed:

```text
400 ms OFF gap
```

The gap makes consecutive identical actions distinguishable.

Example:

```text
UP
│
├── Cue displayed
│
├── Flash interval
│
├── LEDs OFF
│
└── 400 ms gap
      ↓
RIGHT
```

The implementation should preserve the **400 ms gap** between sequence cues.

---

# 6. Input Phase

After the complete sequence has been displayed:

```text
Wait: 3 seconds
```

Then the game enters the input phase.

The player must reproduce:

```text
sequence[0]
sequence[1]
sequence[2]
...
sequence[n]
```

in exactly the same order.

Each input is validated immediately.

---

# 7. Input Validation

For every player action:

```text
Player Action
     ↓
Get Expected Action
     ↓
Compare
     ↓
Correct?
   /     \
 YES      NO
 ↓         ↓
Correct   Incorrect
Feedback  Feedback
 ↓         ↓
Advance input index
```

The expected action is:

```text
sequence[inputIndex]
```

The game should not reveal the expected action to the player.

---

# 8. Feedback

### Correct Input

Provide:

- Short positive buzzer tone
- Green LED feedback
- `correct = true` result/event

### Incorrect Input

Provide:

- Warning buzzer tone
- Red LED feedback
- Increment wrong-input count
- `correct = false` result/event

Feedback should be short and should not interrupt the game loop.

Current firmware feedback duration:

```text
300 ms
```

---

# 9. Sequence Completion

When:

```text
inputIndex == sequenceLength
```

the input phase is complete.

The game should then:

1. Calculate the final score.
2. Calculate stars.
3. Send the final result.
4. Display the result.
5. End the game.

---

# 10. Scoring

Score is based on the number of correctly reproduced sequence positions.

```text
correct = sequenceLength - wrongCount
```

```text
scorePercent =
    (correct × 100) / sequenceLength
```

Examples:

|Sequence|Correct|Score|
|--:|--:|--:|
|4|4|100%|
|4|3|75%|
|4|2|50%|
|4|1|25%|
|4|0|0%|

---

# 11. Star System

Stars are calculated from the final percentage:

```text
90–100% → 3 stars
70–89%  → 2 stars
50–69%  → 1 star
0–49%   → 0 stars
```

---

# 12. Suggested Game States

The new architecture can represent Echo Memory using these states:

```text
IDLE
STARTING
MAPPING
FLASHING
WAITING
INPUT
FEEDBACK
RESULT
COMPLETED
ABORTED
```

### State responsibilities

**IDLE**

No game is active.

**STARTING**

Load the selected level and generate the required sequence/mapping.

**MAPPING**

Level 6 only. Show the randomized mapping for 5 seconds.

**FLASHING**

Display the generated sequence.

**WAITING**

Wait 3 seconds after sequence playback.

**INPUT**

Accept and validate player actions.

**FEEDBACK**

Provide short correct/incorrect feedback.

**RESULT**

Calculate and display score/stars.

**COMPLETED**

Return control to the normal robot/game system.

**ABORTED**

Stop the game and clear game-specific outputs.

---

# 13. Game Data Model

The new architecture can represent the game state with data similar to:

```text
EchoMemoryGameState
 ├── level
 ├── sequence[]
 ├── sequenceLength
 ├── inputIndex
 ├── wrongCount
 ├── currentState
 ├── flashInterval
 ├── mapping[]
 ├── mappingDuration
 ├── feedbackDuration
 └── result
```

The exact structure can follow the conventions of the new architecture.

---

# 14. Game ↔ Hardware Responsibilities

The Echo Memory game logic should determine **what should happen**, while the hardware layer should handle **how the hardware performs it**.

### Game Logic

Responsible for:

- Level configuration
- Sequence generation
- Mapping generation
- State transitions
- Timing
- Input validation
- Score
- Stars
- Game completion

### Hardware Layer

Responsible for:

- LED output
- OLED output
- Buzzer
- Touch/Pet input
- Honk input
- D-pad/joystick input

### Communication Layer

Responsible for:

- Receiving game-start commands
- Receiving player actions from the web app
- Sending game-state events
- Sending input results
- Sending final results

This separation allows Echo Memory to fit into the new architecture without putting game-specific logic inside the BLE or hardware drivers.

---

# 15. Web App / BLE Communication

The web application should primarily interact with the game through events and commands.

### Start Game

```json
{
  "command": "challenge",
  "game": "echo-memory",
  "level": 1
}
```

### Player Action

```json
{
  "command": "input",
  "action": "up"
}
```

Possible actions:

```text
up
right
down
left
pet
honk
```

### Game Events

The firmware/game engine should communicate events such as:

```text
mapping_started
flash_started
waiting
input_started
input_result
game_result
game_aborted
```

The exact event format can be adapted to the new architecture's standard event/message system.

---

# 16. Important Architecture Rule

The **sequence should remain inside the Echo Memory game logic**.

The web application should not need to know the hidden sequence.

The architecture should therefore follow:

```text
              Echo Memory Game
                     │
        ┌────────────┼────────────┐
        ↓            ↓            ↓
   Game State     Hardware     Communication
        │
        ↓
 Hidden Sequence
```

The game engine decides:

```text
What action should be shown?
When should it be shown?
What action should the player enter?
Is the input correct?
What is the score?
```

The hardware and communication layers execute those decisions.

---

# 17. Complete Implementation Flow

```text
START ECHO MEMORY
       │
       ▼
Load Level Configuration
       │
       ▼
Generate Random Sequence
       │
       ├─────────────── Level 6?
       │                    │
       │                   YES
       │                    ↓
       │             Generate Random Mapping
       │                    ↓
       │             Show Mapping for 5s
       │                    ↓
       │             Generate Sequence
       │
       ▼
   FLASHING
       │
       │ Display sequence
       │ 3s / 1.5s flash interval
       │ + 400ms gap
       ▼
   WAITING
       │
       │ 3 seconds
       ▼
     INPUT
       │
       ├── Player action
       │
       ├── Validate
       │
       ├── Correct → Green feedback
       │
       └── Wrong → Red feedback
       │
       ▼
More inputs?
   │       │
  YES      NO
   │       │
   └───┐   ▼
       │ RESULT
       │
       ├── Calculate score
       ├── Calculate stars
       └── Display result
               │
               ▼
             END
```

## Implementation Goal

The new architecture should implement Echo Memory as an **independent game module/state machine** that uses the shared robot services for hardware, input, BLE communication, and display.

This allows Echo Memory to be added without coupling its game rules to the existing games or duplicating common hardware/communication functionality.