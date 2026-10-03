# Game: Echo Memory

The game echo memory is intended to test the users memory power. In the game the robotoy illuminates some colours one after the other in a sequence. The user have to remember the colours in correct sequence order. Each colour represents a assigned action like honk, pet, up, down, left, right. The user has to then perform those actions in correct sequence order.

Echo Memory is implemented directly in the ESP32-S3 firmware as a dedicated game engine.

The actions are:

| Action ID | Action | Fixed color |
| --------: | ------ | ----------- |
|         0 | UP     | Red         |
|         1 | RIGHT  | Yellow      |
|         2 | DOWN   | Green       |
|         3 | LEFT   | Blue        |
|         4 | PET    | Purple      |
|         5 | HONK   | White       |

Levels 1–3 use only the first four directional actions.
Levels 4–6 use all six actions.

Easy: In levels 1 to 3, colours are illuminated on its assigned region only, the whole strip is not illuminated.

Medium: In level 4 and 5, whole strip illuminates the colour sequences, user must remember the colours in sequence and then do the actions in that sequence.

Hard: In level 6, the color-action mapping is assigned dynamically. The colour assigned is from the above listed colours only. No external colours are used. The dynamically assigned colour mapping is sent to frontend. Frontend displays the colour-action mapping for some time. User have to study the mapping within a limited time period like 5 seconds.

The game uses maximum sequence length 7.

level 1 generate 4 sequences.
level 2 generate 5 sequences.
level 3 generate 6 sequences.

Levels 1 to 3 are easy.

level 4 generate 5 sequences.
level 5 generate 6 sequences.

Levels 4 and 5 are medium.

level 6 is hard, generate 5 sequences, otherwise it would become impossible to win.

Level table:

| Level | Sequence length | Flash interval | Actions | LED mode   | Mapping |
| ----: | --------------: | -------------: | ------: | ---------- | ------- |
|     1 |               4 |          3.0 s |       4 | Regional   | Fixed   |
|     2 |               5 |          1.5 s |       4 | Regional   | Fixed   |
|     3 |               6 |          1.5 s |       4 | Regional   | Fixed   |
|     4 |               5 |          3.0 s |       6 | Full strip | Fixed   |
|     5 |               6 |          1.5 s |       6 | Full strip | Fixed   |
|     6 |               5 |          1.5 s |       6 | Full strip | Dynamic |

---

Levels 1–5 use the fixed identity mapping:

```text
UP     → Red
RIGHT  → Yellow
DOWN   → Green
LEFT   → Blue
PET    → Purple
HONK   → White
```

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

There should be a flash interval between illuminating colours in sequence, otherwise if same colours are illuminated in adjacent sequence order, user will not be able to differentiate without the interval gap.

## JSON Contract

### Game start

Mobile → ESP32:

```json
{
  "v": 1,
  "type": "command",
  "command": "game_start",
  "id": "game-001",
  "payload": {
    "gameId": "echo_memory",
    "level": 1
  }
}
```

ESP32 response:

```json
{
  "v": 1,
  "type": "response",
  "response": "game_started",
  "id": "game-001",
  "payload": {
    "gameId": "echo_memory",
    "level": 1,
    "status": "started",
    "mapping": {
      "up": "red",
      "right": "yellow",
      "down": "green",
      "left": "blue"
    }
  }
}
```

The response should be contain real mapping values, especially for 6th level colour-action mapping happens dynamically at the start of a level.

The protocol must not prevent future levels from being added.

After recieving the mapping from the response the mapping is shown to the user in UI untill the user clicks the 'GO' button. The game shouldn't start the execution untill user sends the run_seq command. On clicking the GO button the run_seq command is sent and the mapping table is disappeared from UI and the control buttons are shown.

Mobile -> ESP32

```json
{
  "v": 1,
  "type": "command",
  "command": "run_seq",
  "id": "game-001",
  "payload": {
    "gameId": "echo_memory",
    "level": 1
  }
}
```

---

### Game events

Mobile -> Robot answering uses same joystick input to answer:

```json
{
  "v": 1,
  "type": "input",
  "id": "input-1001",
  "ts": 123456789,
  "payload": {
    "inputType": "joystick",
    "dir": "up"
  }
}
```

```json
{
  "v": 1,
  "type": "command",
  "command": "honk",
  "id": "command-1001",
  "ts": 123456789
}
```

Robot -> Mobile after each task is answered by the user:

```json
{
  "v": 1,
  "type": "response",
  "response": "game_feedback",
  "gameId": "echo_memory",
  "level": 1,
  "taskId": 1,
  "correct": true,
  "correctCount": 1
}
```

---

### Game result

Robot → Mobile after a mobile game completes, or later during result synchronization for a remote-only game:

```json
{
  "v": 1,
  "type": "response",
  "response": "game_result",
  "gameId": "echo_memory",
  "level": 1,
  "score": 5,
  "stars": 3,
  "tasksCompleted": 5,
  "tasksTotal": 5
}
```

---

### Game abort

```json
{
  "v": 1,
  "type": "command ",
  "command": "game_abort",
  "id": "abort-001",
  "payload": {}
}
```

ESP32 must safely stop active game movement and return to the
appropriate non-game state.

---

## ESP-NOW Compatibility

While playing the game using esp-now remote, map the normal directional inputs to appropriate regions and validate the answer. For the honk functionality use the btn1's input from remote.
Show the colour-action mapping on the OLED Display on start of level. When user again presses the same select button(i.e, "sw") the level start running. This behaviour is similar to that of Mobile based implementation.

## Common Rule

While playing the game via any controller(Mobile or ESP-NOW remote), the input shouldn't be taken while the game is flashing the sequence of lights. After flashing all sequence of lights in that level, pause for 3 sec and then user can start giving input one by one. On each input user is giving robotoy will respond if the input is correct in that sequence or not. Finally the result is published.

---
