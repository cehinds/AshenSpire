# Mechanics, UI, maps and assets as JSON

**Status:** contract (owner request, 2026-10-17). Extends [ARCHITECTURE.md](ARCHITECTURE.md); it does
not replace it. Modules, bundles, packs and the profile resolver stay as they are. This document
adds four authored layers — **mechanics**, **UI**, **maps**, **assets** — and one compiled output,
the **build artifact**, so the game's rules, screens and content can be ported to Unity or a native
app by reading JSON instead of JavaScript.

## Goals

- **Customizable:** every number, rule, layout and asset reference is JSON a designer edits.
- **Reusable:** a mechanic, component or map node is authored once and referenced by id.
- **Readable:** one folder per mechanic or component, each with a short `guide.md`.
- **Modular:** a mechanic owns its state, exposes an interface, and talks to others only through
  that interface. Modules switch mechanics on and off.
- **Portable:** the build compiles everything into one serialized artifact any engine can load.

## The MVC mapping

| MVC role | JSON layer | Where |
| --- | --- | --- |
| Model | mechanic `model.schema.json` (state a mechanic owns) and pack content (cards, characters, gear) | `engine/mechanics/<slug>/`, `games/<game>/packs/` |
| Service / controller | mechanic `service.json` (declarative rules) + `interface.json` (commands, events, queries) | `engine/mechanics/<slug>/` |
| View model | component `viewModel` (props, bindings to model paths and queries) | `engine/ui/components/<id>.json` |
| View | component layout (existing `content/config/ui`) and screen composition | `content/config/ui/`, `games/<game>/ui/screens/` |
| Assets | catalog of ids → files per tier, derived from `art-manifest.json` | build output `assets` section |

## Layout

```text
engine/
  contracts/                     # JSON schemas for every file below (this milestone)
  runtime/                       # portable rules runtime: ops catalog, formulas, reference interpreter
    ops.json
    formulas.json
    interpreter.mjs              # reference implementation in JS; Unity/C# implements the same spec
    SPEC.md
  mechanics/<slug>/              # one mechanic per tag
    mechanic.json                # manifest
    model.schema.json            # state the mechanic owns, and where it attaches
    interface.json               # commands, events, queries, required mechanics
    service.json                 # handlers: on command/event -> steps
    cases.json                   # behaviour cases the interpreter runs
    guide.md
  modules/<id>/                  # existing feature switches; module.json lists the mechanics it enables
  ui/components/<id>.json        # reusable components: layout ref + view model + states + events
  maps/components/<id>.json      # reusable map parts: node types, route rules
games/<game>/
  ui/screens/<id>.json           # screens composed from components
  maps/<id>.json                 # map definitions built from map components
  packs/…                        # content (unchanged)
tools/build-game.mjs             # compiles everything into dist/build/<game>.build.json
```

## Mechanics

A **mechanic** is the behaviour behind one **tag**. A card, character, gear item, status or relic
that carries the tag gets the mechanic. The tag id is kept exactly (`fx:heal`,
`lifecycle.exhaust`, `maneuver:smash`); the folder **slug** replaces `:` with `_`
(`fx_heal`, `lifecycle.exhaust`, `maneuver_smash`) because `:` is not portable in file paths.

### `mechanic.json`

```json
{
  "id": "fx_heal",
  "tag": "fx:heal",
  "version": "1.0.0",
  "family": "fx",
  "label": "Heal",
  "description": "Restores HP.",
  "attaches": ["card", "character"],
  "files": { "model": "model.schema.json", "interface": "interface.json", "service": "service.json", "cases": "cases.json", "guide": "guide.md" },
  "presentation": { "icon": "heal", "color": "9FC3E8" },
  "portability": "portable",
  "legacy": { "file": "src/engine/actions.js", "symbol": "applyHeal" }
}
```

- `portability`: `portable` when `service.json` fully describes the behaviour with catalog ops;
  `legacy` when the behaviour still lives in JavaScript (`legacy` names where). The build reports
  the portable share so migration progress is measurable.
- `presentation` holds words and hex colours only (no glyphs); `icon` is an asset id.

### `model.schema.json`

JSON Schema (the kernel subset: `type`, `properties`, `required`, `additionalProperties`, `enum`,
`items`, `minimum`, `maximum`) for the state the mechanic owns, plus `"x-attach"`: `entity`,
`card`, `combat`, `run` or `none`.

### `interface.json`

```json
{
  "mechanic": "fx_heal",
  "commands": { "heal": { "params": { "target": "entityRef", "amount": "value" } } },
  "events":   { "healed": { "payload": { "target": "entityRef", "amount": "number" } } },
  "queries":  { "healAmount": { "params": { "target": "entityRef", "pct": "number" }, "returns": "number",
                "value": { "f": "percentMaxHp", "of": "target", "pct": "$pct" } } },
  "listens":  ["card.played"],
  "requires": []
}
```

Other mechanics, UI view models and content reference only these names:
`fx_heal.heal` (command), `fx_heal.healed` (event), `fx_heal.healAmount` (query).

