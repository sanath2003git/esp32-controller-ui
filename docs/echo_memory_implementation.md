# Echo Memory — Firmware Implementation

## 1. Overview

Echo Memory is implemented directly in the ESP32-S3 firmware as a dedicated game engine.

The firmware owns:

- Level configuration
- Random sequence generation
- Color/action mapping
- Sequence playback timing
- Input validation
- Correct/incorrect feedback
- Score calculation
- Star calculation
- OLED game screens
- LED strip output
- Buzzer feedback
- BLE phase/result messages
- Game abort handling
- Transition back to the normal idle state

The web application does **not** receive the hidden sequence. It starts the selected level, displays the phase information received from the firmware, sends player actions during the input phase, and receives per-input and final results.

High-level flow:

```text
Web App
   │
   │ BLE: challenge / echo-memory / level
   ▼
ESP32 Echo Memory Engine
   │
   ├── Configure level
   ├── Generate random sequence
   ├── [Level 6] Generate random color mapping
   │
   ├── Optional mapping phase
   │
   ├── Flash sequence
   │      └── LED strip + BLE phase messages
   │
   ├── 3-second wait
   │
   ├── Input phase
   │      └── BLE player actions
   │
   ├── Validate each action
   │
   ├── Send input_result
   │
   ├── Calculate final score/stars
   │
   └── Send final response → return to idle
```

---

# 2. Firmware Integration

The game is registered in the firmware's `ActiveGame` enum:

```cpp
enum ActiveGame {
  GAME_NONE,
  GAME_COLOR_QUEST,
  GAME_REFLEX_DASH,
  GAME_ECHO_MEMORY
};
```

The currently active game is stored in:

```cpp
ActiveGame currentGame = GAME_NONE;
```

The main firmware loop routes execution to the Echo Memory game engine:

```cpp
if (currentGame == GAME_COLOR_QUEST) {
  updateColorQuest();
} else if (currentGame == GAME_REFLEX_DASH) {
  updateReflexDash();
} else if (currentGame == GAME_ECHO_MEMORY) {
  updateEchoMemory();
}
```

Therefore, Echo Memory has its own update loop while the common firmware loop continues handling BLE, telemetry, touch, battery monitoring, and other system functions.

---

# 3. Echo Memory Actions

The firmware defines six possible player actions:

```cpp
enum EchoMemoryAction {
  EMA_UP = 0,
  EMA_RIGHT = 1,
  EMA_DOWN = 2,
  EMA_LEFT = 3,
  EMA_PET = 4,
  EMA_HONK = 5
};
```

The actions are:

| Action ID | Action | Fixed color |
|---:|---|---|
| 0 | UP | Red |
| 1 | RIGHT | Yellow |
| 2 | DOWN | Green |
| 3 | LEFT | Blue |
| 4 | PET | Purple |
| 5 | HONK | White |

Levels 1–3 use only the first four directional actions.

Levels 4–6 use all six actions.

---

# 4. Echo Memory State Machine

The game uses the following states:

```cpp
enum EchoMemoryState {
  EMS_IDLE,
  EMS_MAPPING,
  EMS_FLASHING,
  EMS_WAIT,
  EMS_INPUT,
  EMS_RESULT
};
```

## State meanings

### `EMS_IDLE`

No Echo Memory game is running.

The normal OLED idle animation can be displayed.

---

### `EMS_MAPPING`

Used only by Level 6.

The firmware shows the player the randomly generated action-to-color mapping for 5 seconds.

After the mapping period, the game enters `EMS_FLASHING`.

---

### `EMS_FLASHING`

The firmware plays the hidden sequence.

For each sequence item:

1. Turn on the corresponding LED/action.
2. Keep it visible for the configured flash period.
3. Turn the LEDs off.
4. Wait for the 400 ms gap.
5. Move to the next sequence item.

This gap exists so that two identical consecutive actions remain visually distinguishable.

---

### `EMS_WAIT`

The sequence has finished.

The firmware waits for 3 seconds before allowing input.

This creates a separation between:

```text
Watch sequence
      ↓
Get ready
      ↓
Repeat sequence
```

---

### `EMS_INPUT`

