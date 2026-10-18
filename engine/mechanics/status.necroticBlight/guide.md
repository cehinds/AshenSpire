# Necrotic Blight (`status.necroticBlight`)
At the start of its turn, loses HP equal to Necrotic Blight stacks (ignores Block). Applied by Necrotic damage. Stacks do not tick down and it lasts the whole fight; only a cleanse removes it.
- Carried by: statuses on any entity.
- Lives in: `src/engine/combatMatchups.js` (`matchupRiderEffects`).
- Portability: legacy (service.json is empty until the behaviour moves to catalog ops).
