# Elxie - Software Design Brief

Application / Web platform & robot-side game-engine behaviour

Handoff document for the software development team · Scope: software only (firmware internals and electrical design out of scope, referenced where they define an interface) · Status: pre-implementation, for review

## READ THIS FIRST

This document describes what the software must do and where each responsibility lives, not how to implement it. It is deliberately implementation-agnostic on stack choices except where the product has already committed (BLE protocol, cross-platform app). Open decisions are called out in flagged boxes; treat them as questions for the team, not settled requirements.

## 1. System overview

Elxie is a three-device system: a robot, a physical remote, and a mobile/web app. The guiding principle is a clean split of responsibility:

- The robot runs the game. All real-time gameplay — reading sensors, driving motors and outputs, running a level, judging tasks, scoring — happens on the robot. It is self-contained, like a handheld game console.

- The app/web owns the record. Progression, unlocks, stars, best scores, the daily cap, accounts, and new content live in the software. The app is the save file and the content store, not the referee.

- The remote is an input/output peripheral. It sends control input and plays haptics; it holds essentially no game logic.

Consequence: a child can play fully without the phone. The phone, when connected, syncs results up and pushes new/unlocked content down.

## Two communication links

| Link         | Between         | Transport                 | Carries                                           | Latency need                                   |
| ------------ | --------------- | ------------------------- | ------------------------------------------------- | ---------------------------------------------- |
| Control link | Remote ↔ Robot  | ESP-NOW                   | Joystick + button input; haptic commands back     | Real-time (drives live motion & reflex timing) |
| Data link    | Robot ↔ App/Web | BLE (Nordic UART Service) | Results sync, content/unlock push, live telemetry | Non-real-time (game runs on robot)             |

The robot is the hub — both other devices talk to it, not to each other. The software team primarily owns the Data link and the app/web; the robot-side game-engine behaviour is described here because the app must mirror and depend on it, but its implementation sits with firmware.

## 2. Responsibility map — what lives where

| Component     | Owns                                                                                                                                                                                                                                                                                                       |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ROBOT**     | Live game engine (runs current level, judges the 10 tasks, tallies score, computes stars) · sensor reading & actuator control · the three top-level states (Pet / RC / Challenge) · built-in level definitions · the on-device menu (joystick + OLED) · **temporary** session results held until next sync |
| **REMOTE**    | Reads own joystick + buttons, streams state to robot · receives & plays haptic commands · minimal local state only                                                                                                                                                                                         |
| **APP / WEB** | **Persistent progression** (unlocks, stars, best scores, bond meter, daily-cap counter) · account & cloud storage · content authoring & delivery (push new/unlocked levels down) · rich UI (story, instructions, live sensor dashboard, Training view) · results merge logic                               |

## MENTAL MODEL

The robot is a handheld console. The app is the save file plus the store. Unplug the app and the console still plays — it just can't permanently save or download new content until the app reconnects.

## 3. The product's three sections

The top level of the experience is three sections, distinguished by state, not by a menu. Only Challenge is deliberately entered.

## ROBOT Pet mode — the idle default

When no one is driving and no challenge is active, the robot is a robotic pet: gentle movement, expressive face, and periodic "asks for a pet" moments. This is the retention engine — a toy that re-initiates engagement stays in use.

## DESIGN CONSTRAINTS (FIRMWARE, BUT SOFTWARE SHOULD BE AWARE)

- Edge safety: Pet mode must keep the bottom-edge IR sensors live at all times so the robot never wanders off a table.

- Battery: "runs everywhere" should mean mostly restful — occasional small movements, mostly expressive — not continuous roaming, or idle drains the battery.

- Ignored state: define behaviour when a pet request is ignored (recommend: sleep — undemanding, battery-saving, makes "waking it" rewarding).

## ROBOT RC mode — free drive

Triggered automatically when the remote is moved. No menu step: the input itself switches the robot from Pet into live RC driving. Uncapped, no scoring — the pure-play release valve.

## APP ROBOT Challenge mode — structured learning

The one section the child deliberately enters (via the on-device menu or the app). Holds four modes; the app owns the progression around them, the robot runs the play.

## 4. Challenge structure & scoring

