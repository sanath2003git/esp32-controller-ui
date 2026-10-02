🚗 Driving Pro — Compact Fixed-Control UI Plan
1. Overall layout
Instead of one long vertically scrolling page:
┌─────────────────────────┐
│ Game information        │
│                         │
│ Robot status            │
│                         │
│ Controls                │
│                         │
│ Joystick                │
└─────────────────────────┘
       ↓ scroll

use a viewport-locked layout:
┌─────────────────────────────────┐
│  DRIVING PRO     LV 1   00:47  │ ← Fixed header
├─────────────────────────────────┤
│                                 │
│       GAME / MISSION AREA       │
│                                 │
│   Mission + robot status        │
│   dynamically changes here      │
│                                 │
│                                 │
├─────────────────────────────────┤
│ LED    HORN    LIGHT     SCORE  │ ← compact
├─────────────────────────────────┤
│                                 │
│           JOYSTICK              │
│                                 │
│             ↑                   │
│          ↖  ●  ↗                │
│        ←    ●    →              │
│          ↙  ●  ↘                │
│             ↓                   │
│                                 │
└─────────────────────────────────┘

The important part is that the joystick region has a fixed height and is always visible.
2. Divide the viewport into 3 zones
I'd use:
┌──────────────────────────────┐
│       TOP HUD ~15%           │
├──────────────────────────────┤
│                              │
│      GAME AREA ~35–40%       │
│                              │
├──────────────────────────────┤
│                              │
│     CONTROL AREA ~45–50%     │
│                              │
└──────────────────────────────┘

The exact percentages can be responsive, but conceptually:
Zone 1 — HUD
Very compact.
Zone 2 — Game information
Changes depending on the level.
Zone 3 — Driving controls
Always present.
3. Top HUD
Don't give the game a large title section.
Your current aesthetic already works well with a compact header.
I'd use:
┌────────────────────────────────┐
│ ◉ DRIVING PRO   LV 1   ⏱ 00:47 │
└────────────────────────────────┘

Then a very small status row:
┌────────────────────────────────┐
│ DRIVER TRAINING    SCORE 72    │
└────────────────────────────────┘

So the entire game header takes roughly 50–70px.
No giant:
DRIVING PRO
DRIVER TRAINING

title occupying the screen.
4. Mission information should be a compact HUD
This is where I'd make the biggest change from my previous design.
Don't use a large mission card.
Instead:
┌────────────────────────────────┐
│ MISSION                         │
│                                 │
│ FWD 14/20s   REV 5/5s           │
│ L 2/3        R 1/3              │
│                                 │
│ █████████████░░░░░  65%         │
└────────────────────────────────┘

This can fit into roughly 90–110px.
Even better, use two rows:
MISSION

FWD 14/20s   REV 5/5s   L 2/3   R 1/3
████████████████░░░░░░░░░ 65%

That is enough information for Level 1.
5. Don't show unnecessary labels
For example, instead of:
Forward Driving
14 seconds / 20 seconds

use:
↑ FWD  14/20s

Instead of:
Left Turns
2 / 3 completed

use:
↶ L 2/3

You already have a visual language with icons, so take advantage of it.
6. Robot status should also become compact
Your current robot visualization is useful, but it doesn't need to occupy the huge amount of vertical space shown in the screenshot.
Instead of:
              FRONT

       FL             FR


              🤖


       RL             RR

              REAR

      Front distance

use a compact version:
          FRONT
     ● FL       ● FR

          🤖

     ● RL       ● RR
          REAR

      ↕ 42 cm

And put it beside the mission information where screen width allows.
For desktop:
┌────────────────────────────────────┐
│ MISSION              ROBOT         │
│                                    │
│ FWD 14/20s          ●FL    ●FR     │
│ REV  5/5s                🤖        │
│ L   2/3              ●RL    ●RR    │
│ R   1/3                42cm        │
│                                    │
│ ████████████░░░░                   │
└────────────────────────────────────┘

This is much more space-efficient.
7. Desktop layout
Since your screenshot appears to be from the web controller, I'd actually take advantage of the available horizontal space.
Instead of stacking everything:
Mission
↓
Robot
↓
LED/Horn/Light
↓
Joystick

