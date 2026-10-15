# `cards` module guide

Build the starter deck, define readable card faces, and control the rest-only Strategize editor. Cards are selected by the full Ashen core.

**Status:** Listed in `ashen.core@1.0.0`.
Runtime scope: Configured starter-card projection, draw/reshuffle policy, deck editor gating and fallback attack/pass. Card behavior still executes through the existing host action interpreter.

## Authoring example

Add one override to `games/ashenspire/game.json`; leave other bundled modules inherited:

```json
{
  "formatVersion": 1,
  "core": "ashen.core@1.0.0",
  "modules": {
    "cards": false
  }
}
```

The object form below changes only one setting; bundle defaults and other module selections remain:

```json
{
  "modules": { "cards": { "faceMaxLines": 4 } }
}
```

That object is only meaningful when the module is supported by the selected bundle. Catalog status does not promise runtime behavior.

## Settings and inheritance

Settings live in `engine/modules/cards/settings.schema.json`; shipped defaults are in `defaults.json`. Every listed setting is required after resolution unless the schema marks it otherwise.
- `/mode` (type enum; default `"configured"`; allowed "legacy", "configured"): Selects configured host adapter behavior.
- `/roundShuffle` (type enum; default `"entireDeck"`; allowed "entireDeck"): Core reshuffles the full deck at round end.
- `/retainHand` (type enum; default `false`; allowed false): Core does not retain the hand across the boundary.
- `/handBase` (type integer; default `4`; range 0..1000000): Base hand before INT; core hand is 4 + INT.
- `/handAttribute` (type enum; default `"intelligence"`; allowed "intelligence"): Attribute added to handBase.
- `/turnPolicy` (type enum; default `"multiCard"`; allowed "multiCard"): Allows multiple card plays then End Turn.
- `/freeCommandLimit` (type integer; default `32`; range 0..1000000): Bound on free commands to prevent runaway loops.
- `/editorEnabled` (type boolean; default `true`): Enables manual deck editing.
- `/editorWhere` (type enum; default `"strategize"`; allowed "strategize"): Deck editing is limited to the Strategize rest service.
- `/faceMaxEffects` (type integer; default `2`; range 0..1000000): Face-display budget, not an execution limit.
- `/faceMaxLines` (type integer; default `3`; range 0..1000000): Approximate readable face-line budget.

The exact provenance is recorded in `games/ashenspire/bundles/core/bundle.json`: module defaults are the base, selected bundle settings and `policyBindings` apply next, and the author object applies last. Arrays replace the inherited array. If a field has no bundle binding, its module default is inherited unchanged. `false` disables; `true` selects inherited defaults; null has no removal meaning. Unknown keys and invalid values fail validation.

## Content changes

games/ashenspire/packs/core/cards.json, starterDeck.json, resourceVariants.json Change card definitions in `cards.json`; change shared copies or the class-special slot in `starterDeck.json`. If a disabled resource changes a card cost, add its explicit `none`, `sp`, `mp`, or `sp,mp` variant in `resourceVariants.json`.

The referenced pack JSON is gameplay authoring data; it is not executable module code. Keep stable IDs and update every reference when renaming an item.

## Disable behavior, portability and checks

false disables the module with a baseline attack/pass + no-card activity fallback. It does not mint a replacement deck.

The current export requires `ashen.legacy-adapter@1`; it is host-dependent and does not claim a portable rules VM. Unsupported configured modules or values should fail validation rather than silently omit their behavior.

Validate the actual author file with:

```sh
node tools/game-config.mjs validate --input games/ashenspire/game.json
node tools/game-config.mjs check
```

For runtime changes, use the focused tests in `tests/game-profile-run.test.mjs` and the matching module tests. A passing resolver check proves schema/resolution only, not that every host behavior is covered by browser acceptance.
