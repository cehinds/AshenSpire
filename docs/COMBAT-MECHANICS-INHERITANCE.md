# Combat Mechanics Inheritance Roadmap (`content/source/mechanics/`)

> **Pattern:** Each file under `content/source/mechanics/*.json` defines one mechanic family as `{ [id]: { extends?, ...fields } }`.
> `tools/content-build.mjs` compiles all files into `src/content/generated/combatMechanics.js` with compile-time parent → child inheritance, cycle/unknown-parent refusal, and an `inheritedFrom` provenance map per field.
> Editing a parent updates every non-overridden child automatically; explicit child overrides stay pinned.
> `src/model/combatMechanics.js` (`ResolveMechanicsTable`, `MechanicRule`) exposes the same resolver to live combat, previews, and **Score Studio**.

---

## Completed (PR #3005)

### 1. `useLimit.json` — Use-Limited Card Lifecycles
- **Hierarchy:** `useLimit` → `exhaust`, `wither`, `wither.evade`, `playLimit`
- **Parent fields:** `enabled`, `countScope` (`"instance" | "card"`), `onLimit` (`"exhaust" | "unplayable"`), `showsRemainingOnFace`, `upgradeEase`
- **Status:** Shipped in PR #3005 (`src/engine/cardBehavior.js`, `src/framework/lifecycle.js`, `src/engine/combat.js`, `content/source/scoring.json`).

### 2. `costGrowth.json` — Rising Card Costs
- **Hierarchy:** `costGrowth` → `costGrowth.shared` → `costGrowth.evade`, `costGrowth.retreat`, `costGrowth.choiceMode`
- **Parent fields:** `enabled`, `scope` (`"instance" | "card"`), `perUse`, `stamina`, `mana`, `maxSteps`, `uncapped`, `showOnFace`, `easedBySteady`
- **Status:** Shipped in PR #3005 (`src/engine/cardBehavior.js`, `content/source/scoring.json`).

### 3. `guardInteraction.json` — Anti-Guard & Smash Modes
- **Hierarchy:** `guardInteraction` → `pierce`, `blockBreak`, `smashVsDefensive`
- **Parent fields:** `enabled`, `appliesTo: ["block"]`, `affectsWard: false`, `triggersBlockBroken: true`, `previewMatchesLive: true`
- **Children:**
  - `pierce`: `{ mode: "bypass", blockIgnoredPerStack: 1, blockBypassFraction: 0.2, builtInElements: ["lightning"], skinStatus: "stoneHide", earthSource: "earth" }`
  - `blockBreak`: `{ mode: "destroyBeforeDamage", damageScale: 0.6667, blockBreakRatio: 0.6667 }`
  - `smashVsDefensive`: `{ mode: "multiplier", damageMultiplier: 1.25, defendDamageMultiplier: 1.5, blockFraction: 0.25, poiseFraction: 0.5 }`
- **Status:** Shipped (`src/model/combatMechanics.js`, `src/engine/gameProfileCombat.js`, `content/source/scoring.json`, `src/model/combatPower.js`).

---

## Planned Families (Tackle One by One)

### 4. `stanceBreak.json` — Stance Disruption
- **Hierarchy:** `stanceBreak` → `stanceBreak.sweepVsCounter`, `stanceBreak.smashVsDefend`
- **Parent fields:** `enabled`, `resultStance: "idle"`, `cancelEnemyIntent: true`, `clearCounterCharges: true`, `mirrorInPreview: true`, `skipIfStaggered: true`
- **Children:**
  - `stanceBreak.sweepVsCounter`: `{ attackerManeuver: "sweep", targetStance: "counter", condition: "hitLanded" }`
  - `stanceBreak.smashVsDefend`: `{ attackerManeuver: "smash", targetStance: "defend", condition: "damageExceedsPositiveBlock", compareBasis: "raw" }` (`"raw" | "rawPlusBlockBreak"`)
- **Why:** Changing `cancelEnemyIntent` or `resultStance` updates both Sweep and Smash breaks together, while `smashVsDefend.compareBasis` keeps Smash stance breaks consistent when testing `blockBreak`.

