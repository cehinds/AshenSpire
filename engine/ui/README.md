# engine/ui — UI as JSON

Components and screens described as data so a Unity or native port can build the same interface
without reading JavaScript. Contract: `docs/ai/json-game-modules/MECHANICS-ARCHITECTURE.md` (UI
section); schemas in `engine/contracts/ui-component.schema.json` and `ui-screen.schema.json`.

```
engine/ui/components/<id>.json          reusable components (this folder)
engine/ui/index.json                    generated list of component and screen ids
games/<game>/ui/screens/<id>.json       screens composed from components
content/config/ui/                      layout numbers: the single authority, never copied
```

## How the pieces relate

- **Layout** is numbers (sizes, insets, layers, timings). It lives only in `content/config/ui`. A
  component names its file with `layout.ref` and, when it reads one sub-key, `layout.path`
  (dotted, for example `sizing.combatantMeters`). A screen names its scene (`scene.ref`, under
  `scenes/`) and its own layout (`layout.ref`, under `screens/`).
- **View model** is what a component reads. `viewModel.props` are its inputs (name to type or
  reference kind). `viewModel.bindings` map each output field to a model path (`$entity.pools.hp`),
  a query (`intent.of($entity)`), or a formula object. `$name` is a prop or an earlier binding.
  `viewModel.visibility` gates fields by a module query.
- **Component** also lists `states` (named visual states), `events` (UI event to command id, for
  example `tap: "combat.playCard"`), `children` (component plus slot plus props), `assets` (asset
  ids, words only) and `platforms`.
- **Screen** lists `regions`: each places one component in a named slot of the scene or layout,
  with props. Screen `events` map screen-level actions to command ids.

Command ids (`combat.playCard`, `map.pickNode`) and query names (`intent.of`) belong to the
mechanics layer; the UI only names them. Ids are plain words, numbers and dots; no glyphs.

## Enemy visibility

SP, MP and card costs of an enemy appear only through `enemy_visibility.visibleFields`
(`engine/modules/enemy-visibility`). Any component that binds `sp`, `mp`, `cardCosts`, `pools.sp`,
`pools.mp` or `deck.costs` must declare that query in `viewModel.visibility` and list the field; a
component for the player's own resources declares `appliesTo: "player"` instead. The target HUD
shows only the always-visible fields. The validator enforces this.

## Tools

```
node tools/ui-validate.mjs            validate everything, write engine/ui/index.json
node tools/ui-validate.mjs --check    validate and fail if the index is stale
node --test tests/ui-json.test.mjs
```

It checks schemas, that every `layout.ref` and `scene.ref` file exists and every `layout.path`
resolves inside it, that every child and region component exists, ASCII-only text, and the
visibility rule. A component no screen or component uses is a warning.

## Rendering from Unity or a native app

1. Load the build artifact (`ui.components`, `ui.screens`, `ui.layout`) or these files directly.
2. Pick a screen by `route`. Resolve its `scene.ref` and `layout.ref` into the layout table.
3. For each region, instantiate the component into the named slot. Resolve its `layout.ref` and
   `path`, read the numbers, and size and position the native control.
4. Evaluate `viewModel.bindings` against the game model each frame or on change; apply
   `visibility` before showing a field. Pick the visual from the current `states`.
5. Wire each `events` entry to the command id in the rules runtime. Look up `assets` ids in the
   asset catalog for the target tier.
6. Recurse into `children` with their slot and props.
