# `effects` module guide

Set the unified damage model and the per-point weights of STR (physical damage), DEX (Block) and max(INT, WIS) (magic damage).

**Status:** Listed in `ashen.core@1.0.0`.
Runtime scope: Configured unified damage policy and the STR / DEX / magic-stat weights. Card operations remain host-interpreted; arbitrary JSON effect programs are not portable.

## Authoring example

Add one override to `games/ashenspire/game.json`; leave other bundled modules inherited:

```json
{
  "formatVersion": 1,
  "core": "ashen.core@1.0.0",
  "modules": {
    "effects": false
  }
}
```

The object form below changes only one setting; bundle defaults and other module selections remain:

```json
{
  "modules": { "effects": { "strengthDamageWeight": 0 } }
}
```

That object is only meaningful when the module is supported by the selected bundle. Catalog status does not promise runtime behavior.

## Settings and inheritance

Settings live in `engine/modules/effects/settings.schema.json`; shipped defaults are in `defaults.json`. Every listed setting is required after resolution unless the schema marks it otherwise.
- `/mode` (type enum; default `"configured"`; allowed "legacy", "configured"): Validated setting; no configured gameplay behavior is promised unless listed in Runtime scope above.
- `/damageModel` (type enum; default `"unified"`; allowed "unified"): Core uses one unified damage channel.
- `/elements` (type enum; default `false`; allowed false): Core disables elemental damage.
- `/spellRanks` (type enum; default `false`; allowed false): Core disables spell ranks.
- `/strengthDamageWeight` (type number; default `1`; range 0..100): Physical damage added per point of STR (AR is retired, owner 2026-11-18).
- `/magicStatWeight` (type number; default `1`; range 0..100): Magic damage added per point of max(INT, WIS).
- `/dexterityBlockWeight` (type number; default `1`; range 0..100): Block added per point of DEX: `baseBlock + DEX × dexterityBlockWeight`.
- `/baseDamageMultiplier` (type number; default `1`; range 0..10): Scales every card's base damage (player and enemy), rounded up, before STR or the magic stat adds. The Core bundle sets 0.5 (owner, 2026-11-17: base damage halved). A Counter return is not scaled again.
- `/playerDamageMultiplier` (type number; default `1`; range 0..10): Scales every hit a player source deals, as one `side-damage-scale` receipt stage after the element stages and before Block and Poise absorption, so the face, the intent and the hit agree. A Counter return, a reflected hit and a proposal's reactive return are final damage and are not scaled. A positive hit never rounds to 0. The Core bundle sets 0.7 (owner, 2026-11-18: damage, defense and enemy HP cut 30%).
- `/enemyDamageMultiplier` (type number; default `1`; range 0..10): The same stage for hits an enemy source deals. Core sets 0.7 (owner, 2026-11-18).
- `/blockGainMultiplier` (type number; default `1`; range 0..10): A factor inside the configured Block gain floor (`computeBlockGain`), both sides. A Counter's Block grant is a share of an already scaled hit and is not scaled again. Core sets 0.7 (owner, 2026-11-18).
- `/spellPoiseDamageMultiplier` (type number; default `1`; range 1..10): Multiplies the Poise a player's spell-camp card takes from an enemy (what the hit absorbs plus its Poise damage), never past the pool; HP is unchanged. Core sets 2 (owner, 2026-11-18: spell Poise damage +100%).
- Owner ruling, 2026-11-18: Core enemy `hpScaleByTier` (enemies module) is minion 0.385, elite 0.42, boss 0.455 (each 70% of the earlier 0.55 / 0.6 / 0.65).

The exact provenance is recorded in `games/ashenspire/bundles/core/bundle.json`: module defaults are the base, selected bundle settings and the author object resolve next, then `policyBindings` copies resolved module fields onto selected content where declared. Arrays replace inherited arrays. `false` disables; `true` selects inherited defaults; null has no removal meaning. Unknown keys and invalid values fail validation.

## Content changes

Card operation data is in games/ashenspire/packs/core/cards.json. The core intentionally disables elemental damage and spell ranks. This configuration does not make arbitrary JavaScript or new effect names portable.

The referenced pack JSON is gameplay authoring data; it is not executable module code. Keep stable IDs and update every reference when renaming an item.

## Disable behavior, portability and checks

Unknown card operations remain invalid; the configured core does not infer or execute arbitrary JSON/JavaScript.

The current export requires `ashen.legacy-adapter@1`; it is host-dependent and does not claim a portable rules VM. Unsupported configured modules or values should fail validation rather than silently omit their behavior.

Validate the actual author file with:

```sh
node tools/game-config.mjs validate --input games/ashenspire/game.json
node tools/game-config.mjs check
```

For runtime changes, use the focused tests in `tests/game-profile-run.test.mjs` and the matching module tests. A passing resolver check proves schema/resolution only, not that every host behavior is covered by browser acceptance.
