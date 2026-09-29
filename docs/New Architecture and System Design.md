# ELXIE Firmware --- New Architecture and System Design

**Document status:** Single Source of Truth (SSoT) for firmware
architecture and device communication\
**Version:** 1.1.0\
**Date:** 2026-09-26\
**Target hardware:** ESP32-S3 N16R8\
**Firmware framework:** Arduino-ESP32 under PlatformIO\
**Project:** `elxie-firmware`

------------------------------------------------------------------------

## 1. Purpose

This document defines the target architecture for the Elxie robot
firmware and the communication contracts between:

1.  Elxie Robot --- ESP32-S3
2.  BLE Device --- mobile/web application
3.  ESP-NOW Remote --- physical joystick/controller

It is the implementation reference for the firmware migration from the
existing monolithic Arduino sketch into a modular PlatformIO project.

The purpose of this document is not to describe every implementation
detail. It defines the boundaries, states, interfaces, data contracts,
ownership rules, and migration constraints that implementation must
follow.

When an older document, prototype behavior, or code comment conflicts
with this document, this document is authoritative for the new
architecture unless a newer version explicitly changes the decision.

The project is intentionally not being migrated to pure ESP-IDF at this
stage. The selected engineering stack is:

-   VS Code
-   PlatformIO
-   Arduino-ESP32
-   C++
-   Modular source files
-   Existing Arduino-compatible libraries
-   Selective FreeRTOS usage only where it provides a clear benefit

The existing working firmware remains the behavioral reference during
migration. Refactoring must not silently remove working hardware
behavior.

------------------------------------------------------------------------

# 2. System Model

Elxie is a three-device system with a strict control-ownership rule: **BLE mobile connectivity has priority over the ESP-NOW remote.** The mobile application is not merely a data/sync client. When connected, it is the complete user-facing controller and game interface.

``` text
                         Bluetooth LE / NUS
                 +----------------------------+
                 |                            |
                 v                            |
        +---------------------+               |
        | Mobile App          |               |
        | ControlPanel        |               |
        | Game UI             |               |
        | Progression         |               |
        +----------+----------+               |
                   |                          |
                   v                          |
              +----+--------------------------+----+
              |              ELXIE                  |
              |             ESP32-S3                |
              |                                     |
              | Connection/Ownership Manager        |
              | Robot State Machine                 |
              | Game Engine                         |
              | Sensors / Motors / OLED / LEDs      |
              +----------------+--------------------+
                               ^
                               | ESP-NOW
                               |
                    +----------+-----------+
                    | Physical ESP-NOW     |
                    | Remote / Joystick    |
                    +----------------------+
```

## 2.1 Control ownership rule

The system has three connection situations:

| BLE Mobile | ESP-NOW Remote | Robot control owner | Robot behaviour |
|---|---|---|---|
| Connected | Connected or not | **Mobile App** | App ControlPanel, app-selected modes, and app-started games are authoritative. ESP-NOW input is ignored for control. |
| Not connected | Connected | **ESP-NOW Remote** | OLED presents the local mode menu. Remote navigates Game Mode / Free Ride Mode and controls the selected experience. |
| Not connected | Not connected | **Robot itself** | IDLE behaviour only. No external controller is accepted. |

The rule is deliberately simple. Human systems have enough ambiguity already without making a toy negotiate who gets to drive it.

### Priority

``` text
BLE Mobile connected
        │
        ▼
   MOBILE CONTROL
        │
        ├── ControlPanel joystick → robot movement
        ├── Game UI → game_start / game_input / game_abort
        └── BLE hardware/control commands

BLE Mobile disconnected + Remote connected
        │
        ▼
    LOCAL REMOTE
        │
        ├── OLED menu navigation
        ├── Free Ride movement
        └── Local game selection + gameplay

Neither connected
        │
        ▼
       IDLE
```

## 2.2 Robot as execution authority

The robot remains the real-time execution authority in both control paths. The difference is who supplies input:

- Mobile-connected path: the mobile app supplies movement/game input over BLE.
- Remote-only path: the physical remote supplies input over ESP-NOW.
- In both paths, the robot reads sensors, applies safety rules, executes motors, runs game logic, judges tasks, scores, and generates feedback.

The app may present game instructions, progression, scores, and rich UI, but the robot remains authoritative for real-time gameplay results.

## 2.3 Mobile app role

The mobile app has a **ControlPanel** containing a joystick capable of sending movement commands. The same connected BLE session is also the primary interface for starting and playing games.

Therefore the BLE contract must support:

- connection/handshake
- device information
- mobile ControlPanel movement input
- stop/exit control
- game selection/start
- game joystick/input events
- game abort
- game events/results
- telemetry
- hardware UI commands where required
- progression/result synchronization

## 2.4 Remote-only role

The ESP-NOW remote becomes a complete local controller when BLE is absent. It remains intentionally thin: it sends raw joystick/button input and receives feedback. It does not contain game logic or OLED menu logic.

The robot owns the local menu and renders it on the OLED. The robot interprets remote input according to the current local UI/game state.

## 2.5 Remote-only local flow

When the remote connects while BLE is not connected:

``` text
REMOTE CONNECTED
      │
      ▼
OLED: LOCAL MODE
      │
      ├── Game Mode
      │     │
      │     ├── Game selection
      │     ├── Level selection
      │     ├── Task/game instructions
      │     └── Gameplay using remote input
      │
      └── Free Ride Mode
            │
            └── Remote joystick drives robot
```

The OLED is therefore a local user interface, not merely a status display.

## 2.6 BLE connection while remote is active

If BLE connects at any time, BLE ownership becomes authoritative immediately. The robot must:

1. stop accepting ESP-NOW control input for movement/menu/game control;
2. safely stop motors if the previous control path was actively driving;
3. transition to the mobile-controlled state/session;
4. expose the current robot state to the mobile app;
5. let the mobile app explicitly select RC or start a game.

If a remote-only game is active when BLE connects, the local game session is aborted safely and its current partial result is not reported as a completed game result. The mobile app becomes the sole controller.

## 2.7 BLE disconnection while mobile control is active

If BLE disconnects:

- active mobile RC control is stopped immediately;
- active mobile game execution is safely aborted unless a future explicit resume contract is introduced;
- if an ESP-NOW remote is connected, the robot enters the local remote menu;
- if no remote is connected, the robot enters IDLE.

This prevents stale mobile joystick commands from remaining authoritative after the BLE link disappears.

---

# 3. Responsibility Boundaries

## 3.1 Robot responsibilities

The robot owns:

- Real-time robot state and control ownership
- BLE and ESP-NOW connection state
- Motor control
- LED/NeoPixel control
- OLED display and local menu
- Buzzer
- Sensor acquisition
- Safety decisions
- IDLE/pet behavior
- Mobile-controlled RC movement execution
- Remote-controlled Free Ride execution
- Game execution for both mobile and remote play
- Task evaluation
- Game scoring
- Temporary game/session results
- Telemetry generation
- BLE protocol endpoint
- ESP-NOW protocol endpoint
- Remote input interpretation
- Local menu navigation
- Game lifecycle

