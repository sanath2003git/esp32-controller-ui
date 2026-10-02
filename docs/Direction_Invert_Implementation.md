# Direction Invert --- Firmware Implementation

## 1. Overview

Direction Invert is implemented directly in the ESP32-S3 firmware as a
dedicated game engine.

The firmware owns:

-   Level configuration
-   Direction-mapping mode
-   Forward/backward inversion
-   Steering inversion
-   Full inversion
-   Dynamic inversion for Level 6
-   Level timing
-   Task progression
-   Collision detection
-   Turn counting
-   Task success/failure
-   Score calculation
-   Star calculation
-   OLED task/status screens
-   Buzzer feedback
-   BLE task/result messages
-   Game abort handling
-   Transition back to the normal idle state

The web application starts the selected level, displays the task
information received from the firmware, sends movement/input commands,
and receives task and final results.

The actual direction mapping is performed on the ESP32. The mapping
layer does not bypass the existing collision/safety checks.

High-level flow:

``` text
Web App
   │
   │ BLE: challenge / direction-invert / level
   ▼
ESP32 Direction Invert Engine
   │
   ├── Configure level
   ├── Select inversion mode
   ├── Start single level timer
   │
   ├── Task 1: Short Drive
   │      └── Collision + drive-duration check
   │
   ├── Task 2: Turn Count
   │      └── Count left/right logical turns
   │
   ├── Task 3: Left/Right Turn Count
   │      └── Validate required left/right turns
   │
   ├── Calculate score/stars
   ├── Send task/final results
   └── Return to idle
```

------------------------------------------------------------------------

# 2. Firmware Integration

The game is registered in the firmware's `ActiveGame` enum:

``` cpp
enum ActiveGame {
  GAME_NONE,
  GAME_COLOR_QUEST,
  GAME_REFLEX_DASH,
  GAME_ECHO_MEMORY,
  GAME_DIRECTION_INVERT
};
```

The currently active game is stored in:

``` cpp
ActiveGame currentGame = GAME_NONE;
```

The main firmware loop routes execution to the Direction Invert engine:

``` cpp
if (currentGame == GAME_COLOR_QUEST) {
  updateColorQuest();
} else if (currentGame == GAME_REFLEX_DASH) {
  updateReflexDash();
} else if (currentGame == GAME_ECHO_MEMORY) {
  updateEchoMemory();
} else if (currentGame == GAME_DIRECTION_INVERT) {
  directionInvertUpdate();
}
```

Therefore, Direction Invert has its own non-blocking update loop while
the common firmware continues handling BLE, telemetry, hardware safety,
battery monitoring, and other system functions.

------------------------------------------------------------------------

# 3. Direction Invert State Machine

The game uses:

``` cpp
enum DirectionInvertState {
  DIS_IDLE,
  DIS_ACTIVE,
  DIS_RESULT
};
```

## State meanings

### `DIS_IDLE`

No Direction Invert level is running.

The normal OLED idle state can be displayed.

### `DIS_ACTIVE`

A Direction Invert level is running.

The firmware processes:

-   Direction mapping
-   Movement
-   Collision checks
-   Level timer
-   Task progression
-   Turn counting
-   Level 6 dynamic inversion

### `DIS_RESULT`

The level result is being generated/displayed.

The current implementation sends the final result and immediately
restores the normal idle state after displaying the result.

------------------------------------------------------------------------

# 4. Supported Levels

The current firmware supports Direction Invert Levels 1--6.

``` text
Level 1 → Forward/Backward Invert
Level 2 → Forward/Backward Invert
Level 3 → Steering Invert
Level 4 → Steering Invert
Level 5 → Full Invert
Level 6 → Dynamic Invert
```

The game rejects levels outside 1--6:

``` cpp
if (level < 1 || level > 6) {
  sendError("Only Direction Invert Level 1 to 6 are supported");
  return;
}
```

------------------------------------------------------------------------

# 5. Level Timing

The firmware uses one timer for the entire level.

