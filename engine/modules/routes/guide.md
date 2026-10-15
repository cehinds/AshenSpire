# `routes` module guide

Build a deterministic three-act map and provide non-route activities when route generation is off.

**Status:** Listed in `ashen.core@1.0.0`.
Runtime scope: Configured seeded route size, rest placement and route-free activity launcher.

## Authoring example

Add one override to `games/ashenspire/game.json`; leave other bundled modules inherited:

```json
{
  "formatVersion": 1,
  "core": "ashen.core@1.0.0",
  "modules": {
    "routes": false
  }
}
```

The object form below changes only one setting; bundle defaults and other module selections remain:

```json
{
  "modules": { "routes": { "prebossNodes": 8 } }
}
```

That object is only meaningful when the module is supported by the selected bundle. Catalog status does not promise runtime behavior.

## Settings and inheritance

Settings live in `engine/modules/routes/settings.schema.json`; shipped defaults are in `defaults.json`. Every listed setting is required after resolution unless the schema marks it otherwise.
- `/mode` (type enum; default `"configured"`; allowed "legacy", "configured"): Validated setting; no configured gameplay behavior is promised unless listed in Runtime scope above.
- `/acts` (type integer; default `3`; range 1..3): Number of acts; supported range is 1–3.
- `/prebossNodes` (type integer; default `7`; range 1..100): Non-boss nodes per act.
- `/restsPerAct` (type integer; default `2`; range 0..100): Visible rest-node count per act.
- `/hideUnknownNodes` (type boolean; default `true`): Hide unsupported node types in route presentation.
- `/restFloors` (type array; default `[2,6]`; item range 1..1000): Authored rest-node floors; must align with restsPerAct and generated map positions.

The exact provenance is recorded in `games/ashenspire/bundles/core/bundle.json`: module defaults are the base, selected bundle settings and `policyBindings` apply next, and the author object applies last. Arrays replace the inherited array. If a field has no bundle binding, its module default is inherited unchanged. `false` disables; `true` selects inherited defaults; null has no removal meaning. Unknown keys and invalid values fail validation.

## Content changes

games/ashenspire/packs/core/routes.json Adjust acts, pre-boss node count and rest placement in this pack content. A route-free run retains fight, rest and boss entry activities.

The referenced pack JSON is gameplay authoring data; it is not executable module code. Keep stable IDs and update every reference when renaming an item.

## Disable behavior, portability and checks

Route-free activity entry preserves the core fight, rest and boss opportunities.

The current export requires `ashen.legacy-adapter@1`; it is host-dependent and does not claim a portable rules VM. Unsupported configured modules or values should fail validation rather than silently omit their behavior.

Validate the actual author file with:

```sh
node tools/game-config.mjs validate --input games/ashenspire/game.json
node tools/game-config.mjs check
```

For runtime changes, use the focused tests in `tests/game-profile-run.test.mjs` and the matching module tests. A passing resolver check proves schema/resolution only, not that every host behavior is covered by browser acceptance.
