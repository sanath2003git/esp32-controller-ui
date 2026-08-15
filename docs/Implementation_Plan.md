I reviewed the attached HTML. It already proves the basic BLE flow: it filters for your custom service UUID, connects to the GATT server, obtains a characteristic, enables notifications, parses incoming JSON, and writes JSON commands back to the ESP32.  It also already has the RGB command flow using JSON such as `{"command":"color","r":255,"g":0,"b":0}`. 

The existing HTML is therefore useful as our BLE proof-of-concept, but it is not yet the architecture your client needs.

## 1. Target architecture

I recommend separating the application into four logical layers:

```text
Next.js PWA
│
├── UI Layer
│   ├── Home
│   ├── Profile
│   ├── Mode selection
│   ├── Training
│   ├── Challenges
│   ├── Level
│   └── Control panel
│
├── Application State
│   ├── Player profile
│   ├── Connected robot
│   ├── Current mode
│   ├── Current challenge
│   └── Game state
│
├── BLE Layer
│   ├── Scan / connect
│   ├── GATT service
│   ├── Command TX
│   ├── Telemetry RX
│   ├── Device info
│   └── Disconnect/reconnect
│
└── Protocol Layer
    ├── JSON commands
    ├── JSON responses
    ├── Telemetry
    ├── Device information
    └── Game events
```

The ESP32 side becomes:

```text
ESP32-S3
│
├── BLE Server
│
├── Command Handler
│   ├── movement
│   ├── mode
│   ├── challenge
│   ├── LED
│   └── future hardware commands
│
├── Telemetry Generator
│   ├── battery
│   ├── sensor state
│   ├── collision
│   └── logs
│
├── Game/Challenge Logic
│
└── Hardware abstraction
    ├── motors
    ├── sensors
    ├── LEDs
    └── buzzer
```

For the prototype, the hardware abstraction functions can simply print:

```cpp
Serial.println("[MOCK] Motor moving forward");
```

and manipulate the RGB LED. Later, those functions can be replaced with actual motor/sensor implementations without rewriting the BLE protocol.

That is the right separation of concerns.

## 2. BLE protocol

I recommend that we stop using one generic characteristic for everything.

We'll eventually have:

```text
MAINBOT SERVICE
│
├── Command Characteristic
│   Web → ESP32
│   WRITE
│
└── Event/Telemetry Characteristic
    ESP32 → Web
    NOTIFY
```

Potentially later:

```text
MAINBOT SERVICE
│
├── Command       WRITE
├── Telemetry     NOTIFY
├── Device Info   READ
└── Game State    NOTIFY
```

But for the first implementation, two characteristics are enough.

### ESP32 → Web immediately after connection

```json
{
  "type": "device_info",
  "deviceId": "7c:4f:ad:21:43:40",
  "name": "MAINBOT",
  "model": "ESP32-S3-N16R8",
  "firmware": "0.1.0",
  "battery": 87
}
```

For now `battery` can be mocked.

### ESP32 → Web periodically

Every 1 or 2 seconds:

```json
{
  "type": "telemetry",
  "battery": 87,
  "speed": 42,
  "sensors": {
    "front": false,
    "left": false,
    "right": false,
    "collision": false
  }
}
```

### Web → ESP32

Movement:

```json
{
  "type": "command",
  "id": "cmd-001",
  "command": "move",
  "direction": "forward"
}
```

Stop:

```json
{
  "type": "command",
  "id": "cmd-002",
  "command": "stop"
}
```

Game:

```json
{
  "type": "command",
  "id": "cmd-003",
  "command": "start_challenge",
  "mode": "challenge",
  "level": 1
}
```

### ESP32 → Web response

```json
{
  "type": "response",
  "id": "cmd-003",
  "status": "success"
}
```

### Game event

When a mocked collision occurs:

```json
{
  "type": "game_event",
  "event": "collision",
  "status": "failed"
}
```