``` cpp
const unsigned long DI_L1_L4_MAX_TIME_MS = 20000;
const unsigned long DI_L5_MAX_TIME_MS    = 25000;
const unsigned long DI_L6_MAX_TIME_MS    = 30000;
```

Therefore:

    Level Inversion Mode       Maximum Level Time
  ------- ------------------ --------------------
        1 Forward/Backward                   20 s
        2 Forward/Backward                   20 s
        3 Steering                           20 s
        4 Steering                           20 s
        5 Full                               25 s
        6 Dynamic                            30 s

The timer starts once when the level begins:

``` cpp
diLevelStartTime = millis();
```

It is shared by all three tasks.

The timer is **not reset when moving from Task 1 → Task 2 → Task 3**.

The update loop checks:

``` cpp
unsigned long elapsed = now - diLevelStartTime;

if (elapsed >= maxTime) {
  motorsStop();
  diFinishLevel();
  return;
}
```

Therefore the maximum time is the total time available for the entire
level.

------------------------------------------------------------------------

# 6. Direction Mapping

The mapping function is:

``` cpp
const char* diMapDirection(const char* inDir)
```

The mapping layer converts the player's logical command into the
requested robot direction.

The architecture is:

``` text
Joystick / BLE Input
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

The mapping layer does not disable or bypass collision detection.

------------------------------------------------------------------------

# 7. Level 1--2: Forward/Backward Invert

Levels 1 and 2 invert only forward/backward movement.

``` text
Player Input     Robot Movement

FORWARD    →     BACKWARD
BACKWARD   →     FORWARD

LEFT       →     LEFT
RIGHT      →     RIGHT
```

The firmware accepts equivalent direction names:

``` text
forward / front / up
backward / back / down
left
right
```

Example:

``` text
Player presses Forward
        ↓
Logical direction = FORWARD
        ↓
Direction mapping
        ↓
BACKWARD
        ↓
Safety checks
        ↓
Motor command
```

------------------------------------------------------------------------

# 8. Level 3--4: Steering Invert

Levels 3 and 4 invert left/right steering.

``` text
Player Input     Robot Movement

LEFT       →     RIGHT
RIGHT      →     LEFT

FORWARD    →     FORWARD
BACKWARD   →     BACKWARD
```

This creates a steering-reversal challenge while preserving the
forward/backward axis.

------------------------------------------------------------------------

# 9. Level 5: Full Invert

Level 5 inverts both movement axes.

``` text
Player Input     Robot Movement

FORWARD    →     BACKWARD
BACKWARD   →     FORWARD
LEFT       →     RIGHT
RIGHT      →     LEFT
```

This is the complete fixed direction inversion mode.

------------------------------------------------------------------------

# 10. Level 6: Dynamic Invert

Level 6 starts in normal mapping.

``` cpp
diDynamicInverted = false;
```

The firmware then switches between:

``` text
NORMAL
   ↕
FULL INVERT
```

The default switch interval is:

``` cpp
const unsigned long DI_L6_DEFAULT_SWITCH_INTERVAL_MS = 10000;
```

Therefore, the prototype switches mapping state every 10 seconds.

The transition duration is:

``` cpp
const unsigned long DI_L6_TRANSITION_DUR_MS = 600;
```

When the mapping changes:

1.  The current inversion state is toggled.
2.  Motors are stopped briefly.
3.  A 600 ms transition period is started.
4.  A buzzer tone is played.
5.  The OLED is updated.

The transition uses:

``` cpp
motorsStop();
diTransitionUntilMs = now + DI_L6_TRANSITION_DUR_MS;
playTone(2200, 200);
```

The mapping therefore behaves approximately as:

``` text
0–10 s       NORMAL
10–20 s      FULL INVERT
20–30 s      NORMAL
```

The exact transition is controlled by elapsed time from the level start.

------------------------------------------------------------------------

# 11. Main Direction Invert Variables

Important state variables include:

``` cpp
DirectionInvertState diState;

int diLevel;
int diTaskIndex;

