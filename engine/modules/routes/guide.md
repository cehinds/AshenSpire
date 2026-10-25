# `routes` module guide

Build a deterministic three-act map with a configured route depth, branching lanes, shared rest levels and a boss level. Provide non-route activities when route generation is off.

**Status:** Listed in `ashen.core@2.0.0`.
Runtime scope: Seeded routes with ten levels in Core (nine pre-boss levels plus the boss). Without `maxBranches` depth 1 is a shared opening row. When the bundle sets `maxBranches`, depth 1 is instead one start node that reaches every branch, and the act splits into 1 to `min(maxBranches, distinct bosses)` branches; each branch has its own lanes, its own Rest at every rest depth, at least one elite and its own boss. Without `maxBranches` the older single-trunk shape applies (one shared Rest per rest depth, merged lanes, one boss). Fog of war preserves explored ground and reveals the next choices. Elites and bosses cannot occur before depth 3. Route-free runs retain the activity launcher.

## Authoring example

Add one override to `games/ashenspire/game.json`; leave other bundled modules inherited:

```json
{
  "formatVersion": 1,
  "core": "ashen.core@2.0.0",
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
- `/restFloors` (type array; default `[1,6]`; item range 1..1000): Mandatory shared Rest depths; every path visits both by default. With the default, depth 1 is a Rest and supplies the single entrance. The Core preview route authors `[3,6]` so depth 1 is a fight lane (owner, 2026-10-18). Must contain exactly `restsPerAct` unique pre-boss positions.
- `/branchColumns` (type integer; default `3`; range 2..5): Number of lanes on non-rest pre-boss depths. A shared rest node and the boss merge the lanes. With `maxBranches` it is the lane count of a lone branch, and the board is at most `2 * branchColumns` columns wide: each of `b` branches gets `clamp(floor(2 * branchColumns / b), 1, branchColumns)` lanes.
- `/startNodeRefills` (type boolean; default `true`): With `maxBranches`, the single start node `n1_0` carries `refill: true`, and entering it restores HP to full and refills both flasks (`hpCurrent`/`manaCurrent`). Graphs saved without the field do nothing new.
- `/maxBranches` (type integer; optional, no default; range 1..5): Present turns on branching. The branch count is drawn `1..min(maxBranches, distinct bosses for the seat and act)`, so adding bosses raises the cap without a data edit. The bosses are distinct and each branch gets one, ids `boss_0`..`boss_{b-1}`. Edges after depth 1 never leave a branch. The result carries `bossIds`, `shrineIds` (each branch's pre-boss rest) and `branches`; `bossId` and `shrineId` are the first of each. Drawing the branch count and bosses changes every `map` draw after it, so seeds roll different maps than without the setting. The Core pack authors 5.
- `/minimumThreatFloor` (type integer; default `3`; range 1..101): Earliest depth eligible for elites or the final boss. Earlier branching depths draw only non-elite types; the final boss depth (`prebossNodes + 1`) must meet this minimum.
- `/mapMode` (type enum; default `"fog"`; allowed "fog", "path"): Configured route visibility policy. It takes precedence over the viewer's legacy Map reveal setting; `"path"` explicitly draws the whole map. The Core preview route authors `"path"`, so the whole map is visible from the first screen (owner, 2026-10-18).
- `/firstFloor` (type enum; default `null`; allowed "fight", "event", "treasure", "shop", "elite", null): Node type every lane on depth 1 is forced to, so a run can open on that activity instead of the ordinary draw. `null` leaves depth 1 to the draw. Must be one of the route's alternatives (never `rest` or `boss`); `elite` needs `minimumThreatFloor` of 1; depth 1 must not be in `restFloors`. A forced node is drawn as what it is even when `hideUnknownNodes` would show its type as `?`. Forcing depth 1 skips that depth's `map` stream draws, so every later depth of a seed draws differently from a route without it. The Core preview route authors `"fight"` (owner, 2026-10-18).

The exact provenance is recorded in `games/ashenspire/bundles/core/bundle.json`: module defaults are the base, selected bundle settings and `policyBindings` apply next, and the author object applies last. Arrays replace the inherited array. If a field has no bundle binding, its module default is inherited unchanged. `false` disables; `true` selects inherited defaults; null has no removal meaning. Unknown keys and invalid values fail validation.

## Content changes

`games/ashenspire/packs/core/routes.json` defines act/boss content and route shape. Without `maxBranches`, each act has `prebossNodes + 1` depths: `branchColumns` alternatives at each non-rest depth, one shared node at each rest depth, and one boss. With it (Core), a lone branch has 20 nodes at `branchColumns` 3 and `prebossNodes` 9 (the start node, three lanes on five depths, three rests, one boss); two branches have 39, three have 43 and four have 37, because each branch carries its own lanes and rests. Changing `prebossNodes` changes the number of pre-boss depths; for example, `5` with rest floors `[2,4]` produces six depths and 12 nodes. Edit `game.json` settings for bound route depth, lane count, rest placement, threat threshold and visibility policy. A route-free run retains fight, rest and boss entry activities.

With the default `mapMode: "fog"`, only the single starting Rest and boss landmark are drawn before the first move (the Core preview route instead authors `firstFloor: "fight"` and rests on depths 3 and 6, so a run opens on a fight; owner, 2026-10-18). Reaching a node reveals its next choices; reaching the starting Rest also reveals the next Rest landmark, not the route to it. Previously revealed nodes and branches stay visible, including after save/load. Rest, elite and boss types are recognizable only where fog permits them to be drawn; the boss is a landmark from the start, even though its encounter remains at depth 8. Type reveals do not uncover fogged nodes. The legacy `ashen.current` profile retains its existing viewer-setting behavior.

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

## Mandatory preboss rest

`requirePrebossRest: true` requires `restFloors` to include `prebossNodes`.
The core route keeps the opening fight, a rest at depth 3, and the final rest at
7 before the boss at 8. Each rest depth merges every lane, so every possible
boss predecessor is a shrine. The resolver refuses incompatible overrides
before starting the run; the map generator checks the same invariant.
Older snapshots without this field keep their authored route policy.
