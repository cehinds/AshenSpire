# `effects` module guide

Set the unified damage model and the host adapter weights for attack and defense ratings.

**Status:** Listed in `ashen.core@1.0.0`.
Runtime scope: Configured unified damage policy and AR/DR weights. Card operations remain host-interpreted; arbitrary JSON effect programs are not portable.

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
  "modules": { "effects": { "attackRatingWeight": 0 } }
}
```

That object is only meaningful when the module is supported by the selected bundle. Catalog status does not promise runtime behavior.

## Settings and inheritance

Settings live in `engine/modules/effects/settings.schema.json`; shipped defaults are in `defaults.json`. Every listed setting is required after resolution unless the schema marks it otherwise.
- `/mode` (type enum; default `"configured"`; allowed "legacy", "configured"): Validated setting; no configured gameplay behavior is promised unless listed in Runtime scope above.
- `/damageModel` (type enum; default `"unified"`; allowed "unified"): Core uses one unified damage channel.
- `/elements` (type enum; default `false`; allowed false): Core disables elemental damage.
- `/spellRanks` (type enum; default `false`; allowed false): Core disables spell ranks.
- `/attackRatingWeight` (type number; default `1`; range 0..100): Host adapter AR contribution.
- `/defenseRatingWeight` (type number; default `1`; range 0..100): Confirmed host-adapter contribution to Block gained: `baseBlock + DR × defenseRatingWeight`.

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