The UI can immediately turn that into:

```text
GAME OVER!
Challenge Failed
```

This gives us a protocol that can survive the transition from "fake sensors" to actual sensors.

## 3. Application pages

Your requirements translate into this route structure:

```text
/
├── Home
│
├── profile
│   └── Player + robot information
│
├── modes
│   └── Mode selection
│
├── modes/[mode]
│   ├── Training
│   └── Challenges
│
├── modes/[mode]/training
│   └── Control panel
│
└── modes/[mode]/challenges
    ├── Level selection
    └── Level/[level]
        ├── Game UI
        ├── Control panel
        ├── Timer
        ├── Telemetry
        └── Game-over state
```

For the prototype, we can simplify some routes initially, but this is the conceptual structure.

## 4. Home screen

The fixed mobile header should contain something like:

```text
┌──────────────────────────────┐
│ 🤖 MAINBOT        ● Connected │
│ Player: Abhaj                 │
│ Robot: 7C:4F:AD:21:43:40      │
├──────────────────────────────┤
│                              │
│        SELECT MODE            │
│                              │
│ ┌──────────────────────────┐ │
│ │ 🚗 Speed Drive            │ │
│ │ Master the movement       │ │
│ └──────────────────────────┘ │
│                              │
│ ┌──────────────────────────┐ │
│ │ 🎯 Challenge Arena        │ │
│ │ Test your driving skills │ │
│ └──────────────────────────┘ │
│                              │
│ ┌──────────────────────────┐ │
│ │ 🏁 Robot Training        │ │
│ │ Practice freely           │ │
│ └──────────────────────────┘ │
│                              │
└──────────────────────────────┘
```

We'll make it gaming-oriented rather than looking like an enterprise IoT dashboard. The existing HTML is currently more "industrial control panel"; it has a dark gradient, cards and connection indicator, but we'll evolve that visual language considerably.  

## 5. Profile persistence

The first time a robot is connected:

```text
Connect robot
      ↓
Is player profile stored for this robot?
      │
 ┌────┴─────┐
 NO         YES
 │           │
 ▼           ▼
Setup      Load profile
 │           │
 ▼           │
localStorage│
 └─────┬─────┘
       ▼
     Home
```

We'll store something approximately like:

```ts
type PlayerProfile = {
  name: string
  age: number
  createdAt: string
  progress: Record<string, unknown>
}
```

and associate it with the robot:

```ts
type RobotProfile = {
  deviceId: string
  deviceName: string
  player: PlayerProfile
}
```

For this prototype, **browser `localStorage` is enough**. We don't need Redux, Zustand, a database, Firebase, or some other technological monument just to remember a player's name.

Next.js explicitly requires Client Components for browser APIs such as `localStorage`, state, event handlers, and other browser-only APIs. ([Next.js][1])

## 6. Required packages

Keep the dependency footprint small.

The Next.js default setup already provides:

```text
Next.js
React
TypeScript
Tailwind CSS
ESLint
```

Current Next.js documentation recommends `create-next-app`, with TypeScript, Tailwind, ESLint, App Router and Turbopack available in the recommended setup. The current minimum Node.js version is 20.9. ([Next.js][2])

For our application, I'd add only:

```text
lucide-react
```

For icons.

```text
zod
```

For validating JSON messages received from the ESP32.

Potentially later:

```text
motion
```

for game animations.

And potentially:

```text
@serwist/next
```

if we decide to implement a proper installable/offline PWA layer. I would **not install this yet**. The Bluetooth functionality is the more important architectural risk.

We do not need a Bluetooth npm package.

That is important.

The browser provides Web Bluetooth through:

```javascript
navigator.bluetooth
```

and `requestDevice()` handles the browser's device-selection permission flow. Web Bluetooth is currently limited-availability and requires a secure context in supporting browsers. ([MDN Web Docs][3])

Your existing HTML already uses exactly this API. 

So:

```text
BLE package for Next.js ❌
Web Bluetooth API       ✅
```

## 7. Important Web Bluetooth constraint

This needs to remain on our architecture radar.

A normal web page cannot silently scan every nearby Bluetooth device.

The user must interact with the application, then:

```javascript
navigator.bluetooth.requestDevice(...)
```

opens the browser's device chooser.

The browser grants the site access to the selected device. Previously granted devices can also be retrieved using `navigator.bluetooth.getDevices()` in supporting browsers. ([MDN Web Docs][3])

So our UX should be:

```text
WELCOME
   ↓
CONNECT ROBOT
   ↓
Browser Bluetooth chooser
   ↓
MAINBOT
   ↓
Connect
   ↓
Device information received
   ↓
Existing player profile?
   ├── No → Setup
   └── Yes → Home
```

This is much better than pretending the website has unrestricted Bluetooth powers, because browsers have understandably decided that websites secretly controlling nearby machinery would be a bad feature.

## 8. Existing HTML → Next.js migration

We should **not simply paste the existing `index.html` into Next.js**.

We'll extract the useful parts:

Existing:

```text
BLE UUIDs
      ↓
requestDevice()
      ↓
GATT connect
      ↓
get service
      ↓
get characteristic
      ↓
notifications
      ↓
JSON parsing
      ↓
JSON command
```

Those are already demonstrated by your attached HTML.  

We'll turn them into something like:

```text
src/
├── app/
│   ├── page.tsx
│   ├── profile/
│   ├── modes/
│   └── ...
│
├── components/
│   ├── Header.tsx
│   ├── RobotCard.tsx
│   ├── ModeCard.tsx
│   ├── ConnectionButton.tsx
│   ├── ControlPanel.tsx
│   └── ...
│
├── lib/
│   ├── bluetooth/
│   │   ├── client.ts
│   │   ├── constants.ts
│   │   └── types.ts
│   │
│   ├── protocol/
│   │   ├── commands.ts
│   │   ├── messages.ts
│   │   └── schemas.ts
│   │
│   └── storage/
│       └── profile.ts
│
└── types/
    ├── robot.ts
    ├── player.ts
    └── game.ts
```

That separation will save us later when the fake sensor data becomes real sensor data.

## 9. Implementation phases

We'll build this in controlled increments.

Phase 1: Project foundation

```text
Next.js
TypeScript
Tailwind
ESLint
Mobile-first layout
Gaming visual system
```

Phase 2: BLE foundation

```text
ESP32 advertising
GATT service
Command characteristic
Telemetry characteristic
Web Bluetooth connection
```

Phase 3: Protocol

```text
device_info
telemetry
command
response
game_event
```

Phase 4: Robot state

```text
Connected/disconnected
Robot ID
Robot name
Battery
Firmware
Connection state
```

Phase 5: Player profile

```text
First connection
Profile form
localStorage
Robot-specific profile
Progress persistence
```

Phase 6: Home

```text
Fixed header
Player information
Robot information
3 mode cards
```

Phase 7: Mode navigation

```text
Mode
 ├── Training
 └── Challenges
```

Phase 8: Training

```text
Control panel
↑
↓
← →
STOP

ESP32 receives commands
RGB indicates movement
Serial prints mock hardware operation
```

Phase 9: Challenges

```text
Challenge list
      ↓
Level selection
      ↓
Start
      ↓
Timer
      ↓
Control panel
      ↓
ESP32 telemetry
      ↓
Mock collision
      ↓
GAME OVER
```

Phase 10: PWA

```text
manifest
icons
installability
offline shell
```

Phase 11: Hardware integration

Replace:

```cpp
mockBattery()
mockCollision()
mockMotor()
mockSensor()
```

with:

```cpp
readBatterySensor()
readCollisionSensor()
moveMotor()
readActualSensors()
```

This means the UI doesn't care whether the data came from a real sensor or a fake function.

---