## 3.2 Mobile/Web application responsibilities

The application owns:

- BLE discovery and connection
- ControlPanel joystick UI
- Mobile RC controls
- Mobile game selection UI
- Mobile game instructions and presentation
- Game start/abort requests
- Game input transmission while connected
- Persistent progression
- Unlock state
- Best scores/stars
- Account/user data
- Content delivery
- Result synchronization
- Rich visual presentation
- Sensor visualization when telemetry is enabled

The application is the complete external controller while BLE is connected. It must not become the game referee.

## 3.3 Remote responsibilities

The physical remote owns:

- Joystick acquisition
- Button acquisition
- Remote battery reporting
- ESP-NOW packet transmission
- Link heartbeat
- Haptic/feedback output

The remote must not implement:

- Driving Pro scoring
- Colour Quest rules
- Level progression
- Stars
- Collision judgement
- Game state machines
- OLED menu state

The robot interprets raw remote input differently depending on whether it is navigating the local menu, driving Free Ride, or playing a game.

---

# 4. Top-Level Robot State Machine

The target runtime model retains three primary operational states, with a separate **local-menu/controller context** used when the robot is remote-only. The distinction matters because the robot must show a selectable OLED menu without turning the menu itself into another top-level gameplay state.

``` text
                         +------------------+
                         |       IDLE       |
                         | Pet / waiting    |
                         +---------+--------+
                                   |
                     Remote connected, BLE absent
                                   |
                                   v
                         +---------+----------+
                         | LOCAL REMOTE MENU  |
                         | OLED navigation   |
                         +----+----------+---+
                              |          |
                         Free Ride    Game Mode
                              |          |
                              v          v
                           +--+--+    +--+---+
                           | RC  |    | GAME |
                           |Free |    |Local |
                           |Ride |    |Remote|
                           +--+--+    +--+---+
                              |          |
                              +----+-----+
                                   |
                             local end/exit
                                   |
                                   v
                         LOCAL REMOTE MENU

BLE connected at any time
        │
        └──────────────► MOBILE CONTROL
                         │
                         ├── RC
                         └── GAME
```

### 4.1 IDLE

`IDLE` is the default state when no controller is connected. The robot may perform its own pet/idle behavior, display expressions, maintain safety monitoring, and wait for a controller.

If BLE connects, the robot enters **MOBILE CONTROL** context.

If only ESP-NOW connects, the robot enters **LOCAL REMOTE MENU** context and displays the local mode-selection screen.

## 4.2 Mobile Control context

Mobile Control is active whenever BLE is connected. It has two user-visible operating modes:

- Mobile RC / ControlPanel
- Mobile Game

No ESP-NOW input can change either mode while BLE is connected. The remote may remain physically connected, but its control packets are ignored for movement, menu navigation, and gameplay.

## 4.3 Local Remote Menu context

This context is entered only when BLE is disconnected and an ESP-NOW remote is connected. The OLED must display a selectable menu with at least:

1. `Game Mode`
2. `Free Ride Mode`

The remote joystick navigates the menu. A configured action/select button confirms the highlighted item. A back/cancel button returns to the previous menu where applicable.

The robot owns all menu rendering and navigation state.

## 4.4 Local Free Ride

Free Ride is the remote-only equivalent of unrestricted RC control. The remote joystick directly controls robot movement subject to safety rules. There is no scoring.

Exiting Free Ride returns to the local OLED menu.

## 4.5 Local Game

Local Game is entered through the OLED menu and is fully playable without BLE. The user selects the game and level using the remote and OLED. During gameplay, the remote supplies input and the robot runs the complete game engine.

Exiting or completing the game returns to the local OLED menu.

## 4.6 Mobile Game

Mobile Game is started by the connected mobile application. The mobile app supplies game input through BLE and presents the rich game UI. The robot remains responsible for execution, timing, sensor evaluation, scoring, and final result generation.

## 4.7 Safety transition rule

Any transition caused by loss of the active controller must stop motion first. No stale joystick state may survive a controller ownership transition.

---

# 5. Game Registry

The current target game registry is:

  ID                 Game
  ------------------ ----------------
  `color_quest`      Colour Quest
  `echo_memory`      Echo Memory
  `reflex_arc`       Reflex Arc
  `driving_pro`      Driving Pro
  `inverted_drive`   Inverted Drive

`Reflex Dash` appears in an earlier software brief. The latest
architecture planning uses `Reflex Arc`. The new firmware contract uses
`reflex_arc`.

`Reflex Dash` must not be used as a second protocol ID.

------------------------------------------------------------------------

# 6. Firmware Layer Architecture

The firmware must be divided into clear layers.

``` text
main.cpp
   |
   v
RobotController
   |
   +-------------------+
   |                   |
   v                   v
InputManager       GameManager
   |                   |
   +----+          +---+-------------------+
        |          |                       |
        v          v                       v
 BLE Manager   ColorQuest             DrivingPro
 ESP-NOW       EchoMemory             ReflexArc
               InvertedDrive           ...
        |
        v
Hardware Managers
   |
   +-- MotorController
   +-- SensorManager
   +-- LedController
   +-- DisplayController
   +-- BuzzerController
   +-- BatteryManager
```

Recommended project structure:

``` text
elxie-firmware/
├── platformio.ini
├── src/
│   ├── main.cpp
│   ├── config/
│   │   ├── BoardConfig.h
│   │   ├── ProtocolConfig.h
│   │   └── GameConfig.h
│   │
│   ├── core/
│   │   ├── RobotController.h
│   │   ├── RobotController.cpp
│   │   ├── RobotState.h
│   │   ├── RobotCommand.h
│   │   ├── InputEvent.h
│   │   └── RobotTypes.h
│   │
│   ├── communication/
│   │   ├── BleManager.h
│   │   ├── BleManager.cpp
│   │   ├── BleProtocol.h
│   │   ├── BleProtocol.cpp
│   │   ├── EspNowManager.h
│   │   ├── EspNowManager.cpp
│   │   ├── EspNowProtocol.h
│   │   └── EspNowProtocol.cpp
│   │
│   ├── hardware/
│   │   ├── MotorController.h/.cpp
│   │   ├── SensorManager.h/.cpp
│   │   ├── LedController.h/.cpp
│   │   ├── DisplayController.h/.cpp
│   │   ├── BuzzerController.h/.cpp
│   │   └── BatteryManager.h/.cpp
│   │
│   ├── games/
│   │   ├── GameEngine.h
│   │   ├── GameManager.h/.cpp
│   │   ├── ColorQuest.h/.cpp
│   │   ├── EchoMemory.h/.cpp
│   │   ├── ReflexArc.h/.cpp
│   │   ├── DrivingPro.h/.cpp
│   │   └── InvertedDrive.h/.cpp
│   │
│   └── telemetry/
│       ├── TelemetryManager.h/.cpp
│       └── TelemetryTypes.h
│
└── test/
    ├── test_protocol/
    └── test_games/
```