### 5. `stanceRule.json` — Stance Benefits & Weaknesses
- **Hierarchy:** `stanceRule` → `stance.attack`, `stance.prepared`, `stance.defend`, `stance.smash`, `stance.counter`, `stance.neutral`
- **Parent fields:** `enabled`, `excludeReturnHits: true`, `damageMultiplier: 1`, `blockMultiplier: 1`, `poiseDamageBonus: 0`, `spellOverrideStance: "prepared"`
- **Children:** Each stance declares only its non-default deltas (e.g., `stance.prepared` sets `damageMultiplier: 1.25`, `meleeDamageTakenMultiplier: 1.25`; `stance.smash` sets `poiseDamageBonus: 0.5`; `stance.defend` sets `blockMultiplier: 1.5`, `poiseDamageTakenMultiplier: 0.75`, `poiseFloorWhileBlock: 1`).
- **Why:** Replaces flat sibling defaults in `fixCoreMechanics.json` so `src/model/stanceBenefitsRead.js` and Score Studio read one uniform table.

### 6. `reaction.json` — Counters & Enemy Hit-Back Reactions
- **Hierarchy:** `reaction` → `reaction.meleeCounter`, `reaction.rangedCounter`, `reaction.spellCounter`, `reaction.enemyHitBack`
- **Parent fields:** `enabled`, `maxPerTurn: 1`, `replyDamageMultiplier: 1.5`, `replyPoiseMultiplier: 1.5`, `allowChaining: false`, `consumeOnBypass: false`
- **Children:** Coverage matrices (`meleeIncomingManeuvers`, `meleeBypassDamageTypes`, `rangedProjectilesOnly`, `damageDealsOnlyMeleeCovered`).
- **Why:** Keeps Counter coverage, reply math, and enemy hit-back rules synchronized across `combatMatchups.js` and `enemyReactions.js`.

### 7. `protection.json` — Defensive Mitigation Pipelines (Block, Ward, Poise)
- **Hierarchy:** `protection` → `protection.wardBlockFirst`, `protection.wardPoiseFirst`, `protection.weaponPoise`, `protection.wardHpBuffer`, `protection.standard`
- **Parent fields:** `enabled`, `pierceApplies`, `wardShieldsPoise`, `smashSkipsPoiseAbsorption`, `applyLegacyPoiseAdjust`
- **Children:** Each pipeline declares its stage `order` (`block`, `wardHp`, `wardPoise`, `stancePoise`, `weaponPoiseDrain`, `standardPoiseAfterWard`, `standardSplit`) and overrides (`poiseDrainBasis`, `applyLegacyPoiseAdjust`).
- **Status:** Shipped in PR #3017 (`content/source/mechanics/protection.json`, `src/model/combatMechanics.js`, `src/engine/gameProfileCombat.js`, `tests/combat-mechanics-protection.test.mjs`).

### 8. `elementEffect.json` — Elemental Hit Riders & Triggers
- **Hierarchy:** `elementEffect` → `element.fire`, `element.frost`, `element.lightning`, `element.earth`, `element.force`, `element.sacred`, `element.decay`
- **Parent fields:** `enabled`, `buildupPerHit`, `threshold`, `spreadScope`, `pierceStacks`, `cleanseOnHit`
- **Children:** Per-element overrides (Fire row spread, Lightning chain & conductive backlash, Frost chill, Earth/Stone Skin, Holy cleanse, Force immunity when Silenced).
- **Why:** Centralizes shared elemental buildup/routing defaults instead of scattering them across `fixCoreMechanics.json` and `elementIdentity.js`.

### 9. `positioning.json` — Rows, Advance, Retreat & Formation
- **Hierarchy:** `positioning` → `positioning.advance`, `positioning.retreat`, `positioning.push`, `positioning.formationBlock`
- **Parent fields:** `enabled`, `spCostPerBand: 1`, `stacksApplied: 1`, `stacksRemovedOnAdvance: 1`, `emptyFrontPullsBack: true`
- **Children:** Overrides for back-row melee surcharge, Retreat stack counts, push behavior, and multi-enemy row formation Block.
- **Why:** Unifies `range` and `bands` in `fixCoreMechanics.json` under one inheritable engagement model.

### 10. `drawbackEase.json` — Upgrade Drawback Removal (`Refined`)
- **Hierarchy:** `drawbackEase` → `ease.unexhaust`, `ease.unethereal`, `ease.steady`, `ease.unwither`
- **Parent fields:** `enabled`, `minTier`, `bumpsRefinedTag: true`, `countsAsDrawbackEase: true`, `preservesNumbers: true`
- **Children:** Per-drawback removal/increment behavior (including `ease.unwither` to ease `Wither N` alongside `unexhaust` / `unethereal` / `steady`).
- **Why:** Replaces hardcoded `['unexhaust', 'unethereal', 'steady']` arrays in `src/model/cardUpgrade.js` and keeps Score Studio upgrade pricing in sync.
