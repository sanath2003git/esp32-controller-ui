# Implement Colour Quest in Robo Toy Controller

You are a coding agent working directly in the existing Robo Toy Controller repository. Implement the **first playable game, Colour Quest**, by inspecting and extending the current architecture. Keep the change focused. Do not rewrite unrelated code or create duplicate infrastructure.

## 1. First inspect the repository

Before coding, identify and reuse the existing:

- Playground/game components and routes
- Game/Mode cards and level UI
- BLE context/provider/hooks and message handling
- Authentication/user identity
- Database/ORM and server actions/API patterns
- UI components, modal, progress bar, toast, loading/error patterns
- TypeScript conventions and test setup

Do not create a second BLE provider, auth system, database abstraction, or duplicate UI infrastructure.

The project documentation says the browser communicates directly with the ESP32-S3 over BLE, with existing BLE handling and game/challenge pages already present. Treat the actual repository as the source of truth for implementation details.

## 2. Scope

Implement **only Colour Quest**.

There are four planned games:

- Colour Quest
- Echo Memory
- Driving Pro
- Reflex Dash

Do not implement the other three games, but make generic progression components/business logic reusable for them later.

Colour Quest has 6 levels:

| Levels | Difficulty | Concept                                        |
| ------ | ---------- | ---------------------------------------------- |
| L1-L2  | Easy       | Single primary colour, select the shown colour |
| L3-L4  | Medium     | Secondary colours, pick the odd one out        |
| L5-L6  | Hard       | Beyond primary/secondary                       |

Each level is executed by the RoboToy. The web app does **not** simulate tasks or calculate task correctness.

## 3. Responsibilities

Robot/firmware owns:

- Running the level/tasks
- Sensor and joystick input
- Judging tasks
- Calculating final score

Web app owns:

- Starting the selected level
- Receiving the final score
- Calculating/displaying stars
- Persisting user progress
- Best score/stars
- Level unlocking
- Game progress UI

Do not invent a frontend simulation of the robot game.

## 4. BLE protocol

Use the existing BLE implementation and existing UUID/configuration. Do not duplicate or replace it.

Communication standard:

- UTF-8 JSON
- One JSON object per line (`\n`) using NDJSON-style framing
- JSON semantics conform to RFC 8259
- Define/validate message structures using JSON Schema Draft 2020-12 where practical
- Do **not** introduce JSON-RPC

### Start command

When a user starts a Colour Quest level:

```json
{ "command": "challenge", "game": "color-quest", "level": 1 }
```

For another level, change only `level`.

Create/reuse strongly typed protocol definitions:

```ts
type ColorQuestStartCommand = {
  command: "challenge";
  game: "color-quest";
  level: number;
};

type ColorQuestResult = {
  type: "response";
  game: "color-quest";
  score: number; // 0..1
};
```

Validate the incoming message before processing it.

A valid result is:

```json
{ "type": "response", "game": "color-quest", "score": 0.75 }
```

Reject/ignore malformed messages, scores outside `0..1`, and responses for other games.

Do not modify the existing BLE protocol unnecessarily. Keep the implementation compatible with the current contract.

## 5. Game flow

Implement:

```text
Playground
  → Colour Quest
  → Level Selection
  → Select unlocked level
  → Start
  → Send BLE challenge command
  → Waiting/Playing state
  → Receive robot result
  → Validate result
  → Calculate stars
  → Persist result
  → Show result modal
  → Return to level selection
```

Use an explicit state model such as:

```ts
"idle" | "starting" | "playing" | "completed" | "error";
```

Prevent double-starts while starting/playing.

Handle BLE send failure, disconnect, timeout, invalid response, and duplicate response.

Do not repeatedly resend commands automatically.

## 6. Stars

Use these exact product requirements:

```text
score >= 0.80 → 3 stars
score >= 0.60 → 2 stars
score >= 0.40 → 1 star
score <  0.40 → 0 stars
```

Implement as one reusable pure function:

```ts
calculateStars(score: number): 0 | 1 | 2 | 3
```

Test boundaries: `0`, `0.39`, `0.40`, `0.59`, `0.60`, `0.79`, `0.80`, `1`.

Note: the Elxie design brief contains older suggested thresholds of approximately 90/70/50%. Ignore those for this task. The current requirement is 80/60/40.

## 7. Level unlocking

Initial state:

```text
L1 unlocked
L2 locked
L3 locked
L4 locked
L5 locked
L6 locked
```

Rule:

> The next level unlocks only when the previous level has earned 3 stars.

Therefore:

```text
L1 3★ → L2 unlocks
L2 3★ → L3 unlocks
L3 3★ → L4 unlocks
L4 3★ → L5 unlocks
L5 3★ → L6 unlocks
```

Fewer than 3 stars does not unlock the next level.

Completed levels can be replayed.