The exact file split may evolve, but the dependency direction must
remain stable:

``` text
Games -> interfaces/managers -> hardware
Games -> input events
Communication -> commands/events
RobotController -> coordinates everything
```

Game code must not directly manipulate GPIO pins.

------------------------------------------------------------------------

# 7. Main Loop Contract

The final `main.cpp` should remain small.

Target structure:

``` cpp
void setup() {
    hardware.begin();
    communication.begin();
    robotController.begin();
}

void loop() {
    communication.update();
    sensors.update();
    input.update();
    robotController.update();
    telemetry.update();
    display.update();
    buzzer.update();
}
```

The loop must not contain:

-   Game-specific logic
-   Large JSON parsers
-   Long blocking delays
-   Direct GPIO control
-   BLE callback business logic
-   ESP-NOW callback business logic

Communication callbacks should receive data, validate it, and enqueue an
event/packet for normal application processing.

------------------------------------------------------------------------

# 8. Hardware Abstraction

The hardware layer exposes capability-level operations rather than GPIO
operations.

Example:

``` cpp
robot.motors.forward(speed);
robot.motors.stop();

robot.leds.setRegion(Region::FRONT, color);
robot.display.showText("READY");
robot.buzzer.play(1200, 200);
```

Game code must not contain:

``` cpp
digitalWrite(PIN_AIN1, ...);
analogWrite(PIN_PWMA, ...);
```

or direct mux pin manipulation.

This separation is necessary so game logic can be tested without
physical hardware and so future hardware changes do not require
rewriting game logic.

------------------------------------------------------------------------

# 9. Sensor Architecture

`SensorManager` owns physical sensor acquisition.

It should produce a normalized `SensorSnapshot`.

Example:

``` cpp
struct SensorSnapshot {
    uint16_t cornerC1;
    uint16_t cornerC2;
    uint16_t cornerC3;
    uint16_t cornerC4;

    bool obstacleFrontLeft;
    bool obstacleFrontRight;
    bool obstacleRearLeft;
    bool obstacleRearRight;

    uint16_t bottomB1;
    uint16_t bottomB2;
    uint16_t bottomB3;
    uint16_t bottomB4;

    int frontDistanceCm;
    uint16_t heading;
    bool suddenMotion;
    bool touchActive;

    uint8_t batteryPercent;
    uint32_t timestamp;
};
```

The exact sensor list can grow, but games should consume normalized
values rather than reading the CD4067 directly.

## Current corner obstacle rule

The four corner channels `C1`, `C2`, `C3`, and `C4` are the
obstacle-detection sensors.

For the current implementation:

``` text
obstacle = sensor_value < 4000
```

No other sensor may be used to generate the corner-obstacle telemetry
flags unless this contract is deliberately changed.

## Bottom sensors

Bottom sensors are reserved for edge/drop safety and must remain
independent from corner obstacle telemetry.

------------------------------------------------------------------------

# 10. Motor Safety

Motor commands must pass through `MotorController`.

At minimum it must provide:

``` text
stop()
forward(speed)
backward(speed)
turnLeft(speed)
turnRight(speed)
drive(leftSpeed, rightSpeed)
```

Every state transition into GAME, RC, or IDLE must define the motor
behavior.

Safety rules:

1.  Stopping the robot must be possible from any state.
2.  Game abort must stop the motors immediately.
3.  BLE disconnect must not leave motors running indefinitely.
4.  ESP-NOW link loss must not leave motors running indefinitely.
5.  Sensor safety conditions must be able to override normal movement.
6.  A game must never bypass the motor safety layer.

------------------------------------------------------------------------

# 11. BLE Transport

BLE uses Nordic UART Service (NUS).

### Service

``` text
6E400001-B5A3-F393-E0A9-E50E24DCCA9E
```

### RX: App → Robot

``` text
6E400002-B5A3-F393-E0A9-E50E24DCCA9E
```

### TX: Robot → App

``` text
6E400003-B5A3-F393-E0A9-E50E24DCCA9E
```

The existing firmware already uses these standard NUS UUIDs.

The legacy custom UUIDs:

``` text
12345678-1234-1234-1234-123456789001
12345678-1234-1234-1234-123456789002
```

are obsolete for the new architecture.

## BLE message framing

BLE application messages use:

``` text
UTF-8 JSON + newline delimiter
```

One complete JSON object per line.

Example:

``` json
{"type":"client_ready"}
```

The BLE callback must not execute robot behavior directly.

The callback places the complete line into the protocol/event queue. The
main application loop processes it.

------------------------------------------------------------------------

# 12. BLE Connection Lifecycle

BLE connection is the highest-priority external control condition. A connected mobile device owns control regardless of whether an ESP-NOW remote is also connected.

## 12.1 BLE connect

On BLE connection the robot must:

1. mark BLE as connected;
2. set control owner to `mobile`;
3. stop accepting ESP-NOW control packets for movement, menu navigation, or game input;
4. safely stop any active remote-only movement;
5. abort any remote-only game in progress;
6. send `device_info`;
7. send current `state`;
8. wait for `client_ready`;
9. permit the app to explicitly select RC or start a game.

A BLE connection does **not** automatically start RC mode.

## 12.2 BLE disconnect

On BLE disconnect the robot must:

1. invalidate the latest mobile input;
2. stop motors safely;
3. abort any active mobile game unless a future resume contract is introduced;
4. clear mobile ownership;
5. if an ESP-NOW remote is connected, show the local OLED menu and transfer ownership to the remote;
6. otherwise enter IDLE.

## 12.3 Connection ownership state

The controller manager should expose:

```cpp
enum class ControlOwner {
    NONE,
    MOBILE,
    REMOTE
};
```

The effective owner is derived from connection state, not from whichever device most recently sent a packet:

```text
BLE connected        -> MOBILE
BLE disconnected + remote connected -> REMOTE
Neither connected    -> NONE
```

This prevents a late ESP-NOW packet from stealing control from the mobile app.

---

# 13. BLE JSON Contract

The BLE transport remains Nordic UART Service with newline-delimited JSON. The mobile application uses the same BLE session for ControlPanel movement, game commands, telemetry, and synchronization.

The detailed message schemas defined below are the target protocol for the new architecture. Legacy commands such as the old single-purpose `move` message are compatibility inputs only during migration and must not remain the long-term contract.

## 13.1 Handshake

Mobile → Robot:

```json
{"type":"client_ready"}
```

Robot → Mobile:

