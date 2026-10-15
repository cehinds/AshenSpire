# Author an Ashen Spire game profile

`games/ashenspire/game.json` is the one small entry point. The shipped file inherits the complete versioned Ashen core; its missing `modules` entries are intentional. Start by editing this file for feature switches and simple rule settings, then edit the referenced core pack JSON for classes, cards, routes, rest content, rewards and shop content.

```json
{
  "formatVersion": 1,
  "core": "ashen.core@1.0.0",
  "modules": {}
}
```

The profile offers the complete Ashen run: four fixed classes, a ten-card starter, SP/MP, configured combat, routes, rest, shops and rewards. A fresh profile can select Reaver; terminal full-run wins or defeats unlock Starseer, Rogue, then Herald. The current title screen offers Continue, New Game, Load Game, Settings and Exit when a valid save exists; Continue selects the newest eligible save, and both save doors disappear when there is none.

## Change one feature

To start a new core run without cards, change just the module entry:

```json
{
  "formatVersion": 1,
  "core": "ashen.core@1.0.0",
  "modules": { "cards": false }
}
```

The profile keeps the foundation's basic attack and pass, and the run uses its cardless activities. A missing bundled module inherits the core selection. `false` disables it. `true` selects the bundle settings. An object recursively overrides settings; arrays replace the inherited array. Unknown properties, unsupported configured modules and invalid settings fail validation. `$comment` is ignored by gameplay resolution.

To change a setting, use the module's schema and guide. For example, change the route node count only if it remains compatible with the selected rest floors:

```json
{
  "formatVersion": 1,
  "core": "ashen.core@1.0.0",
  "modules": { "routes": { "prebossNodes": 8 } }
}
```

For a selected module, settings resolve as module defaults → bundle settings → author object. `policyBindings` then projects the resolved module settings back onto the corresponding selected pack content before runtime use. This means an edit to a bound pack field alone can be replaced by the module's resolved default. For bound values, edit the module setting in `game.json` (or the module/bundle default when changing the shared preset); edit pack files for definitions and fields not owned by a binding. For example, route counts/rest floors are bound to `routes` settings, while route node content remains in `routes.json`.

## Edit game content

- `games/ashenspire/packs/core/classes.json`: six-point attributes, fixed starter equipment and each class special.
- `cards.json`, `starterDeck.json`, and `resourceVariants.json`: shared cards, ten-card starter composition and explicit cost variants for each resource selection.
- `stats.json`: confirmed primary level gains and the hand formula; secondary derived-stat terms still use the host adapter.
- `routes.json`, `rests.json`, `shops.json`, and `rewards.json`: map shape and rest locations, one-service recovery, offer price/counts and reward categories.
- `classUnlocks.json`: initial Reaver and the permanent unlock order.
- `provisionalPolicies.json`: balance details that are still provisional, including combat values not frozen by the product spec.

The pack is data, not executable module code. Preserve stable IDs and update references together. Do not edit `src/content/generated/gameProfiles.js` or `games/ashenspire/game.lock.json` by hand; both are compiler outputs.

## Validate, build and export

From the repository root:

```sh
node tools/game-config.mjs validate --input games/ashenspire/game.json
node tools/game-config.mjs build
node tools/game-config.mjs check
node tools/game-config.mjs export --input games/ashenspire/game.json --out /tmp/ashen-core-resolved.json
```

`validate` resolves the author JSON. `build` regenerates the profile catalog and exact artifact lock. `check` reports stale generated outputs. `export` writes the resolved host-adapter snapshot; `--portable` currently rejects it because gameplay requires `ashen.legacy-adapter@1`. This is not a portable rules package and Unity/Unreal consumers do not yet receive executable engine-neutral gameplay.

Apply a reviewed candidate with `node tools/game-config.mjs apply --input /path/to/candidate.json`. It validates before replacing `game.json`. A new game reads the newly built profile. A running save keeps its profile pin; this version does not hot-unload modules or silently migrate a saved run.

## Current boundaries

The adapter uses the existing host runtime. Its export lock includes source/runtime and profile artifacts, but this is not proof of a portable interpreter or support for every module listed in the catalog. The Ashen bundle's configured behaviors are documented in the individual module guides. Catalog-only future modules and unsupported instance selections fail closed. `presets/current.json` selects the unchanged legacy behavior with no configured module overrides; the legacy profile rejects unsupported module overrides instead of silently ignoring them.

The current work is on `Feature/json-game-modules`. Source slices and headless tests are in progress; full desktop/mobile browser acceptance is still outstanding. Do not describe a pushed feature branch as a deployed preview.
