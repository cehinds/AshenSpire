# Confused (`status.confused`)
Deals 10% less damage. At the start of its turn, 50% chance to take 3 Poise damage per stack. 1 stack expires each turn.
- Carried by: statuses on any entity.
- Lives in: `src/model/combatExpansionRules.js` (`createCombatExpansionRuleSnapshot`).
- Portability: legacy (service.json is empty until the behaviour moves to catalog ops).