```json
{
  "type":"device_info",
  "deviceId":"7C4FAD214341",
  "name":"Robot-Test",
  "model":"ESP32-S3 N16R8",
  "firmware":"0.1.0",
  "protocolVersion":"1.1"
}
```

## 13.2 Message envelope

Commands should use a common envelope where practical:

```json
{
  "type":"command",
  "command":"...",
  "requestId":"abc123",
  "payload":{}
}
```

`requestId` is optional for high-rate input messages and recommended for state-changing commands that need a response.

## 13.3 Mobile ControlPanel movement

The ControlPanel joystick sends normalized input:

```json
{
  "type":"command",
  "command":"rc_input",
  "payload":{
    "x":0,
    "y":100
  }
}
```

Where:

- `x`: `-100` left to `+100` right
- `y`: `-100` backward to `+100` forward
- `0,0`: centered joystick

The robot accepts `rc_input` only while BLE is connected and the mobile control context is in RC mode.

## 13.4 Mobile RC start

```json
{
  "type":"command",
  "command":"rc_start"
}
```

Robot response:

```json
{
  "type":"response",
  "command":"rc_start",
  "status":"ok"
}
```

## 13.5 Mobile stop

```json
{
  "type":"command",
  "command":"rc_stop"
}
```

The robot must stop motion immediately and invalidate the latest joystick vector.

## 13.6 Mobile game input

While a mobile game is active, the ControlPanel/game UI may send the same normalized joystick representation through `game_input`:

```json
{
  "type":"command",
  "command":"game_input",
  "payload":{
    "x":-100,
    "y":0
  }
}
```

Game-specific buttons may be represented as a bitmask or named action in the payload. The active GameEngine decides what is meaningful.

The robot accepts `game_input` only when:

- BLE is connected;
- control owner is `MOBILE`;
- a mobile game is active.

## 13.7 Mobile game commands

Supported lifecycle commands:

- `game_start`
- `game_abort`
- `game_pause` if later enabled
- `game_resume` if later enabled

Example start:

```json
{
  "type":"command",
  "command":"game_start",
  "payload":{
    "gameId":"driving_pro",
    "level":1
  }
}
```

The same game-start contract is used for mobile play and for the robot's internal local-menu path, but local menu selection does not require a BLE message.

---

# 14. BLE State Events

The robot reports important state/ownership transitions to the connected mobile application.

Example ownership event:

```json
{
  "type":"state",
  "state":"mobile_control",
  "controlOwner":"mobile",
  "bleConnected":true,
  "remoteConnected":true
}
```

Remote-only example:

```json
{
  "type":"state",
  "state":"local_menu",
  "controlOwner":"remote",
  "bleConnected":false,
  "remoteConnected":true
}
```

The `state` message is informational. It does not grant control. Control ownership is determined by the robot's connection manager.

Possible state values include:

- `idle`
- `mobile_control`
- `mobile_rc`
- `mobile_game`
- `local_menu`
- `local_rc`
- `local_game`

## 14.1 Mobile-visible game state

During a mobile game the robot may send:

```json
{
  "type":"game_event",
  "event":"state_changed",
  "gameId":"driving_pro",
  "level":1,
  "state":"running"
}
```

The mobile app should use these events to keep its UI synchronized with the robot rather than assuming that a command was executed merely because it was transmitted.

---

# 15. Mobile Control Command Summary

The target BLE command set is:

| Command | Direction | Purpose | Required control owner |
|---|---|---|---|
| `client_ready` | Mobile → Robot | Complete BLE handshake | None |
| `rc_start` | Mobile → Robot | Enter mobile RC | Mobile |
| `rc_input` | Mobile → Robot | ControlPanel joystick | Mobile |
| `rc_stop` | Mobile → Robot | Stop mobile RC | Mobile |
| `game_start` | Mobile → Robot | Start selected game/level | Mobile |
| `game_input` | Mobile → Robot | Game joystick/action input | Mobile |
| `game_abort` | Mobile → Robot | Abort active mobile game | Mobile |
| `led_set` | Mobile → Robot | Direct LED control where permitted | Mobile |
| `buzzer` | Mobile → Robot | Direct buzzer control where permitted | Mobile |
| `display_text` | Mobile → Robot | Display text where permitted | Mobile |
| `display_expression` | Mobile → Robot | Display expression where permitted | Mobile |
| `display_clear` | Mobile → Robot | Clear display | Mobile |
| `telemetry_start` | Mobile → Robot | Enable telemetry stream | Mobile |
| `telemetry_stop` | Mobile → Robot | Disable telemetry stream | Mobile |
| `ping` | Mobile → Robot | Link/application health check | Mobile |

Robot → Mobile message types:

| Type | Purpose |
|---|---|
| `device_info` | Robot identity/capabilities |
| `state` | Connection, mode, and ownership state |
| `response` | Command success/error |
| `game_event` | Live game lifecycle/task events |
| `game_result` | Completed game result |
| `telemetry` | Sensor/robot telemetry |
| `remote_pair_result` | Pairing result when applicable |

The app must not treat an unacknowledged command as successfully applied.

---

# 16. BLE General Hardware Commands

These commands remain available only when permitted by the current
state.

## NeoPixel

``` json
{
  "type": "led_set",
  "region": "front",
  "r": 255,
  "g": 0,
  "b": 0
}
```

Allowed region:

``` text
front
back
left
right
all
```

## Buzzer

``` json
{
  "type": "buzzer",
  "frequency": 1200,
  "duration": 400
}
```

## OLED text

``` json
{
  "type": "display_text",
  "text": "Hello",
  "line": 0
}
```

## OLED expression

``` json
{
  "type": "display_expression",
  "sequence": [0, 2, 1]
}
```

## OLED clear

``` json
{
  "type": "display_clear"
}
```

Expression IDs currently defined:

    ID Expression
  ---- ------------
     0 Happy
     1 Sad
     2 Heart
     3 Star
     4 Check
     5 Cross
     6 Warning
     7 Robot
     8 Battery
     9 Sleep
    10 WiFi

Game engines may use these capabilities internally through the
DisplayController rather than issuing BLE commands to themselves.

------------------------------------------------------------------------

# 17. Game Lifecycle Protocol

The same GameEngine implementation must support both control paths:

- `MOBILE`: BLE-connected mobile app supplies game input.
- `REMOTE`: BLE absent, ESP-NOW remote supplies game input after local OLED menu selection.

The game engine must not care which transport produced the input. It receives normalized `InputEvent` objects from the controller layer.

## 17.1 Start game from mobile

Mobile → Robot:

```json
{
  "type":"command",
  "command":"game_start",
  "payload":{
    "gameId":"color_quest",
    "level":1
  }
}
```

The robot validates the game, level, current state, and control owner before starting.

## 17.2 Start game from local OLED menu

No BLE command is generated. The local menu controller performs the equivalent internal action:

```cpp
GameManager::start(gameId, level, ControlSource::REMOTE);
```