The player repeats the sequence.

The firmware validates each received action against the corresponding hidden sequence element.

Correct and incorrect feedback is given immediately.

---

### `EMS_RESULT`

The final score and stars are calculated and displayed.

The result remains visible for approximately 2 seconds before the game returns to idle.

---

# 5. Main Echo Memory Variables

The firmware allocates an eight-element sequence buffer:

```cpp
const uint8_t ECHO_MEMORY_MAX_SEQUENCE_LENGTH = 8;

uint8_t echoMemorySequence[ECHO_MEMORY_MAX_SEQUENCE_LENGTH];
```

The game currently uses maximum length 7 because Level 6 contains seven actions.

Important state variables include:

```cpp
uint8_t echoMemorySequenceLength;
unsigned int echoMemoryFlashInterval;
uint8_t echoMemoryActionCount;
bool echoMemoryFullStrip;

uint8_t echoMemoryActionColor[6];

uint8_t echoMemoryFlashIndex;
unsigned long echoMemoryPhaseUntil;

unsigned long echoMemoryFeedbackUntil;

uint8_t echoMemoryInputIndex;
uint8_t echoMemoryWrongCount;
```

The 6-element `echoMemoryActionColor` array stores the color assigned to each action.

---

# 6. Level Configuration

The firmware supports Echo Memory Levels 1–6.

## Level table

| Level | Sequence length | Flash interval | Actions | LED mode | Mapping |
|---:|---:|---:|---:|---|---|
| 1 | 4 | 3.0 s | 4 | Regional | Fixed |
| 2 | 5 | 1.5 s | 4 | Regional | Fixed |
| 3 | 6 | 1.5 s | 4 | Regional | Fixed |
| 4 | 5 | 3.0 s | 6 | Full strip | Fixed |
| 5 | 6 | 1.5 s | 6 | Full strip | Fixed |
| 6 | 7 | 1.5 s | 6 | Full strip | Dynamic |

The configuration is performed inside:

```cpp
void echoMemoryStartLevel(int level)
```

If the requested level is outside 1–6, the firmware sends:

```text
Echo Memory levels 1-6 are supported
```

as an error.

---

# 7. Starting the Game

The web application starts Echo Memory through the normal BLE challenge command.

Expected command structure:

```json
{
  "command": "challenge",
  "game": "echo-memory",
  "level": 1
}
```

The BLE command handler contains:

```cpp
if (strcmp(command, "challenge") == 0) {
  const char *game = doc["game"] | "";

  ...

  else if (strcmp(game, "echo-memory") == 0) {
    int level = doc["level"] | 0;
    echoMemoryStartLevel(level);
  }
}
```

Therefore:

```text
Web App
  ↓
BLE RX
  ↓
handleCommandLine()
  ↓
echoMemoryStartLevel(level)
```

---

# 8. Sequence Generation

The sequence is generated entirely on the ESP32.

The firmware uses:

```cpp
randomSeed(esp_random());
```

during setup.

When a level starts, it generates every sequence element:

```cpp
for (uint8_t i = 0; i < echoMemorySequenceLength; i++) {
  echoMemorySequence[i] = random(0, echoMemoryActionCount);
}
```

This means:

- Level 1 can generate values 0–3.
- Level 2 can generate values 0–3.
- Level 3 can generate values 0–3.
- Levels 4–6 can generate values 0–5.

The complete sequence is generated once at the beginning of the level.

The sequence is **not sent to the web application**.

This is important because the firmware remains the authority for the actual challenge.

---

# 9. Color Mapping

## Levels 1–5

Levels 1–5 use the fixed identity mapping:

```text
UP     → Red
RIGHT  → Yellow
DOWN   → Green
LEFT   → Blue
PET    → Purple
HONK   → White
```

The firmware initializes:

```cpp
for (uint8_t i = 0; i < 6; i++) {
  echoMemoryActionColor[i] = i;
}
```

---

# 10. Level 6 Dynamic Mapping

Level 6 changes the color mapping.

The six colors remain:

```text
Red
Yellow
Green
Blue
Purple
White
```

but their assignment to the six actions is randomized.

