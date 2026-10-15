# `dialogue` module guide

dialogue is reserved in the module catalog for a future optional feature.

**Status:** Catalog entry only; not selected by the core bundle.
Runtime scope: No configured dialogue adapter is wired. Existing dialogue content and flow remain host-owned.

## Authoring example

Add one override to `games/ashenspire/game.json`; leave other bundled modules inherited:

```json
{
  "formatVersion": 1,
  "core": "ashen.core@1.0.0",
  "modules": {
    "dialogue": false
  }
}
```

The safe explicit setting is `false`. Setting this module to `true` or supplying an object is expected to fail with an unsupported-configured-adapter diagnostic; the catalog schema is not a runtime implementation.

## Settings and inheritance

Settings live in `engine/modules/dialogue/settings.schema.json`; shipped defaults are in `defaults.json`. Every listed setting is required after resolution unless the schema marks it otherwise.
- `/mode` (type enum; default `"configured"`; allowed "legacy", "configured"): Validated setting; no configured gameplay behavior is promised unless listed in Runtime scope above.
- `/enabled` (type boolean; default `true`): Validated setting; no configured gameplay behavior is promised unless listed in Runtime scope above.

The exact provenance is recorded in `games/ashenspire/bundles/core/bundle.json`: module defaults are the base, selected bundle settings and `policyBindings` apply next, and the author object applies last. Arrays replace the inherited array. If a field has no bundle binding, its module default is inherited unchanged. `false` disables; `true` selects inherited defaults; null has no removal meaning. Unknown keys and invalid values fail validation.


## Content changes

No source content file is currently consumed by this module. Do not add content here expecting it to change runtime behavior.

The referenced pack JSON is gameplay authoring data; it is not executable module code. Keep stable IDs and update every reference when renaming an item.

## Disable behavior, portability and checks

When a configured feature is disabled, the host foundation still supplies attack/pass, targeting, turn opportunity and outcome flow. A fallback for a specific feature is described above; disabling a setting must not be used to infer that another optional feature turns on.

The current export requires `ashen.legacy-adapter@1`; it is host-dependent and does not claim a portable rules VM. Unsupported configured modules or values should fail validation rather than silently omit their behavior.

Validate the actual author file with:

```sh
node tools/game-config.mjs validate --input games/ashenspire/game.json
node tools/game-config.mjs check
```

For runtime changes, use the focused tests in `tests/game-profile-run.test.mjs` and the matching module tests. A passing resolver check proves schema/resolution only, not that every host behavior is covered by browser acceptance.