unsigned long diLevelStartTime;

unsigned long diTask1DriveAccumMs;
unsigned long diLastDriveSampleMs;

int diTotalTurns;
int diLeftTurns;
int diRightTurns;
int diPrevLogicalDir;

int diReqTurns;
int diReqLeftTurns;
int diReqRightTurns;

bool diCollisionOccurred;

bool diTask1Success;
bool diTask2Success;
bool diTask3Success;

bool diDynamicInverted;
unsigned long diTransitionUntilMs;
```

These variables hold the active level, current task, timer, movement
duration, turn counters, task requirements, task results, and Level 6
inversion state.

------------------------------------------------------------------------

# 12. Task Structure

Every Direction Invert level contains three tasks.

``` text
Task 1 → Short Driving Movement
Task 2 → Turn Count
Task 3 → Left/Right Turn Count
```

The firmware starts Task 1 automatically:

``` cpp
diStartTask(0);
```

After Task 1:

``` text
Task 1
  ↓
Task 2
  ↓
Task 3
  ↓
Level Result
```

The level timer continues running throughout all three tasks.

------------------------------------------------------------------------

# 13. Task 1 --- Short Driving Movement

Task 1 requires the player to drive for a minimum amount of time without
collision.

The required driving duration is:

``` cpp
const unsigned long DI_TASK1_REQUIRED_DRIVE_MS = 1500;
```

Therefore the player must accumulate:

``` text
1.5 seconds of movement
```

while avoiding collisions.

The firmware accumulates movement time only while:

``` cpp
isMoving == true
```

The accumulation uses:

``` cpp
diTask1DriveAccumMs
```

When the accumulated time reaches 1500 ms:

``` text
Task 1 SUCCESS
    ↓
Stop motors
    ↓
Send task_result
    ↓
Start Task 2
```

------------------------------------------------------------------------

# 14. Task 1 Collision Handling

Collision detection is performed continuously while Task 1 is active.

The update loop checks:

``` cpp
if (isMoving && diCheckCollisionDetailed("TASK1_LOOP"))
```

If a collision is detected:

1.  Motors stop.
2.  `diCollisionOccurred` becomes true.
3.  Task 1 is marked unsuccessful.
4.  A warning tone is played.
5.  A failed `task_result` is sent.
6.  The firmware advances to Task 2.

Task 1 therefore does not allow a collision to be ignored.

------------------------------------------------------------------------

# 15. Collision Detection

Direction Invert uses three collision sources.

## A. Ultrasonic sensor

``` cpp
long sonarDist = readSonarCm();

if (sonarDist > 0 && sonarDist < 5) {
  return true;
}
```

The current threshold is:

``` text
Less than 5 cm
```

## B. IR corner sensors

The firmware checks four corner channels:

``` cpp
for (int i = 0; i < 4; i++) {
  int val = readMuxChannel(CORNER_CH[i]);

  if (val < IR_OBSTACLE_THRESHOLD) {
    return true;
  }
}
```

## C. Sudden motion detection

The firmware also checks:

``` cpp
detectSuddenMotion()
```

If sudden motion is detected, it is treated as a collision condition.

Overall:

``` text
Ultrasonic
    OR
IR corner sensors
    OR
Sudden motion
    ↓
Collision = TRUE
```

------------------------------------------------------------------------

# 16. Collision Safety During Movement

Before executing a mapped forward movement, the firmware performs a
collision check:

``` cpp
bool initialCollision = diCheckCollisionDetailed("DI_HANDLE_MOVE");
```

If the mapped movement is forward and a collision is detected:

``` cpp
motorsStop();
```

The movement is not sent to the motor controller.

The important safety order is:

``` text
Input
 ↓
Direction mapping
 ↓
Collision check
 ↓
