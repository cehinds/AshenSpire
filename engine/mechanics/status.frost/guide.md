# Frost (`status.frost`)
Build-up: points do not decay. At {proc.threshold}, burst for {proc.burstPercent}% of max HP (min {proc.burstMin}, max {proc.burstMax}), ignoring Block, and the target is left Weak and Frost-Exposed - then the build-up resets to zero.
- Carried by: statuses on any entity.
- Lives in: `src/engine/ashenBlight.js` (`ashenBlightSpellBuildup`).
- Portability: legacy (service.json is empty until the behaviour moves to catalog ops).
