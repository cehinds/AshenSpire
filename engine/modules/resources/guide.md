# `resources` module guide

Select the resource pools available to cards and runs. HP is foundational; SP and MP are optional configured pools in the Ashen profile.

**Status:** Listed in `ashen.core@1.0.0`.
Runtime scope: Configured HP/SP/MP pool selection and authored per-card resource variants. This adapter does not claim a portable resource VM.

## Authoring example

Add one override to `games/ashenspire/game.json`; leave other bundled modules inherited:

```json
{
  "formatVersion": 1,
  "core": "ashen.core@1.0.0",
  "modules": {
    "resources": false
  }
}
```

The object form below changes only one setting; bundle defaults and other module selections remain:

```json
{
  "modules": { "resources": { "include": ["hp", "sp"] } }
}
```

That object is only meaningful when the module is supported by the selected bundle. Catalog status does not promise runtime behavior.

## Settings and inheritance

Settings live in `engine/modules/resources/settings.schema.json`; shipped defaults are in `defaults.json`. Every listed setting is required after resolution unless the schema marks it otherwise.
- `/mode` (type enum; default `"configured"`; allowed "legacy", "configured"): Validated setting; no configured gameplay behavior is promised unless listed in Runtime scope above.
- `/include` (type array; default `["hp","sp","mp"]`): Unique pool IDs; HP/SP/MP are supported. Actions is catalogued but rejected for configured core.
- `/costPolicy` (type enum; default `"authoredVariants"`; allowed "authoredVariants"): Uses explicit authored resource variants per card.
- `/recovery` (type enum; default `"turnStart"`; allowed "turnStart"): Host adapter recovery timing policy.

The exact provenance is recorded in `games/ashenspire/bundles/core/bundle.json`: module defaults are the base, selected bundle settings and `policyBindings` apply next, and the author object applies last. Arrays replace the inherited array. If a field has no bundle binding, its module default is inherited unchanged. `false` disables; `true` selects inherited defaults; null has no removal meaning. Unknown keys and invalid values fail validation.

## Content changes

games/ashenspire/packs/core/resourceVariants.json and stats.json Toggle a supported pool in `/modules/resources/include`. Every authored card with a cost in a disabled pool needs a matching explicit resource variant. Disabling a pool does not silently delete the card or its effects.

The referenced pack JSON is gameplay authoring data; it is not executable module code. Keep stable IDs and update every reference when renaming an item.

## Disable behavior, portability and checks

Disabled pool costs use the selected authored card variant; non-resource effects and timing remain. HP cannot be disabled.

The current export requires `ashen.legacy-adapter@1`; it is host-dependent and does not claim a portable rules VM. Unsupported configured modules or values should fail validation rather than silently omit their behavior.

Validate the actual author file with:

```sh
node tools/game-config.mjs validate --input games/ashenspire/game.json
node tools/game-config.mjs check
```

For runtime changes, use the focused tests in `tests/game-profile-run.test.mjs` and the matching module tests. A passing resolver check proves schema/resolution only, not that every host behavior is covered by browser acceptance.