Motor command
```

The inversion logic therefore does not bypass the existing safety layer.

------------------------------------------------------------------------

# 17. Task 2 --- Turn Count

Task 2 requires a minimum total number of turns.

The requirements depend on the level group.

For Levels 1 and 3:

``` cpp
DI_L1_T2_REQ_TURNS = 3;
```

For Levels 2, 4, 5 and 6:

``` cpp
DI_L2_T2_REQ_TURNS = 5;
```

Therefore:

  Levels         Required Total Turns
  ------------ ----------------------
  1, 3                              3
  2, 4, 5, 6                        5

The firmware resets:

``` cpp
diTotalTurns = 0;
diLeftTurns = 0;
diRightTurns = 0;
diPrevLogicalDir = -1;
```

when Task 2 starts.

------------------------------------------------------------------------

# 18. Turn Counting Logic

Turn counting uses the **logical player direction**, before inversion.

The logical directions are:

``` text
0 = FORWARD
1 = RIGHT
2 = BACKWARD
3 = LEFT
```

A left turn is counted when:

``` text
Current logical direction = LEFT
AND
Previous logical direction != LEFT
```

A right turn is counted when:

``` text
Current logical direction = RIGHT
AND
Previous logical direction != RIGHT
```

This prevents a continuous LEFT or RIGHT command from being counted
repeatedly as multiple turns.

The counters are:

``` cpp
diLeftTurns
diRightTurns
diTotalTurns
```

------------------------------------------------------------------------

# 19. Task 3 --- Left/Right Turn Count

Task 3 requires both left and right turns.

For Levels 1 and 3:

``` cpp
DI_L1_T3_REQ_LEFT_TURNS = 2;
DI_L1_T3_REQ_RIGHT_TURNS = 2;
```

For Levels 2, 4, 5 and 6:

``` cpp
DI_L2_T3_REQ_LEFT_TURNS = 3;
DI_L2_T3_REQ_RIGHT_TURNS = 3;
```

Therefore:

  Levels         Left Turns   Right Turns
  ------------ ------------ -------------
  1, 3                    2             2
  2, 4, 5, 6              3             3

Task 3 succeeds when:

``` cpp
diLeftTurns >= diReqLeftTurns &&
diRightTurns >= diReqRightTurns
```

------------------------------------------------------------------------

# 20. Task Progression

The task progression is controlled by `directionInvertUpdate()`.

### Task 1 success

``` text
Task 1 completed
       ↓
Send task_result
       ↓
Start Task 2
```

### Task 2 success

``` text
Task 2 completed
       ↓
Send task_result
       ↓
Start Task 3
```

### Task 3 success

``` text
Task 3 completed
       ↓
Send task_result
       ↓
Finish level
```

If the level timer expires at any point:

``` text
Current task
    ↓
Timer expired
    ↓
Stop motors
    ↓
Finish level
```

------------------------------------------------------------------------

# 21. Task Result Messages

After each task, the firmware sends:

``` json
{
  "type": "task_result",
  "game": "direction-invert",
  "level": 1,
  "index": 0,
  "task": 1,
  "success": true,
  "totalTurns": 0,
  "leftTurns": 0,
  "rightTurns": 0
}
```

Important fields:

  Field          Meaning
  -------------- --------------------------------
  `type`         Task result message
  `game`         `direction-invert`
  `level`        Current level
  `index`        Zero-based task index
  `task`         Human-readable task number
  `success`      Whether the task was completed
  `totalTurns`   Current total turn count
  `leftTurns`    Current left-turn count
  `rightTurns`   Current right-turn count

------------------------------------------------------------------------

# 22. Starting a Level

The web application starts Direction Invert through the standard BLE
challenge command.

Expected structure:

``` json
{
  "command": "challenge",
  "game": "direction-invert",
  "level": 1
}
```

The BLE command handler contains:

``` cpp
if (strcmp(command, "challenge") == 0) {
  const char *game = doc["game"] | "";

  ...

  else if (strcmp(game, "direction-invert") == 0) {
    int level = doc["level"] | 0;
    diStartLevel(level);
  }
}
```

The flow is:

``` text
Web App
   ↓
BLE RX
   ↓
handleCommandLine()
   ↓
