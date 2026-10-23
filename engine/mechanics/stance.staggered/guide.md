# Staggered stance (`stance.staggered`)
Core: a Poise break puts the target in the Staggered stance for its next turn; Core has no stacking Staggered status.
- Carried by: entities under the Core (FixCore) combat rules.
- Lives in: `src/engine/actions.js` (`fixCoreStagger`).
- Portability: legacy (service.json is empty until the behaviour moves to catalog ops).
