# Stagger (`mechanic.stagger`)
Poise damage empties the meter; the break staggers the target, adds Vulnerable and costs SP.
- Numbers: model defaults copied from `engine/modules/stagger/defaults.json` (spLoss 1, status vulnerable, stacks 1, damageTakenMultiplier 1.25).
- Lives in: `src/engine/actions.js` (`breakEnemy`); portable service is `service.json` (ops `poiseDamage`, `stagger`, `applyStatus`, `restoreStamina`).
- Portability: portable. Cases trigger the break with `when: { event, with }`; the runtime raises `runtime.poiseBroken`. Entity poise, poiseMax and sp are plain numbers; the numbers come from `$model.*`.
