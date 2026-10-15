# `art` module guide

Choose whether configured presentation uses authored art or procedural low-poly stand-ins.

**Status:** Listed in `ashen.core@1.0.0`.
Runtime scope: Configured art visibility gate and procedural stand-in path. It does not affect targets or game outcomes.

## Authoring example

Add one override to `games/ashenspire/game.json`; leave other bundled modules inherited:

```json
{
  "formatVersion": 1,
  "core": "ashen.core@1.0.0",
  "modules": {
    "art": false
  }
}
```

The object form below changes only one setting; bundle defaults and other module selections remain:

```json
{
  "modules": { "art": { "fallback": "procedural" } }
}
```

That object is only meaningful when the module is supported by the selected bundle. Catalog status does not promise runtime behavior.

## Settings and inheritance

Settings live in `engine/modules/art/settings.schema.json`; shipped defaults are in `defaults.json`. Every listed setting is required after resolution unless the schema marks it otherwise.
- `/mode` (type enum; default `"configured"`; allowed "legacy", "configured"): Validated setting; no configured gameplay behavior is promised unless listed in Runtime scope above.
- `/fixedClassAppearance` (type boolean; default `true`): Gear does not replace the class appearance.
- `/fallback` (type string; default `"procedural"`; minLength 1): Procedural stand-in policy; presentation does not determine outcomes.

The exact provenance is recorded in `games/ashenspire/bundles/core/bundle.json`: module defaults are the base, selected bundle settings and `policyBindings` apply next, and the author object applies last. Arrays replace the inherited array. If a field has no bundle binding, its module default is inherited unchanged. `false` disables; `true` selects inherited defaults; null has no removal meaning. Unknown keys and invalid values fail validation.

## Content changes

Core fixed-appearance policy is declared in engine/modules/art/defaults.json. Set `fallback` to the supported stand-in policy or disable art. Stand-ins preserve hitboxes and target geometry; gear does not swap a class sprite.

The referenced pack JSON is gameplay authoring data; it is not executable module code. Keep stable IDs and update every reference when renaming an item.

## Disable behavior, portability and checks

Procedural/low-poly stand-in keeps hitboxes and targets. Art is presentation-only.

The current export requires `ashen.legacy-adapter@1`; it is host-dependent and does not claim a portable rules VM. Unsupported configured modules or values should fail validation rather than silently omit their behavior.

Validate the actual author file with:

```sh
node tools/game-config.mjs validate --input games/ashenspire/game.json
node tools/game-config.mjs check
```

For runtime changes, use the focused tests in `tests/game-profile-run.test.mjs` and the matching module tests. A passing resolver check proves schema/resolution only, not that every host behavior is covered by browser acceptance.
