# `reactions` module guide

Provide bounded reaction windows for prepared counters and enemy reactions during core combat.

**Status:** Listed in `ashen.core@1.0.0`.
Runtime scope: The configured core profile resolves reaction windows, prepared Counter replies and reaction-chain bounds through the host combat adapter. `chainLimit` limits ordinary chained reactions; counter-return depth keeps its separate policy cap. Reaction execution remains host-dependent and is not portable rules.

## Authoring example

Add one override to `games/ashenspire/game.json`; leave other bundled modules inherited:

```json
{
  "formatVersion": 1,
  "core": "ashen.core@1.0.0",
  "modules": {
    "reactions": false
  }
}
```

Set this module to `false` to disable configured reaction windows. An object can override the chain bound while retaining the bundle's other settings:

```json
{
  "modules": { "reactions": { "chainLimit": 8 } }
}
```

## Settings and inheritance

Settings live in `engine/modules/reactions/settings.schema.json`; shipped defaults are in `defaults.json`. Every listed setting is required after resolution unless the schema marks it otherwise.
- `/mode` (type enum; default `"configured"`; allowed "legacy", "configured"): Validated setting; no configured gameplay behavior is promised unless listed in Runtime scope above.
- `/chainLimit` (type integer; default `16`; range 0..1000000): Maximum depth for an ordinary chained reaction window. Zero disables reaction-window processing; prepared counter return retains its separate bounded depth.

The exact provenance is recorded in `games/ashenspire/bundles/core/bundle.json`: module defaults are the base, selected bundle settings and `policyBindings` apply next, and the author object applies last. Arrays replace the inherited array. If a field has no bundle binding, its module default is inherited unchanged. `false` disables; `true` selects inherited defaults; null has no removal meaning. Unknown keys and invalid values fail validation.

## Content changes

Reaction payloads and their triggers are authored with combat content. The core Counter card is a prepared reaction: it grants its authored Block, then returns its authored damage when a covered incoming contact arrives. It consumes its prepared charge once; normal configured stance, accuracy, Block and Poise resolution process the return hit. Reaction-tagged cards use the reaction resolver and remain subject to the configured chain limit.

The referenced pack JSON is gameplay authoring data; it is not executable module code. Keep stable IDs and update every reference when renaming an item.

## Disable behavior, portability and checks

Disabling reactions removes prepared reaction windows while preserving the normal action/turn queue. Counter's direct card effects remain resolved by the combat adapter; no reaction may create an unbounded chain.

The current export requires `ashen.legacy-adapter@1`; it is host-dependent and does not claim a portable rules VM. Unsupported configured modules or values should fail validation rather than silently omit their behavior.

Validate the actual author file with:

```sh
node tools/game-config.mjs validate --input games/ashenspire/game.json
node tools/game-config.mjs check
```

For runtime changes, use the focused tests in `tests/game-profile-run.test.mjs` and the matching module tests. A passing resolver check proves schema/resolution only, not that every host behavior is covered by browser acceptance.
