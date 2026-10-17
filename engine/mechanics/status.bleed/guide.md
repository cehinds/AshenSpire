# Bleed (`status.bleed`)
Build-up: points do not decay. At {proc.threshold}, burst for {proc.burstPercent}% of max HP (min {proc.burstMin}, max {proc.burstMax}), ignoring Block, plus {proc.poiseDamage} Poise damage - then the build-up resets to zero. Fleshy targets briefly resist further Bleed after a burst.
- Carried by: statuses on any entity.
- Lives in: `src/engine/combatCardTactics.js` (`enqueueCounterWard`).
- Portability: legacy (service.json is empty until the behaviour moves to catalog ops).
