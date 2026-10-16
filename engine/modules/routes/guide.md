# `routes` module guide

Build a deterministic three-act map with a configured route depth, branching lanes, shared rest levels and a boss level. Provide non-route activities when route generation is off.

**Status:** Listed in `ashen.core@1.0.0`.
Runtime scope: Seeded routes with eight levels by default (seven pre-boss levels plus the boss). Each act starts at a single shared Rest node at depth 1, then branches into three lanes. A second shared Rest sits at depth 6; all paths merge at the final boss. Fog of war preserves explored ground and reveals the next choices. Elites and bosses cannot occur before depth 3. Route-free runs retain the activity launcher.

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

The object form below sets route depth and lane count; bundle defaults and other module selections remain:

```json
{
  "modules": { "routes": { "prebossNodes": 7, "branchColumns": 3 } }
}
```

That object is only meaningful when the module is supported by the selected bundle. Catalog status does not promise runtime behavior.

## Settings and inheritance

Settings live in `engine/modules/routes/settings.schema.json`; shipped defaults are in `defaults.json`. Every listed setting is required after resolution unless the schema marks it otherwise.

- `/mode` (type enum; default `"configured"`; allowed "legacy", "configured"): Validated setting; no configured gameplay behavior is promised unless listed in Runtime scope above.
- `/acts` (type integer; default `3`; range 1..3): Number of acts; supported range is 1–3.
- `/prebossNodes` (type integer; default `7`; range 1..100): Non-boss depths per act. Branch alternatives add nodes within a depth, not route levels; the boss adds one final depth.
- `/restsPerAct` (type integer; default `2`; range 0..100): Visible rest-node count per act.
- `/hideUnknownNodes` (type boolean; default `true`): Show the pack's hidden node types (event, fight, treasure and shop by default) as `?` when fog permits the node to be drawn. This does not disable fog.
- `/restFloors` (type array; default `[1,6]`; item range 1..1000): Mandatory shared Rest depths; every path visits both by default. Depth 1 supplies the single entrance. Must contain exactly `restsPerAct` unique pre-boss positions.
- `/branchColumns` (type integer; default `3`; range 2..5): Number of lanes on non-rest pre-boss depths. A shared rest node and the boss merge the lanes.
- `/minimumThreatFloor` (type integer; default `3`; range 1..101): Earliest depth eligible for elites or the final boss. Earlier branching depths draw only non-elite types; the final boss depth (`prebossNodes + 1`) must meet this minimum.
- `/mapMode` (type enum; default `"fog"`; allowed "fog", "path"): Configured route visibility policy. It takes precedence over the viewer's legacy Map reveal setting; `"path"` explicitly draws the whole map.

The exact provenance is recorded in `games/ashenspire/bundles/core/bundle.json`: module defaults are the base, selected bundle settings and `policyBindings` apply next, and the author object applies last. Arrays replace the inherited array. If a field has no bundle binding, its module default is inherited unchanged. `false` disables; `true` selects inherited defaults; null has no removal meaning. Unknown keys and invalid values fail validation.

## Content changes

`games/ashenspire/packs/core/routes.json` defines act/boss content and route shape. By default, each act has eight depths including the boss and 18 nodes: three alternatives at each of five branching pre-boss depths, one shared node at each of two rest depths, and one boss. Changing `prebossNodes` changes the number of pre-boss depths; for example, `5` with rest floors `[2,4]` produces six depths and 12 nodes. Edit `game.json` settings for bound route depth, lane count, rest placement, threat threshold and visibility policy. A route-free run retains fight, rest and boss entry activities.

With the default `mapMode: "fog"`, only the single starting Rest and boss landmark are drawn before the first move. Reaching a node reveals its next choices; reaching the starting Rest also reveals the next Rest landmark, not the route to it. Previously revealed nodes and branches stay visible, including after save/load. Rest, elite and boss types are recognizable only where fog permits them to be drawn; the boss is a landmark from the start, even though its encounter remains at depth 8. Type reveals do not uncover fogged nodes. The legacy `ashen.current` profile retains its existing viewer-setting behavior.

The referenced pack JSON is gameplay authoring data; it is not executable module code. Keep stable IDs and update every reference when renaming an item.

## Disable behavior, portability and checks

Route-free activity entry preserves the core fight, rest and boss opportunities.

The current export requires `ashen.legacy-adapter@1`; it is host-dependent and does not claim a portable rules VM. Unsupported configured modules or values should fail validation rather than silently omit their behavior.

Validate the actual author file with:

```sh
node tools/game-config.mjs validate --input games/ashenspire/game.json
node tools/game-config.mjs check
```

For runtime changes, use the focused tests in `tests/game-profile-map.test.mjs`, `tests/game-profile-run.test.mjs` and `node tools/mapfog.mjs --selftest`. A passing resolver check proves schema/resolution only, not that every host behavior is covered by browser acceptance.