The OLED displays the game/level and instructions. The remote then provides gameplay input through ESP-NOW.

## 17.3 Abort game

Mobile:

```json
{
  "type":"command",
  "command":"game_abort"
}
```

Remote/local menu: the configured Back/Cancel button aborts the local game.

An external controller loss also aborts the active game safely.

## 17.4 Game events

Robot → Mobile when BLE is connected:

```json
{
  "type":"game_event",
  "event":"task_started",
  "gameId":"driving_pro",
  "level":1,
  "task":1
}
```

Other events may include:

- `game_started`
- `task_started`
- `task_completed`
- `task_failed`
- `level_completed`
- `game_aborted`
- `game_completed`

For remote-only play, the same state is presented on the OLED and feedback can be sent to the remote. If BLE is absent, there is naturally no mobile event stream.

## 17.5 Game result

Robot → Mobile after a mobile game completes, or later during result synchronization for a remote-only game:

```json
{
  "type":"game_result",
  "gameId":"driving_pro",
  "level":1,
  "score":3,
  "stars":2,
  "tasksCompleted":3,
  "tasksTotal":3,
  "source":"mobile"
}
```

For a remote-only session stored offline, `source` is `remote` and the result is held until the next BLE synchronization.

---

# 18. Driving Pro Level 1 Contract

The current implementation target for Driving Pro Level 1 is based on
the latest architecture planning.

### Task 1

Ride for 9 seconds without collision.

On task start:

-   robot automatically moves forward
-   joystick up/down does not control forward/backward
-   joystick left/right controls turning
-   when the user releases the joystick after a turn, the robot resumes
    forward motion
-   collision ends the task
-   timer completion ends the task

### Task 2

Same driving behavior for 9 seconds, but the user must perform at least
5 turns.

### Task 3

Same driving behavior for 9 seconds, but the user must perform:

``` text
at least 2 left turns
at least 3 right turns
```

After the required tasks finish, the robot sends `game_result`.

The exact collision threshold must be defined by the sensor
calibration/configuration rather than hard-coded throughout the game.

The existing project also contains a broader future design of six levels
and approximately ten tasks per level. That content model remains a
future expansion. Driving Pro L1's immediate migration scope is the
three-task definition above.

------------------------------------------------------------------------

# 19. Game Input Contract

Game input is normalized before reaching the GameEngine. This keeps the game logic independent of BLE and ESP-NOW.

```cpp
enum class ControlSource {
    NONE,
    MOBILE,
    REMOTE
};

struct InputEvent {
    ControlSource source;
    int8_t x;
    int8_t y;
    uint16_t buttons;
    uint32_t timestampMs;
};
```

The same `InputEvent` is produced from:

- BLE `game_input` when the mobile app is playing;
- ESP-NOW input packets when the remote is playing locally.

The GameEngine never reads BLE characteristics or ESP-NOW packets directly.

---

# 20. ESP-NOW Protocol

ESP-NOW is the physical remote transport. It remains active as a radio link even when BLE is connected, but its input is **not accepted for control while BLE is connected**. This is a logical ownership rule, not a requirement to repeatedly disconnect the ESP-NOW peer.

## 20.1 Remote → Robot packet

The proposed binary input packet remains:

```cpp
struct RemoteInputPacket {
    uint8_t version;
    uint8_t type;
    uint16_t sequence;
    int8_t joystickX;
    int8_t joystickY;
    uint16_t buttons;
    uint8_t battery;
    uint8_t flags;
};
```

Joystick convention:

- `X = -100`: left
- `X = 0`: center
- `X = +100`: right
- `Y = -100`: backward
- `Y = 0`: center
- `Y = +100`: forward

The exact wire serialization must use explicit packed/manual serialization before the remote firmware is finalized. C/C++ struct layout must not be assumed across independent firmware builds.

## 20.2 Button bitmask

Initial button allocation:

| Bit | Meaning | Local-menu role | Game role |
|---:|---|---|---|
| 0 | Primary / Action | Select / Confirm | Game action |
| 1 | Secondary | Context-specific | Game action |
| 2 | Menu | Open/return menu where allowed | Game-defined |
| 3 | Back | Back / Cancel | Abort/Back where allowed |

The robot interprets buttons according to the current local UI/game context.

## 20.3 Robot → Remote feedback

```cpp
struct RemoteFeedbackPacket {
    uint8_t version;
    uint8_t type;
    uint16_t sequence;
    uint8_t pattern;
    uint8_t intensity;
    uint16_t durationMs;
    uint8_t flags;
};
```

Feedback may represent:

- selection confirmation
- invalid action
- task success
- task failure
- game completion
- warning
- safety stop

The OLED remains the primary local visual interface.

## 20.4 Remote-only OLED menu navigation

The robot consumes joystick/button packets as UI input while in the local menu. Recommended navigation:

- joystick up/down: change highlighted menu item
- primary button: select
- back button: return/exit

The first menu must contain exactly these two required choices:

```text
> Game Mode
  Free Ride Mode
```

The implementation may add status information such as remote battery or connection indicator without changing the two required choices.

## 20.5 Local game navigation

Inside `Game Mode`, the OLED menu can expose:

1. Game selection
2. Level selection
3. Start/instructions
4. Gameplay
5. Result screen
6. Return to Game Mode menu

All navigation is local to the robot. No phone is required.

---

# 21. ESP-NOW Heartbeat and Link Safety

The remote should send a heartbeat or regular input packet at a defined interval. The robot tracks the last valid packet timestamp.

If the remote link times out while it is the active controller:

- stop motors;
- cancel active remote joystick state;
- abort a remote-only game if the game requires continuous input;
- return to the local OLED menu if BLE remains disconnected;
- return to mobile control if BLE has connected during the timeout window.

If BLE is connected, remote timeout does not affect the active mobile controller state.

---

# 22. ESP-NOW Pairing

ESP-NOW peers are identified by MAC address. The robot should support a one-time pairing process that binds a remote to the robot.

Pairing may be initiated from the mobile application when BLE is connected or from a future physical pairing flow. Pairing data is configuration, not game state.

The pairing implementation must not change the control-priority rule: a paired remote still cannot control Elxie while BLE is connected.

---

# 23. Input Routing Rules

All external input passes through a single controller/ownership layer before reaching robot behavior.

``` text
BLE packets --------+
                    |
                    v
              ControllerManager
                    |
ESP-NOW packets ----+
                    |
                    v
             Ownership filter
                    |
                    v
              InputRouter
             /      |       \
          Menu      RC      GameEngine
```

## 23.1 BLE input

BLE input is accepted only if BLE is currently connected. It is always the highest-priority controller.

## 23.2 ESP-NOW input

ESP-NOW input is accepted only if:

- BLE is disconnected; and
- ESP-NOW remote is connected/paired; and
- the robot is in a remote-controlled context.

Otherwise the packet may be received for link maintenance but must not affect robot control.

