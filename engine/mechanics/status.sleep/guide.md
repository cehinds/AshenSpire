# Sleep (`status.sleep`)
Locks ordinary cards, Counter and card Evade. Rest restores up to 6 HP and 1 Ward per combat. +10% direct damage received per active stack. Break Sleep: 2 SP per stack.
- Carried by: statuses on any entity.
- Lives in: `src/engine/combatStatusControl.js` (`restorePersistentWard`).
- Portability: legacy (service.json is empty until the behaviour moves to catalog ops).