All four modes share one uniform shape, which makes the content set fully countable: 4 modes × 6 levels × 10 tasks = 240 tasks.

- Each mode has 6 levels, grouped into 3 difficulty pairs (L1–L2, L3–L4, L5–L6). Each pair holds one difficulty stage, giving two levels of practice before escalation.

- Each level contains 10 tasks, escalating easy→hard within the level.

- Stars = average success across the 10 tasks. Suggested cut-offs (tune later): ★★★ ≥ 90%, ★★ ~ 70%, ★ ~ 50%.

## The four modes

| Mode         | L1–L2                                                            | L3–L4                                     | L5–L6                                     |
| ------------ | ---------------------------------------------------------------- | ----------------------------------------- | ----------------------------------------- |
| Colour Quest | Single primary colour — select the shown colour                  | Secondary colours — pick the odd one out  | Beyond primary/secondary                  |
| Echo Memory  | Single-colour direction sequence (L/R/up/down), echo on joystick | Mixed colours                             | Harder / longer sequences                 |
| Driving Pro  | Basic driving tasks (straight, no collision, one turn…)          | Directional tasks (N / E / S / W)         | Real parking (parallel, H-drive, turning) |
| Reflex Dash  | Single-colour alert / safe point                                 | Two colours (green go / red stop by side) | 3+ colours                                |

## OPEN — DRIVING PRO SCORING

Colour/sequence/reflex tasks judge cleanly as right/wrong. Driving Pro tasks are judgement calls — "how straight is straight," "how aligned is parked." Each of its tasks needs an explicit numeric success threshold (heading tolerance, alignment tolerance, collision distance) defined against real sensor readings before its levels can be authored. This mode carries most of the scoring-design effort.

## OPEN — CONFIRM BEFORE AUTHORING

- Reflex Dash L1–L2: exactly how many colours are in play (one meaning, or alert + safe point)?

- Within-level average: consider weighting later tasks or dropping the lowest so a child who ends competent isn't dragged down by early learning attempts.

- Task count should flex down for young players / easy-assist — 10 tasks may exceed the 2–5 min target.

- Secret Codes (a fifth mode explored earlier) is currently dropped from the Challenge set — confirm this is intentional.

## 5. The level definition — the shared contract

The single most important data object. The robot runs levels but the web can create and unlock them, so both sides must agree on one compact, parameterised format. If defined well, the robot ships with the built-in 240 tasks and can accept new levels over BLE with no firmware reflash — preserving extensibility with logic on-device.

Conceptually, a level definition contains:

- Identity: mode, level number, difficulty pair

- Tasks (~10): each task = what is shown/asked · what counts as a correct response · difficulty parameters

- Star thresholds: the average-success cut-offs

- Feedback map: what OLED / LEDs / buzzer / remote-haptic do on pass, fail, and level-win

## ACTION

Agree this schema jointly (app + firmware) as the first deliverable. Everything else — authoring tools, sync, the on-device runner — depends on it.

## 6. Data flows

High-frequency, tiny, stateless messages. Owned by firmware; listed for completeness.

- Remote → Robot: joystick vector (direction + magnitude, or discrete direction for 4-option games); button states.

- Robot → Remote: haptic commands (buzz, pattern, intensity) — e.g. wrong-answer buzz, rising rumble near a curb.

## Data link — BLE / NUS (Robot ↔ App/Web)

Lower-frequency, richer. This is the software team's primary integration surface. Three exchange types:

| Exchange                  | Direction   | When                                  | Payload                                                                                                                                           |
| ------------------------- | ----------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Results sync**          | Robot → App | On connect / session end              | Levels played, stars, scores, best times — accumulated across offline sessions. App merges into the permanent record (keep-best).                 |
| **Content / unlock push** | App → Robot | On connect / after progression change | Newly unlocked level definitions, updated difficulty / easy-assist params, new authored content.                                                  |
| **Live telemetry**        | Robot → App | Only while app shows sensor data      | Real-time sensor stream (distance, heading, line array, sound, etc.) for the dashboard / Training view. The only real-time BLE traffic; optional. |

The existing prototype's protocol stands: Nordic UART Service, newline-delimited JSON. Service 6e400001-… , RX (app→robot) …0002 , TX (robot→app) …0003 . What has changed from the original brief: the app no longer sends game commands during play — the robot runs the game — so BLE's role shifts toward sync + content + telemetry.

