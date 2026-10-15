# `class-selection` module guide

Select fixed Ashen classes and gate later classes behind completed runs.

**Status:** Listed in `ashen.core@1.0.0`.
Runtime scope: Configured fixed classes, lock progression and selection guards.

## Authoring example

Add one override to `games/ashenspire/game.json`; leave other bundled modules inherited:

```json
{
  "formatVersion": 1,
  "core": "ashen.core@1.0.0",
  "modules": {
    "class-selection": false
  }
}
```

The object form below changes only one setting; bundle defaults and other module selections remain:

```json
{
  "modules": { "class-selection": { "fixedLoadout": true } }
}
```

That object is only meaningful when the module is supported by the selected bundle. Catalog status does not promise runtime behavior.

## Settings and inheritance

Settings live in `engine/modules/class-selection/settings.schema.json`; shipped defaults are in `defaults.json`. Every listed setting is required after resolution unless the schema marks it otherwise.
- `/mode` (type enum; default `"configured"`; allowed "legacy", "configured"): Validated setting; no configured gameplay behavior is promised unless listed in Runtime scope above.
- `/initialClass` (type string; default `"reaver"`; minLength 1): Initial eligible class ID.
- `/fixedAttributes` (type boolean; default `true`): Use authored fixed class attributes.
- `/fixedLoadout` (type boolean; default `true`): Use authored fixed class equipment.

The exact provenance is recorded in `games/ashenspire/bundles/core/bundle.json`: module defaults are the base, selected bundle settings and `policyBindings` apply next, and the author object applies last. Arrays replace the inherited array. If a field has no bundle binding, its module default is inherited unchanged. `false` disables; `true` selects inherited defaults; null has no removal meaning. Unknown keys and invalid values fail validation.

## Content changes

games/ashenspire/packs/core/classes.json and classUnlocks.json Change fixed class attributes/loadout or the unlock sequence in source pack JSON. Core begins with Reaver; each unique terminal win or defeat unlocks the next class.

The referenced pack JSON is gameplay authoring data; it is not executable module code. Keep stable IDs and update every reference when renaming an item.

## Disable behavior, portability and checks

Default eligible hero/fixed loadout is the fallback. Character creation remains a separate unsupported optional module.

The current export requires `ashen.legacy-adapter@1`; it is host-dependent and does not claim a portable rules VM. Unsupported configured modules or values should fail validation rather than silently omit their behavior.

Validate the actual author file with:

```sh
node tools/game-config.mjs validate --input games/ashenspire/game.json
node tools/game-config.mjs check
```

For runtime changes, use the focused tests in `tests/game-profile-run.test.mjs` and the matching module tests. A passing resolver check proves schema/resolution only, not that every host behavior is covered by browser acceptance.