Never downgrade stored progress:

- `bestScore = max(oldScore, newScore)`
- `stars = max(oldStars, newStars)`

Do not create duplicate progress records.

Prefer deriving unlock state from authoritative progress rather than maintaining unnecessary duplicated `isUnlocked` flags.

## 8. Database/persistence

Inspect the existing database first.

If authentication/database already exists, integrate with it.

If not, add the minimum required persistent model for per-user game progress using the project's existing stack.

The logical data should support:

```text
Game
GameLevel
UserGameProgress
UserLevelProgress
```

At minimum, level progress needs:

- user
- game/level
- best score
- stars
- attempt count
- timestamps

Use unique constraints to prevent duplicate user-level progress.

Do not trust client-supplied:

- userId
- stars
- unlock state
- game progress

The server must identify the authenticated user, validate the game/level/score, calculate stars, update best results, determine unlocking, and return authoritative progress.

If the repository has an established server-action/API pattern, use it instead of creating a new one.

## 9. Game progress

Show Colour Quest progress in its Game ModeCard.

Recommended calculation:

```text
completedLevels / 6
```

Display an appropriate percentage/progress bar using existing project UI.

Do not break the other three game cards. If their progress is not implemented, safely display their existing empty/default state.

## 10. Level selection UI

Create/reuse the project's level-selection pattern.

Show six levels with:

- level number
- difficulty
- locked/unlocked state
- stars
- best score where appropriate
- completion state

Locked levels must not be startable.

Example:

```text
Level 1
Easy
★★★
Best: 85%
```

A locked level should explain that the previous level requires 3 stars.

Use the existing design system and mobile-first layout.

## 11. Result modal

After a valid robot result, show:

- level completed
- percentage score
- awarded stars
- best result if appropriate

Then allow navigation back to level selection.

Use/reuse a generic result modal if the project has one. Avoid Colour Quest-specific duplication where the concept is generic.

## 12. Error handling

Handle at minimum:

- BLE not connected before start
- BLE send failure
- BLE disconnect during a level
- robot response timeout
- malformed JSON
- wrong message type/game
- score outside `0..1`
- duplicate result
- database failure
- authentication failure

Never generate a fake score.

Never display "completed" unless a valid robot result was received.

If saving fails, do not claim that progress was persisted.

## 13. Architecture requirements

Prefer reusable domain logic:

```text
calculateStars()
calculateGameProgress()
isLevelUnlocked()
mergeBestScore()
mergeBestStars()
```

Centralize Colour Quest level metadata rather than hardcoding it across components.

Use strict TypeScript. Do not use `any` to bypass typing.

Keep BLE event handling centralized through the existing BLE architecture.

Keep database mutations out of presentational components.

Do not introduce unnecessary dependencies.

Do not modify existing movement, stop, RGB, OLED, telemetry, device-info, or connection functionality.

## 14. Testing

Add focused tests for:

1. Star thresholds and boundary values.
2. Initial L1 unlock state.
3. Sequential 3-star unlocking.
4. Failure to unlock with 0/1/2 stars.
5. Best-score preservation.
6. Highest-star preservation.
7. Invalid BLE result rejection.
8. Wrong-game result rejection.
9. Duplicate result handling.
10. Progress calculation.

Use the repository's existing test framework and conventions.

## 15. Implementation strategy

Work incrementally:

1. Inspect repository and existing architecture.
2. Identify exact files/components/services to reuse.
3. Implement domain/progression logic.
4. Add/update database schema and seed data if required.
5. Add typed Colour Quest BLE handling.
6. Implement level-selection and game-start UI.
7. Implement result handling/modal.
8. Connect persistence and authoritative progression.
9. Add tests.
10. Run the project's lint, typecheck, tests, and production build.
11. Fix errors/regressions.

Do not stop after writing a plan. Implement the feature.

## 16. Final verification

Before finishing, verify this end-to-end scenario:

```text
New user
→ Colour Quest
→ L1 is unlocked
→ L2-L6 are locked
→ Start L1
→ BLE sends:
   {"command":"challenge","game":"color-quest","level":1}
→ Robot returns:
   {"type":"response","game":"color-quest","score":0.75}
→ score displayed as 75%
→ 2 stars awarded
→ L2 remains locked
→ progress is persisted
→ replay L1 with 0.85
→ best score becomes 0.85
→ stars become 3
→ L2 unlocks
→ refresh page
→ progress remains correct
```

Also verify that existing robot controller/BLE functionality remains intact.

## 17. Output

After implementation, report only:

- What was implemented
- Files created/modified
- Database changes
- BLE integration
- Tests/verification results
- Any unresolved issue or repository limitation

Do not claim success if typecheck, tests, migration, or build fail.

Keep the implementation focused on Colour Quest. Build reusable foundations only where they are genuinely required for the four-game architecture.