The firmware first initializes the identity mapping and then performs a Fisher-Yates-style shuffle:

```cpp
for (uint8_t i = 5; i > 0; i--) {
  uint8_t j = random(0, i + 1);

  uint8_t tmp = echoMemoryActionColor[i];
  echoMemoryActionColor[i] = echoMemoryActionColor[j];
  echoMemoryActionColor[j] = tmp;
}
```

This creates a one-to-one mapping.

For example, one Level 6 game could produce:

```text
UP     → Blue
RIGHT  → White
DOWN   → Red
LEFT   → Purple
PET    → Yellow
HONK   → Green
```

The actual mapping is generated randomly each time Level 6 starts.

---

# 11. Level 6 Mapping Phase

Level 6 starts in:

```cpp
EMS_MAPPING
```

for 5 seconds.

The firmware sends a BLE phase message containing the generated mapping.

Conceptually:

```json
{
  "type": "phase",
  "game": "echo-memory",
  "level": 6,
  "phase": "mapping",
  "durationMs": 5000,
  "mapping": {
    "up": "...",
    "right": "...",
    "down": "...",
    "left": "...",
    "pet": "...",
    "honk": "..."
  }
}
```

The exact colors are generated dynamically by the firmware.

After 5 seconds, the game begins sequence playback.

---

# 12. LED Output

The firmware has two visual modes.

## Levels 1–3: Regional LEDs

Only the corresponding physical region is illuminated.

The directional mapping is:

```text
UP     → FRONT
RIGHT  → RIGHT
DOWN   → BACK
LEFT   → LEFT
```

The colors are:

```text
UP     → Red
RIGHT  → Yellow
DOWN   → Green
LEFT   → Blue
```

This allows the player to associate both direction and color with the signal.

---

## Levels 4–6: Full Strip

For Levels 4–6, the complete external NeoPixel strip is illuminated with the color assigned to the action.

The color values are:

```text
Red     → RGB(255, 0, 0)
Yellow  → RGB(255, 180, 0)
Green   → RGB(0, 255, 0)
Blue    → RGB(0, 0, 255)
Purple  → RGB(150, 0, 255)
White   → RGB(255, 255, 255)
```

The function responsible for this is:

```cpp
void echoMemoryShowAction(uint8_t action)
```

---

# 13. Sequence Flashing

When sequence playback starts, the first action is immediately shown.

The game enters:

```cpp
EMS_FLASHING
```

and tracks:

```cpp
echoMemoryFlashIndex
```

to identify the current sequence element.

The configured flash interval is reduced by the fixed 400 ms gap:

```cpp
echoMemoryFlashInterval - ECHO_MEMORY_GAP_MS
```

The sequence therefore behaves approximately like:

```text
LED ON
  ↓
flash interval minus 400 ms
  ↓
LED OFF
  ↓
400 ms gap
  ↓
next action
```

The gap is especially important for repeated sequence values:

```text
UP → UP
```

Without the gap, the player could perceive the two signals as one continuous flash.

---

# 14. BLE Phase Messages During Playback

The firmware sends a phase message whenever a sequence element begins.

Example structure:

```json
{
  "type": "phase",
  "game": "echo-memory",
  "level": 1,
  "phase": "flash",
  "index": 0,
  "length": 4
}
```

The `index` identifies the current sequence position.

The actual action/color is not included in the message.

Therefore, the web application can track progress without receiving the hidden answer sequence.

---

# 15. Transition to WAIT

After the final sequence element:

```cpp
echoMemoryState = EMS_WAIT;
echoMemoryPhaseUntil = now + 3000;
```

The LEDs are turned off.

The OLED displays:

```text
WAIT...
Get ready
```

The firmware also sends:

```json
{
  "type": "phase",
  "game": "echo-memory",
  "level": 1,
  "phase": "wait",
  "durationMs": 3000
}
```

After 3 seconds, `echoMemoryBeginInput()` is called.

---

# 16. Input Phase

At the beginning of the input phase:

```cpp
echoMemoryInputIndex = 0;
echoMemoryWrongCount = 0;
echoMemoryState = EMS_INPUT;
```

The OLED displays:

### Levels 1–3