### `service.json`

```json
{
  "mechanic": "fx_heal",
  "handlers": [
    { "on": "command.heal",
      "do": [ { "op": "heal", "target": "$target", "amount": "$amount" },
              { "emit": "fx_heal.healed", "with": { "target": "$target", "amount": "$amount" } } ] }
  ]
}
```

Steps are the **same effect objects cards already use** (`{ "op": "heal", "target": "self", "amount": … }`),
so every card's `effects` array is already valid service code. Values are numbers, `$param`
references, or formula objects (`{ "f": "percentMaxHp", "of": "self", "pct": 10 }`) from the closed
formula set. Control steps:

| Step | Meaning |
| --- | --- |
| `{ "op": "<op>", …params }` | run a catalog op (`engine/runtime/ops.json`) |
| `{ "if": cond, "then": [steps], "else": [steps] }` | branch |
| `{ "forEach": ref, "as": "x", "do": [steps] }` | loop |
| `{ "emit": "<mechanic>.<event>", "with": {…} }` | raise an event |
| `{ "call": "<mechanic>.<command>", "with": {…} }` | invoke another mechanic's command |
| `{ "set": "<model path>", "value": v }` | write this mechanic's own state |

Conditions: `{ "all": [] }`, `{ "any": [] }`, `{ "not": c }`, `{ "cmp": ["<", a, b] }`,
`{ "hasTag": [ref, tag] }`, `{ "hasStatus": [ref, status] }`.

### `cases.json`

```json
[ { "name": "heals and clamps to max HP",
    "given": { "entities": { "self": { "hp": 8, "maxHp": 10 } } },
    "when": { "command": "fx_heal.heal", "with": { "target": "self", "amount": 5 } },
    "then": { "entities": { "self": { "hp": 10 } }, "events": ["fx_heal.healed"] } } ]
```

The reference interpreter runs every case in `npm test`; a Unity port runs the same files.

## UI

A **component** (`engine/ui/components/<id>.json`) is a reusable view with a view model:

```json
{
  "id": "combatTargetHud",
  "layout": { "ref": "content/config/ui/components/combatTargetHud.json" },
  "viewModel": {
    "props": { "entity": "entityRef" },
    "bindings": { "hp": "$entity.pools.hp", "poise": "$entity.poise", "intent": "intent.of($entity)" },
    "visibility": { "query": "enemy_visibility.visibleFields", "fields": { "sp": "sp", "mp": "mp" } }
  },
  "states": ["idle", "selected", "targeted", "defeated"],
  "events": { "tap": "inspect.open" },
  "children": [ { "component": "meter", "props": { "value": "$hp" } } ],
  "assets": []
}
```

A **screen** (`games/<game>/ui/screens/<id>.json`) composes components into the regions of a scene
from `content/config/ui/scenes/`. Layout numbers stay in `content/config/ui` (the existing single
authority); components and screens reference them, never copy them.

## Maps

A **map component** (`engine/maps/components/<id>.json`) defines a node type — combat, elite, rest,
shop, treasure, boss, event — with its icon asset, encounter pool, and placement rules. A **map**
(`games/<game>/maps/<id>.json`) sets the generator (steps, paths, weights) and constraints, and
references environment art and the world atlas (`content/source/worldAtlas.json`).

## Assets

Assets are referenced by **id** everywhere. The asset catalog in the build is derived from
`art-manifest.json` (already generated, never hand-edited), music and fonts: id → file per tier
(placeholder, light, display). No layer stores a path directly.

## Build artifact

`node tools/build-game.mjs` resolves the profile, loads every mechanic, component, screen, map and
asset, validates every cross-reference, and writes **one** deterministic, hashed JSON:

```json
{
  "format": "ashen.build@1",
  "game": "ashenspire", "version": "…", "hash": "sha256:…",
  "profile": { "modules": { … } },
  "tags": { "fx:heal": "fx_heal" },
  "mechanics": { "fx_heal": { "manifest": {…}, "model": {…}, "interface": {…}, "service": {…} } },
  "content": { "cards": […], "characters": […], "gear": […] },
  "ui": { "components": {…}, "screens": {…}, "layout": {…} },
  "maps": { "components": {…}, "maps": {…} },
  "assets": { "catalog": {…} },
  "report": { "mechanics": 0, "portable": 0, "legacy": 0 }
}
```

The web build, a mobile/desktop app and a Unity importer all load this one file. It is a build
output (under `dist/build/`, ignored by git); CI publishes it as an artifact. A committed summary
(`games/<game>/build.summary.json`, counts and hash only) and a `--check` test keep it honest.

## Migration rule

Nothing is duplicated: existing authorities (pack JSON, `content/config/ui`, `content/source/*.csv`,
`art-manifest.json`) stay the single source; the new layers reference them. Behaviour moves from
JavaScript into `service.json` one mechanic at a time; until it does, the mechanic is marked
`legacy` and names its JavaScript home.
