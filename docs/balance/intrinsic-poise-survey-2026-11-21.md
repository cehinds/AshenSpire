# Intrinsic Poise survey, 2026-11-21 (ruling B, step 1: survey only, no edits)

Question: where does the Poise on a physical hit (Strike, Jab, Sweep, Counter, weapon arts that are not smashes) come from?
Answer: not from card data. Printed Poise (`poiseDamage` effects) is 0 on ordinary hits. It comes from engine rules, and it is a
property of the TARGET's Poise pool, not of the card.

## Measured faces (tools/combat-power-report.mjs, tools/lib/cardBudgetMeasure.mjs)

- The harness fights a neutral enemy with Poise 1000 (`cardBudgetMeasure.mjs:38-39`) and records `row.final.poise` as the Poise the
  play removed from that pool (`:217`, `:219`: sum of `perTargetPoise[*].removed`). The scorer weighs it 1 per point (`scoring.json` `effects.poiseDamage`).
- So every plain hit is scored for the Poise its target pool happened to absorb. Strike (printed 6 damage, no Poise effect) measures
  damage 5, Poise 2.

## Source 1: physical hits, Poise absorbs 25% (the "automatic Poise")

- `engine/mechanics/defense.poiseProtection/mechanic.json` (`multiplier` default 0.75) and `service.json` (modifier
  `active-poise-mitigation`: phase `damage.mitigation`, applies when `$owner.persistentPoise.value > 0`, `select.damageKind = physical`).
  Selected for every combatant by `defaultTags` `defense:poiseProtection` (`content/source/fixCoreMechanics.json:16`).
- `src/model/fixCoreMechanics.js:308` `protectionReceipt`: the damage the modifier prevents is what the pool loses (`reduced`).
- Called for every physical hit at `src/engine/gameProfileCombat.js:434` (`normalPoise = protectionReceipt(...)`), and at `:385-395` for the Ward routing path.
  Preview and live both go through `profileDamageReceiptCore`, so the quote equals the play.
- The rule never reads the card: `protectionReceipt(ctx, entity, kind, amount)` has no carrier, so it cannot tell a Strike from a Smash.
- Stronger smash extras are separate and already smash-only: `stanceBenefits.js:81-88` (`smash.poiseDamageBonus` 0.5, `fixCoreMechanics.json:82`)
  and `smashVsDefensive.poiseFraction` (`:66`).
- It also protects the player: the same default tag gives the player's Poise pool the same 25% against enemy physical hits.

Cards affected (measured, Poise from absorption only, no `poiseDamage` effect): 19 physical attack faces, e.g. Strike (Poise 2), Counter, Driving Thrust,
Expose, Flick, Gash, Hit and Run, Jab, Pebble Throw, Raking Sweep, Reaping Arc, Sweep, Wide Sweep, Tempered Edge, Venomed Edge, Whetstone Nick (Poise 1 each),
plus the two smash faces Smash and Sundering Art, and the weapon art Twin Fang (Poise 12). Nine more physical attacks author their own `poiseDamage`
(Feint, Pommel Strike, Hammer Blow, Rending Smash, Ironbreaker, Skullsplitter, Stunning Blow, Whirlwind, Sundering Hew).

## Source 2: spells (the Poise on every spell)

- `ward.enabled` is false (`fixCoreMechanics.json:6-7`), so `poiseMeetsMagic` is true (`gameProfileCombat.js:402`): the magic part of a hit meets Poise first, 1:1.
- Then `SpellPoiseFinish` (`gameProfileCombat.js:146`, factor `:165`) multiplies the Poise a player's spell takes by
  `effects.spellPoiseDamageMultiplier` = 2 (`games/ashenspire/bundles/core/bundle.json:44`).
- 31 spell attack faces carry Poise this way with no `poiseDamage` effect (Cantrip 10, Jolt 10, Spark 8, Palm Flame 18, Cinder Dart 16 ...); 5 more author it.
  This is already "spells carry Poise", the ruling's intent.

## Source 3: weapons

- No weapon gives a plain hit Poise. `scoring.json` `strike.poise` is an item-score term for the weapon-art face only. `attackImpact.*`/`impact.*`
  (`combatRatings.js:32,300`) are settings rows that nothing in the resolver reads for Core.

## What a data-only change can and cannot do

- Data only (no code): `protectionParameters["defense.poiseProtection"].multiplier = 1` in `content/source/fixCoreMechanics.json` (`:171`, read by
  `fixCoreMechanics.js:13,391`). Measured effect: every plain physical hit drops to Poise 0 (Strike 2 -> 0, the 1s -> 0). Smash and spell faces do not move.
  Side effects, because the rule is target-side and has no carrier: the player's own Poise pool stops absorbing 25% of enemy physical hits, and
  enemy pools stop absorbing 25% of the player's hits (damage taken rises by a third while Poise holds). That is a whole-game rebalance, not a card change.
- Carrier-aware ("only maneuver:smash and spells absorb") needs code: `protectionReceipt` would have to be handed the carrier, then a new rules
  key (for example `poise.intrinsicFor: ["smash", "spell"]`) read at `gameProfileCombat.js:434`.

## Test impact of the data change

Experiment (reverted, not committed): multiplier 1, rebuilt. `npm test` (fast) stayed 151 passed, 0 failed. The 40 test files that
mention Poise state (`grep -l "poiseProtection|persistentPoise|poiseMitigated" tests`) went from 499 pass / 0 fail to 40+ failing subtests, for example:
`tests/con-poise.test.mjs`, the Defend Poise-floor rules (rule 2, edge, "another stance"), the Broken-stance tests (hit on a Broken enemy, player Broken),
mixed multihit receipts, element Poise ignore and Fire/Frost archived-profile tests, and every "saved profile keeps its runtime hash" test (the rules
change alters the runtime hash). I did not edit any of them.

Result: the ruling cannot be met by a narrow data change. The only data switch is global and rebalances combat for both sides; the narrow
(carrier-aware) form needs engine code and breaks the pinned tests above. Stopped on the engine change; card retuning (D, E) proceeds under the
current measurement, where Poise on a plain hit is the 25% absorption (1-2 points).