```text
REPEAT!
Use D-pad
```

### Levels 4–6

```text
REPEAT!
D-pad, Honk, Pet
```

The firmware also sends:

```json
{
  "type": "phase",
  "game": "echo-memory",
  "level": 1,
  "phase": "input",
  "length": 4
}
```

---

# 17. Supported BLE Input Formats

The Echo Memory input handler accepts three input styles.

## A. Action input

Example:

```json
{
  "command": "input",
  "action": "up"
}
```

Supported action names:

```text
up
right
down
left
pet
honk
```

---

## B. Direction input

The firmware also accepts:

```json
{
  "command": "input",
  "dir": "up"
}
```

Supported values:

```text
up
right
down
left
pet
honk
```

---

## C. Joystick X/Y input

The firmware also accepts:

```json
{
  "command": "input",
  "x": 700,
  "y": 512
}
```

It converts the joystick position using the existing `joystickToDirection()` function.

The joystick has:

```text
CENTER = 512
DEAD_ZONE = 200
```

If the joystick is inside the dead zone, no action is generated.

Otherwise:

```text
Right movement → RIGHT
Left movement  → LEFT
Down movement  → DOWN
Up movement    → UP
```

PET and HONK are not produced from the joystick conversion.

---

# 18. Input Validation

All input eventually reaches:

```cpp
echoMemoryAnswerAction(action);
```

The function first verifies that the game is actually in:

```cpp
EMS_INPUT
```

It also checks that the action is valid for the current level:

```cpp
if (action < 0 || action >= echoMemoryActionCount)
  return;
```

The submitted action is compared against:

```cpp
echoMemorySequence[echoMemoryInputIndex]
```

Therefore:

```text
Player action
     ↓
Current sequence position
     ↓
Expected action
     ↓
Correct / Incorrect
```

---

# 19. Correct Feedback

When the player enters the expected action:

```cpp
playTone(2400, 100);
setStripColor(0, 80, 0);
```

The firmware:

- Plays a short high-pitched tone.
- Shows green feedback on the full strip.
- Sends an `input_result` message.

Example:

```json
{
  "type": "input_result",
  "game": "echo-memory",
  "level": 1,
  "index": 0,
  "correct": true,
  "score": 1.0
}
```

The score is recalculated after every input.

---

# 20. Incorrect Feedback

When the action does not match the expected sequence element:

```cpp
echoMemoryWrongCount++;
playTone(500, 250);
setStripColor(80, 0, 0);
```

The firmware:

- Increments the wrong-answer counter.
- Plays a lower warning tone.
- Shows red feedback.
- Sends `correct: false`.

Example:

```json
{
  "type": "input_result",
  "game": "echo-memory",
  "level": 1,
  "index": 0,
  "correct": false,
  "score": 0.75
}
```

---

# 21. HONK Action

The HONK action has a dedicated sound effect.

When:

```cpp
action == EMA_HONK
```

the firmware executes:

```cpp
echoMemoryPlayHonkSound();
```

The horn consists of three tones:

```text
400 Hz
550 Hz
750 Hz
```

with short delays between them.

After the horn sound, the action is checked against the sequence.

HONK is available only on Levels 4–6 because those are the levels with six possible actions.

---

# 22. PET Action

PET is represented as:

```cpp
EMA_PET = 4
```

and is available to Echo Memory on Levels 4–6.

The normal touch system can trigger:

```cpp
echoMemoryHandlePet()
```

while Echo Memory is in the input phase.

The function checks:

```cpp
currentGame == GAME_ECHO_MEMORY
```

and:

```cpp
echoMemoryState == EMS_INPUT
```

and only accepts PET when:

```cpp
echoMemoryLevel >= 4
```

It then submits:

```cpp
EMA_PET
```

to the same validation path as BLE input.

This means PET is treated as a real Echo Memory action rather than a separate special-case scoring system.

---

# 23. Input Feedback Timing

After an input:

```cpp
echoMemoryFeedbackUntil = millis() + 300;
```

The feedback remains visible briefly.

During the update loop, once the feedback period expires:

```cpp
echoMemoryStopOutputs();
echoMemoryFeedbackUntil = 0;
```