## 23.3 State-dependent routing

```text
BLE connected
    rc_input   -> Mobile RC -> MotorController
    game_input -> Mobile GameEngine
    other UI commands -> Mobile-authorized handlers
    ESP-NOW input -> ignored for control

BLE disconnected + Remote connected
    ESP-NOW input + local menu -> OLED MenuController
    ESP-NOW input + Free Ride -> MotorController
    ESP-NOW input + Local Game -> GameEngine

Neither connected
    external input -> ignored
    robot -> IDLE behavior
```

## 23.4 No direct transport access from games

Games must consume `InputEvent`, not BLE or ESP-NOW APIs. This makes the same game playable from both the mobile app and physical remote without duplicating game logic.

---

# 24. Controller Ownership

The ownership manager is one of the most important components in the new architecture. It must be deterministic.

```cpp
enum class ControlOwner {
    NONE,
    MOBILE,
    REMOTE
};
```

### BLE connected

`ControlOwner::MOBILE`

- Mobile ControlPanel works.
- Mobile game UI works.
- Mobile game input works.
- ESP-NOW packets are ignored for movement, menu, and game input.

### BLE disconnected + remote connected

`ControlOwner::REMOTE`

- OLED local menu is shown.
- Remote can choose Game Mode or Free Ride Mode.
- Remote can navigate and play games.
- Remote can drive Free Ride.

### Neither connected

`ControlOwner::NONE`

- Robot remains in IDLE behavior.
- No controller input is accepted.

### Ownership transitions

The ownership manager must invalidate the previous source's latest input on every transition. A stale joystick vector is not a command. It is a bug waiting for a convenient moment to become a crash.

---

# 25. Telemetry Contract

Telemetry is a robot-to-app stream. It is sent only while BLE is connected.

It is disabled by default in IDLE.

It is enabled in RC.

Games explicitly declare whether telemetry is required.

For Driving Pro it is enabled because the mobile UI is expected to
display live driving/sensor information.

Example:

``` json
{
  "type": "telemetry",
  "timestamp": 123456,
  "direction": 127,
  "distance": {
    "front": 42
  },
  "obstacle": {
    "frontLeft": false,
    "frontRight": false,
    "rearLeft": false,
    "rearRight": false
  },
  "motion": {
    "sudden": false
  },
  "pit": {
    "detected": false
  },
  "battery": {
    "robot": 87,
    "remote": 62
  },
  "touch": {
    "event": "none"
  },
  "controller": {
    "active": "mobile",
    "bleConnected": true,
    "remoteConnected": true
  }
}
```

The existing corner obstacle telemetry mapping remains:

``` text
C1 -> frontLeft
C2 -> frontRight
C3 -> rearLeft
C4 -> rearRight
```

and:

``` text
C1/C2/C3/C4 value < 4000 => true
```

Telemetry generation must use `SensorManager` rather than independently
reading hardware.

------------------------------------------------------------------------

# 26. Response and Error Contract

All command responses use:

``` json
{
  "type": "response",
  "status": "ok",
  "request": "..."
}
```

or:

``` json
{
  "type": "response",
  "status": "error",
  "request": "...",
  "code": "...",
  "message": "..."
}
```

Initial error codes:

``` text
INVALID_JSON
INVALID_MESSAGE
UNKNOWN_COMMAND
INVALID_PARAMETER
INVALID_STATE
GAME_NOT_FOUND
LEVEL_NOT_FOUND
GAME_ALREADY_RUNNING
NO_GAME_RUNNING
CONTROLLER_UNAVAILABLE
REMOTE_NOT_PAIRED
BUSY
SAFETY_STOP
UNSUPPORTED_VERSION
```

The application must use `code` for programmatic handling and `message`
for diagnostics.

------------------------------------------------------------------------

# 27. Command Permission Matrix

| Capability | BLE connected | BLE disconnected + remote connected | Neither connected |
|---|---|---|---|
| Mobile RC movement | Allowed | Not applicable | Not applicable |
| Mobile game start | Allowed | Not applicable | Not applicable |
| Mobile game input | Allowed during mobile game | Not applicable | Not applicable |
| Mobile game abort | Allowed | Not applicable | Not applicable |
| ESP-NOW Free Ride | Ignored | Allowed after local menu selection | Not allowed |
| ESP-NOW local menu | Ignored | Allowed | Not allowed |
| ESP-NOW local game input | Ignored | Allowed during local game | Not allowed |
| OLED idle behavior | Allowed | Replaced by local menu | Active |
| Local OLED game selection | Not used | Allowed | Not used |
| Telemetry to mobile | Allowed | Unavailable | Unavailable |
| Robot safety stop | Always allowed | Always allowed | Always allowed |

Safety actions are not subordinate to either controller.

---

# 28. Game Engine Interface

Every game implements the same conceptual interface.

``` cpp
class GameEngine {
public:
    virtual bool start(uint8_t level, const String& sessionId) = 0;
    virtual void update(const SensorSnapshot& sensors) = 0;
    virtual void handleInput(const InputEvent& input) = 0;
    virtual void abort() = 0;
    virtual bool isFinished() const = 0;
    virtual GameResult getResult() const = 0;
};
```

The actual implementation may use stronger C++ types than `String`.

Game engines must be non-blocking.

Do not implement:

``` cpp
delay(9000);
```

for a nine-second game task.

Use timestamps/state transitions.

------------------------------------------------------------------------

# 29. Colour Quest Migration

Colour Quest must be migrated into the GameManager/GameEngine architecture without rewriting its game rules unnecessarily.

The migration must support both input sources:

```text
Mobile BLE game_input ----+
                          |
                          v
                    InputEvent
                          |
ESP-NOW remote input -----+
                          |
                          v
                    Colour Quest
```

The game logic should remain transport-agnostic. Existing states such as `GS_IDLE`, `GS_SHOWING`, `GS_WAIT_INPUT`, and `GS_FEEDBACK` may be retained internally during the first migration.

For remote-only play, the game renders task prompts/feedback on the OLED and uses the remote for directional/action input. For mobile play, the same game state is reported to the app through `game_event` messages while the app presents the richer visual UI.

The robot remains the authority for correctness and scoring in both cases.

---

# 30. Driving Pro Architecture

Driving Pro is explicitly designed to be playable through either input source, depending on connection ownership.

## Mobile play

- Mobile app connects over BLE.
- User opens the ControlPanel/game interface.
- App starts Driving Pro.
- App sends normalized `game_input` joystick events.
- Robot performs automatic forward movement/task logic as defined by the level and uses mobile input for steering/action.
- Robot judges collision, timing, turns, and task completion.
- App receives game events and final result.

## Remote-only play

- BLE is disconnected.
- Remote connects.
- OLED local menu appears.
- User selects Game Mode.
- User selects Driving Pro and a level using the remote.
- Robot displays instructions on OLED.
- Robot starts the game.
- Remote joystick supplies the same normalized gameplay input.
- Robot handles all scoring and feedback locally.

