## We have a game idea to be implemented in the playground.

The idea is:

In the playground there is 4 Games:

- Colour Quest
- Echo Memory
- Driving Pro
- Reflex Dash

The four games are four different games and overview of each games are:

The four modes:
| Mode | L1–L2| L3–L4 | L5–L6 |
|-----|------|-------|----------|
|Colour Quest | Single primary colour — select the shown colour| Secondary colours — pick the odd one out| Beyond primary/secondary|
|Echo Memory| Single-colour direction sequence (L/R/up/down), echo on joystick| Mixed colours | Harder / longer sequences |
|Driving Pro| Basic driving tasks (straight, no collision, one turn…)| Directional tasks (N / E / S / W)| Real parking (parallel, H-drive, turning)|
| Reflex Dash |Single-colour alert / safe point |Two colours (green go / red stop by side)| 3+ colours|

Each game have 6 different levels grouped into two levels per group based on difficulty. L1, L2 are Easy, L3, L4 are Medium, L5, L6 are Hard.

At first we have to implement the Game 1 - Colour Quest.

In Colour Quest, upon the user entering into any levels, each level has a number of tasks which is tracked by the RoboToy. After completing the all tasks in a level, the RoboToy will return the score of that level completion. Based on that score we have to give stars for that level. For completing tasks successfully level gets marked against stars, for 80% or above score - 3 stars, for 60% or higher score - 2 stars and for 40% or higher score - 1 star and below 40% score - no stars.

On start of a level a JSON command should be sent to RoboToy like:

```
{
    "command":"challenge",
    "game":"color-quest",
    "level":1
}
```

Upon completion of the level, the RoboToy will respond with a JSON like:

```
{
    "type":"response",
    "game":"color-quest",
    "score":0.75
}
```

The score will be shown to the user and stars awarder is also shown in a pop up modal and then user will be redirected to levels selection page. There the awarded stars will be recorded on corresponding level card.

Every levels are locked initially. Only the first level of Easy is unlocked. Upon getting 3 stars, next level is unlocked.

All the Game progress of the current user should be tracked and stored in database. The user's progress for each game should be shown as a progress bar in the Game ModeCard.

Analyse the current implementation of games in playground, plan and implement necessary UI, database as well as business logic changes and implement the first game feature.