use:
┌─────────────────────────────────────────────┐
│ DRIVING PRO              LV1       00:47   │
├─────────────────────────────────────────────┤
│                                             │
│ ┌──────────────────┐ ┌───────────────────┐ │
│ │ MISSION          │ │ ROBOT             │ │
│ │                  │ │                   │ │
│ │ FWD 14/20s       │ │   ●FL      ●FR    │ │
│ │ REV  5/5s        │ │       🤖          │ │
│ │ L    2/3         │ │   ●RL      ●RR    │ │
│ │ R    1/3         │ │      42 cm        │ │
│ │                  │ │                   │ │
│ │ ███████░░ 65%    │ │                   │ │
│ └──────────────────┘ └───────────────────┘ │
│                                             │
├─────────────────────────────────────────────┤
│ LED          HORN          LIGHT    SCORE  │
├─────────────────────────────────────────────┤
│                                             │
│                 JOYSTICK                    │
│                                             │
│                    ↑                        │
│                 ↖  ●  ↗                     │
│               ←    ●    →                   │
│                 ↙  ●  ↘                     │
│                    ↓                        │
│                                             │
└─────────────────────────────────────────────┘

This is what I'd recommend for your application.
8. The joystick becomes a fixed bottom panel
This is the most important change.
The joystick should be in a container such as:
position: fixed;
bottom: 0;
left: 0;
right: 0;

or, if your controller itself is a centered card:
position: sticky;
bottom: 0;

But I would favor a fixed control dock.
Conceptually:
┌─────────────────────────────┐
│                             │
│      SCROLLABLE GAME AREA   │
│                             │
│                             │
├─────────────────────────────┤
│      CONTROL DOCK           │
│                             │
│ LED   HORN   LIGHT   SCORE  │
│                             │
│          JOYSTICK           │
└─────────────────────────────┘

The game area can scroll if necessary, but the player doesn't care because the joystick is always accessible.
9. The control dock should have a maximum height
Don't let the joystick consume half the screen on smaller devices.
Something like:
Control Dock
    ↓
┌───────────────────┐
│ Peripheral row    │  ~45px
├───────────────────┤
│                   │
│ Joystick          │  ~220–280px
│                   │
└───────────────────┘

So approximately 280–330px total on a desktop-sized controller.
The joystick itself can be responsive:
Desktop → larger joystick
Laptop  → medium joystick
Mobile  → smaller joystick

but its position remains fixed.
10. Make the joystick slightly smaller than your current one
Looking at your screenshot, the joystick is visually large.
You don't actually need such a large joystick because the important thing is the touch/drag area, not necessarily the visible circle.
You can have:
Visible joystick:
      ~180–220px

Interactive hit area:
      ~250–280px

That gives you a compact appearance while still being easy to control.
11. Level 2 becomes even simpler
You don't need the entire mission dashboard.
The game area can become:
┌─────────────────────────────────────┐
│ CHALLENGE       ROUND 2/3           │
│                                     │
│                                     │
│             TURN RIGHT              │
│                  ↗                  │
│                                     │
│             STEP 4 / 6              │
│          ███████████░░              │
│                                     │
└─────────────────────────────────────┘

Then the joystick remains below.
The player can see the instruction without ever losing access to the joystick.
12. Emergency event
When Level 2 or Level 3 triggers an emergency, don't open a huge modal that covers the entire screen.
Instead, transform the game area:
┌─────────────────────────────────────┐
│             ⚠️ EMERGENCY            │
│                                     │
│             STOP NOW                │
│                                     │
│              0.82s                  │
│                                     │
└─────────────────────────────────────┘

The joystick stays visible.
That is actually important because the player needs to interact with it immediately.
13. Emergency Stop interaction
During an emergency, the joystick itself can visually change.
Normal:
      ↑
   ↖  ●  ↗
 ←    ●    →
   ↙  ●  ↘
      ↓

Emergency:
      ⚠
   ↖  ●  ↗
 ←   STOP   →
   ↙  ●  ↘
      ⚠

Or put a compact STOP button directly above the joystick:
┌──────────────────────────────┐
│       ⚠ EMERGENCY            │
│                              │
│          [ STOP ]             │
│                              │
│          JOYSTICK             │
└──────────────────────────────┘

The user can either:
- release the joystick, or
- press STOP.
14. Level 3 diagnostic screen
When the robot fails, don't navigate to another page.
Keep the fixed controller dock.
Only the upper game area changes.
┌─────────────────────────────────────┐
│ LEVEL 3       EMERGENCY MISSION     │
├─────────────────────────────────────┤
│                                     │
│          ⚠ SYSTEM FAILURE           │
│                                     │
│      Driving temporarily locked     │
│                                     │
│         [ DIAGNOSE ]                │
│                                     │
├─────────────────────────────────────┤
│ LED   HORN   LIGHT        SCORE     │
├─────────────────────────────────────┤
│                                     │
│              JOYSTICK               │
│             DISABLED                │
│                                     │
│                 ●                   │
│                                     │
└─────────────────────────────────────┘