This turns the LEDs off and stops the feedback tone.

The next input can then be processed.

---

# 24. Scoring

The firmware tracks:

```cpp
echoMemoryWrongCount
```

and calculates the number of correct inputs as:

```cpp
int correctCount =
    echoMemorySequenceLength - echoMemoryWrongCount;
```

The percentage is:

```cpp
int scorePercent =
    (correctCount * 100) / echoMemorySequenceLength;
```

Therefore, the scoring model is based on the number of sequence positions answered correctly.

For example, for a 4-step sequence:

| Correct | Wrong | Score |
|---:|---:|---:|
| 4 | 0 | 100% |
| 3 | 1 | 75% |
| 2 | 2 | 50% |
| 1 | 3 | 25% |
| 0 | 4 | 0% |

---

# 25. Star Calculation

Stars are assigned using the final percentage:

```cpp
if (scorePercent >= 90)
  stars = 3;
else if (scorePercent >= 70)
  stars = 2;
else if (scorePercent >= 50)
  stars = 1;
```

Therefore:

| Score | Stars |
|---:|---:|
| 90–100% | 3 |
| 70–89% | 2 |
| 50–69% | 1 |
| 0–49% | 0 |

---

# 26. Final Result Message

At the end of the level, the firmware sends:

```json
{
  "type": "response",
  "game": "echo-memory",
  "level": 1,
  "score": 1.0,
  "scorePercent": 100,
  "stars": 3,
  "correct": 4,
  "total": 4
}
```

The fields are:

| Field | Meaning |
|---|---|
| `type` | Response message |
| `game` | `echo-memory` |
| `level` | Completed level |
| `score` | Decimal score from 0.0–1.0 |
| `scorePercent` | Integer percentage |
| `stars` | 0–3 |
| `correct` | Correct sequence positions |
| `total` | Sequence length |

---

# 27. Result OLED Screen

After calculating the result, the OLED displays:

```text
ECHO MEMORY

XX%

Stars: X/3
```

The battery overlay is also drawn if required.

The result remains visible for approximately:

```text
2000 ms
```

After that, the game returns to:

```cpp
EMS_IDLE
```

and:

```cpp
currentGame = GAME_NONE;
```

The normal idle animation resumes.

---

# 28. Abort Handling

Echo Memory supports the generic BLE abort command:

```json
{
  "command": "abort"
}
```

When Echo Memory is active:

```cpp
echoMemoryAbort();
```

is called.

The abort function:

1. Turns off LEDs.
2. Stops the buzzer.
3. Sets the game state to idle.
4. Clears the active game.
5. Resets the level.
6. Resets flashing state.
7. Restores the OLED idle screen.
8. Sends an `aborted` BLE response.

Response:

```json
{
  "type": "aborted",
  "game": "echo-memory"
}
```

---

# 29. Echo Memory State Flow

The complete state transition is:

```text
EMS_IDLE
   │
   │ challenge echo-memory
   ▼
echoMemoryStartLevel()
   │
   ├── Level 1–5 ───────────────┐
   │                            │
   │                            ▼
   │                       EMS_FLASHING
   │
   └── Level 6
          │
          ▼
     EMS_MAPPING
          │
       5 seconds
          │
          ▼
     EMS_FLASHING
          │
       sequence
          │
          ▼
       EMS_WAIT
          │
       3 seconds
          │
          ▼
       EMS_INPUT
          │
      player actions
          │
          ▼
      EMS_RESULT
          │
       2 seconds
          │
          ▼
       EMS_IDLE
```

---

# 30. Detailed Level Flow

## Level 1

```text
Sequence length: 4
Actions: UP / RIGHT / DOWN / LEFT
Flash interval: 3 seconds
LED mode: Regional
Mapping: Fixed
```

Example:

```text
FRONT Red
   ↓
RIGHT Yellow
   ↓
LEFT Blue
   ↓
BACK Green
```

Then:

```text
WAIT 3 seconds
      ↓
REPEAT using D-pad
```

---

## Level 2

```text
Sequence length: 5
Actions: 4 directional actions
Flash interval: 1.5 seconds
LED mode: Regional
Mapping: Fixed
```