diStartLevel(level)
   ↓
diStartTask(0)
```

------------------------------------------------------------------------

# 23. Direction Input Formats

The firmware accepts movement input through:

## A. `direction`

``` json
{
  "command": "input",
  "direction": "forward"
}
```

## B. `dir`

``` json
{
  "command": "input",
  "dir": "left"
}
```

## C. Joystick X/Y

``` json
{
  "command": "input",
  "x": 700,
  "y": 512
}
```

The joystick values are converted using the existing:

``` cpp
joystickToDirection(x, y)
```

The resulting logical direction is then passed through the Direction
Invert mapping.

------------------------------------------------------------------------

# 24. Direct `move` Command

The firmware also supports the normal `move` command.

``` json
{
  "command": "move",
  "direction": "forward",
  "speed": 180
}
```

When Direction Invert is active:

``` cpp
if (currentGame == GAME_DIRECTION_INVERT) {
  diHandleMove(direction, speed);
}
```

Otherwise, the normal firmware movement handler is used.

This ensures Direction Invert controls movement only while its game is
active.

------------------------------------------------------------------------

# 25. Joystick Processing

For joystick input:

``` cpp
int logicalDir = joystickToDirection(x, y);
```

The resulting index is converted to:

``` cpp
const char *dirs[4] = {
  "forward",
  "right",
  "backward",
  "left"
};
```

The logical direction is then sent to:

``` cpp
diHandleMove(dirs[logicalDir], speed);
```

If the joystick is centered/no valid direction is detected:

``` cpp
motorsStop();
```

------------------------------------------------------------------------

# 26. OLED Display

The firmware displays Direction Invert status on the 128×64 OLED.

The header shows:

``` text
DI L1  Task 1/3
```

The inversion mode is displayed according to the level.

### Levels 1--2

``` text
Fwd/Bwd Inverted
```

### Levels 3--4

``` text
Steering Inverted
```

### Level 5

``` text
Full Inverted
```

### Level 6

The OLED shows either:

``` text
Dyn: NORMAL
```

or:

``` text
Dyn: FULL INVERT
```

During the transition period:

``` text
REVERSE INVERT!
```

------------------------------------------------------------------------

# 27. OLED Task Information

### Task 1

``` text
Task: Short Drive
No collision!
```

### Task 2

``` text
Turns: X/Y
Perform turns!
```

### Task 3

``` text
L:X/Y R:X/Y
Left & Right turns
```

The battery overlay is also drawn when required.

------------------------------------------------------------------------

# 28. Level 6 Transition Feedback

When Level 6 switches inversion state:

``` text
Dynamic state changes
        ↓
Motors stop briefly
        ↓
600 ms transition period
        ↓
2200 Hz tone
        ↓
OLED updated
        ↓
New mapping becomes active
```

The transition is non-blocking and is based on the main firmware update
loop.

------------------------------------------------------------------------

# 29. Scoring

Each level contains exactly three tasks.

The firmware counts:

``` cpp
successfulTasks
```

using:

``` cpp
if (diTask1Success) successfulTasks++;
if (diTask2Success) successfulTasks++;
if (diTask3Success) successfulTasks++;
```

The score percentage is:

``` cpp
int scorePercent = (successfulTasks * 100) / 3;
```

Therefore the current score values are:

    Successful Tasks   Score
  ------------------ -------
                 0/3      0%
                 1/3     33%
                 2/3     66%
                 3/3    100%

------------------------------------------------------------------------

# 30. Star Calculation

The firmware uses task completion thresholds:

``` cpp
const int DI_STAR_3_REQ_TASKS = 3;
const int DI_STAR_2_REQ_TASKS = 2;
const int DI_STAR_1_REQ_TASKS = 1;
```

The resulting stars are:

    Successful Tasks   Stars
  ------------------ -------
                 3/3       3
                 2/3       2
                 1/3       1
                 0/3       0

The implementation comments describe these as approximately
corresponding to percentage thresholds, but the actual firmware
calculation is based directly on the number of successful tasks.

------------------------------------------------------------------------

# 31. Final Result Message

At the end of the level, the firmware sends:

``` json
{
  "type": "response",
  "mode": "direction_invert",
  "game": "direction-invert",
  "level": 1,
  "tasks": 3,
  "successfulTasks": 3,
  "score": 100,
  "stars": 3
}
```

Fields:

  Field               Meaning
  ------------------- ------------------------------
  `type`              Final response
  `mode`              `direction_invert`
  `game`              `direction-invert`
  `level`             Completed level
  `tasks`             Total tasks
  `successfulTasks`   Tasks completed successfully
  `score`             Score percentage
  `stars`             0--3

------------------------------------------------------------------------

# 32. Final OLED Result

After level completion, the OLED displays:

``` text
DI L1 COMPLETE