The GameEngine must therefore expose one gameplay API and allow the transport/controller layer to provide either `MOBILE` or `REMOTE` input.

---

# 31. Level Definition Contract

The broader product design defines levels as shared contracts between
firmware and application.

A level definition contains:

-   mode/game identity
-   level number
-   difficulty information
-   tasks
-   task parameters
-   success conditions
-   star thresholds
-   feedback configuration

The immediate firmware migration should use built-in definitions.

BLE content delivery can be added after the core architecture is stable.

The architecture must keep level definitions separate from game
execution code so that future authored content does not require firmware
rewrites.

------------------------------------------------------------------------

# 32. Results and Progression

Robot:

``` text
temporary result
```

App:

``` text
persistent result/progression
```

The robot may retain multiple unsynchronized session results.

The intended future sync behavior is:

-   offline banking
-   keep-best merge
-   idempotent synchronization
-   no duplicate progression from repeated sync

The detailed persistence format is outside the first firmware migration.

------------------------------------------------------------------------

# 33. BLE and ESP-NOW Coexistence

BLE and ESP-NOW operate concurrently on the ESP32-S3 radio.

The architecture therefore treats them as independent communication
managers:

``` text
BleManager
EspNowManager
```

Neither manager owns the robot state machine.

Neither communication callback directly drives motors.

A coexistence test is mandatory before relying on high-rate telemetry
during gameplay.

Test at minimum:

1.  BLE connected, no ESP-NOW input.
2.  ESP-NOW remote active, BLE connected.
3.  RC mode with both links active.
4.  Driving Pro with remote joystick and BLE telemetry.
5.  Repeated BLE notifications while remote input is active.
6.  Remote link loss during BLE connection.
7.  BLE disconnect during active RC.
8.  BLE disconnect during active game.

The objective is to verify that neither communication path starves the
other and that safety behavior remains deterministic.

------------------------------------------------------------------------

# 34. Non-Blocking Design Rule

The migrated firmware must avoid long blocking operations in:

-   BLE callbacks
-   ESP-NOW callbacks
-   game update functions
-   telemetry generation
-   sensor loops

Communication callbacks should enqueue events.

Time-based behavior should use:

``` cpp
millis()
```

or an appropriate scheduler rather than long `delay()` calls.

Short hardware initialization delays are acceptable during startup.

------------------------------------------------------------------------

# 35. Error Handling and Safety Priority

The priority hierarchy is:

``` text
SAFETY
  >
MOTOR STOP
  >
STATE TRANSITION
  >
GAME LOGIC
  >
TELEMETRY
  >
COSMETIC FEEDBACK
```

If a collision/safety condition requires a stop, a game cannot override
it merely because the task wants the robot to continue.

A telemetry failure must never prevent the robot from stopping.

A display failure must never prevent motor safety.

A BLE failure must never leave motors uncontrolled.

------------------------------------------------------------------------

# 36. Configuration Ownership

Hardware constants must live in configuration files.

Examples:

``` cpp
PIN_BUZZER
PIN_STRIP
NUM_STRIP_PIXELS
PIN_STBY
PIN_PWMA
PIN_AIN1
PIN_AIN2
PIN_PWMB
PIN_BIN1
PIN_BIN2
PIN_TRIG
PIN_ECHO
PIN_SDA
PIN_SCL
PIN_MUX_S0
PIN_MUX_S1
PIN_MUX_S2
PIN_MUX_S3
PIN_MUX_SIG
PIN_TOUCH
PIN_BATTERY
PIN_ENC_LEFT
PIN_ENC_RIGHT
```

Protocol constants must live separately.

Game tuning constants must live separately from hardware constants.

This prevents the classic embedded-systems ritual of changing one
threshold and accidentally modifying three unrelated behaviors.

------------------------------------------------------------------------

# 37. PlatformIO Build Configuration

The existing working configuration is retained as the starting point.

Important current configuration:

``` ini
[env:esp32s3_dev]
platform = espressif32
framework = arduino
board = esp32-s3-devkitc-1

upload_port = /dev/ttyUSB0
monitor_port = /dev/ttyUSB0
upload_speed = 921600
monitor_speed = 115200

board_upload.flash_size = 16MB
board_build.flash_mode = qio
board_build.f_flash = 80000000L
board_build.psram_type = opi
board_build.arduino.memory_type = qio_opi

build_flags =
    -DBOARD_HAS_PSRAM
    -DARDUINO_USB_CDC_ON_BOOT=0
    -DARDUINO_RUNNING_CORE=1
    -DARDUINO_EVENT_RUNNING_CORE=1

board_build.partitions = app3M_fat9M_16MB.csv
```

The currently validated peripheral libraries are:

``` text
Adafruit GFX
Adafruit NeoPixel
Adafruit SSD1306
ArduinoJson
```

Additional libraries must be added only when actually required.

The existing project has already successfully flashed the physical
ESP32-S3 with this PlatformIO configuration. That working baseline must
be preserved before migration.

------------------------------------------------------------------------

# 38. Versioning Rules

Firmware protocol version and firmware implementation version are
separate.

Example:

``` text
firmware: 4.0.0
protocol: 1.0
```

Increment protocol version when wire-level contracts change
incompatibly.

Increment firmware version when firmware behavior changes.

All future BLE contract changes must update this document before
implementation.

------------------------------------------------------------------------

# 39. Migration Strategy

Migration must preserve the current working firmware while introducing the new control-ownership architecture. Do not rewrite the whole sketch and architecture simultaneously. That is how perfectly good robots acquire mysterious new personalities.

## Phase 0 --- Freeze the known-good baseline

1. Commit the current PlatformIO project.
2. Tag it `baseline/platformio-working`.
3. Preserve the currently working hardware configuration and sample flashing setup.
4. Record the exact legacy firmware commit/source used for comparison.

## Phase 1 --- Import the legacy firmware unchanged

1. Copy the existing known-good sketch into `src/main.cpp`.
2. Resolve only PlatformIO/compilation differences.
3. Flash the real ESP32-S3.
4. Verify BLE, ESP-NOW, motors, sensors, OLED, NeoPixels, buzzer, and Colour Quest.
5. Commit as `legacy-import`.

No architecture changes are made in this phase.

## Phase 2 --- Extract configuration

Create `config/BoardConfig.h`, `ProtocolConfig.h`, and `GameConfig.h`. Move pin mappings, BLE UUIDs, thresholds, timing constants, and game constants without changing behavior.

## Phase 3 --- Extract hardware modules

Extract:

- MotorController
- SensorManager
- LedController
- DisplayController
- BuzzerController
- BatteryManager

Verify each extraction against the legacy build.

## Phase 4 --- Extract BLE

