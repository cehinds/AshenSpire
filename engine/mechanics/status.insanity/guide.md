# Insanity (`status.insanity`)
Build-up: points do not decay. At {proc.threshold}, burst for {proc.burstPercent}% of max HP (min {proc.burstMin}, max {proc.burstMax}), ignoring Block, with {proc.poiseDamage} Poise damage and a guaranteed Stagger - then the build-up resets to zero.
- Carried by: statuses on any entity.
- Lives in: `src/engine/abilityRiders.js` (`abilityChargedEffects`).
- Portability: legacy (service.json is empty until the behaviour moves to catalog ops).
