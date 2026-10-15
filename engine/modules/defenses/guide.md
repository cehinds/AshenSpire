# `defenses` module guide

Apply Block and Poise in an explicit damage pipeline. Ashen selects Block before Poise.

**Status:** Listed in `ashen.core@1.0.0`.
Runtime scope: Configured Block/Poise selection and ordered damage stages. Unsupported Ward/Barrier selection is rejected by the resolver.

## Authoring example

Add one override to `games/ashenspire/game.json`; leave other bundled modules inherited:

```json
{
  "formatVersion": 1,
  "core": "ashen.core@1.0.0",
  "modules": {
    "defenses": false
  }
}
```

The object form below changes only one setting; bundle defaults and other module selections remain:

```json
{
  "modules": { "defenses": { "include": ["block"], "order": ["block"] } }
}
```

That object is only meaningful when the module is supported by the selected bundle. Catalog status does not promise runtime behavior.

## Settings and inheritance

Settings live in `engine/modules/defenses/settings.schema.json`; shipped defaults are in `defaults.json`. Every listed setting is required after resolution unless the schema marks it otherwise.
- `/mode` (type enum; default `"configured"`; allowed "legacy", "configured"): Validated setting; no configured gameplay behavior is promised unless listed in Runtime scope above.
- `/include` (type array; default `["block","poise"]`): Selected defense IDs; configured core supports block and poise only.
- `/order` (type array; default `["block","poise"]`): Selected stages in exact damage-pipeline order.
- `/poiseMultiplier` (type number; default `0.75`; range 0..1000000): Incoming damage multiplier before rounding.
- `/poiseRounding` (type enum; default `"floor"`; allowed "floor"): Configured rounding rule; current adapter uses floor.
- `/minimumPositiveDamage` (type integer; default `1`; range 0..1000000): Floor for positive incoming damage.
- `/poiseActive` (type enum; default `"positive"`; allowed "positive", "always"): When Poise mitigation applies.
- `/blockScope` (type enum; default `"all"`; allowed "all"): Configured Block scope.
- `/poiseDepletes` (type enum; default `false`; allowed false): Current adapter does not spend Poise.

The exact provenance is recorded in `games/ashenspire/bundles/core/bundle.json`: module defaults are the base, selected bundle settings and `policyBindings` apply next, and the author object applies last. Arrays replace the inherited array. If a field has no bundle binding, its module default is inherited unchanged. `false` disables; `true` selects inherited defaults; null has no removal meaning. Unknown keys and invalid values fail validation.

## Content changes

games/ashenspire/packs/core/provisionalPolicies.json Change the supported `include` set and corresponding `order`. Selected stages are the only stages executed. Poise taken currently uses floor(damage × multiplier), with a minimum positive result of one.

The referenced pack JSON is gameplay authoring data; it is not executable module code. Keep stable IDs and update every reference when renaming an item.

## Disable behavior, portability and checks

No selected Block/Poise stages means damage passes through; unsupported Ward/Barrier instances fail validation.

The current export requires `ashen.legacy-adapter@1`; it is host-dependent and does not claim a portable rules VM. Unsupported configured modules or values should fail validation rather than silently omit their behavior.

Validate the actual author file with:

```sh
node tools/game-config.mjs validate --input games/ashenspire/game.json
node tools/game-config.mjs check
```

For runtime changes, use the focused tests in `tests/game-profile-run.test.mjs` and the matching module tests. A passing resolver check proves schema/resolution only, not that every host behavior is covered by browser acceptance.
