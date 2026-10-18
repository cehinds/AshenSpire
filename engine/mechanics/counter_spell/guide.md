# Spell counter (`counter:spell`)
Intercepts incoming physical ranged moves or spells. Against physical ranged moves, strips Ward without Health retaliation. Against spellcasters, can retaliate against Health.
- Carried by: cards.
- Lives in: `src/engine/combatReactions.js` (`counterCoversAttack`).
- Portability: legacy (service.json is empty until the behaviour moves to catalog ops).
