# `stances` module guide

Give cards and enemies named maneuvers and resolve directed advantage, evasion and stagger policy.

**Status:** Listed in `ashen.core@1.0.0`.
Runtime scope: Configured maneuver identities, matchup edges, evasion chance and bounded stagger; calculations execute in the host adapter.

## Authoring example

Add one override to `games/ashenspire/game.json`; leave other bundled modules inherited:

```json
{
  "formatVersion": 1,
  "core": "ashen.core@1.0.0",
  "modules": {
    "stances": false
  }
}
```

The object form below changes only one setting; bundle defaults and other module selections remain:

```json
{
  "modules": { "stances": { "include": ["attack", "smash", "defend", "counter", "sweep", "evade"] } }
}
```

That object is only meaningful when the module is supported by the selected bundle. Catalog status does not promise runtime behavior.

## Settings and inheritance

Settings live in `engine/modules/stances/settings.schema.json`; shipped defaults are in `defaults.json`. Every listed setting is required after resolution unless the schema marks it otherwise.
- `/mode` (type enum; default `"configured"`; allowed "legacy", "configured"): Validated setting; no configured gameplay behavior is promised unless listed in Runtime scope above.
- `/include` (type array; default `["attack","smash","defend","counter","sweep","prepared","evade"]`): Unique supported maneuver IDs.
- `/matchups` (type object; default `{"attack":["smash","prepared"],"counter":["smash","attack"],"smash":["defend","prepared"],"sweep":["counter","evade"],"prepared":["defend","counter"]}`): Directed edges: key is attacker, array lists the stances it beats.
- `/advantageMultiplier` (type number; default `1.25`; range 0..100): Provisional advantage damage multiplier.
- `/evadeFailureMultiplier` (type integer; default `2`; range 0..1000000): Damage multiplier when an evade fails.
- `/accuracyPolicy` (type enum; default `"chance"`; allowed "chance"): Current host accuracy policy is chance.
- `/staggerPolicy` (type string; default `"legacyAdapter"`; minLength 1): Host adapter stagger policy; treat as provisional.
- `/accuracyBase` (type number; default `0.75`; range 0..1): Base hit chance in [0,1].
- `/accuracyWeight` (type number; default `0.02`; range 0..1): AR−DR contribution to chance.
- `/minimumHitChance` (type number; default `0.05`; range 0..1): Lower hit-chance clamp.
- `/maximumHitChance` (type number; default `0.95`; range 0..1): Upper hit-chance clamp.
- `/accuracyStat` (type enum; default `"ar"`; allowed "ar", "dr", "accuracy", "evasion"): Supported rating key: ar/dr/accuracy/evasion.
- `/evasionStat` (type enum; default `"dr"`; allowed "ar", "dr", "accuracy", "evasion"): Supported rating key: ar/dr/accuracy/evasion.
- `/staggerOnAdvantage` (type boolean; default `true`): Provisional rule that an advantage can stagger.
- `/staggerManeuvers` (type array; default `["smash"]`): Maneuvers eligible for that provisional stagger.
- `/staggerLimitPerTargetPerRound` (type integer; default `1`; range 0..1000000): Maximum stagger triggers for a target during a round.

The exact provenance is recorded in `games/ashenspire/bundles/core/bundle.json`: module defaults are the base, selected bundle settings and `policyBindings` apply next, and the author object applies last. Arrays replace the inherited array. If a field has no bundle binding, its module default is inherited unchanged. `false` disables; `true` selects inherited defaults; null has no removal meaning. Unknown keys and invalid values fail validation.

## Content changes

Card maneuver identities are in games/ashenspire/packs/core/cards.json; numeric policy is in provisionalPolicies.json. Edit the directed `matchups` map or included maneuvers in this settings object. Advantage values and automatic stagger are provisional policy, not confirmed permanent balance.

The referenced pack JSON is gameplay authoring data; it is not executable module code. Keep stable IDs and update every reference when renaming an item.

## Disable behavior, portability and checks

Neutral stance is the explicit fallback; disabling presentation does not change the action timing.

The current export requires `ashen.legacy-adapter@1`; it is host-dependent and does not claim a portable rules VM. Unsupported configured modules or values should fail validation rather than silently omit their behavior.

Validate the actual author file with:

```sh
node tools/game-config.mjs validate --input games/ashenspire/game.json
node tools/game-config.mjs check
```

For runtime changes, use the focused tests in `tests/game-profile-run.test.mjs` and the matching module tests. A passing resolver check proves schema/resolution only, not that every host behavior is covered by browser acceptance.