## Example session flow

- 1. Robot idle → Pet mode (edge-safe, asks for pets).

- 2. Child moves remote → ESP-NOW input → robot switches to RC mode, drives live.

- 3. Child uses OLED menu → enters Challenge → Colour Quest → L1.

- 4. Robot loads L1's 10 tasks, runs them (shows colour, reads joystick over ESP-NOW, judges each, buzzes on wrong, tallies, computes stars) — phone not required.

- 5. Results held in temporary memory.

- 6. Later, app connects over BLE → robot syncs results up → web updates progression, bond meter, daily-cap count → app pushes down any newly unlocked levels.

## 7. Progression, daily cap & easy-assist

- Progression (unlocks, stars, best scores, bond meter) is owned by the app/web and is the persistent source of truth.

- Daily cap restricts only the introduction of new levels — Pet, RC, Training, replays, and star-chasing on cleared levels remain always available. Framing is mastery-pacing (retention), not screen-time limiting: engagement stays high, learning is paced.

- Easy-assist is a global difficulty dial (looser timers, slower robot, fewer/dimmed star goals) so one content set serves ages 5–12. Consider making it adaptive to demonstrated mastery rather than a fixed toggle.

## OPEN — WHERE THE CAP IS ENFORCED

Progression lives online, but levels run offline on the robot. Decide: (a) robot enforces the cap from a locally-cached counter (works offline, robot says "no more today"), or (b) cap is soft offline and reconciles at next sync. This must be settled before building the cap.

## 8. Sync & offline behaviour

- Offline banking: the robot must hold results from multiple sessions between syncs. With bounded memory, define an overflow rule — recommend keep-best-per-level, since that is all progression consumes.

- Merge rule: on sync, reconcile offline and online records by keeping the best score/stars per level, so neither clobbers the other.

- Idempotent sync: a dropped/repeated sync must not double-count or lose progress.

## 9. App / Web platform scope

## Must-have (aligned to MVP thinking)

- Connect & pair (BLE auto-scan; robot visibly "wakes" on connect; first-run name + tutorial)

- Dashboard with live sensor readout + mode selection

- Challenge UI: mode → level → results (stars, score, best), progression & bond meter

- Results sync + content/unlock push + merge logic

- Persistent per-child progression storage (web/cloud)

- Daily-cap logic and easy-assist settings

## Later / post-MVP

- Level authoring tools (create new level definitions to push down)

- Story / narrative layer, cosmetic unlock management

- OTA firmware update delivery

## 10. Cross-cutting technical flags

## RADIO COEXISTENCE

ESP-NOW and BLE share the ESP32-S3 radio. Running both at once (live control + telemetry during Challenge) has real coexistence/timing constraints. Recommend an early firmware spike to confirm the robot can serve remote and app simultaneously without one starving the other. This affects whether the app can show live telemetry during active play.

## REMOTE PAIRING / IDENTITY

ESP-NOW peers by MAC address. Design a one-time pairing step so a remote is bound to its robot — important if multiple units share a household. The app is the natural place to drive/assist pairing.

## SENSOR RELIABILITY UNDER SUNLIGHT

The IR reflectance sensors (line, edge, floor-reading) are affected by ambient IR / sunlight; the ultrasonic sensor is not. Edge sensing is a safety path. Firmware should implement ambient-subtraction and a graceful-degradation state ("readings unreliable — stop/warn"). The app should surface this state to the user rather than letting the robot behave unpredictably. Recommend an early bench test to find the light level at which edge sensing becomes unreliable.

## 11. First deliverables (suggested order)

- 1. Level-definition schema — agreed jointly by app + firmware (Section 5). Everything depends on it.

- 2. BLE sync contract — the three exchanges in Section 6, including merge/idempotency rules.

- 3. Radio-coexistence spike — resolves whether live telemetry during play is viable.

- 4. Driving Pro success thresholds — unblocks authoring the hardest-to-score mode.

- 5. Daily-cap enforcement decision — online-soft vs robot-enforced.

This is a rough design brief for team review, not a final specification. Flagged boxes mark decisions still open; resolve them collaboratively before the corresponding work begins.
