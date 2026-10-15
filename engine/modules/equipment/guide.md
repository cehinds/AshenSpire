# `equipment` module guide

Choose fixed class loadouts and control the equipment editor policy.

**Status:** Listed in `ashen.core@1.0.0`.
Runtime scope: Configured starting loadouts/editor policy and equipment-linked card projection; item mechanics remain host-interpreted.

## Authoring example

Add one override to `games/ashenspire/game.json`; leave other bundled modules inherited:

```json
{
  "formatVersion": 1,
  "core": "ashen.core@1.0.0",
  "modules": {
    "equipment": false
  }
}
```

The object form below changes only one setting; bundle defaults and other module selections remain:

```json
{
  "modules": { "equipment": { "editorEnabled": false } }
}
```

That object is only meaningful when the module is supported by the selected bundle. Catalog status does not promise runtime behavior.

## Settings and inheritance

Settings live in `engine/modules/equipment/settings.schema.json`; shipped defaults are in `defaults.json`. Every listed setting is required after resolution unless the schema marks it otherwise.
- `/mode` (type enum; default `"configured"`; allowed "legacy", "configured"): Validated setting; no configured gameplay behavior is promised unless listed in Runtime scope above.
- `/editorEnabled` (type boolean; default `true`): Whether equipment editing is available.
- `/editorWhere` (type string; default `"noncombat"`; minLength 1): Availability policy; timing is independent of rest-only deck editing.
- `/fixedAppearance` (type boolean; default `true`): Keep class appearance fixed when equipment changes.

The exact provenance is recorded in `games/ashenspire/bundles/core/bundle.json`: module defaults are the base, selected bundle settings and `policyBindings` apply next, and the author object applies last. Arrays replace the inherited array. If a field has no bundle binding, its module default is inherited unchanged. `false` disables; `true` selects inherited defaults; null has no removal meaning. Unknown keys and invalid values fail validation.


## Content changes

games/ashenspire/packs/core/classes.json Change `loadout` entries by using equipment IDs present in the host registry. The gear catalog and equipment effect language are still backed by host content.

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
