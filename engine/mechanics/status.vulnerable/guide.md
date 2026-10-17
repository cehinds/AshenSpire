# Vulnerable (`status.vulnerable`)
Takes 50% more attack damage. 1 stack expires each turn.
- Carried by: statuses on any entity.
- Lives in: `src/engine/combatCardTactics.js` (`enqueueCounterWard`).
- Portability: legacy (service.json is empty until the behaviour moves to catalog ops).
