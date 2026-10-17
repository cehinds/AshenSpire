# Exporting the game to another engine

`node tools/build-game.mjs` compiles every authored JSON layer into one file, `dist/build/<game>.build.json`
(format `ashen.build@1`). A web build, a mobile or desktop app and a Unity project all load that file and
nothing else. It is build output (git-ignored); CI publishes it. Contract: `engine/contracts/build-artifact.schema.json`
and `docs/ai/json-game-modules/MECHANICS-ARCHITECTURE.md`.

```text
node tools/build-game.mjs            write dist/build/ashenspire.build.json + games/ashenspire/build.summary.json
node tools/build-game.mjs --check    build, fail when the committed summary is stale
node --test tests/build-game.test.mjs
```

`--check` is not listed in a fast-check runner on purpose: `tests/build-game.test.mjs` runs it, and
`tests/run-node.mjs` discovers every `*.test.mjs`, so the fast suite already covers it.

## Versioning

- `format` is the shape: `ashen.build@1`. A loader refuses a format it does not know. A breaking change to the
  top-level layout bumps the number.
- `hash` is `sha256:` of the canonical JSON (keys sorted, no whitespace) of the artifact without its `hash` field.
  Same sources, same hash, on every machine; no timestamps. Cache and compare builds by hash.
- `version` is the core version of the game profile; `runtime.specVersion` is a hash of `engine/runtime/SPEC.md`, so a
  port can tell when the rules language it implemented has changed.
- `games/<game>/build.summary.json` (committed) pins hash, byte size and the report counts.

## Top level

| Key | Holds |
| --- | --- |
| `profile` | resolved game profile: `id`, `modules` (switches and their settings), `instances`, `portability` |
| `tags` | tag id to mechanic slug (`"fx:heal": "fx_heal"`) |
| `runtime` | `ops` (the op catalog), `formulas` (the closed formula set), `specVersion` |
| `mechanics` | slug to `{ manifest, model, interface, service, cases }` |
| `content` | all pack content, resolved: cards, characters, gear, enemies, rewards, shops, stats ... |
| `ui` | `components`, `screens`, `layout` (the `content/config/ui` files they reference, keyed by path) |
| `maps` | `components` (node types) and `maps` (one per act) |
| `assets` | `catalog`: asset id to `{ kind, files: { light, high, common }, placeholder? }` |
| `report` | counts and the lists of gaps (below) |

## Load order

1. Read the file, check `format`, recompute `hash` if you want integrity.
2. `runtime.ops` and `runtime.formulas`: build the op table. Refuse to start if a `reference: "portable"` op has no
   implementation (SPEC section 8).
3. `mechanics`: load in sorted slug order (this is the order events reach listeners, SPEC section 6). Index by slug.
4. `tags`: bind each tag to its mechanic. Content carries tags; a tag with no entry is an unbound tag (see `report`).
5. `content`: build cards, characters, gear and enemies. Their effects are data the runtime ops execute.
6. `assets.catalog`, then `ui` and `maps`.

## Rules runtime

`engine/runtime/SPEC.md` is the language; `engine/runtime/interpreter.mjs` is the reference. Implement the state
model, values (`$param`, `$state.x`, formulas), conditions, the steps `op / if / forEach / emit / call / set`, and the
portable ops. A port is correct when every `cases` entry of every `mechanics[slug]` passes. Mechanics with
`manifest.portability` `legacy` name their JavaScript home in `manifest.legacy`; a port reimplements them in its own
code until they are moved into `service`. `data` mechanics have no behaviour (classification tags).

## Tag to mechanic binding

A card, character or gear item that carries `fx:heal` gets `mechanics["fx_heal"]`. Resolve a tag with `tags[tag]`;
call its commands as `slug.command`, listen to `slug.event`, ask `slug.query`. Mechanics talk to each other only through
those names (`interface.requires`, `call`, `emit`); the build has already checked that each target exists.

## Determinism and RNG

- The same state, command and parameters give the same state and events. No clock, no host randomness.
- The only random source is `state.rng.seed`, a 32-bit unsigned integer, advanced by mulberry32 (SPEC section 9).
- Iterate entities in key insertion order and mechanics in sorted slug order.
- The map generator draws from named streams (`generator.seedStream` in `maps.maps.*`); a port keeps one stream per name,
  seeded from the run seed and the name, so adding a draw in one stream never moves another.

## UI view models

`ui.components.<id>` carries `viewModel.props` (inputs), `viewModel.bindings` (model paths and queries, `$entity.pools.hp`),
`states`, `events` (name to command id) and `children`. `ui.screens.<id>` places components in `regions` (slot,
component, props). Render the view model with the engine's own widgets; take sizes, colours and positions from
`ui.layout[path]`. Enemy SP, MP and card costs must only be bound through the `enemy_visibility.visibleFields` query.
`assets` lists logical slots (`card.frame`, `scene.rest`); `report.unresolvedAssets` lists the ones the catalog does not
back yet.

## Assets by id

`assets.catalog.assets[id].files` maps a tier to a path relative to the game's asset root. Tiers: `light`
(mobile), `high` (desktop and web), `common` (one file for all tiers). An entry with `placeholder: true` has no file;
draw the style-guide placeholder from the id. Fall back `tier -> common -> high -> light -> placeholder`.
The id is the path without `assets/` and extension, `/` turned into `.`.

## Report

`report` holds `mechanics portable legacy data portableShare components screens maps assets`, plus the gaps:
`unboundTags` (content tags in a mechanic family with no mechanic), `missingIcons` (mechanic `presentation.icon` ids with
no catalog entry) and `unresolvedAssets` (ui asset slots with no catalog entry). The build fails on a dangling
`requires`, `call` or `emit` target, an unknown screen region or child component, a missing layout file, a map node
without a component, and a map asset id that is not in the catalog.

Unity: see `unity/README.md`.