Create `BleManager` and `BleProtocol`. First preserve existing BLE behavior, then migrate the command contract toward:

- `client_ready`
- `rc_start`
- `rc_input`
- `rc_stop`
- `game_start`
- `game_input`
- `game_abort`
- telemetry/control commands

The mobile app must be updated in lockstep with protocol-version changes.

## Phase 5 --- Extract ESP-NOW

Create `EspNowManager` and `EspNowProtocol`.

Keep radio reception independent from control ownership. The ESP-NOW layer receives and validates packets; `ControllerManager` decides whether they may affect the robot.

## Phase 6 --- Introduce ControllerManager and ownership arbitration

Implement the central rule:

```text
BLE connected -> MOBILE
BLE disconnected + remote connected -> REMOTE
Neither -> NONE
```

At this phase implement:

- safe ownership transitions
- stale-input invalidation
- motor stop on ownership loss
- remote input suppression while BLE is connected

This is the most important behavioral change from the previous architecture.

## Phase 7 --- Introduce local OLED menu

When `owner == REMOTE`, display:

```text
> Game Mode
  Free Ride Mode
```

Implement remote joystick navigation and primary/back buttons.

Add the following local flow:

```text
Local Menu
  ├── Free Ride -> RC
  └── Game Mode
       ├── Game selection
       ├── Level selection
       ├── Instructions
       └── Game
```

## Phase 8 --- Introduce GameManager/GameEngine

Create the game abstraction and route all game input through normalized `InputEvent`.

The GameEngine must not know whether the input came from BLE or ESP-NOW.

## Phase 9 --- Migrate Colour Quest

Move the existing Colour Quest state machine into the GameEngine abstraction. Verify:

- mobile play via BLE
- remote-only play via OLED + ESP-NOW
- scoring
- task progression
- feedback
- result reporting

## Phase 10 --- Implement Driving Pro L1

Implement the documented Level 1 tasks and verify both mobile and remote-only play.

## Phase 11 --- Telemetry Manager

Move telemetry generation out of the main control logic. Telemetry is an observation stream and must never become a hidden control path.

## Phase 12 --- Coexistence and failure testing

Test at minimum:

1. BLE only -> mobile ControlPanel.
2. Remote only -> OLED local menu.
3. Neither -> IDLE.
4. BLE + remote -> mobile owns all control.
5. Connect BLE while remote Free Ride is active.
6. Connect BLE while remote game is active.
7. Disconnect BLE while remote is connected.
8. Disconnect BLE while mobile RC is active.
9. Disconnect BLE while mobile game is active.
10. Remote timeout during local Free Ride.
11. Remote timeout during local game.
12. BLE reconnect after remote-only session.
13. Stale BLE joystick after disconnect.
14. Stale ESP-NOW joystick after BLE connect.
15. Motor safety under every ownership transition.

The migration is not complete until the ownership matrix and transition tests pass.

---

# 40. Git Checkpoint Strategy

Recommended tags:

``` text
v0.1.0-baseline-platformio
v0.2.0-legacy-import
v0.3.0-hardware-modules
v0.4.0-ble-module
v0.5.0-espnow-module
v0.6.0-state-machine
v0.7.0-game-manager
v0.8.0-colour-quest
v0.9.0-driving-pro
v1.0.0-new-architecture
```

Do not create a giant "refactor everything" commit.

Each phase should be independently buildable whenever practical.

------------------------------------------------------------------------

# 41. Definition of Done for the Migration

The new architecture is considered operational when all of the following are true:

- PlatformIO build is reproducible.
- Firmware flashes to the real ESP32-S3.
- BLE connects using the defined NUS service/characteristics.
- Mobile ControlPanel can start RC and send joystick movement.
- Mobile ControlPanel/game UI can start a game and send game input.
- Mobile game results are reported correctly.
- ESP-NOW remote connects and sends validated input.
- With BLE absent, OLED shows the local Game Mode / Free Ride Mode menu.
- Remote can navigate and select the local menu.
- Remote can drive Free Ride without the mobile app.
- Remote can select and complete a game without the mobile app.
- OLED presents sufficient instructions and gameplay feedback for local play.
- With BLE connected, ESP-NOW movement/menu/game commands have no control effect.
- BLE connection during remote operation safely transfers ownership to mobile.
- BLE disconnection safely transfers to remote menu when a remote is connected, otherwise IDLE.
- No stale input survives a controller transition.
- Safety stop always overrides controller/game input.
- Telemetry does not directly control the robot.
- Game logic is transport-agnostic.
- Remote contains no game rules.
- Mobile app contains no authoritative game scoring logic.
- Colour Quest works through both mobile and remote-only paths.
- Driving Pro Level 1 works through both mobile and remote-only paths.
- Git checkpoints exist for every migration phase.

---

# 42. Source and Compatibility Notes

This SSoT is based on the project's current software/design materials
and the working firmware baseline.

Relevant existing definitions include:

-   Elxie Software Design Brief
-   Elxie architecture planning
-   BLE JSON Contract v2
-   Existing merged ESP32-S3 firmware
-   Existing technical documentation

Important compatibility decisions made by this document:

1.  Standard NUS UUIDs used by the current working firmware are
    retained.
2.  The older custom BLE UUIDs in historical technical documentation are
    not part of the new protocol.
3.  BLE JSON remains newline-delimited.
4.  The robot has three top-level states: IDLE, RC, GAME.
5.  Game logic is robot-owned.
6.  ESP-NOW is the normal gameplay input path.
7.  BLE owns game lifecycle, telemetry viewing, synchronization, and
    configuration.
8.  Generic movement commands are forbidden from bypassing the GAME
    router.
9.  ESP-NOW gameplay packets are binary, not JSON.
10. The latest project planning terminology uses `reflex_arc`.
11. The current immediate Driving Pro L1 scope is the three-task
    definition documented above.
12. Persistent progression remains application-owned.

------------------------------------------------------------------------


## 42.1 Superseded control assumption

Earlier versions of this architecture treated ESP-NOW as the primary gameplay input and the mobile app mainly as a synchronization/data client. That assumption is superseded by version 1.1.0.

The current authoritative rule is:

> **BLE connected = Mobile App owns all control. BLE disconnected + ESP-NOW connected = Remote owns local control through the OLED menu. Neither connected = IDLE.**

This rule must be reflected consistently in the firmware, mobile app, and remote firmware before protocol implementation is considered complete.

# 43. Change Control

Any future change to:

-   BLE UUIDs
-   JSON keys
-   JSON message types
-   allowed enum values
-   ESP-NOW packet structure
-   joystick coordinate convention
-   controller ownership
-   robot state definitions
-   game IDs
-   telemetry schema

must first be updated in this document.

Then the corresponding firmware, mobile/web app, and remote firmware may
be changed.

The protocol must never be changed independently in one device and
"fixed later" in another. That is how distributed systems acquire
folklore instead of specifications.
