# `rest` module guide

Offer one durable rest service per visit and recover the character after it commits.

**Status:** Listed in `ashen.core@1.0.0`.
Runtime scope: Configured one-service rest transaction, Strategize/Smith/Level Up, recovery and guards.

## Authoring example

Add one override to `games/ashenspire/game.json`; leave other bundled modules inherited:

```json
{
  "formatVersion": 1,
  "core": "ashen.core@1.0.0",
  "modules": {
    "rest": false
  }
}
```

The object form below changes only one setting; bundle defaults and other module selections remain:

```json
{
  "modules": { "rest": { "services": ["strategize", "levelUp"] } }
}
```

That object is only meaningful when the module is supported by the selected bundle. Catalog status does not promise runtime behavior.

## Settings and inheritance

Settings live in `engine/modules/rest/settings.schema.json`; shipped defaults are in `defaults.json`. Every listed setting is required after resolution unless the schema marks it otherwise.
- `/mode` (type enum; default `"configured"`; allowed "legacy", "configured"): Validated setting; no configured gameplay behavior is promised unless listed in Runtime scope above.
- `/servicesPerVisit` (type enum; default `1`; allowed 1): Current schema fixes this to exactly one service.
- `/services` (type array; default `["strategize","smith","levelUp"]`; minItems 1; items: "strategize", "smith", "levelUp"): Supported service IDs: strategize, smith, levelUp.
- `/allowEmptyStrategize` (type enum; default `true`; allowed true): Allows recovery-only Strategize when there are no cards to edit.
- `/recovery` (type object; default `{"hp":"full","sp":"full","mp":"full","healingFlasks":"full","mpFlasks":"full"}`): Nested recovery policy; core fixes each field to full.
  - `/recovery/hp` (object; default `"full"`; allowed "full"): part of the parent object setting.
  - `/recovery/sp` (object; default `"full"`; allowed "full"): part of the parent object setting.
  - `/recovery/mp` (object; default `"full"`; allowed "full"): part of the parent object setting.
  - `/recovery/healingFlasks` (object; default `"full"`; allowed "full"): part of the parent object setting.
  - `/recovery/mpFlasks` (object; default `"full"`; allowed "full"): part of the parent object setting.

The exact provenance is recorded in `games/ashenspire/bundles/core/bundle.json`: module defaults are the base, selected bundle settings and `policyBindings` apply next, and the author object applies last. Arrays replace the inherited array. If a field has no bundle binding, its module default is inherited unchanged. `false` disables; `true` selects inherited defaults; null has no removal meaning. Unknown keys and invalid values fail validation.

## Content changes

games/ashenspire/packs/core/rests.json Edit service list and recovery policy here. Strategize is the only manual deck editing service; every service restores HP, SP, MP and both flask types.

The referenced pack JSON is gameplay authoring data; it is not executable module code. Keep stable IDs and update every reference when renaming an item.

## Disable behavior, portability and checks

With routes off, the activity launcher still provides a rest opportunity. A configured rest cannot commit multiple services.

The current export requires `ashen.legacy-adapter@1`; it is host-dependent and does not claim a portable rules VM. Unsupported configured modules or values should fail validation rather than silently omit their behavior.

Validate the actual author file with:

```sh
node tools/game-config.mjs validate --input games/ashenspire/game.json
node tools/game-config.mjs check
```

For runtime changes, use the focused tests in `tests/game-profile-run.test.mjs` and the matching module tests. A passing resolver check proves schema/resolution only, not that every host behavior is covered by browser acceptance.