The joystick stays visible, but becomes disabled.
That's better UX because the player doesn't suddenly lose their familiar control position.
15. Diagnostic puzzle should fit into the game area
When they press Diagnose:
┌─────────────────────────────────────┐
│ SYSTEM DIAGNOSTICS                  │
│                                     │
│ 🔋 Battery       ✓ ONLINE           │
│ 📡 Bluetooth     ✓ ONLINE           │
│ ⚙ Controller     ✓ ONLINE           │
│ ◀ Left Motor     ✓ ONLINE           │
│ ▶ Right Motor    ✕ ERROR            │
│                                     │
│ Which system failed?                │
│                                     │
│ [Battery] [Bluetooth]               │
│ [Left]    [Right]                   │
│ [Sensors]                            │
└─────────────────────────────────────┘

No giant modal.
No page change.
No scrolling.
16. Repair puzzle should use the same space
After selection:
┌─────────────────────────────────────┐
│ REPAIR: RIGHT MOTOR                 │
│                                     │
│ Controller ──────── ✕ ─── Motor    │
│                                     │
│                                     │
│           [ RECONNECT ]             │
│                                     │
│             64%                     │
│          ███████░░░                 │
└─────────────────────────────────────┘

Joystick remains at the bottom.
17. Score should be extremely compact
Don't give score its own card.
Put it in the header:
DRIVING PRO      LV 3      ★ 84

During collision:
DRIVING PRO      LV 3      ★ 74
                              -10

During completion, expand it into the final report.
18. Final score screen
Only when the level finishes can you use more space:
┌─────────────────────────────────────┐
│          MISSION COMPLETE           │
│                                     │
│                87                   │
│              SCORE                  │
│                                     │
│ Driving             36 / 40         │
│ Reaction            21 / 25         │
│ Collision           20 / 25         │
│ Time                 10 / 10        │
│                                     │
│          [ CONTINUE ]               │
└─────────────────────────────────────┘

The joystick doesn't need to remain active after completion, so this is the one situation where it can disappear.
19. Final proposed layout
So I would make your entire Driving Pro screen behave like this:
┌─────────────────────────────────────────┐
│ ◉ DRIVING PRO    LV 1    ⏱ 00:47  ★72  │ ← 60px
├─────────────────────────────────────────┤
│                                         │
│ ┌─────────────────┐ ┌─────────────────┐ │
│ │ MISSION         │ │ ROBOT           │ │
│ │ FWD 14/20s      │ │  ●FL      ●FR   │ │
│ │ REV  5/5s       │ │      🤖         │ │
│ │ L    2/3        │ │  ●RL      ●RR   │ │
│ │ R    1/3        │ │     42cm        │ │
│ │ ███████░ 65%    │ │                 │ │
│ └─────────────────┘ └─────────────────┘ │
│                                         │
│              GAME AREA                  │
│                                         │
├─────────────────────────────────────────┤
│  LED          HORN          LIGHT       │ ← ~45px
├─────────────────────────────────────────┤
│                                         │
│                  ↑                      │
│               ↖  ●  ↗                   │
│             ←    ●    →                 │
│               ↙  ●  ↘                   │
│                  ↓                      │
│                                         │
│               JOYSTICK                  │
└─────────────────────────────────────────┘
             ↑
       NEVER SCROLLS

The important difference
Only the middle section changes between levels.
             FIXED
               ↓
┌─────────────────────────────┐
│ Header                       │
├─────────────────────────────┤
│                             │
│       DYNAMIC AREA          │
│                             │
│ Level 1 → Mission           │
│ Level 2 → Current command   │
│ Level 3 → Diagnostics       │
│                             │
├─────────────────────────────┤
│ Peripheral controls         │
├─────────────────────────────┤
│                             │
│       JOYSTICK              │ ← FIXED
│                             │
└─────────────────────────────┘

This is the architecture I'd recommend for your controller because the player's hands/attention are always anchored to the same control location, while the information they need changes above it.
One implementation detail I'd strongly recommend
Make the entire controller viewport 100dvh rather than letting the page naturally grow:
height: 100dvh;
overflow: hidden;

Then make only the game-information region internally scrollable if some diagnostic content ever exceeds the available space.
That gives you:
No page scrolling + joystick permanently accessible + compact game HUD + room for more complex puzzles.