3/3 Tasks

Score: 100%  Stars: 3
```

The firmware plays a result tone:

``` cpp
playTone(stars >= 2 ? 2400 : 900, 200);
```

After sending the result, the firmware resets:

``` cpp
currentGame = GAME_NONE;
diLevel = 0;
diState = DIS_IDLE;
```

and restores the normal idle display.

------------------------------------------------------------------------

# 33. Abort Handling

Direction Invert supports:

``` json
{
  "command": "abort"
}
```

The firmware calls:

``` cpp
diAbort();
```

The abort function:

1.  Stops the motors.
2.  Stops the buzzer.
3.  Sets the game state to idle.
4.  Clears the active game.
5.  Resets the level.
6.  Sends an abort response.
7.  Restores the normal idle state.

Response:

``` json
{
  "type": "aborted",
  "game": "direction-invert"
}
```

------------------------------------------------------------------------

# 34. BLE Communication Architecture

Direction Invert uses the existing Nordic UART Service communication
layer.

``` text
Web App
   │
   │ NUS RX
   ▼
ESP32 Firmware
   │
   │ NUS TX
   ▼
Web App
```

Incoming BLE data uses newline-delimited JSON framing.

The BLE callback assembles complete messages before they are passed to:

``` cpp
handleCommandLine()
```

This keeps BLE packet fragmentation separate from game processing.

------------------------------------------------------------------------

# 35. Communication Responsibilities

## Web App → Firmware

The web application sends:

``` text
Start level
Movement/input
Abort
```

Examples:

``` json
{"command":"challenge","game":"direction-invert","level":1}
```

``` json
{"command":"input","direction":"forward"}
```

``` json
{"command":"input","x":700,"y":512}
```

``` json
{"command":"abort"}
```

## Firmware → Web App

The firmware sends:

``` text
Task result
Final result
Abort confirmation
Errors
```

Main Direction Invert messages:

``` text
task_result
response
aborted
error
```

------------------------------------------------------------------------

# 36. BLE Disconnect Safety

When the BLE connection is lost, the firmware stops the motors:

``` cpp
motorsStop();
```

If Direction Invert was active:

``` cpp
if (currentGame == GAME_DIRECTION_INVERT) {
  diAbort();
}
```

This prevents the robot from continuing an active Direction Invert
movement after the controlling web application disconnects.

After disconnect:

``` text
Stop motors
   ↓
Abort active Direction Invert game
   ↓
Return to idle
   ↓
Resume normal ESP-NOW control
```

------------------------------------------------------------------------

# 37. Direction Invert State Flow

The complete flow is:

``` text
DIS_IDLE
   │
   │ challenge direction-invert
   ▼
diStartLevel()
   │
   ├── Configure level
   ├── Select mapping
   ├── Start level timer
   │
   ▼
Task 1
   │
   │ 1.5 s movement without collision
   ▼
Task 2
   │
   │ Required total turns
   ▼
Task 3
   │
   │ Required left + right turns
   ▼
diFinishLevel()
   │
   ├── Calculate successful tasks
   ├── Calculate score
   ├── Calculate stars
   ├── Send final response
   ├── Show OLED result
   │
   ▼