The sequence is longer and playback is faster than Level 1.

---

## Level 3

```text
Sequence length: 6
Actions: 4 directional actions
Flash interval: 1.5 seconds
LED mode: Regional
Mapping: Fixed
```

The sequence length increases while the same four directional actions remain available.

---

## Level 4

```text
Sequence length: 5
Actions: UP / RIGHT / DOWN / LEFT / PET / HONK
Flash interval: 3 seconds
LED mode: Full strip
Mapping: Fixed
```

The player must now remember six possible actions.

---

## Level 5

```text
Sequence length: 6
Actions: 6
Flash interval: 1.5 seconds
LED mode: Full strip
Mapping: Fixed
```

This increases both sequence length and playback speed compared with Level 4.

---

## Level 6

```text
Sequence length: 7
Actions: 6
Flash interval: 1.5 seconds
LED mode: Full strip
Mapping: Randomized
```

Additional mapping phase:

```text
5 seconds
```

The player must first learn the randomly generated color-to-action relationship and then reproduce the sequence.

---

# 31. BLE Communication Architecture

Echo Memory uses the existing Nordic UART Service.

The firmware uses:

```text
NUS RX characteristic
        ↓
Web App → ESP32 commands
```

and:

```text
NUS TX characteristic
        ↓
ESP32 → Web App notifications
```

The firmware uses newline-delimited JSON framing.

BLE callbacks assemble incoming data before `handleCommandLine()` parses it.

This prevents partial BLE packets from being treated as incomplete JSON commands.

---

# 32. Communication Responsibilities

## Web App → Firmware

The web app sends:

```text
Start level
Input action
Abort game
```

Examples:

```json
{"command":"challenge","game":"echo-memory","level":1}
```

```json
{"command":"input","action":"up"}
```

```json
{"command":"input","dir":"right"}
```

```json
{"command":"abort"}
```

---

## Firmware → Web App

The firmware sends:

```text
Phase changes
Input results
Final result
Abort confirmation
Errors
```

Main Echo Memory message types:

```text
phase
input_result
response
aborted
error
```

---

# 33. Important Security / Game-Integrity Detail

The hidden sequence is generated and stored on the ESP32.

It is not included in the BLE `phase` messages.

The web app therefore does not receive the actual sequence that the player is expected to remember.

The web app receives only information such as:

```text
current phase
sequence length
current playback index
input result
score
final result
```

This keeps sequence validation firmware-side.

---

# 34. OLED Responsibilities

The OLED is locally controlled by the firmware.

Echo Memory uses it for:

```text
Level start
Level 6 mapping study
Sequence instructions
Wait screen
Input instructions
Final score
Stars
```

Examples:

```text
ECHO L1
Watch carefully
```

```text
WAIT...
Get ready
```

```text
REPEAT!
Use D-pad
```

```text
REPEAT!
D-pad, Honk, Pet
```

```text
ECHO MEMORY
100%
Stars: 3/3
```

The battery overlay can appear on these screens.

---

# 35. Hardware Used by Echo Memory

The main hardware outputs involved are:

### External NeoPixel strip

```cpp
#define PIN_STRIP 10
#define NUM_STRIP_PIXELS 30
```

Used for sequence and feedback visualization.

### Buzzer

```cpp
#define PIN_BUZZER 13
```

Used for:

- Correct feedback
- Incorrect feedback
- HONK action
- Final result sound

### OLED

```cpp
#define ADDR_OLED 0x3C
#define OLED_WIDTH 128
#define OLED_HEIGHT 64
```

Used for local game status.

### Touch sensor

```cpp
#define PIN_TOUCH 12
```

Used to detect the PET action during the Echo Memory input phase.

---

# 36. Existing Firmware Components Reused

Echo Memory is integrated into the existing firmware rather than being a completely separate firmware program.

It reuses:

- BLE/NUS communication
- JSON parsing
- BLE notification sending
- NeoPixel strip functions
- OLED display object
- Buzzer
- Joystick direction conversion
- Touch input
- Main firmware loop
- Active-game routing
- Idle animation
- Battery overlay
- Existing hardware initialization

