# Crimson Blight (`status.crimsonBlight`)
At the start of its turn, loses HP equal to Blight stacks (ignores Block). Stacks do not tick down; the Blight expires entirely after 3 turns. Re-applying adds stacks and refreshes the duration.
- Carried by: statuses on any entity.
- Lives in: `src/engine/combatCardTactics.js` (`enqueueCounterWard`).
- Portability: legacy (service.json is empty until the behaviour moves to catalog ops).