DIS_IDLE
```

At any point:

``` text
Active Game
    │
    ├── Abort command
    │
    ├── BLE disconnect
    │
    └── Level timer expiry
             ↓
         Safe stop
             ↓
          Finish/Abort
```

------------------------------------------------------------------------

# 38. Detailed Level Flow

## Level 1

``` text
Mapping: Forward/Backward Invert
Maximum time: 20 s
Task 1: 1.5 s collision-free drive
Task 2: 3 total turns
Task 3: 2 left + 2 right turns
```

Direction behavior:

``` text
Forward  → Backward
Backward → Forward
Left     → Left
Right    → Right
```

------------------------------------------------------------------------

## Level 2

``` text
Mapping: Forward/Backward Invert
Maximum time: 20 s
Task 1: 1.5 s collision-free drive
Task 2: 5 total turns
Task 3: 3 left + 3 right turns
```

Direction behavior is the same as Level 1.

------------------------------------------------------------------------

## Level 3

``` text
Mapping: Steering Invert
Maximum time: 20 s
Task 1: 1.5 s collision-free drive
Task 2: 3 total turns
Task 3: 2 left + 2 right turns
```

Direction behavior:

``` text
Left     → Right
Right    → Left
Forward  → Forward
Backward → Backward
```

------------------------------------------------------------------------

## Level 4

``` text
Mapping: Steering Invert
Maximum time: 20 s
Task 1: 1.5 s collision-free drive
Task 2: 5 total turns
Task 3: 3 left + 3 right turns
```

Direction behavior is the same as Level 3.

------------------------------------------------------------------------

## Level 5

``` text
Mapping: Full Invert
Maximum time: 25 s
Task 1: 1.5 s collision-free drive
Task 2: 5 total turns
Task 3: 3 left + 3 right turns
```

Direction behavior:

``` text
Forward  → Backward
Backward → Forward
Left     → Right
Right    → Left
```

------------------------------------------------------------------------

## Level 6

``` text
Mapping: Dynamic Invert
Maximum time: 30 s
Task 1: 1.5 s collision-free drive
Task 2: 5 total turns
Task 3: 3 left + 3 right turns
```

The mapping starts normal and switches every 10 seconds:

``` text
NORMAL
   ↓
FULL INVERT
   ↓
NORMAL
```

The switch is accompanied by:

-   Motor stop
-   600 ms transition interval
-   2200 Hz tone
-   OLED mapping update

------------------------------------------------------------------------

# 39. Existing Firmware Components Reused

Direction Invert is integrated into the existing firmware rather than
running as a separate firmware program.

It reuses:

-   BLE/NUS communication
-   JSON parsing
-   BLE notification sending
-   Motor control
-   `handleMove()`
-   `motorsStop()`
-   Joystick direction conversion
-   Ultrasonic sensor
-   IR corner sensors
-   Sudden-motion detection
-   OLED display
-   Buzzer
-   Battery overlay
-   Main firmware loop
-   Active-game routing
-   BLE disconnect safety
-   Normal idle state

This keeps Direction Invert inside the same firmware architecture as
Colour Quest, Reflex Dash, and Echo Memory.

------------------------------------------------------------------------

# 40. Direction Invert-Specific Functions

The main Direction Invert implementation is organized around:

``` cpp
diGetLevelMaxTimeMs()
diMapDirection()
diCheckCollisionDetailed()
diCheckCollision()
diUpdateTurnCounting()
diShowTaskOLED()
diSendTaskResult()
diStartTask()
diStartLevel()
diFinishLevel()
diAbort()
directionInvertUpdate()
diHandleMove()
diHandleInput()
```

### Function responsibilities

  -----------------------------------------------------------------------
  Function                            Responsibility
  ----------------------------------- -----------------------------------
  `diGetLevelMaxTimeMs()`             Return maximum time for a level

  `diMapDirection()`                  Apply the active inversion mapping

  `diCheckCollisionDetailed()`        Check sonar, IR and sudden-motion
                                      collision sources

  `diCheckCollision()`                General collision wrapper

  `diUpdateTurnCounting()`            Count logical left/right turns

  `diShowTaskOLED()`                  Display current task and mapping

  `diSendTaskResult()`                Send task completion result

  `diStartTask()`                     Initialize and start a task

  `diStartLevel()`                    Configure and start a level

  `diFinishLevel()`                   Calculate score/stars and finish
                                      level

  `diAbort()`                         Safely abort the game

  `directionInvertUpdate()`           Run the non-blocking game state
                                      machine

  `diHandleMove()`                    Map, safety-check and execute
                                      movement

  `diHandleInput()`                   Parse BLE movement input
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 41. Safety Architecture

The most important implementation rule is that inversion occurs before
the existing safety checks, not instead of them.

``` text
Player Command
      ↓