This keeps Echo Memory inside the same firmware architecture as the other games.

---

# 37. Echo Memory-Specific Functions

The main Echo Memory implementation is organized around these functions:

```cpp
echoMemoryStartLevel()
echoMemoryShowAction()
echoMemoryShowDirection()
echoMemoryBeginInput()
echoMemoryAnswerAction()
echoMemoryAnswerDirection()
echoMemoryHandleInput()
echoMemoryHandlePet()
echoMemoryFinishLevel()
echoMemoryAbort()
echoMemoryStopOutputs()
echoMemoryShowOLED()
echoMemoryPlayHonkSound()
updateEchoMemory()
```

### Function responsibilities

| Function | Responsibility |
|---|---|
| `echoMemoryStartLevel()` | Configure and start a level |
| `echoMemoryShowAction()` | Display an action on LEDs |
| `echoMemoryShowDirection()` | Direction wrapper |
| `echoMemoryBeginInput()` | Start player input |
| `echoMemoryAnswerAction()` | Validate and score an action |
| `echoMemoryAnswerDirection()` | Direction wrapper |
| `echoMemoryHandleInput()` | Parse BLE input |
| `echoMemoryHandlePet()` | Handle physical PET input |
| `echoMemoryFinishLevel()` | Calculate and send final result |
| `echoMemoryAbort()` | Stop and abort game |
| `echoMemoryStopOutputs()` | Clear LEDs and buzzer |
| `echoMemoryShowOLED()` | Display game status |
| `echoMemoryPlayHonkSound()` | Play HONK effect |
| `updateEchoMemory()` | Run the non-blocking game state machine |

---

# 38. Implementation Summary

The current firmware implements Echo Memory as a **firmware-authoritative memory game**.

The core responsibility split is:

```text
                 ECHO MEMORY

        ┌──────────────────────────┐
        │       Web Application    │
        │                          │
        │ Start level              │
        │ Display game UI          │
        │ Send player inputs       │
        │ Display results          │
        └────────────┬─────────────┘
                     │ BLE
                     ▼
        ┌──────────────────────────┐
        │       ESP32 Firmware     │
        │                          │
        │ Level configuration      │
        │ Random sequence          │
        │ Random L6 mapping        │
        │ Playback timing         │
        │ Input validation         │
        │ Score calculation        │
        │ Star calculation         │
        │ Hardware feedback        │
        └────────────┬─────────────┘
                     │
          ┌──────────┼──────────┐
          ▼          ▼          ▼
       NeoPixel    OLED       Buzzer
          │
          ▼
       Player
```

The most important architectural point is that **the ESP32 owns the actual game state and hidden sequence**. BLE is used as the communication layer between the web application and the firmware.

---

# 39. Current Implementation Characteristics

Based on the uploaded firmware:

- Echo Memory supports **6 levels**.
- Maximum implemented sequence length is **7**.
- The sequence is generated randomly on the ESP32.
- Levels 1–3 use four directional actions.
- Levels 4–6 use six actions.
- Levels 1–5 use a fixed action/color mapping.
- Level 6 uses a randomized one-to-one action/color mapping.
- Level 6 has a 5-second mapping study phase.
- Sequence playback uses a 400 ms OFF gap.
- All levels have a 3-second wait before input.
- Correct and incorrect inputs receive immediate feedback.
- The final score is based on correct sequence positions.
- Stars are calculated from the final percentage.
- The firmware sends phase, input-result, and final-result messages over BLE.
- The hidden sequence is not sent to the web app.
- PET and HONK are integrated as gameplay actions for Levels 4–6.
- The existing OLED, NeoPixel, buzzer, touch, BLE, and main-loop infrastructure is reused.

---

# 40. Important Implementation Note

The current firmware's comments and implementation define the Echo Memory game primarily as an **action/color memory game**.

For Levels 1–3, the visual signal is both:

```text
direction + color
```

For Levels 4–6, the signal is primarily:

```text
color → action
```

with PET and HONK becoming additional actions.

Level 6 adds the extra challenge of learning a randomized color/action mapping before memorizing the sequence.

This is the implementation behavior present in the uploaded `sketch_sep28a.ino`.