Logical Direction
      ↓
Direction Inversion
      ↓
Mapped Robot Direction
      ↓
Collision Detection
      ↓
Motor Command
```

Collision sources remain active regardless of inversion mode:

``` text
Ultrasonic
IR Corner Sensors
Sudden Motion
```

If a safety condition is detected, the firmware can stop the motors even
when the player command would otherwise result in movement.

------------------------------------------------------------------------

# 42. Implementation Summary

The current firmware implements Direction Invert as a
**firmware-authoritative driving challenge**.

The responsibility split is:

``` text
                 DIRECTION INVERT

        ┌──────────────────────────┐
        │       Web Application    │
        │                          │
        │ Start level              │
        │ Display task UI          │
        │ Send movement inputs     │
        │ Display results          │
        └────────────┬─────────────┘
                     │ BLE
                     ▼
        ┌──────────────────────────┐
        │       ESP32 Firmware     │
        │                          │
        │ Level configuration      │
        │ Direction mapping        │
        │ Dynamic inversion        │
        │ Level timing             │
        │ Collision detection      │
        │ Turn counting            │
        │ Task validation          │
        │ Score calculation        │
        │ Star calculation         │
        │ Hardware feedback        │
        └────────────┬─────────────┘
                     │
          ┌──────────┼──────────┐
          ▼          ▼          ▼
       Motors      OLED       Buzzer
          │
          ▼
        Robot
```

The ESP32 owns the active game state, direction mapping, safety checks,
task validation, timing, and final scoring. The web application acts as
the controller interface and result display.

------------------------------------------------------------------------

# 43. Current Implementation Characteristics

Based on the uploaded `sketch_oct2a.ino` firmware:

-   Direction Invert supports **6 levels**.
-   Levels 1--2 use **Forward/Backward Invert**.
-   Levels 3--4 use **Steering Invert**.
-   Level 5 uses **Full Invert**.
-   Level 6 uses **Dynamic Invert**.
-   Levels 1--4 have a **20-second total level timer**.
-   Level 5 has a **25-second total level timer**.
-   Level 6 has a **30-second total level timer**.
-   The level timer is shared across all three tasks.
-   Task 1 requires **1.5 seconds of accumulated driving**.
-   Task 1 checks for collisions while the robot is moving.
-   The current ultrasonic collision threshold is **less than 5 cm**.
-   IR corner sensors and sudden-motion detection are also used for
    collision detection.
-   Task 2 counts logical left/right turns.
-   Task 2 requires 3 total turns on Levels 1 and 3, and 5 on Levels 2,
    4, 5 and 6.
-   Task 3 requires 2 left + 2 right turns on Levels 1 and 3.
-   Task 3 requires 3 left + 3 right turns on Levels 2, 4, 5 and 6.
-   Level 6 switches between normal and full inversion every 10 seconds.
-   Level 6 uses a 600 ms transition period with motor stop and buzzer
    feedback.
-   Task results are sent over BLE.
-   Final score is based on the number of successful tasks.
-   Stars are based on 0--3 successful tasks.
-   BLE disconnect stops the motors and aborts an active Direction
    Invert game.
-   The direction-mapping layer remains above the existing safety
    checks.
